import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueRtcSignal,
  attachRtcSignalConsumer,
  detachRtcSignalConsumer,
  clearRtcSignalInbox,
  peekRtcSignalQueueLength,
} from '@/services/rtc/signal-inbox';

describe('signal inbox', () => {
  beforeEach(() => {
    clearRtcSignalInbox();
  });

  it('delivers an offer that arrived before the answerer was listening', () => {
    enqueueRtcSignal({ type: 'offer', sdp: 'v=0-early-offer' });
    enqueueRtcSignal({
      type: 'candidate',
      candidate: 'candidate:1 1 UDP 1 1.1.1.1 9 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    });
    expect(peekRtcSignalQueueLength()).toBe(2);

    const received: unknown[] = [];
    attachRtcSignalConsumer((signal) => received.push(signal));

    expect(received).toEqual([
      { type: 'offer', sdp: 'v=0-early-offer' },
      {
        type: 'candidate',
        candidate: 'candidate:1 1 UDP 1 1.1.1.1 9 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
    ]);
    expect(peekRtcSignalQueueLength()).toBe(0);
  });

  it('forwards signals immediately once a consumer is attached', () => {
    const received: unknown[] = [];
    attachRtcSignalConsumer((signal) => received.push(signal));

    enqueueRtcSignal({ type: 'answer', sdp: 'v=0-answer' });
    expect(received).toEqual([{ type: 'answer', sdp: 'v=0-answer' }]);
    expect(peekRtcSignalQueueLength()).toBe(0);
  });

  it('keeps a queued offer across detach so leave() during init does not drop it', () => {
    enqueueRtcSignal({ type: 'offer', sdp: 'v=0-keep' });
    detachRtcSignalConsumer();
    expect(peekRtcSignalQueueLength()).toBe(1);

    const received: unknown[] = [];
    attachRtcSignalConsumer((signal) => received.push(signal));
    expect(received).toEqual([{ type: 'offer', sdp: 'v=0-keep' }]);
  });

  it('carries the connection epoch through and ignores a malformed one', () => {
    const received: unknown[] = [];
    attachRtcSignalConsumer((signal) => received.push(signal));

    enqueueRtcSignal({ type: 'offer', sdp: 'v=0', epoch: 1725500000000 });
    enqueueRtcSignal({ type: 'answer', sdp: 'v=0', epoch: -1 });
    enqueueRtcSignal({ type: 'answer', sdp: 'v=0', epoch: '3' });

    expect(received).toEqual([
      { type: 'offer', sdp: 'v=0', epoch: 1725500000000 },
      { type: 'answer', sdp: 'v=0' },
      { type: 'answer', sdp: 'v=0' },
    ]);
  });

  it('clears stale SDP when a new match starts', () => {
    enqueueRtcSignal({ type: 'offer', sdp: 'stale' });
    clearRtcSignalInbox();
    expect(peekRtcSignalQueueLength()).toBe(0);

    const handler = vi.fn();
    attachRtcSignalConsumer(handler);
    expect(handler).not.toHaveBeenCalled();
  });
});
