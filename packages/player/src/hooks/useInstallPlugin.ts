import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslation } from '@nuclearplayer/i18n';

import {
  pluginMarketplaceApi,
  type MarketplacePlugin,
} from '../apis/pluginMarketplaceApi';
import { Logger } from '../services/logger';
import {
  hasBundledPluginFallback,
  installBundledPluginFallback,
} from '../services/plugins/bundledPlugins';
import {
  cleanupDownload,
  downloadAndExtractPlugin,
} from '../services/plugins/pluginDownloader';
import { upsertRegistryEntry } from '../services/plugins/pluginRegistry';
import { usePluginStore } from '../stores/pluginStore';
import { errorMessage } from '../utils/errorMessage';

type InstallPluginParams = {
  plugin: MarketplacePlugin;
};

const DOWNLOAD_TIMEOUT_MS = 45000;

export const useInstallPlugin = () => {
  const { t } = useTranslation('plugins');
  const loadPluginFromPath = usePluginStore((state) => state.loadPluginFromPath);
  const enablePlugin = usePluginStore((state) => state.enablePlugin);

  return useMutation({
    mutationFn: async ({ plugin }: InstallPluginParams) => {
      let extractedPath: string | null = null;
      let resolvedVersion = plugin.version ?? '0.1.2';

      try {
        const downloadAction = async (): Promise<string> => {
          let downloadUrl = plugin.downloadUrl;
          let version = plugin.version;

          if (!downloadUrl || !version) {
            try {
              const release = await pluginMarketplaceApi.getLatestRelease(plugin.repo);
              downloadUrl = release.downloadUrl;
              version = release.version;
            } catch (error) {
              Logger.plugins.warn(
                `Failed to fetch release from GitHub API: ${errorMessage(error)}`,
              );
              if (!downloadUrl) {
                throw error;
              }
            }
          }

          if (!downloadUrl) {
            throw new Error(`No download URL available for ${plugin.name}`);
          }

          resolvedVersion = version ?? '1.0.0';
          return await downloadAndExtractPlugin({
            pluginId: plugin.id,
            downloadUrl,
          });
        };

        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(
            () => reject(new Error('Plugin download timed out')),
            DOWNLOAD_TIMEOUT_MS,
          ),
        );

        extractedPath = await Promise.race([downloadAction(), timeoutPromise]);
      } catch (dlError) {
        Logger.plugins.warn(
          `Plugin download failed or timed out for ${plugin.id}: ${errorMessage(dlError)}`,
        );

        if (hasBundledPluginFallback(plugin.id)) {
          Logger.plugins.info(`Using bundled fallback for ${plugin.id}`);
          extractedPath = await installBundledPluginFallback(plugin.id);
        } else {
          throw dlError;
        }
      }

      try {
        const now = new Date().toISOString();
        await upsertRegistryEntry({
          id: plugin.id,
          version: resolvedVersion,
          path: extractedPath,
          installationMethod: 'store',
          enabled: false,
          installedAt: now,
          lastUpdatedAt: now,
        });

        await loadPluginFromPath(extractedPath);
        if (!usePluginStore.getState().getPlugin(plugin.id)) {
          throw new Error(`Failed to load plugin: ${plugin.name}`);
        }
        await enablePlugin(plugin.id);
        return { plugin, version: resolvedVersion };
      } finally {
        await cleanupDownload(plugin.id);
      }
    },
    onError: (error, { plugin }) => {
      const message = errorMessage(error);
      toast.error(t('store.installError.title', { name: plugin.name }), {
        description: message,
      });
    },
  });
};
