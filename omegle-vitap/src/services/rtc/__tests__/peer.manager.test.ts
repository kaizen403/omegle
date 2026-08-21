import { describe, it, expect, vi } from 'vitest';
import { PeerManager } from '@/services/rtc/managers/peer.manager';
import type { RtcState } from '@/services/rtc/managers/types';

function createState(): RtcState {
  return {
    peerConnection: null,
    localVideoTrack: null,
    localAudioTrack: null,
    isJoined: false,
    isLeaving: false,
    isPreviewMode: false,
    isTogglingCamera: false,
    isTogglingMic: false,
    currentNetworkQuality: 'unknown',
    isOfferer: false,
    partnerIdentity: '',
  };
}

function createMockPc() {
  const addedCandidates: RTCIceCandidateInit[] = [];
  const pc = {
    transceivers: [] as Array<{ sender: { replaceTrack: ReturnType<typeof vi.fn> } }>,
    localDescription: null as RTCSessionDescriptionInit | null,
    remoteDescription: null as RTCSessionDescriptionInit | null,
    iceConnectionState: 'new',
    connectionState: 'new',
    onicecandidate: null as ((ev: RTCPeerConnectionIceEvent) => void) | null,
    onnegotiationneeded: null as (() => void) | null,
    ontrack: null as ((ev: RTCTrackEvent) => void) | null,
    oniceconnectionstatechange: null as (() => void) | null,
    onconnectionstatechange: null as (() => void) | null,
    addTransceiver(kind: string) {
      const transceiver = {
        sender: {
          replaceTrack: vi.fn().mockResolvedValue(undefined),
          getParameters: () => ({ encodings: [{}] }),
          setParameters: vi.fn().mockResolvedValue(undefined),
        },
        receiver: { track: null },
        kind,
      };
      this.transceivers.push(transceiver);
      return transceiver;
    },
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' }),
    setLocalDescription: vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
      pc.localDescription = desc;
    }),
    setRemoteDescription: vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
      pc.remoteDescription = desc;
    }),
    addIceCandidate: vi.fn().mockImplementation(async (c: RTCIceCandidateInit) => {
      addedCandidates.push(c);
    }),
    getReceivers: () => [],
    getSenders: () => pc.transceivers.map((t) => t.sender),
    getStats: vi.fn().mockResolvedValue(new Map()),
    restartIce: vi.fn(),
    close: vi.fn(),
  };

  return { pc, addedCandidates };
}

const joinConfig = {
  iceServers: [{ urls: 'stun:stun.example.com:3478' }],
  roomId: 'room-1',
  partnerIdentity: '99',
  localVideoElementId: 'local-video',
  remoteVideoElementId: 'remote-video',
};

describe('PeerManager', () => {
  it('offerer creates an offer; answerer does not', async () => {
    const offererSignals: unknown[] = [];
    const answererSignals: unknown[] = [];
    const offererMock = createMockPc();
    const answererMock = createMockPc();

    const offerer = new PeerManager(createState(), {}, () => offererMock.pc as unknown as RTCPeerConnection);
    const answerer = new PeerManager(createState(), {}, () => answererMock.pc as unknown as RTCPeerConnection);

    await offerer.join({ ...joinConfig, isOfferer: true }, (s) => offererSignals.push(s), null, null);
    await answerer.join({ ...joinConfig, isOfferer: false }, (s) => answererSignals.push(s), null, null);

    expect(offerer.getOffersCreated()).toBe(1);
    expect(offererSignals).toContainEqual({ type: 'offer', sdp: 'offer-sdp' });
    expect(answerer.getOffersCreated()).toBe(0);
    expect(answererMock.pc.createOffer).not.toHaveBeenCalled();

    await offerer.leave();
    await answerer.leave();
  });

  it('queues ICE candidates until remote description is set', async () => {
    const { pc, addedCandidates } = createMockPc();
    const manager = new PeerManager(createState(), {}, () => pc as unknown as RTCPeerConnection);
    const send = vi.fn();

    await manager.join({ ...joinConfig, isOfferer: true }, send, null, null);

    await manager.handleSignal({
      type: 'candidate',
      candidate: 'candidate:1 1 UDP 1 1.1.1.1 9 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });
    expect(addedCandidates).toHaveLength(0);

    await manager.handleSignal({ type: 'answer', sdp: 'answer-sdp' });
    expect(addedCandidates).toHaveLength(1);
    expect(addedCandidates[0].candidate).toContain('1.1.1.1');

    await manager.leave();
  });
});
