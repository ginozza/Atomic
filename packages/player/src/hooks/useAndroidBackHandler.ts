import { useEffect } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { useNowPlayingModalStore } from '../stores/nowPlayingModalStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';

export const useAndroidBackHandler = () => {
  const router = useRouter();
  const routerState = useRouterState();

  useEffect(() => {
    const handleBack = () => {
      const nowPlayingState = useNowPlayingModalStore.getState();
      if (nowPlayingState.isOpen) {
        nowPlayingState.close();
        return;
      }

      const settingsState = useSettingsModalStore.getState();
      if (settingsState.isOpen) {
        if (settingsState.activeItemId !== null) {
          settingsState.selectItem(null);
        } else {
          settingsState.close();
        }
        return;
      }

      const currentPath = routerState.location.pathname;
      const isHome = currentPath === '/' || currentPath === '/dashboard';

      if (!isHome) {
        if (window.history.length > 1) {
          router.history.back();
        } else {
          router.navigate({ to: '/dashboard' });
        }
        return;
      }

      const nuclearAndroid = (
        window as unknown as { NuclearAndroid?: { minimizeApp: () => void } }
      ).NuclearAndroid;

      if (nuclearAndroid?.minimizeApp) {
        nuclearAndroid.minimizeApp();
      } else {
        try {
          getCurrentWindow().minimize();
        } catch {
          // empty
        }
      }
    };

    window.addEventListener('nuclear:android:back', handleBack);
    return () => {
      window.removeEventListener('nuclear:android:back', handleBack);
    };
  }, [router, routerState.location.pathname]);
};
