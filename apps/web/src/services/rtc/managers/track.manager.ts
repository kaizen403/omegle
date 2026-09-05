/**
 * Local camera / microphone tracks via getUserMedia.
 * Preview stays off the PeerConnection.
 */

import { RTC_CONFIG } from '../config';
import { attachLocalVideo } from './video-renderer';
import type { RtcState } from './types';

export class TrackManager {
  constructor(private state: RtcState) {}

  async createVideoTrack(): Promise<MediaStreamTrack> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: RTC_CONFIG.VIDEO.resolution.width },
        height: { ideal: RTC_CONFIG.VIDEO.resolution.height },
        frameRate: { ideal: RTC_CONFIG.VIDEO.resolution.frameRate },
        ...(this.state.currentCameraId ? { deviceId: { exact: this.state.currentCameraId } } : {}),
      },
    });
    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error('DEVICE_NOT_FOUND: No camera device found');
    }
    try {
      // A talking head: keep motion smooth under a tight bitrate rather than chasing detail.
      track.contentHint = 'motion';
    } catch {
      // Not supported
    }
    return track;
  }

  async createAudioTrack(): Promise<MediaStreamTrack> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: RTC_CONFIG.AUDIO.echoCancellation,
        noiseSuppression: RTC_CONFIG.AUDIO.noiseSuppression,
        autoGainControl: RTC_CONFIG.AUDIO.autoGainControl,
        ...(this.state.currentMicId ? { deviceId: { exact: this.state.currentMicId } } : {}),
      },
    });
    const track = stream.getAudioTracks()[0];
    if (!track) {
      throw new Error('DEVICE_NOT_FOUND: No microphone device found');
    }
    return track;
  }

  async createPreview(cameraOn: boolean = true, micOn: boolean = true): Promise<void> {
    if (this.state.isJoined) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some((d) => d.kind === 'videoinput');
    const hasMic = devices.some((d) => d.kind === 'audioinput');

    if (cameraOn && !hasCamera) {
      throw new Error('DEVICE_NOT_FOUND: No camera device found');
    }
    if (micOn && !hasMic) {
      throw new Error('DEVICE_NOT_FOUND: No microphone device found');
    }

    if (cameraOn && !this.state.localVideoTrack) {
      this.state.localVideoTrack = await this.createVideoTrack();
    }

    if (micOn && !this.state.localAudioTrack) {
      this.state.localAudioTrack = await this.createAudioTrack();
    }

    this.state.isPreviewMode = true;
    this.updateDeviceIdsFromTracks();
  }

  async stopPreview(): Promise<void> {
    if (this.state.isJoined) return;
    this.stopAllTracks();
    this.state.isPreviewMode = false;
  }

  async toggleCamera(enabled: boolean): Promise<MediaStreamTrack | null> {
    if (this.state.isLeaving || this.state.isTogglingCamera) {
      return this.state.localVideoTrack;
    }

    this.state.isTogglingCamera = true;

    try {
      if (enabled) {
        if (!this.state.localVideoTrack) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (!devices.some((d) => d.kind === 'videoinput')) {
            throw new Error('DEVICE_NOT_FOUND: No camera found');
          }
          this.state.localVideoTrack = await this.createVideoTrack();
        }
        attachLocalVideo(this.state.localVideoTrack, 'local-video');
      } else if (this.state.localVideoTrack) {
        this.state.localVideoTrack.stop();
        this.state.localVideoTrack = null;
      }
      this.updateDeviceIdsFromTracks();
      return this.state.localVideoTrack;
    } catch (error) {
      if (this.state.localVideoTrack) {
        this.state.localVideoTrack.stop();
        this.state.localVideoTrack = null;
      }
      throw error;
    } finally {
      this.state.isTogglingCamera = false;
    }
  }

  async toggleMicrophone(enabled: boolean): Promise<MediaStreamTrack | null> {
    if (this.state.isLeaving || this.state.isTogglingMic) {
      return this.state.localAudioTrack;
    }

    this.state.isTogglingMic = true;

    try {
      if (enabled) {
        if (!this.state.localAudioTrack) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (!devices.some((d) => d.kind === 'audioinput')) {
            throw new Error('DEVICE_NOT_FOUND: No microphone found');
          }
          this.state.localAudioTrack = await this.createAudioTrack();
        }
      } else if (this.state.localAudioTrack) {
        this.state.localAudioTrack.stop();
        this.state.localAudioTrack = null;
      }
      this.updateDeviceIdsFromTracks();
      return this.state.localAudioTrack;
    } catch (error) {
      if (this.state.localAudioTrack) {
        this.state.localAudioTrack.stop();
        this.state.localAudioTrack = null;
      }
      throw error;
    } finally {
      this.state.isTogglingMic = false;
    }
  }

  async switchCamera(deviceId: string): Promise<MediaStreamTrack | null> {
    if (this.state.isLeaving) return this.state.localVideoTrack;
    this.state.currentCameraId = deviceId;

    if (this.state.localVideoTrack) {
      this.state.localVideoTrack.stop();
      this.state.localVideoTrack = await this.createVideoTrack();
      attachLocalVideo(this.state.localVideoTrack, 'local-video');
    }

    return this.state.localVideoTrack;
  }

  async switchMicrophone(deviceId: string): Promise<MediaStreamTrack | null> {
    if (this.state.isLeaving) return this.state.localAudioTrack;
    this.state.currentMicId = deviceId;

    if (this.state.localAudioTrack) {
      this.state.localAudioTrack.stop();
      this.state.localAudioTrack = await this.createAudioTrack();
    }

    return this.state.localAudioTrack;
  }

  updateDeviceIdsFromTracks(): void {
    try {
      if (this.state.localVideoTrack) {
        const deviceId = this.state.localVideoTrack.getSettings().deviceId;
        if (deviceId) this.state.currentCameraId = deviceId;
      }
      if (this.state.localAudioTrack) {
        const deviceId = this.state.localAudioTrack.getSettings().deviceId;
        if (deviceId) this.state.currentMicId = deviceId;
      }
    } catch {
      // Device settings may be unavailable
    }
  }

  stopAllTracks(): void {
    if (this.state.localVideoTrack) {
      this.state.localVideoTrack.stop();
      this.state.localVideoTrack = null;
    }
    if (this.state.localAudioTrack) {
      this.state.localAudioTrack.stop();
      this.state.localAudioTrack = null;
    }
  }
}
