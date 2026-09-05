export const SIGNAL_TYPES = ['offer', 'answer', 'candidate'] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const MAX_SDP_BYTES = 16 * 1024;
export const MAX_CANDIDATE_BYTES = 2 * 1024;

export interface RtcSignal {
  type: SignalType;
  sdp?: string;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  /**
   * Peer-connection generation, chosen by the clients. Relayed untouched so both sides can
   * tell a signal for the connection they are on from one for a connection they have already
   * replaced (after a reconnect or an ICE failure). Absent from older clients; the receiver
   * treats a missing epoch as its current generation, not as 0.
   */
  epoch?: number;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function isSignalType(value: unknown): value is SignalType {
  return typeof value === 'string' && (SIGNAL_TYPES as readonly string[]).includes(value);
}

function parseEpoch(
  raw: Record<string, unknown>
): { ok: true; epoch?: number } | { ok: false; error: string } {
  if (raw.epoch === undefined || raw.epoch === null) {
    return { ok: true };
  }
  if (typeof raw.epoch !== 'number' || !Number.isSafeInteger(raw.epoch) || raw.epoch < 0) {
    return { ok: false, error: 'Invalid epoch' };
  }
  return { ok: true, epoch: raw.epoch };
}

/**
 * Validate a WebRTC signal without inspecting SDP contents.
 */
export function parseRtcSignal(
  data: unknown
): { ok: true; signal: RtcSignal } | { ok: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Missing or invalid signal data' };
  }

  const raw = data as Record<string, unknown>;
  if (!isSignalType(raw.type)) {
    return { ok: false, error: 'Invalid signal type' };
  }

  const epoch = parseEpoch(raw);
  if (!epoch.ok) {
    return epoch;
  }
  const envelope = epoch.epoch === undefined ? {} : { epoch: epoch.epoch };

  if (raw.type === 'offer' || raw.type === 'answer') {
    if (typeof raw.sdp !== 'string' || raw.sdp.length === 0) {
      return { ok: false, error: 'Missing SDP' };
    }
    if (byteLength(raw.sdp) > MAX_SDP_BYTES) {
      return { ok: false, error: 'SDP too large' };
    }
    return { ok: true, signal: { type: raw.type, sdp: raw.sdp, ...envelope } };
  }

  if (typeof raw.candidate !== 'string' || raw.candidate.length === 0) {
    return { ok: false, error: 'Missing ICE candidate' };
  }
  if (byteLength(raw.candidate) > MAX_CANDIDATE_BYTES) {
    return { ok: false, error: 'ICE candidate too large' };
  }

  const sdpMid =
    raw.sdpMid === undefined || raw.sdpMid === null
      ? null
      : typeof raw.sdpMid === 'string'
        ? raw.sdpMid
        : undefined;
  if (sdpMid === undefined) {
    return { ok: false, error: 'Invalid sdpMid' };
  }

  let sdpMLineIndex: number | null = null;
  if (raw.sdpMLineIndex !== undefined && raw.sdpMLineIndex !== null) {
    if (typeof raw.sdpMLineIndex !== 'number' || !Number.isInteger(raw.sdpMLineIndex)) {
      return { ok: false, error: 'Invalid sdpMLineIndex' };
    }
    sdpMLineIndex = raw.sdpMLineIndex;
  }

  return {
    ok: true,
    signal: {
      type: 'candidate',
      candidate: raw.candidate,
      sdpMid,
      sdpMLineIndex,
      ...envelope,
    },
  };
}
