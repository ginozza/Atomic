import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueItem } from '@nuclearplayer/model';

import { playbackManager } from '../../services/playback';
import { useLayoutStore } from '../../stores/layoutStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { ConnectedFloatingMiniPlayer } from './ConnectedFloatingMiniPlayer';

vi.mock('../../services/playback', () => ({
  playbackManager: {
    toggle: vi.fn(),
  },
}));

const mockQueueItem: QueueItem = {
  id: 'qi-test-1',
  status: 'success',
  addedAtIso: new Date().toISOString(),
  track: {
    title: 'Atomic Apple Track',
    artists: [
      {
        name: 'Liquid Glass Artist',
        roles: [],
        source: { provider: 'test', id: 'art-1' },
      },
    ],
    source: { provider: 'test', id: 'trk-1' },
    artwork: {
      items: [{ url: 'https://example.com/cover.png' }],
    },
  },
};

describe('ConnectedFloatingMiniPlayer (Apple Music Style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueueStore.setState({
      items: [],
      currentIndex: 0,
    });
    useSoundStore.setState({
      status: 'stopped',
      seek: 0,
      duration: 100,
    });
    useLayoutStore.setState({
      rightSidebar: {
        isCollapsed: true,
        width: 200,
      },
    });
  });

  it('renders default placeholder state when queue is empty', () => {
    render(<ConnectedFloatingMiniPlayer />);

    expect(screen.getByTestId('floating-mini-player')).toBeInTheDocument();
    expect(screen.getByText('Not Playing')).toBeInTheDocument();
    expect(
      screen.getByText('Tap a song to start listening'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('mini-player-play-pause-button'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mini-player-next-button')).toBeInTheDocument();
  });

  it('renders playing track metadata and thumbnail when queue has current item', () => {
    useQueueStore.setState({
      items: [mockQueueItem],
      currentIndex: 0,
    });
    useSoundStore.setState({
      status: 'playing',
      seek: 45,
      duration: 180,
    });

    render(<ConnectedFloatingMiniPlayer />);

    expect(screen.getByText('Atomic Apple Track')).toBeInTheDocument();
    expect(screen.getByText('Liquid Glass Artist')).toBeInTheDocument();

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/cover.png');
  });

  it('triggers playback toggle on play/pause click', async () => {
    const user = userEvent.setup();
    useQueueStore.setState({
      items: [mockQueueItem],
      currentIndex: 0,
    });

    render(<ConnectedFloatingMiniPlayer />);

    const playPauseBtn = screen.getByTestId('mini-player-play-pause-button');
    await user.click(playPauseBtn);

    expect(playbackManager.toggle).toHaveBeenCalledTimes(1);
  });

  it('triggers goToNext on next button click', async () => {
    const user = userEvent.setup();
    const goToNextSpy = vi.fn();
    useQueueStore.setState({
      items: [mockQueueItem],
      currentIndex: 0,
      goToNext: goToNextSpy,
    });

    render(<ConnectedFloatingMiniPlayer />);

    const nextBtn = screen.getByTestId('mini-player-next-button');
    await user.click(nextBtn);

    expect(goToNextSpy).toHaveBeenCalledTimes(1);
  });

  it('opens Now Playing modal when tapping the mini-player pill body', async () => {
    const user = userEvent.setup();
    render(<ConnectedFloatingMiniPlayer />);

    const pillBody = screen.getByRole('button', { name: /open now playing/i });
    await user.click(pillBody);

    const { useNowPlayingModalStore } =
      await import('../../stores/nowPlayingModalStore');
    expect(useNowPlayingModalStore.getState().isOpen).toBe(true);
  });

  it('applies shimmer loading styling and aria-busy when current track status is loading', () => {
    useQueueStore.setState({
      items: [{ ...mockQueueItem, status: 'loading' }],
      currentIndex: 0,
    });
    useSoundStore.setState({
      status: 'stopped',
    });

    render(<ConnectedFloatingMiniPlayer />);

    const playPauseBtn = screen.getByTestId('mini-player-play-pause-button');
    expect(playPauseBtn).toHaveAttribute('aria-busy', 'true');
    expect(playPauseBtn).toHaveAttribute('aria-label', 'Loading');
    expect(playPauseBtn.className).toContain('surface-toxic-shimmer');
    expect(playPauseBtn.className).toContain('animate-toxic-glow');
  });

  it('stops shimmer loading styling and shows regular pause when playback starts', () => {
    useQueueStore.setState({
      items: [{ ...mockQueueItem, status: 'success' }],
      currentIndex: 0,
    });
    useSoundStore.setState({
      status: 'playing',
    });

    render(<ConnectedFloatingMiniPlayer />);

    const playPauseBtn = screen.getByTestId('mini-player-play-pause-button');
    expect(playPauseBtn).not.toHaveAttribute('aria-busy');
    expect(playPauseBtn).toHaveAttribute('aria-label', 'Pause');
    expect(playPauseBtn.className).not.toContain('surface-toxic-shimmer');
  });
});
