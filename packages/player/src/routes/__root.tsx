import { createRootRoute } from '@tanstack/react-router';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  CableIcon,
  DiscIcon,
  GaugeIcon,
  HistoryIcon,
  ListMusicIcon,
  MusicIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react';
import { Component, ReactNode, useEffect } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import {
  PlayerShell,
  PlayerWorkspace,
  RouteTransition,
  SidebarNavigation,
  SidebarNavigationItem,
  Toaster,
} from '@nuclearplayer/ui';

import {
  ConnectedNowPlayingModal,
  ConnectedPlayerBar,
} from '../components/ConnectedPlayerBar';
import {
  ConnectedQueuePanel,
  QueueHeaderActions,
} from '../components/ConnectedQueuePanel';
import { ConnectedSettingsModal } from '../components/ConnectedSettingsModal';
import { ConnectedStreamVerification } from '../components/ConnectedStreamVerification';
import { ConnectedTitleBar } from '../components/ConnectedTitleBar';
import { ConnectedTopBar } from '../components/ConnectedTopBar';
import { DevTools } from '../components/DevTools';
import { FlatpakWarningBanner } from '../components/FlatpakWarningBanner';
import { MobileNavigationBar } from '../components/MobileNavigationBar';
import { SoundProvider } from '../components/SoundProvider';
import { StreamResolver } from '../components/StreamResolver';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { useCoreSetting } from '../hooks/useCoreSetting';
import { GlobalShortcuts } from '../shortcuts';
import { useLayoutStore } from '../stores/layoutStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';
import { useStartupStore } from '../stores/startupStore';

const useDarkMode = () => {
  const [isDark] = useCoreSetting<boolean>('theme.dark');
  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDark]);
};

type SafeComponentBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
};

type SafeComponentBoundaryState = {
  hasError: boolean;
  errorCount: number;
};

class SafeComponentBoundary extends Component<
  SafeComponentBoundaryProps,
  SafeComponentBoundaryState
> {
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: SafeComponentBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(): Partial<SafeComponentBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(
      `[SafeComponentBoundary] Caught error in ${this.props.name ?? 'component'}:`,
      error,
    );
    if (this.state.errorCount < 3) {
      this.resetTimer = setTimeout(() => {
        this.setState((prevState) => ({
          hasError: false,
          errorCount: prevState.errorCount + 1,
        }));
      }, 300);
    }
  }

  componentWillUnmount() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

const RootComponent = () => {
  useAndroidBackHandler();
  useDarkMode();
  const { t } = useTranslation('navigation');
  const { t: tPrefs } = useTranslation('preferences');
  const {
    leftSidebar,
    rightSidebar,
    toggleLeftSidebar,
    toggleRightSidebar,
    setLeftSidebarWidth,
    setRightSidebarWidth,
  } = useLayoutStore();
  const openSettings = useSettingsModalStore((state) => state.open);
  const isStartingUp = useStartupStore((state) => state.isStartingUp);
  useEffect(() => {
    const win = getCurrentWindow();
    const showPromise = win?.show?.();
    if (showPromise && typeof showPromise.catch === 'function') {
      showPromise
        .catch(() => {})
        .then(() => {
          const focusPromise = win?.setFocus?.();
          if (focusPromise && typeof focusPromise.catch === 'function') {
            focusPromise.catch(() => {});
          }
        });
    }
  }, []);
  return (
    <PlayerShell onContextMenu={(e) => e.preventDefault()}>
      <GlobalShortcuts />
      <ConnectedTitleBar />
      <FlatpakWarningBanner />
      <ConnectedTopBar />
      {!isStartingUp && (
        <SafeComponentBoundary name="StreamResolver">
          <StreamResolver />
        </SafeComponentBoundary>
      )}
      <SoundProvider>
        <PlayerWorkspace className="flex flex-col md:grid">
          <div className="contents max-md:hidden">
            <PlayerWorkspace.LeftSidebar
              width={leftSidebar.width}
              isCollapsed={leftSidebar.isCollapsed}
              onWidthChange={setLeftSidebarWidth}
              onToggle={toggleLeftSidebar}
            >
              <SidebarNavigation isCompact={leftSidebar.isCollapsed}>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                  <SidebarNavigationItem
                    to="/dashboard"
                    icon={<GaugeIcon />}
                    label={t('dashboard')}
                  />
                  <SidebarNavigationItem
                    to="/favorites/albums"
                    icon={<DiscIcon />}
                    label={t('favoriteAlbums')}
                  />
                  <SidebarNavigationItem
                    to="/favorites/tracks"
                    icon={<MusicIcon />}
                    label={t('favoriteTracks')}
                  />
                  <SidebarNavigationItem
                    to="/favorites/artists"
                    icon={<UserIcon />}
                    label={t('favoriteArtists')}
                  />
                  <SidebarNavigationItem
                    to="/playlists"
                    icon={<ListMusicIcon />}
                    label={t('playlists')}
                  />
                  <SidebarNavigationItem
                    to="/history"
                    icon={<HistoryIcon />}
                    label={t('history')}
                  />
                  <SidebarNavigationItem
                    to="/sources"
                    icon={<CableIcon />}
                    label={t('sources')}
                  />
                </div>
                <SidebarNavigationItem
                  icon={<SettingsIcon />}
                  label={tPrefs('title')}
                  onClick={() => openSettings()}
                />
              </SidebarNavigation>
            </PlayerWorkspace.LeftSidebar>
          </div>

          <PlayerWorkspace.Main className="surface-background bg-background min-h-0 w-full flex-1 overflow-hidden md:pb-0">
            <RouteTransition />
          </PlayerWorkspace.Main>

          <div className="contents max-md:hidden">
            <PlayerWorkspace.RightSidebar
              width={rightSidebar.width}
              isCollapsed={rightSidebar.isCollapsed}
              onWidthChange={setRightSidebarWidth}
              onToggle={toggleRightSidebar}
              headerActions={<QueueHeaderActions />}
              footer={<ConnectedStreamVerification />}
            >
              <ConnectedQueuePanel isCollapsed={rightSidebar.isCollapsed} />
            </PlayerWorkspace.RightSidebar>
          </div>
        </PlayerWorkspace>
      </SoundProvider>

      <SafeComponentBoundary name="ConnectedPlayerBar">
        <ConnectedPlayerBar />
      </SafeComponentBoundary>
      <SafeComponentBoundary name="ConnectedNowPlayingModal">
        <ConnectedNowPlayingModal />
      </SafeComponentBoundary>
      <SafeComponentBoundary name="MobileNavigationBar">
        <MobileNavigationBar />
      </SafeComponentBoundary>
      <Toaster />
      <ConnectedSettingsModal />
      <DevTools />
    </PlayerShell>
  );
};

export const Route = createRootRoute({
  component: RootComponent,
});
