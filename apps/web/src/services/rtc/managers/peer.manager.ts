/**
 * One RTCPeerConnection per match generation.
 *
 * Negotiation follows the W3C "perfect negotiation" pattern: either side may (re)negotiate at
 * any time, and an offer collision is resolved by role — the answerer is *polite* and rolls
 * its own offer back, the offerer is *impolite* and ignores the incoming one. Every signal is
 * applied strictly in arrival order, and every signal carries the generation (`epoch`) it
 * belongs to, so both sides can tear the connection down and rebuild it in lockstep after a
 * reconnect or an ICE failure that a restart could not heal.
 *
 * Transceivers are created only by the offerer. The answerer waits for the offer and adopts
 * the transceivers the browser builds while applying it: Chrome does not associate an offer's
 * m-sections with transceivers made by a bare addTransceiver(), so pre-creating them on the
 * answerer leaves its camera and mic on transceivers that are never negotiated — the call
 * "connects" and only one direction ever carries media.
 */

import { RTC_CONFIG, getVideoSettingsForNetwork, getAudioSettingsForNetwork } from '../config';
import type { NetworkQuality } from '../config';
import type {
  IceServer,
  RtcJoinConfig,
  RtcSignal,
  NetworkQualityLevel,
  RemoteTrackState,
  RtcConnectionState,
} from '../types';
import type { RtcState, RtcCallbacks } from './types';
import { attachRemoteVideo, clearMediaElement } from './video-renderer';
import { remoteAudio as sharedRemoteAudio, RemoteAudio } from './remote-audio';

export type PeerConnectionFactory = (config: RTCConfiguration) => RTCPeerConnection;
export type SendSignal = (signal: RtcSignal) => void;

type Kind = 'audio' | 'video';
const KINDS: readonly Kind[] = ['audio', 'video'];

const DEFAULT_FACTORY: PeerConnectionFactory = (config) => new RTCPeerConnection(config);

function newMediaStream(tracks: MediaStreamTrack[] = []): MediaStream | null {
  if (typeof MediaStream === 'undefined') return null;
  try {
    return new MediaStream(tracks);
  } catch {
    return null;
  }
}

function isKind(value: unknown): value is Kind {
  return value === 'audio' || value === 'video';
}

export class PeerManager {
  private sendSignal: SendSignal | null = null;
  private iceServers: IceServer[] = [];
  private polite = false;
  private remoteVideoElementId = '';

  /** Serialises every operation that touches the PeerConnection. */
  private chain: Promise<void> = Promise.resolve();
  /** Bumped for every PeerConnection we create, so events from a closed one are ignored. */
  private generation = 0;
  /** Bumped whenever a description is applied; lets onnegotiationneeded skip stale requests. */
  private descriptionsApplied = 0;

  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private localTracks: Record<Kind, MediaStreamTrack | null> = { audio: null, video: null };
  private localStream: MediaStream | null = null;
  private remoteVideoTrack: MediaStreamTrack | null = null;

  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private failedTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private lastIceRestartAt = 0;
  private consecutiveRebuilds = 0;
  private offersCreated = 0;
  /** Reported once per connection; see `reportIceRoute`. */
  private routeReported = false;

  constructor(
    private state: RtcState,
    private callbacks: RtcCallbacks,
    private peerConnectionFactory: PeerConnectionFactory = DEFAULT_FACTORY,
    private remoteAudio: RemoteAudio = sharedRemoteAudio
  ) {}

  getOffersCreated(): number {
    return this.offersCreated;
  }

  getEpoch(): number {
    return this.state.epoch;
  }

  getConnectionState(): RtcConnectionState {
    return this.state.connectionState;
  }

  /** The live remote video track, as reported by `ontrack`. */
  getRemoteVideoTrack(): MediaStreamTrack | null {
    return this.remoteVideoTrack;
  }

