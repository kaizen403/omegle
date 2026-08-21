import { parseRtcSignal, MAX_SDP_BYTES, MAX_CANDIDATE_BYTES } from './signal.parse';
import { SignalHandler } from './signal.handler';

describe('parseRtcSignal', () => {
  it('accepts offer and answer SDP under the size cap', () => {
    const offer = parseRtcSignal({ type: 'offer', sdp: 'v=0' });
    expect(offer).toEqual({ ok: true, signal: { type: 'offer', sdp: 'v=0' } });
    const answer = parseRtcSignal({ type: 'answer', sdp: 'v=0' });
    expect(answer.ok).toBe(true);
  });

  it('rejects oversized SDP', () => {
    const sdp = 'a'.repeat(MAX_SDP_BYTES + 1);
    const result = parseRtcSignal({ type: 'offer', sdp });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/too large/);
    }
  });

  it('accepts candidates and rejects oversize', () => {
    const ok = parseRtcSignal({
      type: 'candidate',
      candidate: 'candidate:1 1 UDP 1 1.1.1.1 9 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });
    expect(ok.ok).toBe(true);

    const tooBig = parseRtcSignal({
      type: 'candidate',
      candidate: 'c'.repeat(MAX_CANDIDATE_BYTES + 1),
    });
    expect(tooBig.ok).toBe(false);
  });

  it('rejects unknown types including ice-candidate', () => {
    expect(parseRtcSignal({ type: 'ice-candidate', candidate: 'x' }).ok).toBe(false);
  });
});

describe('SignalHandler', () => {
  function mockSocket(overrides: Record<string, unknown> = {}) {
    const toEmit = jest.fn();
    const to = jest.fn(() => ({ emit: toEmit }));
    return {
      uid: 1,
      state: 'active',
      roomId: 'room-1',
      to,
      toEmit,
      ...overrides,
    };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not relay when the socket is not in a room', () => {
    const handler = new SignalHandler();
    const socket = mockSocket({ state: 'idle', roomId: undefined });
    handler.handleSignal(socket as never, { type: 'offer', sdp: 'v=0' });
    expect(socket.to).not.toHaveBeenCalled();
    handler.destroy();
  });

  it('relays a valid signal only to the room', () => {
    const handler = new SignalHandler();
    const socket = mockSocket();
    handler.handleSignal(socket as never, { type: 'offer', sdp: 'v=0' });
    expect(socket.to).toHaveBeenCalledWith('room-1');
    expect(socket.toEmit).toHaveBeenCalledWith('signal', { type: 'offer', sdp: 'v=0' });
    handler.destroy();
  });

  it('drops oversized payloads without relaying', () => {
    const handler = new SignalHandler();
    const socket = mockSocket();
    handler.handleSignal(socket as never, { type: 'offer', sdp: 'a'.repeat(MAX_SDP_BYTES + 1) });
    expect(socket.to).not.toHaveBeenCalled();
    handler.destroy();
  });
});
