/**
 * One RTCPeerConnection per match. Assigned-role signaling, trickle ICE, ICE restart.
 */

import { RTC_CONFIG, getVideoSettingsForNetwork, getAudioSettingsForNetwork } from '../config';
import type { NetworkQuality } from '../config';
import type { RtcJoinConfig, RtcSignal, NetworkQualityLevel, RtcParticipant } from '../types';
import type { RtcState, RtcCallbacks } from './types';
import { attachRemoteVideo, clearMediaElement } from './video-renderer';

export type PeerConnectionFactory = (config: RTCConfiguration) => RTCPeerConnection;
export type SendSignal = (signal: RtcSignal) => void;

const DEFAULT_FACTORY: PeerConnectionFactory = (config) => new RTCPeerConnection(config);

export class PeerManager {
  private sendSignal: SendSignal | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private makingOffer = false;
  private iceRestartInFlight = false;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private audioTransceiver: RTCRtpTransceiver | null = null;
  private videoTransceiver: RTCRtpTransceiver | null = null;
  private remoteVideoElementId = '';
  private unsubscribers: Array<() => void> = [];
  private offersCreated = 0;

  constructor(
    private state: RtcState,
    private callbacks: RtcCallbacks,
    private peerConnectionFactory: PeerConnectionFactory = DEFAULT_FACTORY
  ) {}

  getOffersCreated(): number {
    return this.offersCreated;
  }

