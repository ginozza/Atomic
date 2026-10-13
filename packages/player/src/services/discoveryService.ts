import { i18n } from '@nuclearplayer/i18n';
import type { Track } from '@nuclearplayer/model';

import { useQueueStore } from '../stores/queueStore';
import { useSettingsStore } from '../stores/settingsStore';
import { reportError } from '../utils/logging';
import { discoveryHost } from './discoveryHost';
import { eventBus } from './eventBus';
import { providersHost } from './providersHost';

const CONTEXT_SIZE = 10;
const RECOMMENDATION_LIMIT = 5;

export const initDiscoveryService = () => {
  return eventBus.on('trackStarted', async () => {
    const isEnabled = useSettingsStore
      .getState()
      .getValue('core.playback.discovery');
    const activeDiscoveryId = providersHost.getActive('discovery');
    if (!isEnabled || !providersHost.get(activeDiscoveryId, 'discovery')) {
      return;
    }

    const { items, currentIndex } = useQueueStore.getState();
    const isLastTrack = currentIndex >= items.length - 1;
    if (!isLastTrack) {
      return;
    }

    const variety =
      (useSettingsStore
        .getState()
        .getValue('core.playback.discoveryVariety') as number) ?? 0.5;

    const contextTracks: Track[] = items
      .slice(-CONTEXT_SIZE)
      .map((item) => item.track);

    try {
      const collected: Track[] = [];
      const seenKeys = new Set(
        items.map((it) =>
          `${it.track.artists?.[0]?.name}::${it.track.title}`.toLowerCase(),
        ),
      );

      for (let iteration = 0; iteration < 5; iteration++) {
        const queryContext = [...contextTracks, ...collected];
        const recommendations = await discoveryHost.getRecommendations(
          queryContext,
          { variety, limit: RECOMMENDATION_LIMIT },
        );
        if (!recommendations || recommendations.length === 0) {
          break;
        }
        let addedInIteration = false;
        for (const rec of recommendations) {
          const key = `${rec.artists?.[0]?.name}::${rec.title}`.toLowerCase();
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            collected.push(rec);
            addedInIteration = true;
          }
        }
        if (!addedInIteration || collected.length >= RECOMMENDATION_LIMIT) {
          break;
        }
      }

      if (collected.length > 0) {
        useQueueStore.getState().addToQueue(collected);
      }
    } catch (error) {
      reportError('discovery', {
        userMessage: i18n.t('discovery:recommendationError'),
        error,
      });
    }
  });
};
