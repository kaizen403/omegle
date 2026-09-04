/**
 * RTC service facade — 1:1 P2P WebRTC.
 * Callers use preview / join / leave / toggle; PeerConnection stays inside.
 */

import { getSocketIOService } from '@/services/socket';
import type { ClientMessage } from '@/types/matchmaking';
import type { RtcJoinConfig, DeviceIds, NetworkQualityLevel, RtcParticipant } from './types';
import {
  TrackManager,
  PeerManager,
  attachLocalVideo,
  attachRemoteVideo,
  type RtcState,
  type RtcCallbacks,
} from './managers';
import { attachRtcSignalConsumer, detachRtcSignalConsumer } from './signal-inbox';

export class RtcService {
  private state: RtcState;
  private callbacks: RtcCallbacks = {};
  private trackManager: TrackManager;
  private peerManager: PeerManager;
  private unsubscribeSignal: (() => void) | null = null;

  constructor() {
    this.state = {
      peerConnection: null,
      localVideoTrack: null,
      localAudioTrack: null,
      isJoined: false,
      isLeaving: false,
      isPreviewMode: false,
      isTogglingCamera: false,
      isTogglingMic: false,
      currentCameraId: undefined,
      currentMicId: undefined,
      currentNetworkQuality: 'unknown',
      isOfferer: false,
      partnerIdentity: '',
    };

    this.trackManager = new TrackManager(this.state);
    this.peerManager = new PeerManager(this.state, this.callbacks);
  }

  async createLocalPreview(cameraOn: boolean = true, micOn: boolean = true): Promise<void> {
    await this.trackManager.createPreview(cameraOn, micOn);
  }

  async stopPreview(): Promise<void> {
    await this.trackManager.stopPreview();
  }

  async join(
    config: RtcJoinConfig,
    cameraOn: boolean = true,
    micOn: boolean = true
  ): Promise<void> {
    try {
      if (cameraOn && !this.state.localVideoTrack) {
        await this.trackManager.createPreview(true, micOn && !this.state.localAudioTrack);
      } else if (micOn && !this.state.localAudioTrack) {
        await this.trackManager.createPreview(false, true);
      }
    } catch {
      // Still join so we can receive the peer (same machine / camera in use).
    }

    const socket = getSocketIOService();
    const sendSignal = (signal: import('./types').RtcSignal) => {
      const message: ClientMessage = { type: 'signal', data: signal };
      socket.send(message);
    };

    this.unsubscribeSignal = () => {
      detachRtcSignalConsumer();
    };

    await this.peerManager.join(
      config,
      sendSignal,
      cameraOn ? this.state.localVideoTrack : null,
      micOn ? this.state.localAudioTrack : null
    );

    // After the PC exists so a queued offer is not dropped by handleSignal.
    attachRtcSignalConsumer((signal) => {
      void this.peerManager.handleSignal(signal);
    });

    this.trackManager.updateDeviceIdsFromTracks();
  }

  async leave(): Promise<void> {
    this.unsubscribeSignal?.();
    this.unsubscribeSignal = null;
    await this.peerManager.leave();
  }

  isRoomJoined(): boolean {
    return this.state.isJoined;
  }

  async toggleCamera(enabled: boolean): Promise<void> {
    const track = await this.trackManager.toggleCamera(enabled);
    if (this.state.isJoined) {
      await this.peerManager.replaceVideoTrack(enabled ? track : null);
    }
  }

  async toggleMicrophone(enabled: boolean): Promise<void> {
    const track = await this.trackManager.toggleMicrophone(enabled);
    if (this.state.isJoined) {
      await this.peerManager.replaceAudioTrack(enabled ? track : null);
    }
  }

  async switchCamera(deviceId: string): Promise<void> {
    const track = await this.trackManager.switchCamera(deviceId);
    if (this.state.isJoined) {
      await this.peerManager.replaceVideoTrack(track);
    }
  }

  async switchMicrophone(deviceId: string): Promise<void> {
    const track = await this.trackManager.switchMicrophone(deviceId);
    if (this.state.isJoined) {
      await this.peerManager.replaceAudioTrack(track);
    }
  }

  getCurrentDevices(): DeviceIds {
    return {
      cameraId: this.state.currentCameraId,
      micId: this.state.currentMicId,
    };
  }

  playLocalVideo(elementId: string): void {
    attachLocalVideo(this.state.localVideoTrack, elementId);
  }

  resumeRemoteAudio(): void {
    this.peerManager.resumeRemoteAudio();
  }

  playRemoteVideo(_participant: RtcParticipant, elementId: string): void {
    // Use the track `ontrack` actually handed us rather than re-deriving it.
    //
    // This used to take the first receiver of kind 'video', which is not necessarily the one
    // carrying media: a PeerConnection can hold receivers belonging to transceivers that were
    // never negotiated, and their tracks are live-but-silent placeholders. Picking one of
    // those overwrote the real remote track on the <video> element milliseconds after
    // `ontrack` had attached it correctly, leaving a permanently black remote tile
    // (videoWidth 0) while `inbound-rtp` showed frames decoding.
    const videoTrack =
      this.peerManager.getRemoteVideoTrack() ??
      this.state.peerConnection
        ?.getTransceivers()
        .find(
          (transceiver) =>
            transceiver.mid !== null &&
            transceiver.receiver.track?.kind === 'video' &&
            transceiver.currentDirection !== null &&
            transceiver.currentDirection !== 'inactive' &&
            transceiver.currentDirection !== 'sendonly'
        )?.receiver.track;

    if (videoTrack) {
      attachRemoteVideo(videoTrack, elementId);
    }
  }

  reattachLocalVideo(elementId: string): void {
    if (this.state.localVideoTrack) {
      this.playLocalVideo(elementId);
    }
  }

  getLocalConnectionQuality(): NetworkQualityLevel {
    return this.peerManager.getLocalConnectionQuality();
  }

  getRemoteConnectionQuality(): NetworkQualityLevel {
    return this.peerManager.getRemoteConnectionQuality();
  }

  setOnUserPublished(
    callback: (participant: RtcParticipant, mediaType: 'audio' | 'video') => void
  ): void {
    this.callbacks.onTrackSubscribed = callback;
  }

  setOnUserUnpublished(
    callback: (participant: RtcParticipant, mediaType: 'audio' | 'video') => void
  ): void {
    this.callbacks.onTrackUnsubscribed = callback;
  }

  setOnUserJoined(callback: (participant: RtcParticipant) => void): void {
    this.callbacks.onParticipantConnected = callback;
  }

  setOnUserLeft(callback: (participant: RtcParticipant) => void): void {
    this.callbacks.onParticipantDisconnected = callback;
  }

  setOnConnectionQualityChanged(
    callback: (quality: NetworkQualityLevel, participant: RtcParticipant | null) => void
  ): void {
    this.callbacks.onConnectionQualityChanged = callback;
  }

  getLocalVideoTrack(): MediaStreamTrack | null {
    return this.state.localVideoTrack;
  }

  getLocalAudioTrack(): MediaStreamTrack | null {
    return this.state.localAudioTrack;
  }

  getLocalParticipantIdentity(): string | null {
    return this.state.isJoined ? 'local' : null;
  }
}
