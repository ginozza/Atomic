import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueueItem, StreamCandidate } from '@nuclearplayer/model';
import { PlayerBar } from '@nuclearplayer/ui';

import { ConnectedFloatingMiniPlayer } from '../../components/ConnectedPlayerBar/ConnectedFloatingMiniPlayer';
import { ConnectedNowPlayingModal } from '../../components/ConnectedPlayerBar/ConnectedNowPlayingModal';
import { useHyperIslandBridge } from '../../hooks/useHyperIslandBridge';
import { hasBundledPluginFallback } from '../../services/plugins/bundledPlugins';
import { providersHost } from '../../services/providersHost';
import { AudioSourceFactory } from '../../services/streamResolution/audioSource';
import { StreamResolution } from '../../services/streamResolution/streamResolution';
import { useNowPlayingModalStore } from '../../stores/nowPlayingModalStore';
import { usePluginStore } from '../../stores/pluginStore';
import { useProvidersStore } from '../../stores/providersStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSoundStore } from '../../stores/soundStore';
import { DashboardProviderBuilder } from '../builders/DashboardProviderBuilder';
import { DiscoveryProviderBuilder } from '../builders/DiscoveryProviderBuilder';
import { MetadataProviderBuilder } from '../builders/MetadataProviderBuilder';
import {
  createMockCandidate,
  createMockStream,
  StreamingProviderBuilder,
} from '../builders/StreamingProviderBuilder';
import { createMockTrack } from '../utils/mockTrack';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((command: string) => {
    if (command === 'stream_server_port') {
      return Promise.resolve(9100);
    }
    return Promise.resolve(undefined);
  }),
}));

const createQueryClientWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const defaultLabels = {
  shuffleOn: 'Shuffle on',
  shuffleOff: 'Shuffle off',
  repeatOff: 'Repeat off',
  repeatAll: 'Repeat all',
  repeatOne: 'Repeat one',
  discoveryOn: 'Discovery on',
  discoveryOff: 'Discovery off',
};

