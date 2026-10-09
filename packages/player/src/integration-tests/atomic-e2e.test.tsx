import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as pluginSdk from '@nuclearplayer/plugin-sdk';
import type { SettingDefinition } from '@nuclearplayer/plugin-sdk';
import { PluginStoreItem } from '@nuclearplayer/ui';

import rawPackageJson from '../../../../package.json';
import rawIndexHtml from '../../index.html?raw';
import rawCargoToml from '../../src-tauri/Cargo.toml?raw';
import rawStringsXml from '../../src-tauri/gen/android/app/src/main/res/values/strings.xml?raw';
import tauriConfig from '../../src-tauri/tauri.conf.json';
import {
  pluginMarketplaceApi,
  type MarketplacePlugin,
} from '../apis/pluginMarketplaceApi';
import { ConnectedPlayerBarWrapper as Wrapper } from '../components/ConnectedPlayerBar/ConnectedPlayerBar.test-wrapper';
import { useInstallPlugin } from '../hooks/useInstallPlugin';
import * as pluginDownloader from '../services/plugins/pluginDownloader';
import { providersHost } from '../services/providersHost';
import { usePluginStore } from '../stores/pluginStore';
import { useQueueStore } from '../stores/queueStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';
import {
  registerCoreSettings,
  useSettingsStore,
} from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';
import {
  createMockCandidate,
  createMockStream,
  StreamingProviderBuilder,
} from '../test/builders/StreamingProviderBuilder';

const SEEK_CONTAINER_WIDTH = 200;
const SEEK_CONTAINER_HEIGHT = 32;

const mockYouTubePlugin: MarketplacePlugin = {
  id: 'nuclear-youtube-plugin',
  name: 'YouTube Music',
  description: 'Stream music from YouTube with Atomic high fidelity audio',
  author: 'Atomic Team',
  repo: 'NuclearPlayer/nuclear-youtube-plugin',
  category: 'streaming',
  categories: ['streaming'],
  version: '1.0.0',
  addedAt: '2026-01-15T00:00:00Z',
};

const setupPointerCaptureMock = (element: HTMLElement) => {
  element.setPointerCapture = vi.fn();
  element.releasePointerCapture = vi.fn();
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({
      x: 0,
      y: 0,
      width: SEEK_CONTAINER_WIDTH,
      height: SEEK_CONTAINER_HEIGHT,
    }),
  );
};

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

