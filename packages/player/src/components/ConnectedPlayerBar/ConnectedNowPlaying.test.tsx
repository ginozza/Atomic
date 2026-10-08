import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueItem } from '@nuclearplayer/model';

import { useQueueStore } from '../../stores/queueStore';
import { ConnectedNowPlaying } from './ConnectedNowPlaying';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

describe('ConnectedNowPlaying', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders default text when no track is playing', () => {
    useQueueStore.setState({ items: [], currentIndex: -1 });
    render(<ConnectedNowPlaying />);

    expect(screen.getByText('No track playing')).toBeInTheDocument();
  });

  it('renders track details with well-formed track', () => {
    const item: QueueItem = {
      id: 'item-1',
      status: 'success',
      addedAtIso: new Date().toISOString(),
      track: {
        title: 'Paranoid Android',
        artists: [
          {
            name: 'Radiohead',
            roles: [],
            source: { provider: 'test', id: 'rh-1' },
          },
        ],
        album: {
          title: 'OK Computer',
          source: { provider: 'test', id: 'okc-1' },
        },
        durationMs: 387000,
        source: { provider: 'test', id: 'pa-1' },
      },
    };
    useQueueStore.setState({ items: [item], currentIndex: 0 });

    render(<ConnectedNowPlaying />);
    expect(screen.getByText('Paranoid Android')).toBeInTheDocument();
    expect(screen.getByText('Radiohead')).toBeInTheDocument();
  });

  it('does not crash when track is missing artists and source', () => {
    const item = {
      id: 'item-2',
      status: 'success',
      addedAtIso: new Date().toISOString(),
      track: {
        title: 'Unknown Track',
      },
    } as unknown as QueueItem;
    useQueueStore.setState({ items: [item], currentIndex: 0 });

    render(<ConnectedNowPlaying />);
    expect(screen.getByText('Unknown Track')).toBeInTheDocument();
  });
});
