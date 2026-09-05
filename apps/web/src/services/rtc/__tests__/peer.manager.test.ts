import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { PeerManager } from '@/services/rtc/managers/peer.manager';
import { RemoteAudio } from '@/services/rtc/managers/remote-audio';
import { RTC_CONFIG } from '@/services/rtc/config';
import type { RtcState } from '@/services/rtc/managers/types';
import type { RtcSignal, RtcCallbacks } from '@/services/rtc/types';

// ------------------------------------------------------------------------------------------
// Test doubles
// ------------------------------------------------------------------------------------------

class FakeMediaStream {
  tracks: unknown[];
  constructor(tracks: unknown[] = []) {
    this.tracks = [...tracks];
  }
  getTracks() {
    return this.tracks;
  }
  addTrack(track: unknown) {
    if (!this.tracks.includes(track)) this.tracks.push(track);
  }
  removeTrack(track: unknown) {
    this.tracks = this.tracks.filter((t) => t !== track);
  }
}

beforeAll(() => {
  (globalThis as unknown as { MediaStream: unknown }).MediaStream = FakeMediaStream;
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

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
    epoch: 0,
    connectionState: 'idle',
  };
}

type Listener = () => void;

function fakeTrack(kind: 'audio' | 'video', muted = true) {
  const listeners: Record<string, Listener[]> = {};
  const track = {
    kind,
    muted,
    readyState: 'live' as 'live' | 'ended',
    addEventListener(event: string, cb: Listener) {
      (listeners[event] ??= []).push(cb);
    },
    fire(event: 'mute' | 'unmute' | 'ended') {
      if (event === 'mute') track.muted = true;
      if (event === 'unmute') track.muted = false;
      if (event === 'ended') track.readyState = 'ended';
      (listeners[event] ?? []).forEach((cb) => cb());
    },
  };
  return track;
}

interface MockTransceiver {
  kind: string;
  mid: string | null;
  direction: string;
  currentDirection: string | null;
  stop: () => void;
  receiver: { track: { kind: string } };
  sender: {
    track: unknown;
    replaceTrack: ReturnType<typeof vi.fn>;
    getParameters: () => { encodings: Array<Record<string, unknown>> };
    setParameters: ReturnType<typeof vi.fn>;
    setStreams: ReturnType<typeof vi.fn>;
  };
}

function makeTransceiver(kind: string, direction: string): MockTransceiver {
  const transceiver: MockTransceiver = {
    kind,
    mid: null,
    direction,
    currentDirection: null,
    stop() {
      transceiver.currentDirection = 'stopped';
    },
    receiver: { track: { kind } },
    sender: {
      track: null,
      replaceTrack: vi.fn().mockImplementation(async (track: unknown) => {
        transceiver.sender.track = track;
      }),
      getParameters: () => ({ encodings: [{}] }),
      setParameters: vi.fn().mockResolvedValue(undefined),
      setStreams: vi.fn(),
    },
  };
  return transceiver;
}

let sdpSeq = 0;

/**
 * Enough of RTCPeerConnection to exercise negotiation. Models the two Chrome behaviours the
 * code depends on: an incoming offer never reuses a transceiver made by addTransceiver(),
 * and setRemoteDescription(offer) in have-local-offer performs an implicit rollback.
 */
