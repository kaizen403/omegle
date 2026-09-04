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
    addTransceiver(kind: string, init?: { direction?: string }) {
      const transceiver = {
        sender: {
          track: null as unknown,
          replaceTrack: vi.fn().mockImplementation(async (t: unknown) => {
            transceiver.sender.track = t;
          }),
          getParameters: () => ({ encodings: [{}] }),
          setParameters: vi.fn().mockResolvedValue(undefined),
        },
        // A transceiver created locally has no mid until it has been negotiated. That is
        // exactly what made the old answerer path broken and invisible.
        mid: null as string | null,
        direction: init?.direction ?? 'sendrecv',
        currentDirection: null as string | null,
        receiver: { track: { kind } },
        kind,
      };
      this.transceivers.push(transceiver);
      return transceiver;
    },
    getTransceivers() {
      return pc.transceivers;
    },
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' }),
    setLocalDescription: vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
      pc.localDescription = desc;
    }),
    setRemoteDescription: vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
      pc.remoteDescription = desc;
      if (desc.type !== 'offer') return;
      // Chrome does not associate an incoming offer's m-sections with transceivers created
      // by a bare addTransceiver(); it appends new ones, reciprocal to the offer. Modelling
      // that here is the whole point of this mock.
      ['audio', 'video'].forEach((kind, index) => {
        const transceiver = pc.addTransceiver(kind, { direction: 'recvonly' }) as unknown as {
          mid: string | null;
        };
        transceiver.mid = String(index);
      });
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

    const offerer = new PeerManager(
      createState(),
      {},
      () => offererMock.pc as unknown as RTCPeerConnection
    );
    const answerer = new PeerManager(
      createState(),
      {},
      () => answererMock.pc as unknown as RTCPeerConnection
    );

    await offerer.join(
      { ...joinConfig, isOfferer: true },
      (s) => offererSignals.push(s),
      null,
      null
    );
    await answerer.join(
      { ...joinConfig, isOfferer: false },
      (s) => answererSignals.push(s),
      null,
      null
    );

    expect(offerer.getOffersCreated()).toBe(1);
    expect(offererSignals).toContainEqual({ type: 'offer', sdp: 'offer-sdp' });
    expect(answerer.getOffersCreated()).toBe(0);
    expect(answererMock.pc.createOffer).not.toHaveBeenCalled();

    await offerer.leave();
    await answerer.leave();
  });

  it('answerer answers sendrecv and attaches its own tracks to the negotiated transceivers', async () => {
    // Regression: the answerer used to pre-create transceivers with addTransceiver(). Chrome
    // ignored them when applying the offer, so the answer went out as recvonly and this side
    // never sent a packet — the partner saw a black tile and heard nothing, while the call
    // still reported itself connected.
    const { pc } = createMockPc();
    const send = vi.fn();
    const manager = new PeerManager(createState(), {}, () => pc as unknown as RTCPeerConnection);

    const micTrack = { kind: 'audio' } as unknown as MediaStreamTrack;
    const cameraTrack = { kind: 'video' } as unknown as MediaStreamTrack;

    await manager.join({ ...joinConfig, isOfferer: false }, send, cameraTrack, micTrack);

    // Nothing is created before the offer arrives: the offer decides the m-line layout.
    expect(pc.transceivers).toHaveLength(0);

    await manager.handleSignal({ type: 'offer', sdp: 'offer-sdp' });

    const negotiated = pc.transceivers as unknown as Array<{
      mid: string | null;
      direction: string;
      kind: string;
      sender: { track: unknown };
    }>;
    expect(negotiated).toHaveLength(2);
    expect(negotiated.every((t) => t.mid !== null)).toBe(true);
    expect(negotiated.map((t) => t.direction)).toEqual(['sendrecv', 'sendrecv']);
    expect(negotiated.find((t) => t.kind === 'audio')?.sender.track).toBe(micTrack);
    expect(negotiated.find((t) => t.kind === 'video')?.sender.track).toBe(cameraTrack);
    expect(send).toHaveBeenCalledWith({ type: 'answer', sdp: 'answer-sdp' });

    await manager.leave();
  });

  it('applies a camera toggle that lands before the offer does', async () => {
    // The answerer has no transceiver to replace a track on until the offer arrives, so the
    // track has to be remembered and attached at adoption time.
    const { pc } = createMockPc();
    const manager = new PeerManager(createState(), {}, () => pc as unknown as RTCPeerConnection);

    await manager.join({ ...joinConfig, isOfferer: false }, vi.fn(), null, null);

    const lateCamera = { kind: 'video' } as unknown as MediaStreamTrack;
    await manager.replaceVideoTrack(lateCamera);

    await manager.handleSignal({ type: 'offer', sdp: 'offer-sdp' });

    const video = (
      pc.transceivers as unknown as Array<{ kind: string; sender: { track: unknown } }>
    ).find((t) => t.kind === 'video');
    expect(video?.sender.track).toBe(lateCamera);

    await manager.leave();
  });

  it('offerer still creates its transceivers up front', async () => {
    const { pc } = createMockPc();
    const manager = new PeerManager(createState(), {}, () => pc as unknown as RTCPeerConnection);
    const micTrack = { kind: 'audio' } as unknown as MediaStreamTrack;
    const cameraTrack = { kind: 'video' } as unknown as MediaStreamTrack;

    await manager.join({ ...joinConfig, isOfferer: true }, vi.fn(), cameraTrack, micTrack);

    expect(pc.transceivers).toHaveLength(2);
    expect(pc.transceivers.map((t) => (t as unknown as { kind: string }).kind)).toEqual([
      'audio',
      'video',
    ]);
    expect((pc.transceivers[0] as unknown as { sender: { track: unknown } }).sender.track).toBe(
      micTrack
    );

    await manager.leave();
  });

  it('exposes the remote video track from ontrack rather than guessing a receiver', async () => {
    const { pc } = createMockPc();
    const manager = new PeerManager(createState(), {}, () => pc as unknown as RTCPeerConnection);

    await manager.join({ ...joinConfig, isOfferer: false }, vi.fn(), null, null);
    expect(manager.getRemoteVideoTrack()).toBeNull();

    const listeners: Record<string, () => void> = {};
    const track = {
      kind: 'video',
      muted: true,
      readyState: 'live',
      addEventListener: (event: string, cb: () => void) => {
        listeners[event] = cb;
      },
    };
    pc.ontrack?.({ track } as unknown as RTCTrackEvent);

    expect(manager.getRemoteVideoTrack()).toBe(track);

    listeners.ended?.();
    expect(manager.getRemoteVideoTrack()).toBeNull();

    await manager.leave();
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

  it('publishes a remote track that starts muted (first RTP has not arrived)', async () => {
    const { pc } = createMockPc();
    const onTrackSubscribed = vi.fn();
    const onTrackUnsubscribed = vi.fn();
    const manager = new PeerManager(
      createState(),
      { onTrackSubscribed, onTrackUnsubscribed },
      () => pc as unknown as RTCPeerConnection
    );

    await manager.join({ ...joinConfig, isOfferer: false }, vi.fn(), null, null);

    const listeners: Record<string, () => void> = {};
    const track = {
      kind: 'video',
      muted: true,
      readyState: 'live',
      addEventListener: (event: string, cb: () => void) => {
        listeners[event] = cb;
      },
    };

    pc.ontrack?.({ track } as unknown as RTCTrackEvent);

    expect(onTrackSubscribed).toHaveBeenCalledWith({ identity: '99' }, 'video');
    expect(onTrackUnsubscribed).not.toHaveBeenCalled();

    listeners.mute?.();
    expect(onTrackUnsubscribed).not.toHaveBeenCalled();

    listeners.ended?.();
    expect(onTrackUnsubscribed).toHaveBeenCalledWith({ identity: '99' }, 'video');

    await manager.leave();
  });
});
