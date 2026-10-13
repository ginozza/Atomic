import { useRouter } from '@tanstack/react-router';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { FC, useEffect, useState } from 'react';

import { Dialog, SettingsPanel, usePlatform } from '@nuclearplayer/ui';

import { useNowPlayingModalStore } from '../stores/nowPlayingModalStore';
import { usePlayerDecorationsStore } from '../stores/playerDecorationsStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';
import { SocialLinks } from './SocialLinks';
import { useSettingsNavigation } from './useSettingsNavigation';
import { VersionString } from './VersionString';

const SETTINGS_CATEGORIES = [
  { id: 'general', defaultLabel: 'General' },
  { id: 'playback', defaultLabel: 'Playback' },
  { id: 'appearance', defaultLabel: 'Appearance & Themes' },
  {
    id: 'decorations',
    defaultLabel: 'Player Decorations',
  },
  { id: 'app-plugins', defaultLabel: 'Plugins & Extensions' },
  { id: 'themes', defaultLabel: 'Theme Store' },
  { id: 'integrations', defaultLabel: 'Connectivity & Jam' },
  { id: 'shortcuts', defaultLabel: 'Keyboard Shortcuts' },
  { id: 'updates', defaultLabel: 'Updates' },
  { id: 'logs', defaultLabel: 'Logs & Diagnostics' },
  { id: 'whats-new', defaultLabel: "What's New" },
];

export const ConnectedSettingsModal: FC = () => {
  const router = useRouter();
  const platform = usePlatform();
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return (
      platform === 'android' || platform === 'ios' || window.innerWidth < 768
    );
  });

  useEffect(() => {
    if (platform === 'android' || platform === 'ios') {
      setIsMobile(true);
      return;
    }
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [platform]);

  const { isOpen, close, activeItemId, selectItem } = useSettingsModalStore();
  const { sections, content } = useSettingsNavigation();

  const activeCategory = SETTINGS_CATEGORIES.find(
    (item) => item.id === activeItemId,
  );

  if (!isMobile) {
    return (
      <SettingsPanel
        isOpen={isOpen}
        onClose={close}
        sections={sections}
        navigationFooter={
          <div className="flex flex-col items-center gap-2">
            <SocialLinks />
            <VersionString />
          </div>
        }
      >
        {content}
      </SettingsPanel>
    );
  }

  return (
    <Dialog.Root
      isOpen={isOpen}
      onClose={close}
      showCloseButton={false}
      className="surface-background fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none flex-col rounded-none border-0 p-0 pt-[max(env(safe-area-inset-top),1rem)]"
    >
      {activeItemId === null ? (
        <div className="flex h-full flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between px-4 py-3">
            <h1 className="font-heading text-foreground text-xl font-black tracking-tight">
              Settings
            </h1>
            <button
              type="button"
              onClick={close}
              className="text-foreground/80 hover:text-foreground -mr-1 rounded-full p-2 transition-transform active:scale-95"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
            <button
              type="button"
              onClick={() => {
                close();
                void router.navigate({ to: '/history' });
              }}
              className="border-primary/20 bg-primary/10 hover:bg-primary/20 flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all active:scale-[0.99]"
            >
              <span className="text-primary text-base font-bold">
                View Listening History
              </span>
              <ChevronRightIcon className="text-primary ml-2 h-5 w-5 shrink-0" />
            </button>

            <div className="border-border/30 bg-card/40 divide-border/20 flex flex-col divide-y overflow-hidden rounded-2xl border">
              {SETTINGS_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`settings-navigation-item-${item.id}`}
                  onClick={() => {
                    if (item.id === 'decorations') {
                      close();
                      useNowPlayingModalStore.getState().open();
                      usePlayerDecorationsStore.getState().setEditMode(true);
                      return;
                    }
                    selectItem(item.id);
                  }}
                  className="hover:bg-card/80 active:bg-card flex w-full items-center justify-between px-4 py-4 text-left transition-all active:scale-[0.99]"
                >
                  <span className="text-foreground text-base font-medium">
                    {item.defaultLabel}
                  </span>
                  <ChevronRightIcon className="text-muted-foreground ml-2 h-5 w-5 shrink-0" />
                </button>
              ))}
            </div>

            <div className="text-muted-foreground flex flex-col items-center gap-3 pt-6 pb-2 text-center text-xs">
              <SocialLinks />
              <VersionString />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => selectItem(null)}
              className="bg-muted/60 text-foreground flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-bold transition-transform active:scale-95"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span>Settings</span>
            </button>
            <h2 className="font-heading text-foreground max-w-[50%] truncate text-center text-base font-black">
              {activeCategory?.defaultLabel ?? activeItemId}
            </h2>
            <button
              type="button"
              onClick={close}
              className="text-foreground/80 hover:text-foreground rounded-xl p-1.5 transition-transform active:scale-95"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
            {content}
          </div>
        </div>
      )}
    </Dialog.Root>
  );
};
