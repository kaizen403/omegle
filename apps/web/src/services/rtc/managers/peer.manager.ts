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

  /**
   * The local tracks this side wants to send. Held here because the answerer cannot attach
   * them until the offer has been applied (see `adoptNegotiatedTransceivers`), and because a
   * camera/mic toggle can land before that happens.
   */
  private localAudioTrack: MediaStreamTrack | null = null;
  private localVideoTrack: MediaStreamTrack | null = null;

  /** The remote video track handed to us by `ontrack`, so nothing has to guess it later. */
  private remoteVideoTrack: MediaStreamTrack | null = null;

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

    this.localAudioTrack = micTrack;
    this.localVideoTrack = cameraTrack;
    this.audioTransceiver = null;
    this.videoTransceiver = null;
    this.remoteVideoTrack = null;

    // Only the offerer creates transceivers up front, and doing so is what fixes the bug
    // this whole path used to have.
    //
    // Both sides used to call addTransceiver('audio'|'video', sendrecv) before signalling.
    // On the answerer that is silently wrong: when setRemoteDescription applies the offer,
    // Chrome does NOT associate the offer's m-sections with transceivers created by a bare
    // addTransceiver() — it only reuses ones created by addTrack(). So it built two *new*
    // recvonly transceivers, answered `a=recvonly` on both m-lines, and left the answerer's
    // camera and mic attached to two transceivers that were never negotiated (mid === null).
    //
    // The call still "connected": ICE succeeded, the offerer's media flowed, and the
    // answerer's tile filled in. But the answerer sent nothing, in either direction of the
    // UI's understanding — the offerer's `inbound-rtp` stayed empty forever. That is exactly
    // the "he can't see or hear me even though my camera and mic are on" report.
    //
    // The answerer now waits for the offer and adopts the transceivers Chrome actually
    // negotiated (see `adoptNegotiatedTransceivers`).
    if (config.isOfferer) {
      this.audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      this.videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      await this.audioTransceiver.sender.replaceTrack(micTrack);
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
      // Must happen before createAnswer, or the answer goes out as recvonly and this side
      // never sends a single RTP packet.
      await this.adoptNegotiatedTransceivers(pc);
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
    // Remembered so a toggle that lands before the offer arrives is still applied when the
    // answerer adopts its transceivers.
    this.localVideoTrack = track;
    const hadTrack = Boolean(this.videoTransceiver?.sender.track);
    await this.videoTransceiver?.sender.replaceTrack(track);
    if (track && !hadTrack) {
      await this.renegotiateAfterAddingTrack();
    }
  }

  async replaceAudioTrack(track: MediaStreamTrack | null): Promise<void> {
    this.localAudioTrack = track;
    const hadTrack = Boolean(this.audioTransceiver?.sender.track);
    await this.audioTransceiver?.sender.replaceTrack(track);
    if (track && !hadTrack) {
      await this.renegotiateAfterAddingTrack();
    }
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
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.remoteVideoTrack = null;
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
        this.remoteVideoTrack = track;
        attachRemoteVideo(track, this.remoteVideoElementId);
      } else {
        this.attachRemoteAudio(track);
      }

      const publishIfLive = () => {
        // Remote tracks start muted until the first RTP packet. Treating
        // `muted` as unpublished hides a live video behind the avatar overlay.
        if (track.readyState === 'ended') {
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
      track.addEventListener('ended', () => {
        if (kind === 'video' && this.remoteVideoTrack === track) {
          this.remoteVideoTrack = null;
        }
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

  private async renegotiateAfterAddingTrack(): Promise<void> {
    // Only the offerer may renegotiate. The answerer does not need to: its transceivers are
    // negotiated as sendrecv regardless of whether it had a track at answer time, so turning
    // a camera on later is just a replaceTrack on an already-live sender.
    if (!this.state.isOfferer) return;
    await this.createAndSendOffer();
  }

  /**
   * Adopt the transceivers the browser created while applying a remote offer.
   *
   * Chrome builds one transceiver per m-section and gives them the reciprocal direction
   * (`recvonly` against a `sendrecv` offer). Left alone, the answer says recvonly and this
   * side never sends. Forcing them back to sendrecv and attaching the local tracks is what
   * makes the call two-way.
   *
   * Idempotent: a later renegotiation offer runs through here again and simply re-confirms.
   */
  private async adoptNegotiatedTransceivers(pc: RTCPeerConnection): Promise<void> {
    const negotiated = (kind: 'audio' | 'video') =>
      pc.getTransceivers().find((t) => t.mid !== null && t.receiver.track?.kind === kind) ?? null;

    this.audioTransceiver = negotiated('audio') ?? this.audioTransceiver;
    this.videoTransceiver = negotiated('video') ?? this.videoTransceiver;

    for (const transceiver of [this.audioTransceiver, this.videoTransceiver]) {
      if (!transceiver) continue;
      try {
        if (transceiver.direction !== 'sendrecv') {
          transceiver.direction = 'sendrecv';
        }
      } catch {
        // Transceiver stopped mid-negotiation; the next offer will rebuild it.
      }
    }

    try {
      await this.audioTransceiver?.sender.replaceTrack(this.localAudioTrack);
    } catch {
      // Mic unavailable — stay in the call and keep receiving.
    }
    try {
      await this.videoTransceiver?.sender.replaceTrack(this.localVideoTrack);
    } catch {
      // Camera unavailable — stay in the call and keep receiving.
    }
  }

  /** The live remote video track, as reported by `ontrack`. */
  getRemoteVideoTrack(): MediaStreamTrack | null {
    return this.remoteVideoTrack;
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
      this.audioElement.setAttribute('playsinline', 'true');
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