describe('Atomic Phase 2 Resiliency & Platform Hardening E2E Suite', () => {
  beforeEach(() => {
    providersHost.clear();
    useQueueStore.setState({
      items: [],
      currentIndex: 0,
      isReady: true,
      isLoading: false,
    });
    useSoundStore.setState({
      src: null,
      status: 'stopped',
      seek: 0,
      duration: 180,
      crossfadeMs: 0,
      preload: 'auto',
      crossOrigin: '',
    });
    useSettingsStore.setState({
      definitions: {},
      values: {
        'playback.streamExpiryMs': 3600000,
        'playback.streamResolutionRetries': 1,
        'core.playback.shuffle': false,
        'core.playback.repeat': 'off',
        'core.playback.discovery': false,
      },
      loaded: true,
    });
    useNowPlayingModalStore.setState({
      isOpen: false,
    });
    usePluginStore.setState({
      plugins: {},
    });
    vi.restoreAllMocks();
  });

  describe('Tier 1: Feature Coverage', () => {
    it('resolves stream and transitions queue item to success with active audio source', async () => {
      const streamingProvider = new StreamingProviderBuilder()
        .withSearchForTrack(async (artist, title) => [
          createMockCandidate('stream-primary-1', `${artist} - ${title}`),
        ])
        .withGetStreamUrl(async (candidateId) =>
          createMockStream(candidateId, {
            mimeType: 'audio/mpeg',
            container: 'mp3',
            url: 'https://cdn.example.com/audio-primary.mp3',
          }),
        )
        .build();

      providersHost.register(streamingProvider);

      const track = createMockTrack('Resilient Anthem');
      const item: QueueItem = {
        id: 'queue-item-1',
        track,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [item],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      await resolver.resolve(item, { autoPlay: true });

      await waitFor(() => {
        const currentItem = useQueueStore.getState().getCurrentItem();
        expect(currentItem?.status).toBe('success');
      });

      const soundState = useSoundStore.getState();
      expect(soundState.src).not.toBeNull();
      expect(soundState.src?.url).toContain('http://127.0.0.1:9100/stream/');
      expect(soundState.src?.protocol).toBe('https');
    });

    it('falls back to second candidate when primary candidate fails stream resolution', async () => {
      let candidateResolutionAttempts = 0;
      const streamingProvider = new StreamingProviderBuilder()
        .withSearchForTrack(async (artist, title) => [
          createMockCandidate(
            'candidate-bad',
            `${artist} - ${title} (Dead Link)`,
          ),
          createMockCandidate(
            'candidate-good',
            `${artist} - ${title} (Working Link)`,
          ),
        ])
        .withGetStreamUrl(async (candidateId) => {
          candidateResolutionAttempts += 1;
          if (candidateId === 'candidate-bad') {
            throw new Error('Stream unavailable');
          }
          return createMockStream(candidateId, {
            mimeType: 'audio/mp4',
            container: 'm4a',
            url: 'https://cdn.example.com/working-stream.m4a',
          });
        })
        .build();

      providersHost.register(streamingProvider);

      const track = createMockTrack('Cascade Recovery');
      const item: QueueItem = {
        id: 'queue-item-fallback',
        track,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [item],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      await resolver.resolve(item, { autoPlay: true });

      await waitFor(() => {
        const currentItem = useQueueStore.getState().getCurrentItem();
        expect(currentItem?.status).toBe('success');
        expect(currentItem?.track.streamCandidates).toHaveLength(1);
        expect(currentItem?.track.streamCandidates?.[0].id).toBe(
          'candidate-good',
        );
      });

      expect(candidateResolutionAttempts).toBe(2);
      expect(useSoundStore.getState().src?.url).toContain(
        'http://127.0.0.1:9100/stream/',
      );
    });

    it('renders shimmer loading indicator on PlayerBarControls when item is resolving', () => {
      render(
        <PlayerBar.Controls
          isPlaying={false}
          isLoading={true}
          labels={defaultLabels}
          onPlayPause={vi.fn()}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onShuffleToggle={vi.fn()}
          onRepeatToggle={vi.fn()}
          showDiscovery={false}
        />,
      );

      const loadingButton = screen.getByTestId('player-loading-button');
      expect(loadingButton).toBeVisible();
      expect(loadingButton).toHaveAttribute('aria-busy', 'true');
      expect(loadingButton).toHaveAttribute('aria-label', 'Loading');
      expect(loadingButton.className).toContain('surface-toxic-shimmer');
      expect(loadingButton.className).toContain('animate-toxic-glow');
    });

    it('renders loading shimmer feedback on ConnectedFloatingMiniPlayer when item is loading', () => {
      const track = createMockTrack('Mini Player Track');
      const loadingItem: QueueItem = {
        id: 'qi-mini-loading',
        track,
        status: 'loading',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [loadingItem],
        currentIndex: 0,
      });

      render(<ConnectedFloatingMiniPlayer />, {
        wrapper: createQueryClientWrapper(),
      });

      const miniPlayButton = screen.getByTestId(
        'mini-player-play-pause-button',
      );
      expect(miniPlayButton).toBeVisible();
      expect(miniPlayButton).toHaveAttribute('aria-busy', 'true');
      expect(miniPlayButton).toHaveAttribute('aria-label', 'Loading');
      expect(miniPlayButton.className).toContain('surface-toxic-shimmer');
      expect(miniPlayButton.className).toContain('animate-toxic-glow');
    });

    it('renders loading shimmer feedback on ConnectedNowPlayingModal when item is loading', () => {
      const track = createMockTrack('Modal Track');
      const loadingItem: QueueItem = {
        id: 'qi-modal-loading',
        track,
        status: 'loading',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [loadingItem],
        currentIndex: 0,
      });
      useNowPlayingModalStore.setState({
        isOpen: true,
      });

      render(<ConnectedNowPlayingModal />, {
        wrapper: createQueryClientWrapper(),
      });

      const modalPlayButton = screen.getByTestId(
        'now-playing-play-pause-button',
      );
      expect(modalPlayButton).toBeVisible();
      expect(modalPlayButton).toHaveAttribute('aria-busy', 'true');
      expect(modalPlayButton).toHaveAttribute('aria-label', 'Loading');
      expect(modalPlayButton.className).toContain('surface-toxic-shimmer');
      expect(modalPlayButton.className).toContain('animate-toxic-glow');
    });

    it('extracts direct audio stream URL and routes via local proxy instead of iframe', async () => {
      const factory = new AudioSourceFactory();
      const directCandidate: StreamCandidate = {
        id: 'yt-direct-stream-id',
        title: 'Direct Stream Track',
        failed: false,
        durationMs: 240000,
        source: { provider: 'youtube', id: 'yt-direct-stream-id' },
        stream: {
          url: 'https://rr2---sn-4g5ednks.googlevideo.com/videoplayback?expire=123',
          container: 'm4a',
          codec: 'mp4a.40.2',
          durationMs: 240000,
          protocol: 'https',
          source: { provider: 'youtube', id: 'yt-direct-stream-id' },
        },
      };

      const audioSource = await factory.fromCandidate(directCandidate);

      expect(audioSource.protocol).toBe('mse');
      expect(audioSource.durationSeconds).toBe(240);
      expect(audioSource.url).toContain('http://127.0.0.1:9100/stream/');
      expect(audioSource.protocol).not.toBe('youtube');
    });

    it('processes native Android transport actions via HyperIsland bridge', () => {
      renderHook(() => useHyperIslandBridge());

      useSoundStore.setState({ status: 'playing' });
      act(() => {
        window.dispatchEvent(
          new CustomEvent('nuclear:hyperisland:action', {
            detail: { action: 'toggle' },
          }),
        );
      });
      expect(useSoundStore.getState().status).toBe('paused');

      act(() => {
        window.dispatchEvent(
          new CustomEvent('nuclear:hyperisland:action', {
            detail: { action: 'toggle' },
          }),
        );
      });
      expect(useSoundStore.getState().status).toBe('playing');
    });

    it('validates bundled fallback plugins exist for essential offline bootstrapping', () => {
      expect(hasBundledPluginFallback('nuclear-plugin-youtube')).toBe(true);
      expect(hasBundledPluginFallback('nuclear-plugin-something')).toBe(true);
    });

    it('configures preferred default providers for metadata and streaming on bootstrap', () => {
      const spotifyProvider = MetadataProviderBuilder.albumDetailsProvider()
        .withId('spotify')
        .withName('Spotify')
        .build();
      const youtubeProvider = new StreamingProviderBuilder()
        .withId('youtube')
        .withName('YouTube')
        .build();

      providersHost.register(spotifyProvider);
      providersHost.register(youtubeProvider);

      providersHost.resolveActiveOnBootstrap();

      expect(providersHost.getActive('metadata')).toBe('spotify');
      expect(providersHost.getActive('streaming')).toBe('youtube');
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('handles per-candidate resolution timeout without blocking queue progression', async () => {
      const candidateTimeoutMs = 50;
      let secondCandidateInvoked = false;

      const streamingProvider = new StreamingProviderBuilder()
        .withSearchForTrack(async (artist, title) => [
          createMockCandidate('slow-candidate', `${artist} - ${title}`),
          createMockCandidate('fast-candidate', `${artist} - ${title}`),
        ])
        .withGetStreamUrl(async (candidateId) => {
          if (candidateId === 'slow-candidate') {
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve({
                  url: '',
                  protocol: 'https',
                  failed: true,
                });
              }, candidateTimeoutMs * 4);
            });
          }
          secondCandidateInvoked = true;
          return createMockStream(candidateId);
        })
        .build();

      providersHost.register(streamingProvider);

      const track = createMockTrack('Timeout Resilience');
      const item: QueueItem = {
        id: 'qi-timeout-race',
        track,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [item],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      const resolutionPromise = resolver.resolve(item, { autoPlay: true });

      await waitFor(
        () => {
          const currentItem = useQueueStore.getState().getCurrentItem();
          expect(
            currentItem?.status === 'success' || secondCandidateInvoked,
          ).toBe(true);
        },
        { timeout: 3000 },
      );

      await resolutionPromise;
      expect(useQueueStore.getState().getCurrentItem()?.status).toBe('success');
    });

    it('aborts active resolution when superseding with a new track without race conditions', async () => {
      const trackOne = createMockTrack('Track One');
      const trackTwo = createMockTrack('Track Two');

      let trackOneResolving = true;
      const streamingProvider = new StreamingProviderBuilder()
        .withSearchForTrack(async (_artist, title) => [
          createMockCandidate(`cand-${title}`, title),
        ])
        .withGetStreamUrl(async (candidateId) => {
          if (candidateId === 'cand-Track One') {
            await new Promise((resolve) => setTimeout(resolve, 200));
            if (!trackOneResolving) {
              throw new Error('Aborted');
            }
          }
          return createMockStream(candidateId);
        })
        .build();

      providersHost.register(streamingProvider);

      const itemOne: QueueItem = {
        id: 'item-1',
        track: trackOne,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      const itemTwo: QueueItem = {
        id: 'item-2',
        track: trackTwo,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };

      useQueueStore.setState({
        items: [itemOne, itemTwo],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      void resolver.resolve(itemOne, { autoPlay: true });

      expect(useQueueStore.getState().items[0].status).toBe('loading');

      trackOneResolving = false;
      useQueueStore.setState({ currentIndex: 1 });
      await resolver.resolve(itemTwo, { autoPlay: true });

      await waitFor(() => {
        expect(useQueueStore.getState().items[1].status).toBe('success');
      });

      expect(useQueueStore.getState().items[0].status).toBeUndefined();
    });

    it('transitions to error state and unlocks queue when all stream candidates fail', async () => {
      const streamingProvider = new StreamingProviderBuilder()
        .withSearchForTrack(async (artist, title) => [
          createMockCandidate('cand-fail-1', `${artist} - ${title}`),
          createMockCandidate('cand-fail-2', `${artist} - ${title}`),
        ])
        .withGetStreamUrl(async () => {
          throw new Error('Stream unavailable');
        })
        .build();

      providersHost.register(streamingProvider);

      const track = createMockTrack('Exhausted Track');
      const item: QueueItem = {
        id: 'qi-all-failed',
        track,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [item],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      await resolver.resolve(item, { autoPlay: true });

      await waitFor(() => {
        const currentItem = useQueueStore.getState().getCurrentItem();
        expect(currentItem?.status).toBe('error');
        expect(currentItem?.error).toBe('streaming:errors.allCandidatesFailed');
      });

      expect(useQueueStore.getState().items[0].status).not.toBe('loading');
    });

    it('handles empty candidate search result by failing item without hanging in loading', async () => {
      const streamingProvider = new StreamingProviderBuilder()
        .withSearchForTrack(async () => {
          throw new Error('Search failed');
        })
        .build();

      providersHost.register(streamingProvider);

      const track = createMockTrack('No Candidates Track');
      const item: QueueItem = {
        id: 'qi-empty-cand',
        track,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [item],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      await resolver.resolve(item, { autoPlay: true });

      await waitFor(() => {
        const currentItem = useQueueStore.getState().getCurrentItem();
        expect(currentItem?.status).toBe('error');
        expect(currentItem?.error).toBe('streaming:errors.noCandidatesFound');
      });
    });

    it('handles duplicate provider registration and unregistration idempotently', () => {
      const provider = new StreamingProviderBuilder()
        .withId('idempotent-streaming')
        .withName('Idempotent Provider')
        .build();

      const registeredFirst = providersHost.register(provider);
      const registeredSecond = providersHost.register(provider);

      expect(registeredFirst).toBe('idempotent-streaming');
      expect(registeredSecond).toBe('idempotent-streaming');
      expect(providersHost.list('streaming')).toHaveLength(1);

      const unregisterResult = providersHost.unregister('idempotent-streaming');
      expect(unregisterResult).toBe(true);
      const unregisterAgain = providersHost.unregister('idempotent-streaming');
      expect(unregisterAgain).toBe(false);
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('retries fresh stream resolution for an item in error status and successfully recovers', async () => {
      let attemptCount = 0;
      const streamingProvider = new StreamingProviderBuilder()
        .withSearchForTrack(async (artist, title) => [
          createMockCandidate('retry-cand', `${artist} - ${title}`),
        ])
        .withGetStreamUrl(async (candidateId) => {
          attemptCount += 1;
          if (attemptCount === 1) {
            throw new Error('Temporary stream glitch');
          }
          return createMockStream(candidateId);
        })
        .build();

      providersHost.register(streamingProvider);

      const track = createMockTrack('Glitch Recovery Track');
      const item: QueueItem = {
        id: 'qi-retry',
        track,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [item],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      await resolver.resolve(item, { autoPlay: true });

      await waitFor(() => {
        expect(useQueueStore.getState().getCurrentItem()?.status).toBe('error');
      });

      await resolver.resolveWithFreshStreams(
        useQueueStore.getState().getCurrentItem()!,
        { autoPlay: true },
      );

      await waitFor(() => {
        const currentItem = useQueueStore.getState().getCurrentItem();
        expect(currentItem?.status).toBe('success');
      });

      expect(useSoundStore.getState().src?.url).toContain(
        'http://127.0.0.1:9100/stream/',
      );
    });

    it('transitions shimmer loading button to pause button when playing and to play button when paused', () => {
      const { rerender } = render(
        <PlayerBar.Controls
          isPlaying={false}
          isLoading={true}
          labels={defaultLabels}
          onPlayPause={vi.fn()}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onShuffleToggle={vi.fn()}
          onRepeatToggle={vi.fn()}
          showDiscovery={false}
        />,
      );

      expect(screen.getByTestId('player-loading-button')).toBeVisible();
      expect(
        screen.queryByTestId('player-pause-button'),
      ).not.toBeInTheDocument();

      rerender(
        <PlayerBar.Controls
          isPlaying={true}
          isLoading={false}
          labels={defaultLabels}
          onPlayPause={vi.fn()}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onShuffleToggle={vi.fn()}
          onRepeatToggle={vi.fn()}
          showDiscovery={false}
        />,
      );

      expect(screen.getByTestId('player-pause-button')).toBeVisible();
      expect(
        screen.queryByTestId('player-loading-button'),
      ).not.toBeInTheDocument();

      rerender(
        <PlayerBar.Controls
          isPlaying={false}
          isLoading={false}
          labels={defaultLabels}
          onPlayPause={vi.fn()}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onShuffleToggle={vi.fn()}
          onRepeatToggle={vi.fn()}
          showDiscovery={false}
        />,
      );

      expect(screen.getByTestId('player-play-button')).toBeVisible();
      expect(
        screen.queryByTestId('player-loading-button'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('player-pause-button'),
      ).not.toBeInTheDocument();
    });

    it('combines direct audio stream routing with Android background bridge actions to advance queue', async () => {
      renderHook(() => useHyperIslandBridge());

      const updatePlaybackMock = vi.fn();
      window.NuclearAndroid = {
        updatePlayback: updatePlaybackMock,
        forceGC: vi.fn(),
        isHyperOS: () => true,
        isHyperIslandSupported: () => true,
      };

      const trackA = createMockTrack('Background Song A');
      const trackB = createMockTrack('Background Song B');
      const itemA: QueueItem = {
        id: 'qi-bg-a',
        track: trackA,
        status: 'success',
        addedAtIso: new Date().toISOString(),
      };
      const itemB: QueueItem = {
        id: 'qi-bg-b',
        track: trackB,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [itemA, itemB],
        currentIndex: 0,
      });

      useSoundStore.setState({
        status: 'playing',
        seek: 45,
        duration: 210,
        src: {
          url: 'http://127.0.0.1:9100/stream/direct-audio-proxy',
          protocol: 'mse',
        },
      });

      act(() => {
        window.dispatchEvent(
          new CustomEvent('nuclear:hyperisland:action', {
            detail: { action: 'next' },
          }),
        );
      });

      expect(useQueueStore.getState().currentIndex).toBe(1);
      expect(useQueueStore.getState().getCurrentItem()?.track.title).toBe(
        'Background Song B',
      );
    });

    it('navigates away from failed queue item and clears previous resolution error', async () => {
      const streamingProvider = new StreamingProviderBuilder()
        .withSearchForTrack(async (artist, title) => [
          createMockCandidate(`cand-${title}`, `${artist} - ${title}`),
        ])
        .withGetStreamUrl(async (candidateId) => {
          if (candidateId === 'cand-Broken First') {
            throw new Error('Stream unavailable');
          }
          return createMockStream(candidateId);
        })
        .build();

      providersHost.register(streamingProvider);

      const firstTrack = createMockTrack('Broken First');
      const secondTrack = createMockTrack('Working Second');
      const itemOne: QueueItem = {
        id: 'qi-broken-1',
        track: firstTrack,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      const itemTwo: QueueItem = {
        id: 'qi-working-2',
        track: secondTrack,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };

      useQueueStore.setState({
        items: [itemOne, itemTwo],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      await resolver.resolve(itemOne, { autoPlay: true });

      await waitFor(() => {
        expect(useQueueStore.getState().items[0].status).toBe('error');
      });

      useQueueStore.setState({ currentIndex: 1 });
      await resolver.resolve(itemTwo, { autoPlay: true });

      await waitFor(() => {
        expect(useQueueStore.getState().items[1].status).toBe('success');
      });

      expect(useQueueStore.getState().items[0].status).toBeUndefined();
    });
  });

  describe('Tier 4: Real-World Scenarios', () => {
    it('Scenario 1: Clean Install Boot & Plugin Provider Bootstrapping', () => {
      providersHost.clear();
      useProvidersStore.getState().clearAllActive();

      const spotifyMetadata = MetadataProviderBuilder.albumDetailsProvider()
        .withId('spotify')
        .withName('Spotify')
        .build();
      const youtubeStreaming = new StreamingProviderBuilder()
        .withId('youtube')
        .withName('YouTube')
        .build();
      const deezerDashboard = new DashboardProviderBuilder()
        .withId('deezer-dashboard')
        .withName('Deezer')
        .build();
      const lastfmDiscovery = new DiscoveryProviderBuilder()
        .withId('lastfm-discovery')
        .withName('Last.fm')
        .build();

      providersHost.register(spotifyMetadata);
      providersHost.register(youtubeStreaming);
      providersHost.register(deezerDashboard);
      providersHost.register(lastfmDiscovery);

      providersHost.resolveActiveOnBootstrap();

      expect(providersHost.getActive('metadata')).toBe('spotify');
      expect(providersHost.getActive('streaming')).toBe('youtube');
      expect(providersHost.getActive('dashboard')).toBe('deezer-dashboard');
      expect(providersHost.getActive('discovery')).toBe('lastfm-discovery');
    });

    it('Scenario 2: Track Search to Stream Resolution with Candidate Fallback Workflow', async () => {
      const streamingProvider = new StreamingProviderBuilder()
        .withId('youtube')
        .withSearchForTrack(async (artist, title) => [
          createMockCandidate(
            'cand-stale',
            `${artist} - ${title} (404 Stream)`,
          ),
          createMockCandidate(
            'cand-fresh',
            `${artist} - ${title} (Valid Direct Audio)`,
          ),
        ])
        .withGetStreamUrl(async (candidateId) => {
          if (candidateId === 'cand-stale') {
            throw new Error('404 Not Found');
          }
          return createMockStream(candidateId, {
            container: 'm4a',
            mimeType: 'audio/mp4',
            url: 'https://googlevideo.com/videoplayback?id=atomic123',
          });
        })
        .build();

      providersHost.register(streamingProvider);
      providersHost.setActive('streaming', 'youtube');

      const searchedTrack = createMockTrack('Radioactive Pulse');
      const queueItem: QueueItem = {
        id: 'qi-scenario-2',
        track: searchedTrack,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [queueItem],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      await resolver.resolve(queueItem, { autoPlay: true });

      await waitFor(() => {
        const currentItem = useQueueStore.getState().getCurrentItem();
        expect(currentItem?.status).toBe('success');
        expect(currentItem?.track.streamCandidates?.[0].id).toBe('cand-fresh');
      });

      const soundState = useSoundStore.getState();
      expect(soundState.src).not.toBeNull();
      expect(soundState.src?.url).toContain('http://127.0.0.1:9100/stream/');
    });

    it('Scenario 3: Resilient Playback Recovery After Network Failure Workflow', async () => {
      let isNetworkRestored = false;
      const streamingProvider = new StreamingProviderBuilder()
        .withSearchForTrack(async (artist, title) => [
          createMockCandidate('cand-network', `${artist} - ${title}`),
        ])
        .withGetStreamUrl(async (candidateId) => {
          if (!isNetworkRestored) {
            throw new Error('Network offline');
          }
          return createMockStream(candidateId);
        })
        .build();

      providersHost.register(streamingProvider);

      const track = createMockTrack('Intermittent Network Track');
      const item: QueueItem = {
        id: 'qi-network-recovery',
        track,
        status: 'idle',
        addedAtIso: new Date().toISOString(),
      };
      useQueueStore.setState({
        items: [item],
        currentIndex: 0,
      });

      const resolver = new StreamResolution();
      await resolver.resolve(item, { autoPlay: true });

      await waitFor(() => {
        expect(useQueueStore.getState().getCurrentItem()?.status).toBe('error');
      });

      isNetworkRestored = true;

      const currentFailedItem = useQueueStore.getState().getCurrentItem()!;
      await resolver.resolveWithFreshStreams(currentFailedItem, {
        autoPlay: true,
      });

      await waitFor(() => {
        expect(useQueueStore.getState().getCurrentItem()?.status).toBe(
          'success',
        );
      });

      expect(useSoundStore.getState().src).not.toBeNull();
    });

    it('Scenario 4: Continuous Android Background Playback & Lockscreen Control Workflow', () => {
      renderHook(() => useHyperIslandBridge());

      const updatePlaybackMock = vi.fn();
      window.NuclearAndroid = {
        updatePlayback: updatePlaybackMock,
        forceGC: vi.fn(),
        isHyperOS: () => true,
        isHyperIslandSupported: () => true,
      };

      const trackOne = createMockTrack('Background Stream One');
      const trackTwo = createMockTrack('Background Stream Two');
      useQueueStore.setState({
        items: [
          {
            id: 'bg-item-1',
            track: trackOne,
            status: 'success',
            addedAtIso: new Date().toISOString(),
          },
          {
            id: 'bg-item-2',
            track: trackTwo,
            status: 'idle',
            addedAtIso: new Date().toISOString(),
          },
        ],
        currentIndex: 0,
      });

      useSoundStore.setState({
        status: 'playing',
        seek: 10,
        duration: 180,
        src: {
          url: 'http://127.0.0.1:9100/stream/direct-audio',
          protocol: 'mse',
        },
      });

      expect(useSoundStore.getState().status).toBe('playing');

      act(() => {
        window.dispatchEvent(
          new CustomEvent('nuclear:hyperisland:action', {
            detail: { action: 'toggle' },
          }),
        );
      });
      expect(useSoundStore.getState().status).toBe('paused');

      act(() => {
        window.dispatchEvent(
          new CustomEvent('nuclear:hyperisland:action', {
            detail: { action: 'next' },
          }),
        );
      });
      expect(useQueueStore.getState().currentIndex).toBe(1);
      expect(useQueueStore.getState().getCurrentItem()?.track.title).toBe(
        'Background Stream Two',
      );
    });
  });
});
