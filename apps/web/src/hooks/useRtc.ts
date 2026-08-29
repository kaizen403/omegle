/**
 * useRtc Hook
 * Manages P2P WebRTC (video/audio) state and operations
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { showError, showWarning, showSuccess, parseMediaError, ErrorCode } from '@/lib/toast';
import { useMediaState } from './useMediaState';
import { analytics } from '@/services/analytics';
import { RTC_INIT_TIMEOUT, DEVICE_UPDATE_INTERVAL, DOM_IDS } from '@/constants';
import type { MatchDataMatched } from '@/types/matchmaking';
import type { RtcService } from '@/services/rtc';
import type { NetworkQualityLevel, RtcParticipant } from '@/services/rtc';

interface UseRtcOptions {
  onRemoteVideoReady?: (participantId: string) => void;
  onRemoteUserLeft?: (participantId: string) => void;
}

export function useRtc(options: UseRtcOptions = {}) {
  const { onRemoteVideoReady, onRemoteUserLeft } = options;

  const rtcServiceRef = useRef<RtcService | null>(null);
  const isInitializingRef = useRef(false);

  const { isCameraOn, isMicOn, setCameraOn, setMicOn } = useMediaState();

  const [isRTCInitialized, setIsRTCInitialized] = useState(false);
  const [isRemoteCameraOn, setIsRemoteCameraOn] = useState(false);
  const [isRemoteMicOn, setIsRemoteMicOn] = useState(false);
  const hasPreviewRef = useRef(false);
  const [currentCameraId, setCurrentCameraId] = useState<string | undefined>(undefined);
  const [currentMicId, setCurrentMicId] = useState<string | undefined>(undefined);

  const [localNetworkQuality, setLocalNetworkQuality] = useState<NetworkQualityLevel>('unknown');
  const [remoteNetworkQuality, setRemoteNetworkQuality] = useState<NetworkQualityLevel>('unknown');

  const initializeRTC = useCallback(
    async (
      matchData: MatchDataMatched,
      uid: string | number,
      localVideoElementId: string,
      remoteVideoElementId: string
    ) => {
      if (!matchData.rtcEnabled) {
        setIsRTCInitialized(false);
        return;
      }

      const initTimeout = setTimeout(() => {
        showError('Connection timeout. Please check your network.', ErrorCode.CONNECTION_TIMEOUT);
        isInitializingRef.current = false;
      }, RTC_INIT_TIMEOUT);

      try {
        isInitializingRef.current = true;

        if (rtcServiceRef.current?.isRoomJoined()) {
          await rtcServiceRef.current.leave();
          setIsRTCInitialized(false);
        }

        if (!Array.isArray(matchData.iceServers)) {
          clearTimeout(initTimeout);
          showError(
            'Video service configuration error. Please contact support.',
            ErrorCode.CHANNEL_JOIN_FAILED
          );
          throw new Error('Missing ICE servers');
        }

        if (!matchData.roomId) {
          clearTimeout(initTimeout);
          showError('Invalid session data. Please try again.', ErrorCode.CHANNEL_JOIN_FAILED);
          throw new Error('Missing room id from match data');
        }

        const rtcConnectionStart = Date.now();
        const numericUid = typeof uid === 'number' ? uid : parseInt(String(uid), 10);
        const isOfferer =
          typeof matchData.isOfferer === 'boolean'
            ? matchData.isOfferer
            : numericUid < matchData.partnerUid;

        if (!rtcServiceRef.current) {
          const { RtcService } = await import('@/services/rtc');
          rtcServiceRef.current = new RtcService();
        }

        rtcServiceRef.current.setOnUserPublished(
          (participant: RtcParticipant, mediaType: 'audio' | 'video') => {
            if (mediaType === 'video') {
              setIsRemoteCameraOn(true);
              const remoteElement = document.getElementById(remoteVideoElementId);
              if (remoteElement) {
                rtcServiceRef.current?.playRemoteVideo(participant, remoteVideoElementId);
                onRemoteVideoReady?.(participant.identity);
              }
            } else if (mediaType === 'audio') {
              setIsRemoteMicOn(true);
            }
          }
        );

        rtcServiceRef.current.setOnUserUnpublished(
          (_participant: RtcParticipant, mediaType: 'audio' | 'video') => {
            if (mediaType === 'video') {
              setIsRemoteCameraOn(false);
            } else if (mediaType === 'audio') {
              setIsRemoteMicOn(false);
            }
          }
        );

        rtcServiceRef.current.setOnUserLeft((participant: RtcParticipant) => {
          setIsRemoteCameraOn(false);
          setIsRemoteMicOn(false);
          setRemoteNetworkQuality('unknown');
          onRemoteUserLeft?.(participant.identity);
        });

        rtcServiceRef.current.setOnConnectionQualityChanged(
          (quality: NetworkQualityLevel, participant: RtcParticipant | null) => {
            const localIdentity = rtcServiceRef.current?.getLocalParticipantIdentity();
            const isLocalParticipant =
              participant === null || participant.identity === localIdentity;

            if (isLocalParticipant) {
              setLocalNetworkQuality(quality);
            } else {
              setRemoteNetworkQuality(quality);
            }
          }
        );

        await rtcServiceRef.current.join(
          {
            iceServers: matchData.iceServers,
            isOfferer,
            roomId: matchData.roomId,
            partnerIdentity: String(matchData.partnerUid),
            localVideoElementId,
            remoteVideoElementId,
          },
          isCameraOn,
          isMicOn
        );

        if (!rtcServiceRef.current) {
          clearTimeout(initTimeout);
          throw new Error('RTC service was cleaned up during initialization');
        }

        setLocalNetworkQuality(rtcServiceRef.current.getLocalConnectionQuality());
        setRemoteNetworkQuality(rtcServiceRef.current.getRemoteConnectionQuality());

        const devices = rtcServiceRef.current.getCurrentDevices();
        if (devices.cameraId) setCurrentCameraId(devices.cameraId);
        if (devices.micId) setCurrentMicId(devices.micId);

        analytics.trackRTCJoin();
        analytics.trackRTCConnectionTime(Date.now() - rtcConnectionStart);

        if (isCameraOn && rtcServiceRef.current) {
          const localElement = document.getElementById(localVideoElementId);
          if (localElement) {
            try {
              rtcServiceRef.current.playLocalVideo(localVideoElementId);
            } catch {
              // Video element may not exist yet
            }
          }
        }

        setIsRTCInitialized(true);
        clearTimeout(initTimeout);
        isInitializingRef.current = false;
      } catch (error) {
        clearTimeout(initTimeout);
        setIsRTCInitialized(false);
        isInitializingRef.current = false;

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
      }
    },
    [isCameraOn, isMicOn, onRemoteVideoReady, onRemoteUserLeft]
  );

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
        const devices = rtcServiceRef.current.getCurrentDevices();
        if (devices.cameraId) setCurrentCameraId(devices.cameraId);
        rtcServiceRef.current.resumeRemoteAudio();
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
          if (!rtcServiceRef.current) {
            const { RtcService } = await import('@/services/rtc');
            rtcServiceRef.current = new RtcService();
          }

          await rtcServiceRef.current.createLocalPreview(true, isMicOn);
          hasPreviewRef.current = true;

          const devices = rtcServiceRef.current.getCurrentDevices();
          if (devices.cameraId) setCurrentCameraId(devices.cameraId);
          if (devices.micId) setCurrentMicId(devices.micId);

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
  }, [isCameraOn, isMicOn, isRTCInitialized, setCameraOn]);

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
        const devices = rtcServiceRef.current.getCurrentDevices();
        if (devices.micId) setCurrentMicId(devices.micId);
        rtcServiceRef.current.resumeRemoteAudio();
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
          if (!rtcServiceRef.current) {
            const { RtcService } = await import('@/services/rtc');
            rtcServiceRef.current = new RtcService();
          }

          await rtcServiceRef.current.createLocalPreview(isCameraOn, newState);
          hasPreviewRef.current = true;

          const devices = rtcServiceRef.current.getCurrentDevices();
          if (devices.cameraId) setCurrentCameraId(devices.cameraId);
          if (devices.micId) setCurrentMicId(devices.micId);

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
  }, [isCameraOn, isMicOn, isRTCInitialized, setMicOn]);

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

    const wasCameraOn = isCameraOn;
    const wasMicOn = isMicOn;

    try {
      await rtcServiceRef.current.leave();
      hasPreviewRef.current = false;
      setIsRTCInitialized(false);
      setIsRemoteCameraOn(false);
      setIsRemoteMicOn(false);
      setLocalNetworkQuality('unknown');
      setRemoteNetworkQuality('unknown');

      if (wasCameraOn || wasMicOn) {
        setTimeout(async () => {
          try {
            if (!rtcServiceRef.current) {
              const { RtcService } = await import('@/services/rtc');
              rtcServiceRef.current = new RtcService();
            }
            await rtcServiceRef.current.createLocalPreview(wasCameraOn, wasMicOn);
            hasPreviewRef.current = true;

            if (wasCameraOn) {
              rtcServiceRef.current.reattachLocalVideo(DOM_IDS.LOCAL_VIDEO);
            }
          } catch {
            // Preview recreation failed
          }
        }, 100);
      } else {
        setTimeout(() => {
          rtcServiceRef.current = null;
        }, 200);
      }
    } catch {
      setIsRTCInitialized(false);
    }
  }, [isCameraOn, isMicOn]);

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
    isRemoteCameraOn,
    isRemoteMicOn,
    localNetworkQuality,
    remoteNetworkQuality,
    initializeRTC,
    toggleCamera,
    toggleMicrophone,
    switchCamera,
    switchMicrophone,
    getCurrentDevices,
    reattachLocalVideo,
    resumeRemoteAudio: () => {
      rtcServiceRef.current?.resumeRemoteAudio();
    },
    leaveRTC,
  };
}
