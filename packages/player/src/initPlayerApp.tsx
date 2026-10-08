import React from 'react';

import App from './App';
import { initLogStream } from './hooks/useLogStream';
import { applyThemeFromSettingsIfAny } from './services/advancedThemeService';
import { startAdvancedThemeWatcher } from './services/advancedThemeWatcher';
import { initBridgeHandler } from './services/bridge/bridgeHandler';
import { registerBuiltInCoreSettings } from './services/coreSettings';
import { initDiscordHandler } from './services/discordHandler';
import { initDiscoveryService } from './services/discoveryService';
import { initHistoryService } from './services/history';
import { initHttpApiHandler } from './services/httpApi';
import {
  applyLanguageFromSettings,
  initLanguageWatcher,
} from './services/languageService';
import { loadMarketplaceThemes } from './services/marketplaceThemeDirService';
import { initMcpHandler } from './services/mcp';
import { initMpdHandler } from './services/mpd';
import { initPlaybackEventBridge } from './services/playbackEventBridge';
import { hydratePluginsFromRegistry } from './services/plugins/pluginBootstrap';
import { ytdlpEnsureInstalled } from './services/tauri/commands';
import { initializeFavoritesStore } from './stores/favoritesStore';
import { initializePlaylistStore } from './stores/playlistStore';
import { initializeQueueStore } from './stores/queueStore';
import { initializeSettingsStore } from './stores/settingsStore';
import { initializeShortcutsStore } from './stores/shortcutsStore';
import { initializeStreamVerificationStore } from './stores/streamVerificationStore';
import { hydrateThemeStore } from './stores/themeStore';
import { useUpdaterStore } from './stores/updaterStore';

const initializeStores = () =>
  initializeSettingsStore()
    .then(() => initializeShortcutsStore())
    .then(() => initializeQueueStore())
    .then(() => initializeFavoritesStore())
    .then(() => initializeStreamVerificationStore())
    .then(() => initializePlaylistStore());

const initRemoteControl = () =>
  initMcpHandler()
    .then(() => initMpdHandler())
    .then(() => initHttpApiHandler())
    .then(() => initBridgeHandler());

const initLanguage = () =>
  applyLanguageFromSettings().then(() => initLanguageWatcher());

const initThemes = () =>
  startAdvancedThemeWatcher()
    .then(() => loadMarketplaceThemes())
    .then(() => hydrateThemeStore())
    .then(() => applyThemeFromSettingsIfAny());

const startBackgroundTasks = () => {
  void hydratePluginsFromRegistry();
  void useUpdaterStore.getState().checkForUpdate();
  void ytdlpEnsureInstalled();
};

export const initPlayerApp = async (
  root: ReturnType<typeof import('react-dom/client').createRoot>,
) => {
  initLogStream();

  // Suppress DOMException/AbortError from interrupted media operations (play(),
  // fetch cancellation on skip, Vite dynamic import cancellation) that would
  // otherwise bubble up and trigger React error boundaries.
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof DOMException) {
      event.preventDefault();
      return;
    }
    if (reason instanceof Error && reason.name === 'AbortError') {
      event.preventDefault();
    }
  });

  // React 18 also re-dispatches uncaught errors via window.dispatchEvent,
  // which bypasses unhandledrejection. Catch DOMException here too.
  window.addEventListener('error', (event) => {
    const error = event.error;
    if (error instanceof DOMException) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  await initializeStores()
    .then(() => registerBuiltInCoreSettings())
    .then(() => initDiscoveryService())
    .then(() => initRemoteControl())
    .then(() => initDiscordHandler())
    .then(() => initPlaybackEventBridge())
    .then(() => initHistoryService())
    .then(() => initLanguage())
    .then(() => initThemes())
    .then(() => startBackgroundTasks());

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};
