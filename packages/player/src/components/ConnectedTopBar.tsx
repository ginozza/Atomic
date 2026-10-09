import {
  useCanGoBack,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { ChevronLeftIcon, HistoryIcon, SettingsIcon } from 'lucide-react';
import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import {
  Tooltip,
  TopBar,
  TopBarLogo,
  TopBarNavigation,
} from '@nuclearplayer/ui';

import { useAppVersion } from '../hooks/useAppVersion';
import { useCanGoForward } from '../hooks/useCanGoForward';
import { useCoreSetting } from '../hooks/useCoreSetting';
import { useFramelessWindow } from '../hooks/useFramelessWindow';
import { useSettingsModalStore } from '../stores/settingsModalStore';
import { ConnectedThemeController } from './ConnectedThemeController';
import { JamQrCodeButton } from './JamQrCodeButton';
import { SearchBox } from './SearchBox';
import { UpdateBadge } from './UpdateBadge';

const MAIN_TABS = [
  '/',
  '/dashboard',
  '/playlists',
  '/favorites',
  '/queue',
  '/search',
];

export const ConnectedTopBar: FC = () => {
  const router = useRouter();
  const routerState = useRouterState();
  const { version } = useAppVersion();
  const canGoBack = useCanGoBack();
  const canGoForward = useCanGoForward();
  const frameless = useFramelessWindow();
  const [isTitleBarEnabled] = useCoreSetting<boolean>(
    'appearance.customTitleBar',
  );
  const openSettings = useSettingsModalStore((state) => state.open);
  const { t } = useTranslation('navigation');
  const { t: tCommon } = useTranslation('common');

  const pathname = routerState.location.pathname;
  const isMainTab = MAIN_TABS.includes(pathname);
  const showBackButton = canGoBack && !isMainTab;

  let sectionTitle = t('dashboard');
  if (pathname.startsWith('/playlists')) {
    sectionTitle = t('playlists');
  } else if (pathname.startsWith('/favorites')) {
    sectionTitle = t('favoriteTracks');
  } else if (pathname.startsWith('/search')) {
    sectionTitle = tCommon('actions.search');
  } else if (pathname.startsWith('/history')) {
    sectionTitle = t('history');
  } else if (pathname.startsWith('/sources')) {
    sectionTitle = t('sources');
  } else if (pathname.startsWith('/queue')) {
    sectionTitle = 'Queue';
  }

  return (
    <>
      <div className="contents max-md:hidden">
        <TopBar draggable={frameless}>
          <div className="flex flex-row items-center gap-4">
            {!isTitleBarEnabled && (
              <Tooltip
                content={`Atomic ${version}`}
                side="bottom"
                wrapperClassName="flex items-center"
              >
                <TopBarLogo />
              </Tooltip>
            )}
            <TopBarNavigation
              onBack={() => router.history.back()}
              onForward={() => router.history.forward()}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
            />
            <UpdateBadge />
          </div>
          <SearchBox />
          <div className="flex flex-row items-center justify-end gap-2">
            <JamQrCodeButton />
            <ConnectedThemeController />
          </div>
        </TopBar>
      </div>

      <header className="flex h-13 shrink-0 items-center justify-between border-0 bg-transparent px-4 select-none md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          {showBackButton && (
            <button
              type="button"
              onClick={() => router.history.back()}
              className="text-foreground hover:bg-muted -ml-1 shrink-0 rounded-xl p-1.5 transition-transform active:scale-95"
              aria-label="Back"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          )}
          <h1
            data-testid="topbar-section-title"
            className="font-heading text-foreground truncate text-xl font-black tracking-tight"
          >
            {sectionTitle}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            data-testid="topbar-history-button"
            onClick={() => router.navigate({ to: '/history' })}
            className="text-foreground hover:bg-muted rounded-xl p-1.5 transition-transform active:scale-95"
            aria-label="History"
          >
            <HistoryIcon className="text-muted-foreground hover:text-foreground h-5 w-5" />
          </button>
          <JamQrCodeButton />
          <button
            type="button"
            data-testid="topbar-settings-button"
            onClick={() => openSettings()}
            className="text-foreground hover:bg-muted rounded-xl p-1.5 transition-transform active:scale-95"
            aria-label="Settings"
          >
            <SettingsIcon className="text-muted-foreground hover:text-foreground h-5 w-5" />
          </button>
        </div>
      </header>
    </>
  );
};
