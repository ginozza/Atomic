import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueItem } from '@nuclearplayer/model';

import { playbackManager } from '../../services/playback';
import { useNowPlayingModalStore } from '../../stores/nowPlayingModalStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { ConnectedNowPlayingModal } from './ConnectedNowPlayingModal';

vi.mock('../../services/playback', () => ({
  playbackManager: {
    toggle: vi.fn(),
    seek: vi.fn(),
  },
}));

const mockQueueItem: QueueItem = {
  id: 'qi-test-np',
  status: 'success',
  addedAtIso: new Date().toISOString(),
  track: {
    title: 'Bohemian Rhapsody',
    artists: [
      {
        name: 'Queen',
        roles: [],
        source: { provider: 'test', id: 'queen-1' },
      },
    ],
    source: { provider: 'test', id: 'bohem-1' },
    album: {
      title: 'A Night at the Opera',
      source: { provider: 'test', id: 'opera-1' },
    },
    artwork: {
      items: [{ url: 'https://example.com/opera.png' }],
    },
  },
};

describe('ConnectedNowPlayingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNowPlayingModalStore.setState({ isOpen: false });
    useQueueStore.setState({
      items: [mockQueueItem],
      currentIndex: 0,
    });
    useSoundStore.setState({
      status: 'playing',
      seek: 60,
      duration: 354,
    });
  });

  it('renders nothing when closed', () => {
    useNowPlayingModalStore.setState({ isOpen: false });
    render(<ConnectedNowPlayingModal />);

    expect(screen.queryByTestId('now-playing-modal')).not.toBeInTheDocument();
  });

  it('renders full-screen Now Playing view with track details when open', () => {
    useNowPlayingModalStore.setState({ isOpen: true });
    render(<ConnectedNowPlayingModal />);

    expect(screen.getByTestId('now-playing-modal')).toBeInTheDocument();
    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText('Queen')).toBeInTheDocument();
    expect(screen.getByText('A Night at the Opera')).toBeInTheDocument();
    expect(screen.getByTestId('now-playing-close-button')).toBeInTheDocument();
    expect(
      screen.getByTestId('now-playing-play-pause-button'),
    ).toBeInTheDocument();
  });

  it('closes modal when tapping close button', async () => {
    const user = userEvent.setup();
    useNowPlayingModalStore.setState({ isOpen: true });
    render(<ConnectedNowPlayingModal />);

    await user.click(screen.getByTestId('now-playing-close-button'));
    expect(useNowPlayingModalStore.getState().isOpen).toBe(false);
  });

  it('triggers playbackManager.toggle on play/pause click', async () => {
    const user = userEvent.setup();
    useNowPlayingModalStore.setState({ isOpen: true });
    render(<ConnectedNowPlayingModal />);

    await user.click(screen.getByTestId('now-playing-play-pause-button'));
    expect(playbackManager.toggle).toHaveBeenCalledTimes(1);
  });

  it('triggers goToNext on next track button click', async () => {
    const user = userEvent.setup();
    const goToNextSpy = vi.fn();
    useQueueStore.setState({
      items: [mockQueueItem],
      currentIndex: 0,
      goToNext: goToNextSpy,
    });
    useNowPlayingModalStore.setState({ isOpen: true });
    render(<ConnectedNowPlayingModal />);

    await user.click(screen.getByTestId('now-playing-next-button'));
    expect(goToNextSpy).toHaveBeenCalledTimes(1);
  });

  it('applies shimmer loading styling and aria-busy when current track status is loading', () => {
    useQueueStore.setState({
      items: [{ ...mockQueueItem, status: 'loading' }],
      currentIndex: 0,
    });
    useSoundStore.setState({
      status: 'stopped',
    });
    useNowPlayingModalStore.setState({ isOpen: true });

    render(<ConnectedNowPlayingModal />);

    const playPauseBtn = screen.getByTestId('now-playing-play-pause-button');
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
    useNowPlayingModalStore.setState({ isOpen: true });

    render(<ConnectedNowPlayingModal />);

    const playPauseBtn = screen.getByTestId('now-playing-play-pause-button');
    expect(playPauseBtn).not.toHaveAttribute('aria-busy');
    expect(playPauseBtn).toHaveAttribute('aria-label', 'Pause');
    expect(playPauseBtn.className).not.toContain('surface-toxic-shimmer');
  });
});
