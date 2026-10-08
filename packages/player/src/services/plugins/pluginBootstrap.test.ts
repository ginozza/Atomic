import '../../test/mocks/plugin-fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePluginStore } from '../../stores/pluginStore';
import { providersHost } from '../providersHost';
import {
  ESSENTIAL_PLUGIN_IDS,
  hasBundledPluginFallback,
  installBundledPluginFallback,
} from './bundledPlugins';
import {
  hydratePluginsFromRegistry,
  installAndEnableBundledPlugin,
} from './pluginBootstrap';
import * as pluginDownloader from './pluginDownloader';
import * as pluginRegistry from './pluginRegistry';

vi.mock('./bundledPlugins', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./bundledPlugins')>();
  return {
    ...actual,
    installBundledPluginFallback: vi.fn(actual.installBundledPluginFallback),
    hasBundledPluginFallback: vi.fn(actual.hasBundledPluginFallback),
  };
});

describe('pluginBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('installAndEnableBundledPlugin', () => {
    it('installs and enables a bundled fallback plugin into managed storage', async () => {
      const mockExtractedPath = '/mock/extracted/path';
      vi.mocked(hasBundledPluginFallback).mockReturnValue(true);
      vi.mocked(installBundledPluginFallback).mockResolvedValue(
        mockExtractedPath,
      );

      const loadSpy = vi.fn().mockResolvedValue(undefined);
      const enableSpy = vi.fn().mockResolvedValue(undefined);
      const cleanupSpy = vi
        .spyOn(pluginDownloader, 'cleanupDownload')
        .mockResolvedValue(undefined);

      vi.spyOn(usePluginStore, 'getState').mockReturnValue({
        plugins: {},
        loadPluginFromPath: loadSpy,
        enablePlugin: enableSpy,
      } as never);

      await installAndEnableBundledPlugin('nuclear-plugin-something');

      expect(installBundledPluginFallback).toHaveBeenCalledWith(
        'nuclear-plugin-something',
      );
      expect(loadSpy).toHaveBeenCalledWith(mockExtractedPath);
      expect(enableSpy).toHaveBeenCalledWith('nuclear-plugin-something');
      expect(cleanupSpy).toHaveBeenCalledWith('nuclear-plugin-something');

      cleanupSpy.mockRestore();
    });

    it('skips installation if no bundled fallback exists', async () => {
      vi.mocked(hasBundledPluginFallback).mockReturnValue(false);

      const loadSpy = vi.fn();
      vi.spyOn(usePluginStore, 'getState').mockReturnValue({
        plugins: {},
        loadPluginFromPath: loadSpy,
        enablePlugin: vi.fn(),
      } as never);

      await installAndEnableBundledPlugin('unknown-plugin');

      expect(installBundledPluginFallback).not.toHaveBeenCalled();
      expect(loadSpy).not.toHaveBeenCalled();
    });
  });

  describe('hydratePluginsFromRegistry on clean install', () => {
    it('detects empty registry and automatically installs and enables all 4 essential plugins', async () => {
      let callCount = 0;
      vi.spyOn(pluginRegistry, 'listRegistryEntries').mockImplementation(
        async () => {
          callCount++;
          if (callCount === 1) {
            return []; // Clean install
          }
          return ESSENTIAL_PLUGIN_IDS.map((id) => ({
            id,
            version: '1.0.0',
            path: `/home/user/.local/share/com.nuclearplayer/plugins/${id}/1.0.0`,
            installationMethod: 'store' as const,
            enabled: true,
            installedAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
          }));
        },
      );

      const resolveActiveSpy = vi.spyOn(
        providersHost,
        'resolveActiveOnBootstrap',
      );

      const installedPlugins: string[] = [];
      const enabledPlugins: string[] = [];

      vi.mocked(hasBundledPluginFallback).mockReturnValue(true);
      vi.mocked(installBundledPluginFallback).mockImplementation(async (id) => {
        installedPlugins.push(id);
        return `/mock/extracted/${id}`;
      });

      vi.spyOn(pluginDownloader, 'cleanupDownload').mockResolvedValue(
        undefined,
      );

      vi.spyOn(usePluginStore, 'getState').mockReturnValue({
        plugins: {
          'nuclear-plugin-something': { enabled: true },
          'nuclear-plugin-youtube': { enabled: true },
          'nuclear-plugin-lastfm': { enabled: true },
          'nuclear-plugin-deezer-dashboard': { enabled: true },
        },
        loadPluginFromPath: vi.fn().mockResolvedValue(undefined),
        enablePlugin: vi.fn().mockImplementation(async (id: string) => {
          enabledPlugins.push(id);
        }),
      } as never);

      await hydratePluginsFromRegistry();

      expect(installedPlugins).toEqual([
        'nuclear-plugin-something',
        'nuclear-plugin-youtube',
        'nuclear-plugin-lastfm',
        'nuclear-plugin-deezer-dashboard',
      ]);
      expect(enabledPlugins).toEqual([
        'nuclear-plugin-something',
        'nuclear-plugin-youtube',
        'nuclear-plugin-lastfm',
        'nuclear-plugin-deezer-dashboard',
      ]);
      expect(resolveActiveSpy).toHaveBeenCalled();

      resolveActiveSpy.mockRestore();
    });
  });
});