  async join(
    config: RtcJoinConfig,
    sendSignal: SendSignal,
    cameraTrack: MediaStreamTrack | null,
    micTrack: MediaStreamTrack | null
  ): Promise<void> {
    if (this.state.isJoined) return;
    if (this.state.isLeaving) {
      throw new Error('Cannot join while leaving another session');
    }

    this.sendSignal = sendSignal;
    this.iceServers = config.iceServers;
    this.polite = !config.isOfferer;
    this.state.isOfferer = config.isOfferer;
    this.state.partnerIdentity = config.partnerIdentity;
    this.state.epoch = config.epoch ?? 0;
    this.remoteVideoElementId = config.remoteVideoElementId;
    this.localTracks = { audio: micTrack, video: cameraTrack };
    this.consecutiveRebuilds = 0;
    this.offersCreated = 0;
    this.state.isJoined = true;

    // Only the offerer starts the first negotiation; see the class comment.
    await this.run(() => this.createPeer({ initiate: !this.polite }));
  }

  /**
   * Replace the connection with a fresh one at a newer generation.
   *
   * Used after a signalling reconnect, when either side may have changed networks. With
   * `onlyIfUnhealthy` a connection that is still `connected` is left alone; if the partner
   * rebuilt anyway, their first signal carries the new epoch and we follow it then.
   */
  rebuild(targetEpoch?: number, options: { onlyIfUnhealthy?: boolean } = {}): Promise<void> {
    return this.run(async () => {
      const pc = this.state.peerConnection;
      if (options.onlyIfUnhealthy && pc && pc.connectionState === 'connected') return;
      // An explicit rebuild is a deliberate fresh start, not another failed attempt.
      this.consecutiveRebuilds = 0;
      await this.rebuildToUnlocked(targetEpoch ?? this.state.epoch + 1, { initiate: true });
    });
  }

  handleSignal(signal: RtcSignal): Promise<void> {
    return this.run(() => this.processSignal(signal));
  }

  replaceVideoTrack(track: MediaStreamTrack | null): Promise<void> {
    return this.replaceLocalTrack('video', track);
  }

  replaceAudioTrack(track: MediaStreamTrack | null): Promise<void> {
    return this.replaceLocalTrack('audio', track);
  }

  primeRemoteAudio(): void {
    this.remoteAudio.prime();
  }

  resumeRemoteAudio(): void {
    this.remoteAudio.resume();
  }

  async applyBitrate(quality: NetworkQuality): Promise<void> {
    const pc = this.state.peerConnection;
    if (!pc) return;
    const video = getVideoSettingsForNetwork(quality);
    const audio = getAudioSettingsForNetwork(quality);
    await this.setSenderParameters(this.senderFor(pc, 'video'), {
      maxBitrate: video.maxBitrate,
      maxFramerate: video.frameRate,
      // A conversation is a talking head. When bandwidth runs short, a slightly softer but
      // smooth face reads far better than a sharp one that stutters, so give up resolution
      // before framerate.
      degradationPreference: 'maintain-framerate',
    });
    await this.setSenderParameters(this.senderFor(pc, 'audio'), { maxBitrate: audio.maxBitrate });
  }

  getLocalConnectionQuality(): NetworkQualityLevel {
    return this.state.currentNetworkQuality;
  }

  getRemoteConnectionQuality(): NetworkQualityLevel {
    return this.state.currentNetworkQuality;
  }

  async leave(): Promise<void> {
    if (!this.state.isJoined || this.state.isLeaving) return;
    this.state.isLeaving = true;

    await this.run(async () => {
      this.teardownPeer();
    });

    this.localTracks = { audio: null, video: null };
    this.sendSignal = null;
    this.state.isJoined = false;
    this.state.isLeaving = false;
    this.state.isPreviewMode = false;
    this.state.currentNetworkQuality = 'unknown';
    this.setConnectionState('idle');
  }

  // ---------------------------------------------------------------------------------------
  // Serialisation
  // ---------------------------------------------------------------------------------------

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  // ---------------------------------------------------------------------------------------
  // Peer lifecycle
  // ---------------------------------------------------------------------------------------