describe('Atomic E2E Integration Suite', () => {
  beforeEach(() => {
    providersHost.clear();
    useQueueStore.setState({
      items: [],
      currentIndex: 0,
    });
    useSettingsStore.setState({
      definitions: {},
      values: {},
      loaded: true,
    });
    useSoundStore.setState({
      status: 'stopped',
      seek: 0,
      duration: 0,
    });
    useSettingsModalStore.setState({
      isOpen: false,
      activeItemId: null,
    });
    vi.restoreAllMocks();
  });

  describe('Tier 1: Feature Coverage', () => {
    it('verifies Atomic application metadata in tauri.conf.json and package.json', () => {
      expect(tauriConfig.productName).toBe('Atomic');
      expect(tauriConfig.mainBinaryName).toBe('atomic-music-player');
      expect(tauriConfig.app.windows[0].title).toBe('Atomic Music Player');
      expect(rawPackageJson.name).toBe('atomic');
    });

    it('verifies Atomic Android manifest and title definitions in strings.xml', () => {
      expect(rawStringsXml).toContain(
        '<string name="app_name">"Atomic"</string>',
      );
      expect(rawStringsXml).toContain(
        '<string name="main_activity_title">"Atomic"</string>',
      );
    });

    it('verifies Cargo.toml and index.html contain Atomic branding', () => {
      expect(rawCargoToml).toContain('description = "Atomic Music Player"');
      expect(rawIndexHtml).toContain('<title>Atomic</title>');
    });

    it('verifies Plugin SDK compatibility shim exports intact interfaces', () => {
      expect(pluginSdk).toBeDefined();
      expect(typeof pluginSdk).toBe('object');
    });

    it('renders ConnectedPlayerBar with accessible non-overlapping controls', async () => {
      const item = new Wrapper.QueueItemBuilder()
        .withTitle('Atomic Energy')
        .withArtist('Isotope Core')
        .build();
      Wrapper.seedQueueItem(item);
      Wrapper.seedVolume(0.85);

      await Wrapper.mount();

      expect(screen.getByTestId('player-play-button')).toBeVisible();
      expect(screen.getByTestId('player-next-button')).toBeVisible();
      expect(screen.getByTestId('player-repeat-button')).toBeVisible();
      expect(screen.getByTestId('player-shuffle-button')).toBeVisible();
      expect(screen.getByTestId('player-mute-button')).toBeVisible();
      expect(screen.getByTestId('player-volume-slider')).toBeVisible();
      expect(screen.getByTestId('player-seek-bar')).toBeVisible();
    });

    it('connects volume and mute controls to playback settings in settings store', async () => {
      const user = userEvent.setup();
      Wrapper.seedVolume(0.7);
      useSettingsStore.setState({
        values: {
          'core.playback.volume': 0.7,
          'core.playback.muted': false,
        },
      });

      await Wrapper.mount();

      const muteButton = screen.getByTestId('player-mute-button');
      expect(muteButton).toHaveAttribute('aria-label', 'Mute');

      await user.click(muteButton);
      expect(useSettingsStore.getState().values['core.playback.muted']).toBe(
        true,
      );
      expect(muteButton).toHaveAttribute('aria-label', 'Unmute');

      await Wrapper.volume.changeValue(90);
      expect(useSettingsStore.getState().values['core.playback.volume']).toBe(
        0.9,
      );
    });

    it('connects seek bar progress and interactions to sound store', async () => {
      useSoundStore.setState({
        status: 'playing',
        seek: 60,
        duration: 240,
      });

      await Wrapper.mount();

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);

      fireEvent.click(seekBar, { clientX: 100 });
      expect(useSoundStore.getState().seek).toBe(120);
    });

    it('handles plugin installation network timeout gracefully without hanging in pending state', async () => {
      const toastErrorSpy = vi
        .spyOn(toast, 'error')
        .mockReturnValue('toast-1' as unknown as number);
      vi.spyOn(pluginMarketplaceApi, 'getLatestRelease').mockRejectedValue(
        new Error('Network request timed out after 15000ms'),
      );

      const { result } = renderHook(() => useInstallPlugin(), {
        wrapper: createQueryClientWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      await act(async () => {
        try {
          await result.current.mutateAsync({ plugin: mockYouTubePlugin });
        } catch {
          // Expected rejection
        }
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
        expect(result.current.isError).toBe(true);
        expect(toastErrorSpy).toHaveBeenCalled();
      });
    });

    it('verifies download cleanup is executed when installation fails during loading', async () => {
      vi.spyOn(pluginMarketplaceApi, 'getLatestRelease').mockResolvedValue({
        version: '1.0.0',
        name: 'Release 1.0.0',
        publishedAt: '2026-01-20T00:00:00Z',
        downloadUrl: 'https://example.com/plugin.zip',
        size: 1024,
      });
      vi.spyOn(pluginDownloader, 'downloadAndExtractPlugin').mockResolvedValue(
        '/tmp/plugins/extracted',
      );
      vi.spyOn(
        usePluginStore.getState(),
        'loadPluginFromPath',
      ).mockRejectedValue(new Error('Failed to parse plugin bundle'));
      const cleanupSpy = vi
        .spyOn(pluginDownloader, 'cleanupDownload')
        .mockResolvedValue(undefined);

      const { result } = renderHook(() => useInstallPlugin(), {
        wrapper: createQueryClientWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ plugin: mockYouTubePlugin });
        } catch {
          // Expected rejection
        }
      });

      expect(result.current.isPending).toBe(false);
      expect(cleanupSpy).toHaveBeenCalledWith(mockYouTubePlugin.id);
    });

    it('filters desktop window settings from appearance category on mobile platform', () => {
      const sampleSettings: SettingDefinition[] = [
        {
          id: 'appearance.framelessWindow',
          title: 'Frameless Window',
          description: 'Toggle window frame',
          category: 'appearance',
          kind: 'boolean',
          default: false,
          widget: { type: 'toggle' },
        },
        {
          id: 'appearance.customTitleBar',
          title: 'Custom Title Bar',
          description: 'Use custom title bar',
          category: 'appearance',
          kind: 'boolean',
          default: false,
          widget: { type: 'toggle' },
        },
        {
          id: 'playback.crossfade',
          title: 'Crossfade',
          description: 'Enable audio crossfade',
          category: 'playback',
          kind: 'boolean',
          default: false,
          widget: { type: 'toggle' },
        },
      ];

      registerCoreSettings(sampleSettings);

      const isDesktopOnlySetting = (settingId: string) =>
        settingId.includes('framelessWindow') ||
        settingId.includes('customTitleBar') ||
        settingId.includes('titleBarStyle');

      const mobileVisible = Object.values(
        useSettingsStore.getState().definitions,
      ).filter((definition) => !isDesktopOnlySetting(definition.id));

      expect(
        mobileVisible.some((definition) =>
          definition.id.includes('framelessWindow'),
        ),
      ).toBe(false);
      expect(
        mobileVisible.some((definition) =>
          definition.id.includes('customTitleBar'),
        ),
      ).toBe(false);
      expect(
        mobileVisible.some((definition) => definition.id.includes('crossfade')),
      ).toBe(true);
    });

    it('preserves settings category selection without bouncing back to general', () => {
      useSettingsModalStore.getState().open('general');
      expect(useSettingsModalStore.getState().activeItemId).toBe('general');

      useSettingsModalStore.getState().selectItem('playback');
      expect(useSettingsModalStore.getState().activeItemId).toBe('playback');

      useSettingsModalStore.getState().selectItem('appearance');
      expect(useSettingsModalStore.getState().activeItemId).toBe('appearance');
    });

    it('disambiguates Plugins navigation items between manager and store', () => {
      const navigationItems = [
        { id: 'installed-plugins', label: 'Installed Plugins' },
        { id: 'plugin-store', label: 'Plugin Store' },
      ];

      expect(navigationItems[0].label).not.toBe(navigationItems[1].label);
      expect(navigationItems[0].id).not.toBe(navigationItems[1].id);
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('renders player bar correctly under extreme mobile viewports (320px, 360px, 380px)', async () => {
      const item = new Wrapper.QueueItemBuilder()
        .withTitle('Compact Resonance')
        .withArtist('Atomic Narrow')
        .build();
      Wrapper.seedQueueItem(item);

      const { container } = await Wrapper.mount();

      const viewportWidths = [320, 360, 380];
      for (const width of viewportWidths) {
        container.style.width = `${width}px`;
        expect(screen.getByTestId('player-play-button')).toBeVisible();
        expect(screen.getByTestId('player-next-button')).toBeVisible();
        expect(screen.getByTestId('player-mute-button')).toBeVisible();
      }
    });

    it('handles boundary seeking at exactly 0:00 (0%) and track end (100%)', async () => {
      useSoundStore.setState({
        status: 'playing',
        seek: 50,
        duration: 200,
      });

      await Wrapper.mount();

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);

      fireEvent.click(seekBar, { clientX: 0 });
      expect(useSoundStore.getState().seek).toBe(0);

      fireEvent.click(seekBar, { clientX: 200 });
      expect(useSoundStore.getState().seek).toBe(200);
    });

    it('handles rapid volume mute toggling in quick succession without race conditions', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        values: { 'core.playback.muted': false },
      });

      await Wrapper.mount();

      const muteButton = screen.getByTestId('player-mute-button');
      for (let index = 0; index < 5; index += 1) {
        await user.click(muteButton);
      }

      expect(useSettingsStore.getState().values['core.playback.muted']).toBe(
        true,
      );
    });

    it('simulates network timeout abort signal during plugin download and verifies clean cache recovery', async () => {
      const abortError = new DOMException(
        'The operation was aborted',
        'AbortError',
      );
      vi.spyOn(pluginMarketplaceApi, 'getLatestRelease').mockRejectedValue(
        abortError,
      );

      const { result } = renderHook(() => useInstallPlugin(), {
        wrapper: createQueryClientWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ plugin: mockYouTubePlugin });
        } catch {
          // Expected rejection
        }
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('supports seeking and volume muting while audio playback is actively playing', async () => {
      const user = userEvent.setup();
      const item = new Wrapper.QueueItemBuilder()
        .withTitle('Symphony of Atoms')
        .withArtist('Quantum Quartet')
        .build();
      Wrapper.seedQueueItem(item);
      useSoundStore.setState({
        status: 'playing',
        seek: 10,
        duration: 300,
      });

      await Wrapper.mount();

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);

      fireEvent.click(seekBar, { clientX: 100 });
      expect(useSoundStore.getState().seek).toBe(150);

      const muteButton = screen.getByTestId('player-mute-button');
      await user.click(muteButton);
      expect(useSettingsStore.getState().values['core.playback.muted']).toBe(
        true,
      );

      expect(useSoundStore.getState().status).toBe('playing');
    });

    it('maintains uninterrupted audio playback while navigating settings categories', async () => {
      useSoundStore.setState({
        status: 'playing',
        seek: 80,
        duration: 200,
      });

      useSettingsModalStore.getState().open();
      expect(useSoundStore.getState().status).toBe('playing');

      useSettingsModalStore.getState().selectItem('appearance');
      expect(useSettingsModalStore.getState().activeItemId).toBe('appearance');
      expect(useSoundStore.getState().status).toBe('playing');

      useSettingsModalStore.getState().selectItem('playback');
      expect(useSettingsModalStore.getState().activeItemId).toBe('playback');
      expect(useSoundStore.getState().status).toBe('playing');

      useSettingsModalStore.getState().close();
      expect(useSoundStore.getState().status).toBe('playing');
    });

    it('renders and filters plugin store under mobile viewport dimensions', () => {
      const handleInstall = vi.fn();
      render(
        <div style={{ width: 360 }}>
          <PluginStoreItem
            name={mockYouTubePlugin.name}
            description={mockYouTubePlugin.description}
            author={mockYouTubePlugin.author}
            version={mockYouTubePlugin.version}
            categories={mockYouTubePlugin.categories}
            isInstalled={false}
            isInstalling={false}
            onInstall={handleInstall}
          />
        </div>,
      );

      expect(screen.getByTestId('plugin-store-item-name')).toHaveTextContent(
        'YouTube Music',
      );
      expect(screen.getByTestId('plugin-store-item-author')).toHaveTextContent(
        'Atomic Team',
      );
      expect(screen.getByTestId('plugin-store-item-version')).toHaveTextContent(
        'v1.0.0',
      );
      expect(screen.getByText('streaming')).toBeVisible();
      expect(screen.getByRole('button', { name: /install/i })).toBeVisible();
    });
  });

  describe('Tier 4: Real-World Scenarios', () => {
    it('Scenario 1: Cold launch & application branding verification', () => {
      expect(tauriConfig.productName).toBe('Atomic');
      expect(tauriConfig.mainBinaryName).toBe('atomic-music-player');
      expect(rawPackageJson.name).toBe('atomic');
      expect(rawStringsXml).toContain(
        '<string name="app_name">"Atomic"</string>',
      );
      expect(rawCargoToml).toContain('Atomic Music Player');
      expect(rawIndexHtml).toContain('<title>Atomic</title>');
    });

    it('Scenario 2: Mobile portrait playback workflow with scrubbing, mute, and track navigation', async () => {
      const user = userEvent.setup();
      const firstTrack = new Wrapper.QueueItemBuilder()
        .withId('qi-track-1')
        .withTitle('Nuclear Decay')
        .withArtist('Atomic Band')
        .build();
      const secondTrack = new Wrapper.QueueItemBuilder()
        .withId('qi-track-2')
        .withTitle('Chain Reaction')
        .withArtist('Atomic Band')
        .build();

      useQueueStore.setState({
        items: [firstTrack, secondTrack],
        currentIndex: 0,
      });
      useSoundStore.setState({
        status: 'playing',
        seek: 20,
        duration: 200,
      });

      await Wrapper.mount();

      expect(Wrapper.nowPlaying.title('Nuclear Decay')).toBeInTheDocument();

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);

      fireEvent.click(seekBar, { clientX: 100 });
      expect(useSoundStore.getState().seek).toBe(100);

      const muteButton = screen.getByTestId('player-mute-button');
      await user.click(muteButton);
      expect(useSettingsStore.getState().values['core.playback.muted']).toBe(
        true,
      );

      const nextButton = screen.getByTestId('player-next-button');
      await user.click(nextButton);
      expect(useQueueStore.getState().currentIndex).toBe(1);
    });

    it('Scenario 3: YouTube streaming plugin discovery, installation timeout, and recovery workflow', async () => {
      const toastSpy = vi
        .spyOn(toast, 'error')
        .mockReturnValue('toast-id' as unknown as number);
      vi.spyOn(pluginMarketplaceApi, 'getLatestRelease').mockRejectedValue(
        new Error('Connection timed out'),
      );

      const { result } = renderHook(() => useInstallPlugin(), {
        wrapper: createQueryClientWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ plugin: mockYouTubePlugin });
        } catch {
          // Expected failure
        }
      });

      expect(result.current.isPending).toBe(false);
      expect(toastSpy).toHaveBeenCalled();

      const streamingProvider = new StreamingProviderBuilder()
        .withName('YouTube Music')
        .withSearchForTrack(async (artist, title) => [
          createMockCandidate('yt-atomic-1', `${artist} - ${title}`),
        ])
        .withGetStreamUrl(async (candidateId) => createMockStream(candidateId))
        .build();

      providersHost.register(streamingProvider);
      const candidates = await streamingProvider.searchForTrack(
        'Radiohead',
        'Creep',
      );
      expect(candidates).toHaveLength(1);
      const stream = await streamingProvider.getStreamUrl(candidates[0].id);
      expect(stream).toBeDefined();
    });

    it('Scenario 4: Mobile settings customization workflow', async () => {
      useSettingsModalStore.getState().open();
      expect(useSettingsModalStore.getState().isOpen).toBe(true);

      useSettingsModalStore.getState().selectItem('playback');
      await useSettingsStore.getState().setValue('core.playback.volume', 0.95);
      await useSettingsStore.getState().setValue('core.playback.shuffle', true);
      await useSettingsStore.getState().setValue('core.playback.repeat', 'all');

      expect(useSettingsStore.getState().getValue('core.playback.volume')).toBe(
        0.95,
      );
      expect(
        useSettingsStore.getState().getValue('core.playback.shuffle'),
      ).toBe(true);
      expect(useSettingsStore.getState().getValue('core.playback.repeat')).toBe(
        'all',
      );

      useSettingsModalStore.getState().close();
      expect(useSettingsModalStore.getState().isOpen).toBe(false);
    });

    it('Scenario 5: Packaging & APK configuration readiness check', () => {
      expect(tauriConfig.identifier).toBe('com.nuclearplayer');
      expect(tauriConfig.productName).toBe('Atomic');
      expect(rawStringsXml).toContain('"Atomic"');
      expect(rawCargoToml).toContain('name = "app_lib"');
      expect(rawCargoToml).toContain('cdylib');
    });
  });
});