  async join(
    config: RtcJoinConfig,
    sendSignal: SendSignal,
    cameraTrack: MediaStreamTrack | null,
    micTrack: MediaStreamTrack | null
  ): Promise<void> {
    if (this.state.isJoined) return;
    if (this.state.isLeaving) {
      throw new Error('Cannot join while leaving another session');
    }

    this.sendSignal = sendSignal;
    this.state.isOfferer = config.isOfferer;
    this.state.partnerIdentity = config.partnerIdentity;
    this.remoteVideoElementId = config.remoteVideoElementId;
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
    this.offersCreated = 0;

    const pc = this.peerConnectionFactory({
      iceServers: config.iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
    });
    this.state.peerConnection = pc;

    this.audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
    this.videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });

    if (micTrack) {
      await this.audioTransceiver.sender.replaceTrack(micTrack);
    }
    if (cameraTrack) {
      await this.videoTransceiver.sender.replaceTrack(cameraTrack);
    }

    this.bindPeerEvents(pc);

    this.state.isJoined = true;
    this.startStatsLoop();

    if (config.isOfferer) {
      await this.createAndSendOffer();
    }
  }

  async handleSignal(signal: RtcSignal): Promise<void> {
    const pc = this.state.peerConnection;
    if (!pc || this.state.isLeaving) return;

    if (signal.type === 'offer') {
      if (this.state.isOfferer) return;
      await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      this.remoteDescriptionSet = true;
      await this.flushCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (answer.sdp) {
        this.sendSignal?.({ type: 'answer', sdp: answer.sdp });
      }
      return;
    }

    if (signal.type === 'answer') {
      if (!this.state.isOfferer) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      this.remoteDescriptionSet = true;
      await this.flushCandidates(pc);
      return;
    }

    const candidate: RTCIceCandidateInit = {
      candidate: signal.candidate,
      sdpMid: signal.sdpMid,
      sdpMLineIndex: signal.sdpMLineIndex,
    };

    if (!this.remoteDescriptionSet) {
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // Stale candidate after rollback / restart
    }
  }

  async replaceVideoTrack(track: MediaStreamTrack | null): Promise<void> {
    await this.videoTransceiver?.sender.replaceTrack(track);
  }

  async replaceAudioTrack(track: MediaStreamTrack | null): Promise<void> {
    await this.audioTransceiver?.sender.replaceTrack(track);
  }

  resumeRemoteAudio(): void {
    if (!this.audioElement) return;
    void this.audioElement.play().catch(() => {
      // Still waiting for a user gesture
    });
  }

  async applyBitrate(quality: NetworkQuality): Promise<void> {
    const video = getVideoSettingsForNetwork(quality);
    const audio = getAudioSettingsForNetwork(quality);
    await this.setSenderBitrate(this.videoTransceiver?.sender, video.maxBitrate);
    await this.setSenderBitrate(this.audioTransceiver?.sender, audio.maxBitrate);
  }

  getLocalConnectionQuality(): NetworkQualityLevel {
    return this.state.currentNetworkQuality;
  }

  getRemoteConnectionQuality(): NetworkQualityLevel {
    return this.state.currentNetworkQuality;
  }

  async leave(): Promise<void> {
    if (!this.state.isJoined || this.state.isLeaving) return;
    this.state.isLeaving = true;
    this.clearTimers();
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    try {
      await this.audioTransceiver?.sender.replaceTrack(null);
      await this.videoTransceiver?.sender.replaceTrack(null);
    } catch {
      // Closing
    }

    this.state.peerConnection?.close();
    this.state.peerConnection = null;
    this.audioTransceiver = null;
    this.videoTransceiver = null;
    this.remoteDescriptionSet = false;
    this.pendingCandidates = [];
    this.sendSignal = null;

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement.remove();
      this.audioElement = null;
    }
    if (this.remoteVideoElementId) {
      clearMediaElement(this.remoteVideoElementId);
    }

    this.state.isJoined = false;
    this.state.isLeaving = false;
    this.state.isPreviewMode = false;
    this.state.currentNetworkQuality = 'unknown';
  }

  private bindPeerEvents(pc: RTCPeerConnection): void {
    pc.onicecandidate = (event) => {
      if (!event.candidate || !event.candidate.candidate) return;
      this.sendSignal?.({
        type: 'candidate',
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    };

    pc.onnegotiationneeded = () => {
      if (!this.state.isOfferer || this.makingOffer || !this.state.isJoined) return;
      if (this.offersCreated > 0) return;
      void this.createAndSendOffer();
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const participant: RtcParticipant = { identity: this.state.partnerIdentity };
      const kind = track.kind === 'video' ? 'video' : 'audio';

      if (kind === 'video') {
        attachRemoteVideo(track, this.remoteVideoElementId);
      } else {
        this.attachRemoteAudio(track);
      }

      const publishIfLive = () => {
        if (track.readyState === 'ended' || track.muted) {
          this.callbacks.onTrackUnsubscribed?.(participant, kind);
          return;
        }
        this.callbacks.onTrackSubscribed?.(participant, kind);
      };

      publishIfLive();
      track.addEventListener('unmute', () => {
        if (kind === 'audio') this.resumeRemoteAudio();
        publishIfLive();
      });
      track.addEventListener('mute', publishIfLive);
      track.addEventListener('ended', () => {
        this.callbacks.onTrackUnsubscribed?.(participant, kind);
      });
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      if (iceState === 'failed') {
        void this.restartIce();
      } else if (iceState === 'disconnected') {
        this.scheduleIceRestart();
      } else if (iceState === 'connected' || iceState === 'completed') {
        this.clearDisconnectTimer();
        this.callbacks.onParticipantConnected?.({ identity: this.state.partnerIdentity });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.callbacks.onParticipantDisconnected?.({ identity: this.state.partnerIdentity });
      }
    };
  }

  private async createAndSendOffer(iceRestart = false): Promise<void> {
    const pc = this.state.peerConnection;
    if (!pc || !this.state.isOfferer) return;
    if (this.makingOffer) return;

    this.makingOffer = true;
    try {
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      this.offersCreated += 1;
      if (offer.sdp) {
        this.sendSignal?.({ type: 'offer', sdp: offer.sdp });
      }
    } finally {
      this.makingOffer = false;
    }
  }

  private async restartIce(): Promise<void> {
    if (!this.state.isOfferer || this.iceRestartInFlight || !this.state.peerConnection) return;
    this.iceRestartInFlight = true;
    try {
      this.state.peerConnection.restartIce();
      await this.createAndSendOffer(true);
    } finally {
      this.iceRestartInFlight = false;
    }
  }

  private scheduleIceRestart(): void {
    this.clearDisconnectTimer();
    this.disconnectTimer = setTimeout(() => {
      const state = this.state.peerConnection?.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') {
        void this.restartIce();
      }
    }, RTC_CONFIG.ICE_DISCONNECT_MS);
  }

  private clearDisconnectTimer(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  private async flushCandidates(pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore expired candidates
      }
    }
  }

  private attachRemoteAudio(track: MediaStreamTrack): void {
    if (!this.audioElement) {
      this.audioElement = document.createElement('audio');
      this.audioElement.autoplay = true;
      this.audioElement.style.display = 'none';
      document.body.appendChild(this.audioElement);
    }
    this.audioElement.srcObject = new MediaStream([track]);
    void this.audioElement.play().catch(() => {
      // Autoplay may be blocked
    });
  }

  private startStatsLoop(): void {
    this.clearStatsTimer();
    this.statsTimer = setInterval(() => {
      void this.pollStats();
    }, RTC_CONFIG.STATS_INTERVAL_MS);
  }

  private async pollStats(): Promise<void> {
    const pc = this.state.peerConnection;
    if (!pc) return;

    try {
      const stats = await pc.getStats();
      let rtt = 0;
      let fractionLost = 0;
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const pair = report as RTCIceCandidatePairStats & { currentRoundTripTime?: number };
          if (typeof pair.currentRoundTripTime === 'number') {
            rtt = pair.currentRoundTripTime * 1000;
          }
        }
        if (report.type === 'inbound-rtp') {
          const inbound = report as RTCInboundRtpStreamStats & { fractionLost?: number };
          if (typeof inbound.fractionLost === 'number') {
            fractionLost = Math.max(fractionLost, inbound.fractionLost);
          }
        }
      });

      let quality: NetworkQualityLevel = 'unknown';
      if (rtt || fractionLost) {
        if (rtt < 150 && fractionLost < 0.02) quality = 'excellent';
        else if (rtt < 300 && fractionLost < 0.05) quality = 'good';
        else quality = 'poor';
      }

      if (quality !== 'unknown' && quality !== this.state.currentNetworkQuality) {
        this.state.currentNetworkQuality = quality;
        void this.applyBitrate(quality);
        this.callbacks.onConnectionQualityChanged?.(quality, {
          identity: this.state.partnerIdentity,
        });
      }
    } catch {
      // getStats not available in tests / closed PC
    }
  }

  private async setSenderBitrate(
    sender: RTCRtpSender | undefined,
    maxBitrate: number
  ): Promise<void> {
    if (!sender) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{ maxBitrate }];
      } else {
        params.encodings[0].maxBitrate = maxBitrate;
      }
      await sender.setParameters(params);
    } catch {
      // setParameters unsupported
    }
  }

  private clearStatsTimer(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearDisconnectTimer();
    this.clearStatsTimer();
  }
}
