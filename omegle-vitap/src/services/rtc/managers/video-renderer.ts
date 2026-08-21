/**
 * Attach MediaStreamTracks to DOM video/audio elements via srcObject.
 */

function ensureVideoElement(
  elementId: string,
  options: { objectFit?: 'cover' | 'contain'; muted?: boolean } = {}
): HTMLVideoElement | null {
  const { objectFit = 'cover', muted = false } = options;
  const element = document.getElementById(elementId);
  if (!element) return null;

  if (element instanceof HTMLVideoElement) {
    element.muted = muted;
    element.autoplay = true;
    element.playsInline = true;
    return element;
  }

  let videoEl = element.querySelector('video');
  if (!videoEl) {
    videoEl = document.createElement('video');
    element.innerHTML = '';
    element.appendChild(videoEl);
  }
  videoEl.style.width = '100%';
  videoEl.style.height = '100%';
  videoEl.style.objectFit = objectFit;
  videoEl.muted = muted;
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  return videoEl;
}

function setTrackOnElement(element: HTMLMediaElement, track: MediaStreamTrack): void {
  const existing = element.srcObject;
  if (existing instanceof MediaStream) {
    existing.getTracks().forEach((t) => {
      if (t.kind === track.kind) existing.removeTrack(t);
    });
    existing.addTrack(track);
    element.srcObject = existing;
  } else {
    element.srcObject = new MediaStream([track]);
  }
  void element.play().catch(() => {
    // Autoplay may be blocked until a user gesture
  });
}

export function attachLocalVideo(track: MediaStreamTrack | null, elementId: string): void {
  if (!track) return;
  const videoEl = ensureVideoElement(elementId, { muted: true });
  if (!videoEl) return;
  setTrackOnElement(videoEl, track);
}

export function attachRemoteVideo(track: MediaStreamTrack | null, elementId: string): void {
  if (!track) return;
  const videoEl = ensureVideoElement(elementId, { objectFit: 'cover', muted: true });
  if (!videoEl) return;
  setTrackOnElement(videoEl, track);
}

export function clearMediaElement(elementId: string): void {
  const element = document.getElementById(elementId);
  if (!element) return;
  const media =
    element instanceof HTMLMediaElement ? element : element.querySelector('video, audio');
  if (media instanceof HTMLMediaElement) {
    media.srcObject = null;
  }
}