function createMockPc() {
  const pc = {
    transceivers: [] as MockTransceiver[],
    signalingState: 'stable' as string,
    iceConnectionState: 'new' as string,
    connectionState: 'new' as string,
    localDescription: null as RTCSessionDescriptionInit | null,
    remoteDescription: null as RTCSessionDescriptionInit | null,
    addedCandidates: [] as RTCIceCandidateInit[],
    rollbacks: 0,
    iceRestartRequested: false,
    closed: false,
    onicecandidate: null as ((ev: RTCPeerConnectionIceEvent) => void) | null,
    onnegotiationneeded: null as (() => void) | null,
    ontrack: null as ((ev: RTCTrackEvent) => void) | null,
    oniceconnectionstatechange: null as (() => void) | null,
    onconnectionstatechange: null as (() => void) | null,

    addTransceiver(kind: string, init?: { direction?: string }) {
      const transceiver = makeTransceiver(kind, init?.direction ?? 'sendrecv');
      pc.transceivers.push(transceiver);
      return transceiver;
    },
    getTransceivers() {
      return pc.transceivers;
    },
    createOffer: vi.fn().mockImplementation(async () => ({
      type: 'offer',
      sdp: `offer-${++sdpSeq}${pc.iceRestartRequested ? '-restart' : ''}`,
    })),
    createAnswer: vi.fn().mockImplementation(async () => ({
      type: 'answer',
      sdp: `answer-${++sdpSeq}`,
    })),
    setLocalDescription: vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
      if (desc.type === 'offer') {
        if (pc.signalingState !== 'stable') throw new Error('InvalidStateError');
        pc.transceivers.forEach((t, i) => {
          if (t.mid === null) t.mid = String(i);
        });
        pc.signalingState = 'have-local-offer';
      } else {
        if (pc.signalingState !== 'have-remote-offer') throw new Error('InvalidStateError');
        pc.signalingState = 'stable';
      }
      pc.localDescription = desc;
      pc.iceRestartRequested = false;
    }),
    setRemoteDescription: vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
      if (desc.type === 'offer') {
        if (pc.signalingState === 'have-local-offer') {
          pc.rollbacks += 1;
          pc.localDescription = null;
          pc.signalingState = 'stable';
        }
        if (pc.signalingState !== 'stable') throw new Error('InvalidStateError');
        ['audio', 'video'].forEach((kind, index) => {
          const negotiated = pc.transceivers.find((t) => t.kind === kind && t.mid !== null);
          if (!negotiated) {
            const t = makeTransceiver(kind, 'recvonly');
            t.mid = String(index);
            pc.transceivers.push(t);
          }
        });
        pc.signalingState = 'have-remote-offer';
      } else {
        if (pc.signalingState !== 'have-local-offer') throw new Error('InvalidStateError');
        pc.signalingState = 'stable';
      }
      pc.remoteDescription = desc;
    }),
    addIceCandidate: vi.fn().mockImplementation(async (c: RTCIceCandidateInit) => {
      pc.addedCandidates.push(c);
    }),
    restartIce: vi.fn().mockImplementation(() => {
      pc.iceRestartRequested = true;
    }),
    getStats: vi.fn().mockResolvedValue(new Map()),
    close: vi.fn().mockImplementation(() => {
      pc.closed = true;
      pc.signalingState = 'closed';
    }),
  };
  return pc;
}

type MockPc = ReturnType<typeof createMockPc>;

const joinConfig = {
  iceServers: [{ urls: 'stun:stun.example.com:3478' }],
  roomId: 'room-1',
  partnerIdentity: '99',
  localVideoElementId: 'local-video',
  remoteVideoElementId: 'remote-video',
};

function createManager(callbacks: RtcCallbacks = {}) {
  const pcs: MockPc[] = [];
  const signals: RtcSignal[] = [];
  const state = createState();
  const manager = new PeerManager(
    state,
    callbacks,
    () => {
      const pc = createMockPc();
      pcs.push(pc);
      return pc as unknown as RTCPeerConnection;
    },
    new RemoteAudio()
  );
  return {
    manager,
    state,
    pcs,
    signals,
    send: (s: RtcSignal) => signals.push(s),
    pc: () => pcs[pcs.length - 1],
  };
}

const micTrack = () => ({ kind: 'audio' }) as unknown as MediaStreamTrack;
const cameraTrack = () => ({ kind: 'video' }) as unknown as MediaStreamTrack;

