import { useRouter } from '@tanstack/react-router';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from 'lucide-react';
import { FC } from 'react';

import { Dialog } from '@nuclearplayer/ui';

import { useNowPlayingModalStore } from '../stores/nowPlayingModalStore';
import { usePlayerDecorationsStore } from '../stores/playerDecorationsStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';
import { PlayerDecorationsSettings } from '../views/Settings/PlayerDecorationsSettings';
import { Logs } from '../views/Logs/Logs';
import { Plugins } from '../views/Plugins/Plugins';
import { Settings } from '../views/Settings/Settings';
import { Themes } from '../views/Themes/Themes';
import { WhatsNew } from '../views/WhatsNew';
import { SocialLinks } from './SocialLinks';
import { VersionString } from './VersionString';

const SETTINGS_CATEGORIES = [
  { id: 'general', defaultLabel: 'General' },
  { id: 'playback', defaultLabel: 'Playback' },
  { id: 'appearance', defaultLabel: 'Appearance & Themes' },
  { id: 'decorations', defaultLabel: 'Player Decorations (GIFs & Stickers)' },
  { id: 'plugins', defaultLabel: 'Plugins' },
  { id: 'app-plugins', defaultLabel: 'Plugins & Extensions' },
  { id: 'themes', defaultLabel: 'Theme Store' },
  { id: 'integrations', defaultLabel: 'Connectivity & Jam' },
  { id: 'history', defaultLabel: 'Listening History & Stats' },
  { id: 'updates', defaultLabel: 'Updates' },
  { id: 'logs', defaultLabel: 'Logs & Diagnostics' },
  { id: 'whats-new', defaultLabel: "What's New" },
];

export const ConnectedSettingsModal: FC = () => {
  const router = useRouter();
  const { isOpen, close, activeItemId, selectItem } = useSettingsModalStore();

  const activeCategory = SETTINGS_CATEGORIES.find(
    (item) => item.id === activeItemId,
  );

  return (
    <Dialog.Root
      isOpen={isOpen}
      onClose={close}
      showCloseButton={false}
      className="fixed inset-0 m-0 w-full h-full max-w-none max-h-none rounded-none border-0 p-0 flex flex-col surface-background z-50 pt-[max(env(safe-area-inset-top),1rem)]"
    >
      {activeItemId === null ? (
        <div className="flex flex-col h-full overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 shrink-0">
            <h1 className="font-heading font-black text-xl text-foreground tracking-tight">
              Settings
            </h1>
            <button
              type="button"
              onClick={close}
              className="p-2 -mr-1 rounded-full text-foreground/80 hover:text-foreground active:scale-95 transition-transform"
              aria-label="Close"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] space-y-4">
            <button
              type="button"
              onClick={() => {
                close();
                router.navigate({ to: '/history' });
              }}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-primary/10 hover:bg-primary/20 active:scale-[0.99] transition-all text-left border border-primary/20"
            >
              <span className="font-bold text-base text-primary">
                View Listening History
              </span>
              <ChevronRightIcon className="w-5 h-5 text-primary shrink-0 ml-2" />
            </button>

            <div className="flex flex-col divide-y divide-border/20 rounded-2xl bg-card/40 border border-border/30 overflow-hidden">
              {SETTINGS_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'decorations') {
                      close();
                      useNowPlayingModalStore.getState().open();
                      usePlayerDecorationsStore.getState().setEditMode(true);
                      return;
                    }
                    selectItem(item.id);
                  }}
                  className="w-full flex items-center justify-between px-4 py-4 hover:bg-card/80 active:bg-card active:scale-[0.99] transition-all text-left"
                >
                  <span className="font-medium text-base text-foreground">
                    {item.defaultLabel}
                  </span>
                  <ChevronRightIcon className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 pt-6 pb-2 text-center text-xs text-muted-foreground">
              <SocialLinks />
              <VersionString />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 shrink-0">
            <button
              type="button"
              onClick={() => selectItem(null)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold text-sm text-foreground bg-muted/60 active:scale-95 transition-transform"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <h2 className="font-heading font-black text-base text-foreground truncate max-w-[50%] text-center">
              {activeCategory?.defaultLabel ?? activeItemId}
            </h2>
            <button
              type="button"
              onClick={close}
              className="p-1.5 rounded-xl text-foreground/80 hover:text-foreground active:scale-95 transition-transform"
              aria-label="Close"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-2 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
            {activeItemId === 'decorations' && <PlayerDecorationsSettings />}
            {activeItemId === 'app-plugins' && <Plugins />}
            {activeItemId === 'themes' && <Themes />}
            {activeItemId === 'logs' && <Logs />}
            {activeItemId === 'whats-new' && <WhatsNew />}
            {activeItemId !== 'decorations' &&
              activeItemId !== 'app-plugins' &&
              activeItemId !== 'themes' &&
              activeItemId !== 'logs' &&
              activeItemId !== 'whats-new' && <Settings />}
          </div>
        </div>
      )}
    </Dialog.Root>
  );
};
