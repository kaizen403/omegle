import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { RemoteAudio } from '@/services/rtc/managers/remote-audio';

class FakeMediaStream {
  tracks: unknown[];
  constructor(tracks: unknown[] = []) {
    this.tracks = [...tracks];
  }
  getTracks() {
    return this.tracks;
  }
}

beforeAll(() => {
  (globalThis as unknown as { MediaStream: unknown }).MediaStream = FakeMediaStream;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RemoteAudio', () => {
  it('prime creates a hidden audio element and starts playback so a later track is allowed to play', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const audio = new RemoteAudio();

    expect(audio.isPrimed()).toBe(false);
    audio.prime();

    const element = document.querySelector('audio') as HTMLAudioElement;
    expect(element).not.toBeNull();
    expect(element.autoplay).toBe(true);
    expect(element.getAttribute('playsinline')).toBe('true');
    expect(play).toHaveBeenCalledTimes(1);
    expect(audio.isPrimed()).toBe(true);

    audio.dispose();
    expect(document.querySelector('audio')).toBeNull();
  });

  it('attach points the same element at the live track and plays again', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const audio = new RemoteAudio();
    audio.prime();
    const element = document.querySelector('audio') as HTMLAudioElement & {
      srcObject: FakeMediaStream;
    };

    const track = { kind: 'audio' };
    audio.attach(track as unknown as MediaStreamTrack);

    expect(document.querySelectorAll('audio')).toHaveLength(1);
    expect(element.srcObject.getTracks()).toEqual([track]);
    expect(play).toHaveBeenCalledTimes(2);

    audio.detach();
    expect(element.srcObject.getTracks()).toEqual([]);
    expect(document.querySelectorAll('audio')).toHaveLength(1);

    audio.dispose();
  });

  it('survives a browser that refuses playback and a resume before prime', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'));
    const audio = new RemoteAudio();
    expect(() => audio.resume()).not.toThrow();
    expect(() => audio.prime()).not.toThrow();
    expect(() => audio.resume()).not.toThrow();
    audio.dispose();
  });
});
