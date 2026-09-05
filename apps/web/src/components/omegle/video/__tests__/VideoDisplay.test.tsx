import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VideoDisplay } from '../VideoDisplay';

describe('VideoDisplay', () => {
  it('keeps the remote video visible after match even if the camera flag is still off', () => {
    const { container } = render(
      <VideoDisplay
        id="remote-video"
        label="Stranger"
        isConnected={true}
        isSearching={false}
        isCameraOn={false}
        isMicOn={false}
      />
    );

    const remote = container.querySelector('#remote-video');
    expect(remote).not.toBeNull();
    expect(remote?.className).toContain('opacity-100');
    expect(remote?.className).not.toContain('opacity-0');
  });

  it('hides local video when the local camera is off', () => {
    const { container } = render(
      <VideoDisplay
        id="local-video"
        label="You"
        isConnected={true}
        isSearching={false}
        isCameraOn={false}
      />
    );

    const local = container.querySelector('#local-video');
    expect(local?.className).toContain('opacity-0');
  });

  it('shows a status overlay over the remote feed and keeps the video mounted', () => {
    const { container, getByRole } = render(
      <VideoDisplay
        id="remote-video"
        label="Stranger"
        isConnected={true}
        isSearching={false}
        status="camera-off"
      />
    );

    const overlay = getByRole('status');
    expect(overlay.getAttribute('data-status')).toBe('camera-off');
    expect(overlay.textContent).toContain('Camera is off');
    expect(container.querySelector('#remote-video')?.className).toContain('opacity-100');
  });

  it('shows no overlay when the remote feed is live or before a match', () => {
    const live = render(
      <VideoDisplay id="remote-video" label="Stranger" isConnected={true} isSearching={false} />
    );
    expect(live.queryByRole('status')).toBeNull();

    const idle = render(
      <VideoDisplay
        id="remote-video"
        label="Stranger"
        isConnected={false}
        isSearching={false}
        status="connecting"
      />
    );
    expect(idle.queryByRole('status')).toBeNull();
  });
});