  /**
   * Build a fresh RTCPeerConnection for the current generation.
   *
   * `initiate` decides who lays out the m-lines for this generation. It is true for the
   * offerer on the first join and for whichever side starts a rebuild of its own (a resumed
   * socket, an ICE failure) — that side must offer, or the partner never learns about the new
   * generation. It is false when we are following an offer the partner already sent: then we
   * create nothing and adopt the transceivers their offer produces, exactly like an answerer.
   */
  private async createPeer(options: { initiate: boolean }): Promise<void> {
    this.generation += 1;
    const generation = this.generation;

    this.pendingCandidates = [];
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
    this.remoteVideoTrack = null;
    this.lastIceRestartAt = 0;
    this.routeReported = false;

    const pc = this.peerConnectionFactory({
      iceServers: this.iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all',
    });
    this.state.peerConnection = pc;
    this.localStream = newMediaStream(
      KINDS.map((kind) => this.localTracks[kind]).filter((t): t is MediaStreamTrack => t !== null)
    );

    this.setConnectionState(this.consecutiveRebuilds > 0 ? 'reconnecting' : 'connecting');
    this.bindPeerEvents(pc, generation);

    if (options.initiate) {
      // The initiating side owns the m-line layout: one audio and one video section, both
      // sendrecv, whether or not it has a track to send right now. A camera turned on later
      // is then just replaceTrack() on an already negotiated sender — no renegotiation.
      for (const kind of KINDS) {
        const init: RTCRtpTransceiverInit = {
          direction: 'sendrecv',
          sendEncodings: [{ maxBitrate: this.initialBitrate(kind) }],
        };
        if (this.localStream) init.streams = [this.localStream];
        const transceiver = pc.addTransceiver(kind, init);
        const track = this.localTracks[kind];
        if (track) {
          try {
            await transceiver.sender.replaceTrack(track);
          } catch {
            // Device vanished between preview and join; keep receiving.
          }
        }
      }
      if (this.isCurrent(pc, generation)) {
        await this.makeOffer(pc);
      }
    }

    this.startStatsLoop();
    this.startConnectWatchdog(pc, generation);
  }

  private teardownPeer(): void {
    this.clearTimers();
    const pc = this.state.peerConnection;
    if (pc) {
      try {
        pc.close();
      } catch {
        // Already closed
      }
    }
    this.state.peerConnection = null;
    this.remoteVideoTrack = null;
    this.pendingCandidates = [];
    this.localStream = null;
    this.remoteAudio.detach();
    if (this.remoteVideoElementId) {
      clearMediaElement(this.remoteVideoElementId);
    }
    for (const kind of KINDS) {
      this.callbacks.onRemoteTrack?.(kind, 'none');
    }
  }

  private async rebuildToUnlocked(epoch: number, options: { initiate: boolean }): Promise<void> {
    if (!this.state.isJoined || this.state.isLeaving) return;
    if (epoch <= this.state.epoch) return;

    if (this.consecutiveRebuilds >= RTC_CONFIG.MAX_CONSECUTIVE_REBUILDS) {
      this.setConnectionState('failed');
      return;
    }

    this.consecutiveRebuilds += 1;
    this.state.epoch = epoch;
    this.teardownPeer();
    await this.createPeer(options);
  }

  private isCurrent(pc: RTCPeerConnection, generation: number): boolean {
    return generation === this.generation && this.state.peerConnection === pc;
  }

  // ---------------------------------------------------------------------------------------
  // Signalling
  // ---------------------------------------------------------------------------------------

  private send(signal: RtcSignal): void {
    this.sendSignal?.({ ...signal, epoch: this.state.epoch });
  }

  private async processSignal(signal: RtcSignal): Promise<void> {
    if (!this.state.isJoined || this.state.isLeaving) return;

    // Older clients and older relays omit epoch. Treat that as "this generation" so a
    // resume that has already advanced past 0 can still apply their answer and candidates.
    // Only an explicit older number is a signal for a connection we have already replaced.
    const epoch = signal.epoch ?? this.state.epoch;
    if (epoch < this.state.epoch) return;
    if (epoch > this.state.epoch) {
      // The partner rebuilt; follow them before applying anything they sent. Their first
      // signal on a new generation is the offer that lays it out, so we answer rather than
      // offer. Anything else arriving first means their offer was lost — offer ourselves.
      await this.rebuildToUnlocked(epoch, { initiate: signal.type !== 'offer' });
    }

    const pc = this.state.peerConnection;
    if (!pc) return;

    if (signal.type === 'candidate') {
      await this.applyCandidate(pc, signal);
      return;
    }
    await this.applyDescription(pc, signal);
  }

