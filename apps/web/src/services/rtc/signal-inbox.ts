/**
 * Holds WebRTC signals that arrive before PeerConnection is ready.
 * Match + offerer join is often faster than the answerer's RTC import.
 */

import type { RTCSignal } from '@/types/matchmaking';
import type { RtcSignal } from './types';

const pending: RtcSignal[] = [];
let consumer: ((signal: RtcSignal) => void) | null = null;

function parseEpoch(raw: Record<string, unknown>): number | undefined {
  const value = raw.epoch;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return undefined;
  return value;
}

export function toRtcSignal(
  signal: RTCSignal | RtcSignal | Record<string, unknown>
): RtcSignal | null {
  if (!signal || typeof signal !== 'object') return null;
  const raw = signal as Record<string, unknown>;
  const epoch = parseEpoch(raw);
  const envelope = epoch === undefined ? {} : { epoch };

  if (raw.type === 'offer' || raw.type === 'answer') {
    if (typeof raw.sdp !== 'string' || raw.sdp.length === 0) return null;
    return { type: raw.type, sdp: raw.sdp, ...envelope };
  }

  if (raw.type === 'candidate') {
    if (typeof raw.candidate !== 'string' || raw.candidate.length === 0) return null;
    return {
      type: 'candidate',
      candidate: raw.candidate,
      sdpMid: typeof raw.sdpMid === 'string' ? raw.sdpMid : null,
      sdpMLineIndex: typeof raw.sdpMLineIndex === 'number' ? raw.sdpMLineIndex : null,
      ...envelope,
    };
  }

  return null;
}

export function enqueueRtcSignal(raw: unknown): void {
  const envelope = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const payload =
    envelope && envelope.signal && typeof envelope.signal === 'object' ? envelope.signal : raw;
  const parsed = toRtcSignal(payload as RTCSignal);
  if (!parsed) return;

  if (consumer) {
    consumer(parsed);
    return;
  }
  pending.push(parsed);
}

export function attachRtcSignalConsumer(handler: (signal: RtcSignal) => void): void {
  consumer = handler;
  const queued = pending.splice(0);
  for (const signal of queued) {
    handler(signal);
  }
}

export function detachRtcSignalConsumer(): void {
  consumer = null;
}

export function clearRtcSignalInbox(): void {
  consumer = null;
  pending.length = 0;
}

export function peekRtcSignalQueueLength(): number {
  return pending.length;
}
