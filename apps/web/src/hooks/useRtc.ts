/**
 * useRtc Hook
 * Manages P2P WebRTC (video/audio) state and operations
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { showError, showWarning, showSuccess, parseMediaError, ErrorCode } from '@/lib/toast';
import { useMediaState } from './useMediaState';
import { analytics } from '@/services/analytics';
import { DEVICE_UPDATE_INTERVAL, DOM_IDS } from '@/constants';
import { primeRemoteAudio, remoteAudio } from '@/services/rtc/managers/remote-audio';
import type { MatchDataMatched } from '@/types/matchmaking';
import type { RtcService } from '@/services/rtc';
import type {
  NetworkQualityLevel,
  RtcParticipant,
  RemoteTrackState,
  RtcConnectionState,
} from '@/services/rtc';

/** What the remote tile should say about the partner's camera. */
export type RemoteCameraStatus = 'connecting' | 'live' | 'off';

/** How long a connected call may stay without video before we call the camera "off". */
const REMOTE_CAMERA_GRACE_MS = 2000;

export function useRtc() {
  const rtcServiceRef = useRef<RtcService | null>(null);
  const isInitializingRef = useRef(false);

  const { isCameraOn, isMicOn, setCameraOn, setMicOn } = useMediaState();

  const [isRTCInitialized, setIsRTCInitialized] = useState(false);
  const [remoteVideoState, setRemoteVideoState] = useState<RemoteTrackState>('none');
  const [remoteAudioState, setRemoteAudioState] = useState<RemoteTrackState>('none');
  const [rtcConnectionState, setRtcConnectionState] = useState<RtcConnectionState>('idle');
  const [remoteCameraStatus, setRemoteCameraStatus] = useState<RemoteCameraStatus>('connecting');
  const [currentCameraId, setCurrentCameraId] = useState<string | undefined>(undefined);
  const [currentMicId, setCurrentMicId] = useState<string | undefined>(undefined);

  const [localNetworkQuality, setLocalNetworkQuality] = useState<NetworkQualityLevel>('unknown');
  const [remoteNetworkQuality, setRemoteNetworkQuality] = useState<NetworkQualityLevel>('unknown');

  useEffect(() => {
    if (remoteVideoState === 'live') {
      setRemoteCameraStatus('live');
      return;
    }
    if (remoteVideoState === 'muted') {
      setRemoteCameraStatus('off');
      return;
    }
    if (rtcConnectionState !== 'connected') {
      setRemoteCameraStatus('connecting');
      return;
    }
    // Connected with no video yet. A track normally unmutes within a few hundred ms of the
    // transport coming up, so anything longer means the partner joined with the camera off.
    const timer = setTimeout(() => setRemoteCameraStatus('off'), REMOTE_CAMERA_GRACE_MS);
    return () => clearTimeout(timer);
  }, [remoteVideoState, rtcConnectionState]);

  const ensureService = useCallback(async (): Promise<RtcService> => {
    if (!rtcServiceRef.current) {
      const { RtcService } = await import('@/services/rtc');
      rtcServiceRef.current = new RtcService();
    }
    return rtcServiceRef.current;
  }, []);

  const resetRemoteState = useCallback(() => {
    setRemoteVideoState('none');
    setRemoteAudioState('none');
    setRtcConnectionState('idle');
    setLocalNetworkQuality('unknown');
    setRemoteNetworkQuality('unknown');
  }, []);

  const syncDevices = useCallback((service: RtcService) => {
    const devices = service.getCurrentDevices();
    if (devices.cameraId) setCurrentCameraId(devices.cameraId);
    if (devices.micId) setCurrentMicId(devices.micId);
  }, []);

  const initializeRTC = useCallback(
    async (
      matchData: MatchDataMatched,
      localVideoElementId: string,
      remoteVideoElementId: string
    ) => {
      if (!matchData.rtcEnabled) {
        setIsRTCInitialized(false);
        return;
      }

      isInitializingRef.current = true;

      try {
        if (rtcServiceRef.current?.isRoomJoined()) {
          await rtcServiceRef.current.leave();
          setIsRTCInitialized(false);
        }

        if (!Array.isArray(matchData.iceServers)) {
          showError(
            'Video service configuration error. Please contact support.',
            ErrorCode.CHANNEL_JOIN_FAILED
          );
          throw new Error('Missing ICE servers');
        }

        if (!matchData.roomId) {
          showError('Invalid session data. Please try again.', ErrorCode.CHANNEL_JOIN_FAILED);
          throw new Error('Missing room id from match data');
        }

        const service = await ensureService();
        const connectionStart = Date.now();
        resetRemoteState();

        service.setOnRemoteTrack((kind, state) => {
          if (kind === 'video') {
            setRemoteVideoState(state);
            return;
          }
          setRemoteAudioState(state);
          if (state === 'live') {
            remoteAudio.resume();
          }
        });

        service.setOnConnectionState((state) => {
          setRtcConnectionState(state);
          if (state === 'connected') {
            analytics.trackRTCConnectionTime(Date.now() - connectionStart);
          }
        });

        service.setOnIceRoute((route) => {
          analytics.trackRTCIceRoute({ ...route, connectTimeMs: Date.now() - connectionStart });
        });

        service.setOnConnectionQualityChanged(
          (quality: NetworkQualityLevel, participant: RtcParticipant | null) => {
            const localIdentity = service.getLocalParticipantIdentity();
            const isLocalParticipant =
              participant === null || participant.identity === localIdentity;
            if (isLocalParticipant) {
              setLocalNetworkQuality(quality);
            } else {
              setRemoteNetworkQuality(quality);
            }
          }
        );

        await service.join(
          {
            iceServers: matchData.iceServers,
            isOfferer: matchData.isOfferer,
            roomId: matchData.roomId,
            partnerIdentity: String(matchData.partnerUid),
            localVideoElementId,
            remoteVideoElementId,
            epoch: matchData.rtcEpoch ?? 0,
          },
          isCameraOn,
          isMicOn
        );

        if (rtcServiceRef.current !== service) {
          throw new Error('RTC service was cleaned up during initialization');
        }

        syncDevices(service);
        analytics.trackRTCJoin();

        if (isCameraOn && document.getElementById(localVideoElementId)) {
          try {
            service.playLocalVideo(localVideoElementId);
          } catch {
            // Video element may not exist yet
          }
        }

        setIsRTCInitialized(true);
      } catch (error) {
        setIsRTCInitialized(false);

        if (rtcServiceRef.current) {
          try {
            await rtcServiceRef.current.leave();
          } catch {
            // Cleanup errors are expected
          }
          rtcServiceRef.current = null;
        }

        const { message, code } = parseMediaError(error);
        showError(message, code);
        throw error;
      } finally {
        isInitializingRef.current = false;
      }
    },
    [ensureService, resetRemoteState, syncDevices, isCameraOn, isMicOn]
  );

  /**
   * Replace the peer connection after a signalling reconnect (ours or the partner's). A
   * connection that is still healthy is left alone.
   */
  const rebuildRTC = useCallback(async (epoch?: number) => {
    const service = rtcServiceRef.current;
    if (!service?.isRoomJoined()) return;
    await service.rebuild(epoch);
  }, []);

  const resumeRemoteAudio = useCallback(() => {
    remoteAudio.resume();
  }, []);

  const prepareLocalMedia = useCallback(async () => {
    // First, and synchronously: this runs inside the Start click, which is the only chance
    // to unlock remote audio on iOS before the partner's track arrives.
    primeRemoteAudio();

    if (!isCameraOn && !isMicOn) {
      return;
    }

    try {
      const service = await ensureService();
      await service.createLocalPreview(isCameraOn, isMicOn);
      syncDevices(service);

      if (isCameraOn) {
        service.reattachLocalVideo(DOM_IDS.LOCAL_VIDEO);
      }
    } catch {
      // Permission denied — text chat still works after match
    }
  }, [ensureService, syncDevices, isCameraOn, isMicOn]);

  const isTogglingCameraRef = useRef(false);

  const toggleCamera = useCallback(async () => {
    if (isTogglingCameraRef.current) {
      return;
    }

    isTogglingCameraRef.current = true;
    const newState = !isCameraOn;
    setCameraOn(newState);

    if (isRTCInitialized && rtcServiceRef.current) {
      try {
        await rtcServiceRef.current.toggleCamera(newState);
        syncDevices(rtcServiceRef.current);
        remoteAudio.resume();
        analytics.trackCameraToggle(newState, 'call');
        showSuccess(newState ? 'Camera on' : 'Camera off');
      } catch (error) {
        const errorStr = String(error);
        if (errorStr.includes('NotAllowedError') || errorStr.includes('PermissionDenied')) {
          const { message } = parseMediaError(error);
          showError(message, ErrorCode.CAMERA_PERMISSION_DENIED);
          setTimeout(() => {
            showWarning('Please allow camera access in your browser settings and try again.');
          }, 1000);
        }
        setCameraOn(!newState);
      } finally {
        isTogglingCameraRef.current = false;
      }
    } else {
      if (newState) {
        try {
          const service = await ensureService();
          await service.createLocalPreview(true, isMicOn);
          syncDevices(service);
          analytics.trackCameraToggle(true, 'preview');
        } catch (error) {
          const errorStr = String(error);
          if (errorStr.includes('NotAllowedError') || errorStr.includes('PermissionDenied')) {
            const { message } = parseMediaError(error);
            showError(message, ErrorCode.CAMERA_PERMISSION_DENIED);
          }
          setCameraOn(false);
        } finally {
          isTogglingCameraRef.current = false;
        }
      } else {
        isTogglingCameraRef.current = false;
      }
    }
  }, [ensureService, syncDevices, isCameraOn, isMicOn, isRTCInitialized, setCameraOn]);

  const isTogglingMicRef = useRef(false);

  const toggleMicrophone = useCallback(async () => {
    if (isTogglingMicRef.current) {
      return;
    }

    isTogglingMicRef.current = true;
    const newState = !isMicOn;
    setMicOn(newState);

    if (isRTCInitialized && rtcServiceRef.current) {
      try {
        await rtcServiceRef.current.toggleMicrophone(newState);
        syncDevices(rtcServiceRef.current);
        remoteAudio.resume();
        analytics.trackMicrophoneToggle(newState, 'call');
        showSuccess(newState ? 'Microphone on' : 'Microphone off');
      } catch (error) {
        const errorStr = String(error);
        if (errorStr.includes('NotAllowedError') || errorStr.includes('PermissionDenied')) {
          const { message, code } = parseMediaError(error);
          showError(message, code);
        }
        setMicOn(!newState);
      } finally {
        isTogglingMicRef.current = false;
      }
    } else {
      if (newState || isCameraOn) {
        try {
          const service = await ensureService();
          await service.createLocalPreview(isCameraOn, newState);
          syncDevices(service);
          analytics.trackMicrophoneToggle(newState, 'preview');
        } catch {
          // Preview mic toggle failed
        } finally {
          isTogglingMicRef.current = false;
        }
      } else {
        isTogglingMicRef.current = false;
      }
    }
  }, [ensureService, syncDevices, isCameraOn, isMicOn, isRTCInitialized, setMicOn]);

  const leaveRTC = useCallback(async () => {
    if (isInitializingRef.current) {
      const maxWait = 3000;
      const startWait = Date.now();
      while (isInitializingRef.current && Date.now() - startWait < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    if (!rtcServiceRef.current) {
      return;
    }

    try {
      // Closes the peer connection only. The local camera and mic stay live and stay
      // attached to the preview, so "Next" does not pay for a second getUserMedia and the
      // camera indicator does not blink between partners.
      await rtcServiceRef.current.leave();
      setIsRTCInitialized(false);
      resetRemoteState();

      if (isCameraOn) {
        rtcServiceRef.current.reattachLocalVideo(DOM_IDS.LOCAL_VIDEO);
      }
    } catch {
      setIsRTCInitialized(false);
    }
  }, [resetRemoteState, isCameraOn]);

  const switchCamera = useCallback(async (deviceId: string) => {
    if (!rtcServiceRef.current) return;

    try {
      await rtcServiceRef.current.switchCamera(deviceId);
      setCurrentCameraId(deviceId);
    } catch (error) {
      const { message, code } = parseMediaError(error);
      showError(message, code);
    }
  }, []);

  const switchMicrophone = useCallback(async (deviceId: string) => {
    if (!rtcServiceRef.current) return;

    try {
      await rtcServiceRef.current.switchMicrophone(deviceId);
      setCurrentMicId(deviceId);
    } catch {
      showError('Failed to switch microphone. Please try again.', ErrorCode.MIC_IN_USE);
    }
  }, []);

  const getCurrentDevices = useCallback(() => {
    return { cameraId: currentCameraId, micId: currentMicId };
  }, [currentCameraId, currentMicId]);

  const reattachLocalVideo = useCallback(
    (elementId: string = DOM_IDS.LOCAL_VIDEO) => {
      if (rtcServiceRef.current && isCameraOn) {
        rtcServiceRef.current.reattachLocalVideo(elementId);
      }
    },
    [isCameraOn]
  );

  useEffect(() => {
    if (!rtcServiceRef.current || !isRTCInitialized) return;

    const updateDeviceIds = () => {
      const devices = rtcServiceRef.current?.getCurrentDevices();
      if (devices) {
        setCurrentCameraId(devices.cameraId);
        setCurrentMicId(devices.micId);
      }
    };

    updateDeviceIds();
    const interval = setInterval(updateDeviceIds, DEVICE_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [isRTCInitialized]);

  useEffect(() => {
    const handleDeviceChange = async () => {
      if (isCameraOn || isMicOn) {
        showWarning('Device change detected. Your camera or microphone may have changed.');
      }
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [isCameraOn, isMicOn]);

  return {
    isCameraOn,
    isMicOn,
    isRTCInitialized,
    isRemoteCameraOn: remoteVideoState === 'live',
    isRemoteMicOn: remoteAudioState === 'live',
    remoteCameraStatus,
    rtcConnectionState,
    localNetworkQuality,
    remoteNetworkQuality,
    initializeRTC,
    rebuildRTC,
    prepareLocalMedia,
    toggleCamera,
    toggleMicrophone,
    switchCamera,
    switchMicrophone,
    getCurrentDevices,
    reattachLocalVideo,
    resumeRemoteAudio,
    leaveRTC,
  };
}
