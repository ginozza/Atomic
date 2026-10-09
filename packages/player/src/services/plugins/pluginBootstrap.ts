import { normalize } from '@tauri-apps/api/path';
import gt from 'semver/functions/gt';

import { usePluginStore } from '../../stores/pluginStore';
import { useStartupStore } from '../../stores/startupStore';
import { errorMessage } from '../../utils/errorMessage';
import { Logger } from '../logger';
import { providersHost } from '../providersHost';
import {
  ESSENTIAL_PLUGIN_IDS,
  FALLBACK_PLUGINS,
  hasBundledPluginFallback,
  installBundledPluginFallback,
} from './bundledPlugins';
import { createPluginAPI } from './createPluginAPI';
import { checkAndUpdatePlugins } from './pluginAutoUpdate';
import { getPluginsDir } from './pluginDir';
import { cleanupDownload } from './pluginDownloader';
import { PluginLoader } from './PluginLoader';
import {
  getRegistryEntry,
  listRegistryEntries,
  setRegistryEntryWarnings,
} from './pluginRegistry';

export { ESSENTIAL_PLUGIN_IDS } from './bundledPlugins';

export const installAndEnableBundledPlugin = async (
  pluginId: string,
): Promise<void> => {
  if (!hasBundledPluginFallback(pluginId)) {
    Logger.plugins.warn(
      `No bundled fallback found for essential plugin ${pluginId}`,
    );
    return;
  }

  const extractedPath = await installBundledPluginFallback(pluginId);
  try {
    await usePluginStore.getState().loadPluginFromPath(extractedPath);
    await usePluginStore.getState().enablePlugin(pluginId);
  } finally {
    await cleanupDownload(pluginId);
  }
};

const isManagedPath = async (absPath: string): Promise<boolean> => {
  const normalizedPath = await normalize(absPath);
  const normalizedBase = await normalize(await getPluginsDir());
  return normalizedPath.startsWith(normalizedBase);
};

export const hydratePluginsFromRegistry = async (): Promise<void> => {
  useStartupStore.getState().startStartup();
  const now = Date.now();
  let entries = (await listRegistryEntries()).sort(
    (a, b) =>
      new Date(a.installedAt).getTime() - new Date(b.installedAt).getTime(),
  );

  if (entries.length === 0) {
    Logger.plugins.info(
      'Clean install detected: installing and enabling essential bundled plugins',
    );
    for (const pluginId of ESSENTIAL_PLUGIN_IDS) {
      try {
        await installAndEnableBundledPlugin(pluginId);
      } catch (error) {
        Logger.plugins.error(
          `Failed to install essential plugin ${pluginId}: ${errorMessage(error)}`,
        );
      }
    }
    entries = (await listRegistryEntries()).sort(
      (a, b) =>
        new Date(a.installedAt).getTime() - new Date(b.installedAt).getTime(),
    );
  }

  for (const entry of entries) {
    const fallback = FALLBACK_PLUGINS[entry.id];
    if (fallback && gt(fallback.version, entry.version)) {
      try {
        Logger.plugins.info(
          `Updating bundled plugin ${entry.id} from ${entry.version} to ${fallback.version}`,
        );
        await installAndEnableBundledPlugin(entry.id);
        continue;
      } catch (error) {
        Logger.plugins.warn(
          `Failed to auto-update bundled plugin ${entry.id}: ${errorMessage(error)}`,
        );
      }
    }

    // TODO: Support non-managed paths (dev plugins)
    if (!(await isManagedPath(entry.path))) {
      continue;
    }
    const existingPlugin = usePluginStore.getState().plugins[entry.id];
    if (existingPlugin && existingPlugin.enabled) {
      continue;
    }
    const pluginLoadStartTime = Date.now();
    try {
      const loader = new PluginLoader(entry.path);
      const metadata = await loader.loadMetadata();
      const api = createPluginAPI(metadata.id, metadata.displayName);
      const { instance } = await loader.load(api);
      const warnings = entry.warnings ?? loader.getWarnings() ?? [];
      usePluginStore.setState((state) => ({
        plugins: {
          ...state.plugins,
          [entry.id]: {
            metadata,
            path: entry.path,
            enabled: false,
            warning: warnings.length > 0,
            warnings,
            installationMethod: entry.installationMethod,
            originalPath: entry.originalPath,
            instance,
            api,
          },
        },
      }));
      if (entry.enabled) {
        await usePluginStore.getState().enablePlugin(entry.id);
      }
    } catch (error) {
      const message = errorMessage(error);
      const current = await getRegistryEntry(entry.id);
      const merged = Array.from(
        new Set([...(current?.warnings ?? []), message]),
      );
      await setRegistryEntryWarnings(entry.id, merged);
    } finally {
      const pluginLoadFinishTime = Date.now();
      useStartupStore
        .getState()
        .setPluginDuration(
          entry.id,
          pluginLoadFinishTime - pluginLoadStartTime,
        );
    }
  }

  providersHost.resolveActiveOnBootstrap();

  const startupFinishTime = Date.now();
  useStartupStore.getState().finishStartup(startupFinishTime - now);

  void checkAndUpdatePlugins();
};
