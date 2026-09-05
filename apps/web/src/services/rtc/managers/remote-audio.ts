/**
 * The hidden <audio> element that plays the partner's voice.
 *
 * Remote audio cannot go through the <video> element: that one is muted so it may autoplay
 * anywhere. Audio therefore needs its own element, and WebKit only lets an element play with
 * sound if `play()` was called on it during a user gesture. The remote track arrives seconds
 * after the Start click, so the element has to be created and "unlocked" during the click
 * (`prime`) and merely re-pointed at the real track later (`attach`).
 */
export class RemoteAudio {
  private element: HTMLAudioElement | null = null;

  /** Create the element and call play() on it. Call this synchronously inside a user gesture. */
  prime(): void {
    const element = this.ensureElement();
    if (!element) return;
    if (!element.srcObject) {
      element.srcObject = createStream([]);
    }
    play(element);
  }

  /** Point the element at a live remote track and (re)start playback. */
  attach(track: MediaStreamTrack): void {
    const element = this.ensureElement();
    if (!element) return;
    // A fresh stream every time: Safari does not reliably start playing when a track is added
    // to a stream that is already the element's source.
    element.srcObject = createStream([track]);
    play(element);
  }

  /** Drop the current track but keep the (unlocked) element for the next match. */
  detach(): void {
    if (!this.element) return;
    this.element.srcObject = createStream([]);
  }

  /** Retry playback after a user gesture, for browsers that refused the first attempt. */
  resume(): void {
    if (!this.element) return;
    play(this.element);
  }

  isPrimed(): boolean {
    return this.element !== null;
  }

  /** Remove the element entirely (tests, teardown). */
  dispose(): void {
    if (!this.element) return;
    try {
      this.element.pause();
    } catch {
      // jsdom
    }
    this.element.srcObject = null;
    this.element.remove();
    this.element = null;
  }

  private ensureElement(): HTMLAudioElement | null {
    if (this.element) return this.element;
    if (typeof document === 'undefined') return null;
    const element = document.createElement('audio');
    element.autoplay = true;
    element.setAttribute('playsinline', 'true');
    element.style.display = 'none';
    document.body.appendChild(element);
    this.element = element;
    return element;
  }
}

function createStream(tracks: MediaStreamTrack[]): MediaStream | null {
  if (typeof MediaStream === 'undefined') return null;
  try {
    return new MediaStream(tracks);
  } catch {
    return null;
  }
}

function play(element: HTMLAudioElement): void {
  try {
    const result = element.play();
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        // Waiting for a user gesture; `resume()` retries on the next one.
      });
    }
  } catch {
    // jsdom has no play()
  }
}

/** Shared across matches: unlocked once, reused for every partner. */
export const remoteAudio = new RemoteAudio();

/** Unlock remote audio. Must be called synchronously from a click/tap handler. */
export function primeRemoteAudio(): void {
  remoteAudio.prime();
}
