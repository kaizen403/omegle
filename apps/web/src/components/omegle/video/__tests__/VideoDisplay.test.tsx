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
});