  private async applyDescription(
    pc: RTCPeerConnection,
    description: { type: 'offer' | 'answer'; sdp: string }
  ): Promise<void> {
    const isOffer = description.type === 'offer';

    const readyForOffer =
      !this.makingOffer && (pc.signalingState === 'stable' || this.isSettingRemoteAnswerPending);
    const offerCollision = isOffer && !readyForOffer;

    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    if (!isOffer && pc.signalingState !== 'have-local-offer') {
      // A duplicate or late answer; nothing to apply it to.
      return;
    }

    this.isSettingRemoteAnswerPending = !isOffer;
    try {
      // For the polite side this is also the rollback of its own colliding offer.
      await pc.setRemoteDescription({ type: description.type, sdp: description.sdp });
    } catch {
      this.isSettingRemoteAnswerPending = false;
      if (isOffer) {
        // The offer cannot be applied to this connection (a stale one after the partner
        // rebuilt, or a browser without rollback). Start over on both sides.
        await this.rebuildToUnlocked(this.state.epoch + 1, { initiate: true });
      }
      return;
    }
    this.isSettingRemoteAnswerPending = false;
    this.descriptionsApplied += 1;

    await this.flushCandidates(pc);

    if (!isOffer) return;

    await this.adoptNegotiatedTransceivers(pc);
    try {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.descriptionsApplied += 1;
      const sdp = pc.localDescription?.sdp ?? answer.sdp;
      if (sdp) {
        this.send({ type: 'answer', sdp });
      }
    } catch {
      // Connection closed under us
    }
  }

  private async applyCandidate(
    pc: RTCPeerConnection,
    signal: Extract<RtcSignal, { type: 'candidate' }>
  ): Promise<void> {
    const candidate: RTCIceCandidateInit = {
      candidate: signal.candidate,
      sdpMid: signal.sdpMid,
      sdpMLineIndex: signal.sdpMLineIndex,
    };
    if (!pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // Candidate for a description that was rolled back or restarted
    }
  }

