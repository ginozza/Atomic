import { useCanGoBack, useRouter, useRouterState } from '@tanstack/react-router';
import { ChevronLeftIcon, HistoryIcon, SettingsIcon } from 'lucide-react';
import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';

import { useSettingsModalStore } from '../stores/settingsModalStore';
import { JamQrCodeButton } from './JamQrCodeButton';

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
  const canGoBack = useCanGoBack();
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
    <header className="h-13 flex items-center justify-between px-4 select-none shrink-0 bg-transparent border-0">
      <div className="flex items-center gap-2 min-w-0">
        {showBackButton && (
          <button
            type="button"
            onClick={() => router.history.back()}
            className="p-1.5 -ml-1 rounded-xl text-foreground hover:bg-muted active:scale-95 transition-transform shrink-0"
            aria-label="Back"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
        )}
        <h1
          data-testid="topbar-section-title"
          className="font-heading font-black text-xl tracking-tight text-foreground truncate"
        >
          {sectionTitle}
        </h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          data-testid="topbar-history-button"
          onClick={() => router.navigate({ to: '/history' })}
          className="p-1.5 rounded-xl text-foreground hover:bg-muted active:scale-95 transition-transform"
          aria-label="History"
        >
          <HistoryIcon className="w-5 h-5 text-muted-foreground hover:text-foreground" />
        </button>
        <JamQrCodeButton />
        <button
          type="button"
          data-testid="topbar-settings-button"
          onClick={() => openSettings()}
          className="p-1.5 rounded-xl text-foreground hover:bg-muted active:scale-95 transition-transform"
          aria-label="Settings"
        >
          <SettingsIcon className="w-5 h-5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </header>
  );
};
