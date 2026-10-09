import '../../test/mocks/plugin-fs';

import * as fs from '@tauri-apps/plugin-fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  NuclearPlugin,
  ProviderDescriptor,
} from '@nuclearplayer/plugin-sdk';

import {
  ESSENTIAL_PLUGIN_IDS,
  FALLBACK_PLUGINS,
  hasBundledPluginFallback,
  installBundledPluginFallback,
} from './bundledPlugins';

describe('bundledPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defines the 4 essential plugins in ESSENTIAL_PLUGIN_IDS', () => {
    expect(ESSENTIAL_PLUGIN_IDS).toEqual([
      'nuclear-plugin-something',
      'nuclear-plugin-youtube',
      'nuclear-plugin-lastfm',
      'nuclear-plugin-deezer-dashboard',
    ]);
  });

  it('has fallback definitions for all essential plugins', () => {
    for (const pluginId of ESSENTIAL_PLUGIN_IDS) {
      expect(hasBundledPluginFallback(pluginId)).toBe(true);
      const fallback = FALLBACK_PLUGINS[pluginId];
      expect(fallback).toBeDefined();
      expect(fallback.version).toBeTruthy();
      expect(fallback.main).toBeTruthy();
      expect(fallback.code).toBeTruthy();
      expect(fallback.manifest).toBeDefined();
      expect(fallback.manifest.name).toBe(pluginId);
    }
  });

  it('returns false for unknown plugin id', () => {
    expect(hasBundledPluginFallback('non-existent-plugin')).toBe(false);
  });

  it('throws error when installing non-existent fallback plugin', async () => {
    await expect(
      installBundledPluginFallback('non-existent-plugin'),
    ).rejects.toThrow('No bundled fallback available for non-existent-plugin');
  });

  it('writes package.json and code file during installBundledPluginFallback', async () => {
    const writtenFiles: Record<string, string> = {};
    vi.mocked(fs.writeTextFile).mockImplementation(
      async (filePath: string, content: string) => {
        writtenFiles[filePath] = content;
      },
    );

    const targetDir = await installBundledPluginFallback(
      'nuclear-plugin-something',
    );
    expect(targetDir).toContain('nuclear-plugin-something');
    expect(fs.writeTextFile).toHaveBeenCalledTimes(2);

    expect(
      writtenFiles['plugins/.downloads/nuclear-plugin-something/package.json'],
    ).toBeDefined();
    const manifest = JSON.parse(
      writtenFiles['plugins/.downloads/nuclear-plugin-something/package.json'],
    );
    expect(manifest.name).toBe('nuclear-plugin-something');
    expect(
      writtenFiles['plugins/.downloads/nuclear-plugin-something/dist/index.js'],
    ).toBeDefined();
  });

  it('evaluates and registers providers for all 4 essential plugins on onEnable', async () => {
    const evaluatePlugin = (code: string): NuclearPlugin => {
      const exports = {} as Record<string, unknown>;
      const module = { exports } as { exports: unknown };
      const allowedModules: Record<string, unknown> = {
        '@nuclearplayer/plugin-sdk': {},
        '@nuclearplayer/ui': {},
        react: {},
        'react/jsx-runtime': {},
      };
      const fakeRequire = (id: string) => {
        if (id in allowedModules) {
          return allowedModules[id];
        }
        throw new Error(`Module ${id} not found`);
      };

      new Function('exports', 'module', 'require', code)(
        exports,
        module,
        fakeRequire,
      );
      return (
        (module.exports as { default?: NuclearPlugin }).default ??
        (module.exports as NuclearPlugin)
      );
    };

    const registered: ProviderDescriptor[] = [];
    const fakeApi = {
      Http: { fetch: async () => ({}) },
      Events: { on: vi.fn() },
      Settings: { register: vi.fn(), registerWidget: vi.fn() },
      Ytdlp: { search: vi.fn(), getStream: vi.fn() },
      Providers: {
        register: (p: ProviderDescriptor) => {
          registered.push(p);
        },
        unregister: vi.fn(),
      },
    };

    const spotify = evaluatePlugin(
      FALLBACK_PLUGINS['nuclear-plugin-something'].code,
    );
    await spotify.onEnable(fakeApi as never);
    expect(
      registered.some(
        (provider) => provider.id === 'spotify' && provider.kind === 'metadata',
      ),
    ).toBe(true);

    const lastfm = evaluatePlugin(
      FALLBACK_PLUGINS['nuclear-plugin-lastfm'].code,
    );
    await lastfm.onEnable(fakeApi as never);
    expect(
      registered.some(
        (provider) =>
          provider.id === 'lastfm-discovery' && provider.kind === 'discovery',
      ),
    ).toBe(true);

    const deezer = evaluatePlugin(
      FALLBACK_PLUGINS['nuclear-plugin-deezer-dashboard'].code,
    );
    await deezer.onEnable(fakeApi as never);
    expect(
      registered.some(
        (provider) =>
          provider.id === 'deezer-dashboard' && provider.kind === 'dashboard',
      ),
    ).toBe(true);
    expect(
      registered.some(
        (provider) =>
          provider.id === 'deezer-playlists' && provider.kind === 'playlists',
      ),
    ).toBe(true);

    const youtube = evaluatePlugin(
      FALLBACK_PLUGINS['nuclear-plugin-youtube'].code,
    );
    await youtube.onEnable(fakeApi as never);
    expect(
      registered.some(
        (provider) =>
          provider.id === 'youtube' && provider.kind === 'streaming',
      ),
    ).toBe(true);
  });
});