/** Two managers wired to each other, with signals delivered in order on demand. */
async function connectPair() {
  const offerer = createManager();
  const answerer = createManager();
  await offerer.manager.join(
    { ...joinConfig, isOfferer: true },
    offerer.send,
    cameraTrack(),
    micTrack()
  );
  await answerer.manager.join(
    { ...joinConfig, isOfferer: false },
    answerer.send,
    cameraTrack(),
    micTrack()
  );
  const pump = async () => {
    for (let round = 0; round < 10; round++) {
      const toAnswerer = offerer.signals.splice(0);
      for (const s of toAnswerer) await answerer.manager.handleSignal(s);
      const toOfferer = answerer.signals.splice(0);
      for (const s of toOfferer) await offerer.manager.handleSignal(s);
      if (offerer.signals.length === 0 && answerer.signals.length === 0) break;
    }
  };
  await pump();
  return { offerer, answerer, pump };
}

// ------------------------------------------------------------------------------------------

describe('PeerManager', () => {
  it('offerer creates exactly one offer on join; answerer creates none', async () => {
    const offerer = createManager();
    const answerer = createManager();

    await offerer.manager.join({ ...joinConfig, isOfferer: true }, offerer.send, null, null);
    await answerer.manager.join({ ...joinConfig, isOfferer: false }, answerer.send, null, null);

    expect(offerer.manager.getOffersCreated()).toBe(1);
    expect(offerer.pc().createOffer).toHaveBeenCalledTimes(1);
    expect(offerer.signals[0]).toMatchObject({ type: 'offer', epoch: 0 });
    expect(answerer.manager.getOffersCreated()).toBe(0);
    expect(answerer.pc().createOffer).not.toHaveBeenCalled();
    // Nothing is created before the offer arrives: the offer decides the m-line layout.
    expect(answerer.pc().transceivers).toHaveLength(0);

    await offerer.manager.leave();
    await answerer.manager.leave();
  });

  it('negotiates two-way: the answer is sendrecv with the answerer tracks attached', async () => {
    // Regression: the answerer used to pre-create transceivers with addTransceiver(). Chrome
    // ignored them when applying the offer, so the answer went out as recvonly and this side
    // never sent a packet — the partner saw a black tile and heard nothing.
    const { offerer, answerer } = await connectPair();

    const negotiated = answerer.pc().transceivers;
    expect(negotiated).toHaveLength(2);
    expect(negotiated.every((t) => t.mid !== null)).toBe(true);
    expect(negotiated.map((t) => t.direction)).toEqual(['sendrecv', 'sendrecv']);
    expect(negotiated.find((t) => t.kind === 'audio')?.sender.track).toMatchObject({
      kind: 'audio',
    });
    expect(negotiated.find((t) => t.kind === 'video')?.sender.track).toMatchObject({
      kind: 'video',
    });
    expect(answerer.pc().signalingState).toBe('stable');
    expect(offerer.pc().signalingState).toBe('stable');
    expect(offerer.pc().remoteDescription?.type).toBe('answer');

    await offerer.manager.leave();
    await answerer.manager.leave();
  });

  it('applies a camera toggle that lands before the offer does', async () => {
    const answerer = createManager();
    await answerer.manager.join({ ...joinConfig, isOfferer: false }, answerer.send, null, null);

    const lateCamera = cameraTrack();
    await answerer.manager.replaceVideoTrack(lateCamera);
    await answerer.manager.handleSignal({ type: 'offer', sdp: 'offer-sdp', epoch: 0 });

    const video = answerer.pc().transceivers.find((t) => t.kind === 'video');
    expect(video?.sender.track).toBe(lateCamera);
    expect(video?.direction).toBe('sendrecv');

    await answerer.manager.leave();
  });

  it('applies signals strictly in order: back-to-back offers yield two answers and no error', async () => {
    const answerer = createManager();
    await answerer.manager.join({ ...joinConfig, isOfferer: false }, answerer.send, null, null);

    const first = answerer.manager.handleSignal({ type: 'offer', sdp: 'offer-1', epoch: 0 });
    const second = answerer.manager.handleSignal({ type: 'offer', sdp: 'offer-2', epoch: 0 });
    await Promise.all([first, second]);

    expect(answerer.signals.filter((s) => s.type === 'answer')).toHaveLength(2);
    expect(answerer.pc().signalingState).toBe('stable');
    expect(answerer.pc().rollbacks).toBe(0);

    await answerer.manager.leave();
  });

  it('polite side rolls back its own offer when one arrives; impolite side ignores the collision', async () => {
    const { offerer, answerer, pump } = await connectPair();

    // Answerer (polite) needs an ICE restart: it makes an offer of its own.
    answerer.pc().restartIce();
    answerer.pc().onnegotiationneeded?.();
    await answerer.manager.handleSignal({
      type: 'candidate',
      candidate: 'candidate:0 1 UDP 1 1.1.1.1 9 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
      epoch: 0,
    }); // Flushes the queue so the offer has been made.
    expect(answerer.pc().signalingState).toBe('have-local-offer');
    expect(answerer.manager.getOffersCreated()).toBe(1);

    // Meanwhile the offerer (impolite) also offers; both are now in have-local-offer.
    offerer.pc().restartIce();
    offerer.pc().onnegotiationneeded?.();
    await offerer.manager.handleSignal({
      type: 'candidate',
      candidate: 'candidate:0 1 UDP 1 1.1.1.1 9 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
      epoch: 0,
    });
    expect(offerer.pc().signalingState).toBe('have-local-offer');

    const offererOffer = offerer.signals.find((s) => s.type === 'offer');
    const answererOffer = answerer.signals.find((s) => s.type === 'offer');
    expect(offererOffer && answererOffer).toBeTruthy();

    // Impolite side ignores the colliding offer outright.
    const srdCallsBefore = offerer.pc().setRemoteDescription.mock.calls.length;
    await offerer.manager.handleSignal(answererOffer!);
    expect(offerer.pc().setRemoteDescription.mock.calls.length).toBe(srdCallsBefore);
    expect(offerer.pc().signalingState).toBe('have-local-offer');

    // Polite side rolls back and answers.
    await answerer.manager.handleSignal(offererOffer!);
    expect(answerer.pc().rollbacks).toBe(1);
    expect(answerer.pc().signalingState).toBe('stable');
    // Nothing unassociated survives to become a stray m-line in a later offer.
    expect(
      answerer.pc().transceivers.filter((t) => t.mid === null && t.currentDirection !== 'stopped')
    ).toHaveLength(0);

    offerer.signals.length = 0;
    await pump();
    expect(offerer.pc().signalingState).toBe('stable');

    await offerer.manager.leave();
    await answerer.manager.leave();
  });

  it('drops signals from an older generation and follows a newer one', async () => {
    const { offerer, answerer } = await connectPair();
    const firstPc = offerer.pc();

    // The partner rebuilt at generation 5: we tear down, rebuild, and answer under 5.
    await offerer.manager.handleSignal({ type: 'offer', sdp: 'offer-new-gen', epoch: 5 });
    expect(firstPc.closed).toBe(true);
    expect(offerer.pcs).toHaveLength(2);
    expect(offerer.manager.getEpoch()).toBe(5);
    expect(offerer.pc().signalingState).toBe('stable');
    // Being the offerer role does not stop us answering a rebuilt partner's offer.
    expect(offerer.signals.at(-1)).toMatchObject({ type: 'answer', epoch: 5 });

    // A straggler from generation 0 is ignored.
    await offerer.manager.handleSignal({
      type: 'candidate',
      candidate: 'candidate:9 1 UDP 1 9.9.9.9 9 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
      epoch: 0,
    });
    expect(offerer.pc().addedCandidates).toHaveLength(0);

    await offerer.manager.leave();
    await answerer.manager.leave();
  });

  it('applies epoch-less answers and candidates to the current generation', async () => {
    // Mixed rollout: we rebuilt after a resume, the partner is still on the old client
    // (or an old relay stripped the field). Their answer must not be read as generation 0.
    const offerer = createManager();
    await offerer.manager.join({ ...joinConfig, isOfferer: true }, offerer.send, null, null);
    await offerer.manager.rebuild(5);
    expect(offerer.manager.getEpoch()).toBe(5);
    expect(offerer.pc().signalingState).toBe('have-local-offer');

    await offerer.manager.handleSignal({ type: 'answer', sdp: 'answer-from-old-client' });
    expect(offerer.pc().signalingState).toBe('stable');
    expect(offerer.pc().setRemoteDescription).toHaveBeenCalledWith({
      type: 'answer',
      sdp: 'answer-from-old-client',
    });

    await offerer.manager.handleSignal({
      type: 'candidate',
      candidate: 'candidate:9 1 UDP 1 9.9.9.9 9 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });
    expect(offerer.pc().addedCandidates).toHaveLength(1);

    await offerer.manager.leave();
  });

  it('rebuild() starts a new generation, re-attaches tracks, and is a no-op when not newer or when healthy', async () => {
    const states: string[] = [];
    const offerer = createManager({ onConnectionState: (s) => states.push(s) });
    const camera = cameraTrack();
    await offerer.manager.join({ ...joinConfig, isOfferer: true }, offerer.send, camera, null);
    expect(offerer.pcs).toHaveLength(1);

    await offerer.manager.rebuild(1725500000000);
    expect(offerer.pcs).toHaveLength(2);
    expect(offerer.pcs[0].closed).toBe(true);
    expect(offerer.manager.getEpoch()).toBe(1725500000000);
    expect(offerer.pc().transceivers.find((t) => t.kind === 'video')?.sender.track).toBe(camera);
    expect(offerer.signals.at(-1)).toMatchObject({ type: 'offer', epoch: 1725500000000 });

    await offerer.manager.rebuild(1725500000000);
    expect(offerer.pcs).toHaveLength(2);

    offerer.pc().connectionState = 'connected';
    await offerer.manager.rebuild(1725500000001, { onlyIfUnhealthy: true });
    expect(offerer.pcs).toHaveLength(2);

    offerer.pc().connectionState = 'disconnected';
    await offerer.manager.rebuild(1725500000001, { onlyIfUnhealthy: true });
    expect(offerer.pcs).toHaveLength(3);

    await offerer.manager.leave();
  });

  it('a rebuild started by the answerer side announces itself with an offer', async () => {
    // Otherwise a partner whose connection still looks healthy never learns about the new
    // generation and the two sides deadlock on different epochs.
    const { offerer, answerer, pump } = await connectPair();

    await answerer.manager.rebuild(1725500000000);
    expect(answerer.signals.at(-1)).toMatchObject({ type: 'offer', epoch: 1725500000000 });

    await pump();
    expect(offerer.manager.getEpoch()).toBe(1725500000000);
    expect(offerer.pc().signalingState).toBe('stable');
    expect(answerer.pc().signalingState).toBe('stable');
    // The follower adopted the rebuilt side's layout instead of creating its own.
    expect(offerer.pc().transceivers).toHaveLength(2);
    expect(offerer.pc().transceivers.map((t) => t.direction)).toEqual(['sendrecv', 'sendrecv']);

    await offerer.manager.leave();
    await answerer.manager.leave();
  });

  it('queues ICE candidates until the remote description is set', async () => {
    const offerer = createManager();
    await offerer.manager.join({ ...joinConfig, isOfferer: true }, offerer.send, null, null);

    await offerer.manager.handleSignal({
      type: 'candidate',
      candidate: 'candidate:1 1 UDP 1 1.1.1.1 9 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
      epoch: 0,
    });
    expect(offerer.pc().addedCandidates).toHaveLength(0);

    await offerer.manager.handleSignal({ type: 'answer', sdp: 'answer-sdp', epoch: 0 });
    expect(offerer.pc().addedCandidates).toHaveLength(1);

    await offerer.manager.leave();
  });

  it('reports remote track state: live on unmute, muted after being live, none on ended', async () => {
    const events: Array<[string, string]> = [];
    const answerer = createManager({ onRemoteTrack: (kind, state) => events.push([kind, state]) });
    await answerer.manager.join({ ...joinConfig, isOfferer: false }, answerer.send, null, null);

    const track = fakeTrack('video');
    answerer.pc().ontrack?.({ track } as unknown as RTCTrackEvent);
    expect(answerer.manager.getRemoteVideoTrack()).toBe(track);
    // Muted before it has ever been live means "connecting", not "camera off".
    expect(events).toEqual([]);

    track.fire('mute');
    expect(events).toEqual([]);

    track.fire('unmute');
    expect(events).toEqual([['video', 'live']]);

    track.fire('mute');
    expect(events).toEqual([
      ['video', 'live'],
      ['video', 'muted'],
    ]);

    track.fire('ended');
    expect(events.at(-1)).toEqual(['video', 'none']);
    expect(answerer.manager.getRemoteVideoTrack()).toBeNull();

    await answerer.manager.leave();
  });

  it('restarts ICE on failure and rebuilds if that does not recover; gives up after the cap', async () => {
    vi.useFakeTimers();
    const states: string[] = [];
    const offerer = createManager({ onConnectionState: (s) => states.push(s) });
    await offerer.manager.join({ ...joinConfig, isOfferer: true }, offerer.send, null, null);

    const failOnce = async () => {
      const pc = offerer.pc();
      pc.iceConnectionState = 'failed';
      pc.connectionState = 'failed';
      pc.oniceconnectionstatechange?.();
      pc.onconnectionstatechange?.();
      expect(pc.restartIce).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(RTC_CONFIG.ICE_FAILED_REBUILD_MS + 10);
    };

    await failOnce();
    expect(offerer.pcs).toHaveLength(2);
    expect(offerer.manager.getEpoch()).toBe(1);
    expect(states).toContain('reconnecting');

    for (let i = 1; i < RTC_CONFIG.MAX_CONSECUTIVE_REBUILDS; i++) {
      await failOnce();
    }
    expect(offerer.pcs).toHaveLength(RTC_CONFIG.MAX_CONSECUTIVE_REBUILDS + 1);

    await failOnce();
    expect(offerer.pcs).toHaveLength(RTC_CONFIG.MAX_CONSECUTIVE_REBUILDS + 1);
    expect(offerer.manager.getConnectionState()).toBe('failed');

    await offerer.manager.leave();
  });

  it('rebuilds a connection that never comes up, so a lost offer is not a dead call', async () => {
    // No ICE event ever fires for a peer whose offer was lost: it sits in `new`, gathering
    // nothing. Only the watchdog catches it.
    vi.useFakeTimers();
    const offerer = createManager();
    await offerer.manager.join({ ...joinConfig, isOfferer: true }, offerer.send, null, null);
    expect(offerer.pcs).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(RTC_CONFIG.CONNECT_WATCHDOG_MS - 100);
    expect(offerer.pcs).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(200);
    expect(offerer.pcs).toHaveLength(2);
    expect(offerer.manager.getEpoch()).toBe(1);
    expect(offerer.signals.at(-1)).toMatchObject({ type: 'offer', epoch: 1 });

    // A connection that does come up is left alone.
    offerer.pc().connectionState = 'connected';
    offerer.pc().onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(RTC_CONFIG.CONNECT_WATCHDOG_MS * 2);
    expect(offerer.pcs).toHaveLength(2);
    expect(offerer.manager.getConnectionState()).toBe('connected');

    await offerer.manager.leave();
  });

  it('leave closes the connection and resets state', async () => {
    const offerer = createManager();
    await offerer.manager.join({ ...joinConfig, isOfferer: true }, offerer.send, null, null);
    const pc = offerer.pc();

    await offerer.manager.leave();
    expect(pc.closed).toBe(true);
    expect(offerer.state.peerConnection).toBeNull();
    expect(offerer.state.isJoined).toBe(false);
    expect(offerer.manager.getConnectionState()).toBe('idle');

    // Nothing after leave touches the dead connection.
    await offerer.manager.handleSignal({ type: 'answer', sdp: 'late', epoch: 0 });
    expect(pc.setRemoteDescription).not.toHaveBeenCalled();
  });
});
