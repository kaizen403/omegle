/**
 * RTC service facade — 1:1 P2P WebRTC.
 * Callers use preview / join / rebuild / leave / toggle; PeerConnection stays inside.
 */

import { getSocketIOService } from '@/services/socket';
import type { ClientMessage } from '@/types/matchmaking';
import type {
  RtcJoinConfig,
  DeviceIds,
  NetworkQualityLevel,
  RtcParticipant,
  RtcSignal,
  RemoteTrackState,
  RtcConnectionState,
} from './types';
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
      epoch: 0,
      connectionState: 'idle',
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
    const sendSignal = (signal: RtcSignal) => {
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

  /**
   * Replace the peer connection after a signalling reconnect. Left alone if it is still
   * healthy; see PeerManager.rebuild.
   */
  async rebuild(epoch?: number): Promise<void> {
    if (!this.state.isJoined) return;
    await this.peerManager.rebuild(epoch, { onlyIfUnhealthy: true });
  }

  async leave(): Promise<void> {
    this.unsubscribeSignal?.();
    this.unsubscribeSignal = null;
    await this.peerManager.leave();
  }

  isRoomJoined(): boolean {
    return this.state.isJoined;
  }

  getConnectionState(): RtcConnectionState {
    return this.state.connectionState;
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

  /** Unlock the remote audio element; call synchronously inside a user gesture. */
  primeRemoteAudio(): void {
    this.peerManager.primeRemoteAudio();
  }

  resumeRemoteAudio(): void {
    this.peerManager.resumeRemoteAudio();
  }

  playRemoteVideo(_participant: RtcParticipant, elementId: string): void {
    // Only ever the track `ontrack` handed us. A PeerConnection can hold receivers whose
    // transceivers were never negotiated; their tracks are live-but-silent placeholders and
    // attaching one blanks the tile.
    const videoTrack = this.peerManager.getRemoteVideoTrack();
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

  setOnRemoteTrack(callback: (kind: 'audio' | 'video', state: RemoteTrackState) => void): void {
    this.callbacks.onRemoteTrack = callback;
  }

  setOnConnectionState(callback: (state: RtcConnectionState) => void): void {
    this.callbacks.onConnectionState = callback;
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
