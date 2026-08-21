/**
 * RTC service facade — 1:1 P2P WebRTC.
 * Callers use preview / join / leave / toggle; PeerConnection stays inside.
 */

import { getSocketIOService } from '@/services/socket';
import type { ClientMessage, ServerMessage, RTCSignal } from '@/types/matchmaking';
import type { RtcJoinConfig, DeviceIds, NetworkQualityLevel, RtcParticipant } from './types';
import {
  TrackManager,
  PeerManager,
  attachLocalVideo,
  attachRemoteVideo,
  type RtcState,
  type RtcCallbacks,
} from './managers';

function toRtcSignal(signal: RTCSignal): import('./types').RtcSignal | null {
  if (signal.type === 'offer' || signal.type === 'answer') {
    return { type: signal.type, sdp: signal.sdp };
  }
  if (signal.type === 'candidate') {
    return {
      type: 'candidate',
      candidate: signal.candidate,
      sdpMid: signal.sdpMid ?? null,
      sdpMLineIndex: signal.sdpMLineIndex ?? null,
    };
  }
  return null;
}

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
    if (cameraOn && !this.state.localVideoTrack) {
      await this.trackManager.createPreview(true, micOn && !this.state.localAudioTrack);
    } else if (micOn && !this.state.localAudioTrack) {
      await this.trackManager.createPreview(false, true);
    }

    const socket = getSocketIOService();
    const sendSignal = (signal: import('./types').RtcSignal) => {
      const message: ClientMessage = { type: 'signal', data: signal };
      socket.send(message);
    };

    this.unsubscribeSignal = socket.onMessage((message: ServerMessage) => {
      if (message.type !== 'signal') return;
      const parsed = toRtcSignal(message.data as RTCSignal);
      if (parsed) {
        void this.peerManager.handleSignal(parsed);
      }
    });

    await this.peerManager.join(
      config,
      sendSignal,
      cameraOn ? this.state.localVideoTrack : null,
      micOn ? this.state.localAudioTrack : null
    );

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

  playRemoteVideo(_participant: RtcParticipant, elementId: string): void {
    const videoTrack = this.state.peerConnection
      ?.getReceivers()
      .find((receiver) => receiver.track?.kind === 'video')?.track;
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