  private async flushCandidates(pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Expired candidate
      }
    }
  }

  private async makeOffer(pc: RTCPeerConnection): Promise<void> {
    if (pc.signalingState !== 'stable') return;
    this.makingOffer = true;
    try {
      const offer = await pc.createOffer();
      if (pc !== this.state.peerConnection) return;
      await pc.setLocalDescription(offer);
      this.descriptionsApplied += 1;
      this.offersCreated += 1;
      const sdp = pc.localDescription?.sdp ?? offer.sdp;
      if (sdp) {
        this.send({ type: 'offer', sdp });
      }
    } catch {
      // Connection closed under us, or a colliding remote offer changed the state first.
    } finally {
      this.makingOffer = false;
    }
  }

  /**
   * Adopt the transceivers the browser created while applying a remote offer.
   *
   * They come out `recvonly`. Forcing them to `sendrecv` and attaching our tracks before
   * createAnswer is what makes the answer two-way. Idempotent, so a renegotiation offer
   * (ICE restart) runs through here again and simply re-confirms.
   */
  private async adoptNegotiatedTransceivers(pc: RTCPeerConnection): Promise<void> {
    for (const transceiver of pc.getTransceivers()) {
      if (transceiver.currentDirection === 'stopped') continue;

      if (transceiver.mid === null) {
        // One of ours that the browser did not associate with the remote offer (our own
        // offer collided and was rolled back). Left alone it would be added as an extra
        // m-line in our next offer and the partner would get a second, silent track.
        try {
          transceiver.stop();
        } catch {
          // Already stopped
        }
        continue;
      }
      const kind = transceiver.receiver.track?.kind;
      if (!isKind(kind)) continue;

      try {
        if (transceiver.direction !== 'sendrecv') {
          transceiver.direction = 'sendrecv';
        }
      } catch {
        // Stopped mid-negotiation; the next offer rebuilds it.
      }

      const track = this.localTracks[kind];
      if (transceiver.sender.track !== track) {
        try {
          await transceiver.sender.replaceTrack(track);
        } catch {
          // Device unavailable — stay in the call and keep receiving.
        }
      }

      this.associateLocalStream(transceiver.sender);
    }

    await this.applyBitrate(this.state.currentNetworkQuality);
  }

  private associateLocalStream(sender: RTCRtpSender): void {
    if (!this.localStream) return;
    const withStreams = sender as RTCRtpSender & { setStreams?: (...s: MediaStream[]) => void };
    if (typeof withStreams.setStreams !== 'function') return;
    try {
      withStreams.setStreams(this.localStream);
    } catch {
      // Not supported on this transceiver state
    }
  }

  // ---------------------------------------------------------------------------------------
  // Local tracks
  // ---------------------------------------------------------------------------------------

  private replaceLocalTrack(kind: Kind, track: MediaStreamTrack | null): Promise<void> {
    const previous = this.localTracks[kind];
    this.localTracks[kind] = track;
    return this.run(async () => {
      if (this.localStream) {
        if (previous && previous !== track) {
          try {
            this.localStream.removeTrack(previous);
          } catch {
            // Not in the stream
          }
        }
        if (track) {
          try {
            this.localStream.addTrack(track);
          } catch {
            // Already present
          }
        }
      }

      const pc = this.state.peerConnection;
      if (!pc) return;
      const sender = this.senderFor(pc, kind);
      // The answerer has no sender until the offer arrives; the track is attached then.
      if (!sender) return;
      try {
        await sender.replaceTrack(track);
      } catch {
        // Sender closed
      }
      if (track) {
        await this.applyBitrate(this.state.currentNetworkQuality);
      }
    });
  }

  private senderFor(pc: RTCPeerConnection, kind: Kind): RTCRtpSender | null {
    const transceivers = pc
      .getTransceivers()
      .filter((t) => t.receiver.track?.kind === kind && t.currentDirection !== 'stopped');
    const negotiated = transceivers.find((t) => t.mid !== null);
    return (negotiated ?? transceivers[0])?.sender ?? null;
  }

  private initialBitrate(kind: Kind): number {
    return kind === 'video'
      ? getVideoSettingsForNetwork(this.state.currentNetworkQuality).maxBitrate
      : getAudioSettingsForNetwork(this.state.currentNetworkQuality).maxBitrate;
  }

  private async setSenderParameters(
    sender: RTCRtpSender | null,
    values: {
      maxBitrate: number;
      maxFramerate?: number;
      degradationPreference?: RTCDegradationPreference;
    }
  ): Promise<void> {
    if (!sender) return;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = values.maxBitrate;
      if (values.maxFramerate !== undefined) {
        params.encodings[0].maxFramerate = values.maxFramerate;
      }
      if (values.degradationPreference !== undefined) {
        params.degradationPreference = values.degradationPreference;
      }
      await sender.setParameters(params);
    } catch {
      // setParameters unsupported or sender not yet negotiated
    }
  }

  // ---------------------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------------------

  private bindPeerEvents(pc: RTCPeerConnection, generation: number): void {
    const alive = () => this.isCurrent(pc, generation);

    pc.onicecandidate = (event) => {
      if (!alive() || !event.candidate || !event.candidate.candidate) return;
      this.send({
        type: 'candidate',
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    };

    pc.onnegotiationneeded = () => {
      if (!alive()) return;
      // Queue behind whatever is in flight. If a description lands in the meantime (the
      // initial offer we made ourselves, or an answer that already covers this change),
      // the request is stale and is dropped.
      const requestedAt = this.descriptionsApplied;
      void this.run(async () => {
        if (!alive()) return;
        if (pc.signalingState !== 'stable') return;
        if (this.descriptionsApplied !== requestedAt) return;
        await this.makeOffer(pc);
      });
    };

    pc.ontrack = (event) => {
      if (!alive()) return;
      this.handleRemoteTrack(event.track, alive);
    };

    pc.oniceconnectionstatechange = () => {
      if (!alive()) return;
      this.handleIceState(pc, alive);
    };

    pc.onconnectionstatechange = () => {
      if (!alive()) return;
      this.handleConnectionState(pc);
    };
  }

  private handleRemoteTrack(track: MediaStreamTrack, alive: () => boolean): void {
    const kind = track.kind;
    if (!isKind(kind)) return;

    if (kind === 'video') {
      this.remoteVideoTrack = track;
      attachRemoteVideo(track, this.remoteVideoElementId);
    } else {
      this.remoteAudio.attach(track);
    }

    // A remote track starts muted and unmutes on the first packet, so "muted" before it has
    // ever been live means "still connecting", not "camera off".
    let wasLive = false;
    const emit = (state: RemoteTrackState) => {
      if (!alive()) return;
      this.callbacks.onRemoteTrack?.(kind, state);
    };

    track.addEventListener('unmute', () => {
      wasLive = true;
      if (kind === 'audio') this.remoteAudio.resume();
      emit('live');
    });
    track.addEventListener('mute', () => {
      if (wasLive) emit('muted');
    });
    track.addEventListener('ended', () => {
      if (kind === 'video' && this.remoteVideoTrack === track) {
        this.remoteVideoTrack = null;
      }
      emit('none');
    });

    if (!track.muted && track.readyState !== 'ended') {
      wasLive = true;
      emit('live');
    }
  }

  private handleIceState(pc: RTCPeerConnection, alive: () => boolean): void {
    switch (pc.iceConnectionState) {
      case 'connected':
      case 'completed':
        this.clearDisconnectTimer();
        this.clearFailedTimer();
        break;
      case 'disconnected':
        this.clearDisconnectTimer();
        this.disconnectTimer = setTimeout(() => {
          this.disconnectTimer = null;
          if (!alive()) return;
          const state = pc.iceConnectionState;
          if (state === 'disconnected' || state === 'failed') {
            this.restartIce(pc);
          }
        }, RTC_CONFIG.ICE_DISCONNECT_MS);
        break;
      case 'failed':
        this.clearDisconnectTimer();
        this.restartIce(pc);
        this.clearFailedTimer();
        this.failedTimer = setTimeout(() => {
          this.failedTimer = null;
          if (!alive()) return;
          if (pc.connectionState === 'connected') return;
          void this.run(() => this.rebuildToUnlocked(this.state.epoch + 1, { initiate: true }));
        }, RTC_CONFIG.ICE_FAILED_REBUILD_MS);
        break;
      default:
        break;
    }
  }

  private restartIce(pc: RTCPeerConnection): void {
    const now = Date.now();
    if (now - this.lastIceRestartAt < RTC_CONFIG.ICE_RESTART_MIN_INTERVAL_MS) return;
    this.lastIceRestartAt = now;
    try {
      // Either side may restart; the resulting offer goes through normal collision handling.
      pc.restartIce();
    } catch {
      // Closed
    }
  }

  private handleConnectionState(pc: RTCPeerConnection): void {
    switch (pc.connectionState) {
      case 'connected':
        this.consecutiveRebuilds = 0;
        this.clearConnectTimer();
        this.setConnectionState('connected');
        void this.reportIceRoute(pc);
        break;
      case 'disconnected':
      case 'failed':
        this.setConnectionState('reconnecting');
        break;
      case 'connecting':
      case 'new':
        this.setConnectionState(this.consecutiveRebuilds > 0 ? 'reconnecting' : 'connecting');
        break;
      default:
        break;
    }
  }

  private setConnectionState(state: RtcConnectionState): void {
    if (this.state.connectionState === state) return;
    this.state.connectionState = state;
    this.callbacks.onConnectionState?.(state);
  }

  /**
   * Report how this call is routed, once, as soon as it connects.
   *
   * A `relay` pair means TURN is carrying the media because no direct path existed. The share
   * of calls on relay is what decides whether peer-to-peer is sufficient for this product,
   * and it was previously unmeasurable — the only signal was users saying video "didn't
   * work".
   */
  private async reportIceRoute(pc: RTCPeerConnection): Promise<void> {
    if (this.routeReported || !this.callbacks.onIceRoute) return;
    this.routeReported = true;

    try {
      const stats = await pc.getStats();
      const candidates = new Map<string, { candidateType?: string }>();
      let pair: { localCandidateId?: string; remoteCandidateId?: string } | null = null;

      stats.forEach((report) => {
        if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
          candidates.set(report.id, report as { candidateType?: string });
        }
        if (
          report.type === 'candidate-pair' &&
          (report as { state?: string }).state === 'succeeded' &&
          !pair
        ) {
          pair = report as { localCandidateId?: string; remoteCandidateId?: string };
        }
      });

      if (!pair) {
        this.routeReported = false;
        return;
      }

      const selected = pair as { localCandidateId?: string; remoteCandidateId?: string };
      const local = candidates.get(selected.localCandidateId ?? '')?.candidateType ?? 'unknown';
      const remote = candidates.get(selected.remoteCandidateId ?? '')?.candidateType ?? 'unknown';

      this.callbacks.onIceRoute({
        local,
        remote,
        relayed: local === 'relay' || remote === 'relay',
      });
    } catch {
      // getStats unavailable; leave it unreported rather than guessing.
      this.routeReported = false;
    }
  }

  // ---------------------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------------------

  private startStatsLoop(): void {
    this.clearStatsTimer();
    this.statsTimer = setInterval(() => {
      void this.pollStats();
    }, RTC_CONFIG.STATS_INTERVAL_MS);
  }

  private async pollStats(): Promise<void> {
    const pc = this.state.peerConnection;
    if (!pc) return;

    try {
      const stats = await pc.getStats();
      let rtt = 0;
      let fractionLost = 0;
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const pair = report as RTCIceCandidatePairStats & { currentRoundTripTime?: number };
          if (typeof pair.currentRoundTripTime === 'number') {
            rtt = pair.currentRoundTripTime * 1000;
          }
        }
        if (report.type === 'inbound-rtp') {
          const inbound = report as RTCInboundRtpStreamStats & { fractionLost?: number };
          if (typeof inbound.fractionLost === 'number') {
            fractionLost = Math.max(fractionLost, inbound.fractionLost);
          }
        }
      });

      let quality: NetworkQualityLevel = 'unknown';
      if (rtt || fractionLost) {
        if (rtt < 150 && fractionLost < 0.02) quality = 'excellent';
        else if (rtt < 300 && fractionLost < 0.05) quality = 'good';
        else quality = 'poor';
      }

      if (quality !== 'unknown' && quality !== this.state.currentNetworkQuality) {
        this.state.currentNetworkQuality = quality;
        void this.applyBitrate(quality);
        this.callbacks.onConnectionQualityChanged?.(quality, {
          identity: this.state.partnerIdentity,
        });
      }
    } catch {
      // getStats not available in tests / closed PC
    }
  }

  // ---------------------------------------------------------------------------------------
  // Timers
  // ---------------------------------------------------------------------------------------

  private clearDisconnectTimer(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  /**
   * Rebuild a connection that never came up.
   *
   * Nothing else catches this: a peer whose offer or answer was lost sits in `new` with no
   * candidates and no failure event, so neither the ICE handlers nor the stats loop ever
   * fire. Without this the call is silently dead and the UI says "connecting" forever.
   */
  private startConnectWatchdog(pc: RTCPeerConnection, generation: number): void {
    this.clearConnectTimer();
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (!this.isCurrent(pc, generation)) return;
      if (pc.connectionState === 'connected') return;
      if (this.state.connectionState === 'failed') return;
      void this.run(() => this.rebuildToUnlocked(this.state.epoch + 1, { initiate: true }));
    }, RTC_CONFIG.CONNECT_WATCHDOG_MS);
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearFailedTimer(): void {
    if (this.failedTimer) {
      clearTimeout(this.failedTimer);
      this.failedTimer = null;
    }
  }

  private clearStatsTimer(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearDisconnectTimer();
    this.clearFailedTimer();
    this.clearConnectTimer();
    this.clearStatsTimer();
  }
}
