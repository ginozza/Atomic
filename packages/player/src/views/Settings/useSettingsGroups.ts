import groupBy from 'lodash-es/groupBy';
import { useMemo } from 'react';

import type { SettingDefinition } from '@nuclearplayer/plugin-sdk';
import { usePlatform } from '@nuclearplayer/ui';

import { useSettingsStore } from '../../stores/settingsStore';

export type CategoryGroup = {
  name: string;
  settings: SettingDefinition[];
};

const MOBILE_PLATFORMS = new Set(['android', 'ios']);

export const useSettingsGroups = (): CategoryGroup[] => {
  const { definitions } = useSettingsStore();
  const platform = usePlatform();
  const isMobile = MOBILE_PLATFORMS.has(platform);

  return useMemo(() => {
    const visibleSettings = Object.values(definitions).filter(
      (definition) =>
        !definition.hidden && !(isMobile && definition.desktopOnly),
    );

    const grouped = groupBy(
      visibleSettings,
      (definition) => definition.category,
    );

    return Object.entries(grouped)
      .sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB))
      .map(([name, settings]) => ({ name, settings }));
  }, [definitions, isMobile]);
};

export const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);
