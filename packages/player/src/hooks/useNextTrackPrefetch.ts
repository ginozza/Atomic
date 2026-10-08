import { useEffect, useRef } from 'react';

import { Logger } from '../services/logger';
import { isStreamExpired, streamingHost } from '../services/streamingHost';
import { candidatesForTrack } from '../services/streamResolution/candidateSource';
import { useQueueStore } from '../stores/queueStore';
import { getSetting } from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';

const PREFETCH_THRESHOLD_SECONDS = 30;

const getNextItem = () => {
  const { items, currentIndex, shuffleOrder, shufflePosition } =
    useQueueStore.getState();

  const shuffleEnabled =
    (getSetting('core.playback.shuffle') as boolean) ?? false;
  const repeatMode = (getSetting('core.playback.repeat') as string) ?? 'off';

  if (shuffleEnabled && shuffleOrder.length > 0 && shufflePosition !== -1) {
    const nextPosition = shufflePosition + 1;
    if (nextPosition < shuffleOrder.length) {
      return items[shuffleOrder[nextPosition]];
    }
    if (repeatMode === 'all' && shuffleOrder.length > 1) {
      return items[shuffleOrder[0]];
    }
    return undefined;
  }

  if (currentIndex < items.length - 1) {
    return items[currentIndex + 1];
  }
  if (repeatMode === 'all' && items.length > 0) {
    return items[0];
  }
  return undefined;
};

export const useNextTrackPrefetch = (): void => {
  const prefetchedItemIdRef = useRef<string | null>(null);
  const isPrefetchingRef = useRef(false);

  useEffect(() => {
    const prefetchNext = async (): Promise<void> => {
      const { seek, duration, status } = useSoundStore.getState();

      if (status !== 'playing') {
        return;
      }
      if (!duration || duration <= 0) {
        return;
      }

      const remaining = duration - seek;
      if (remaining > PREFETCH_THRESHOLD_SECONDS) {
        return;
      }

      const nextItem = getNextItem();
      if (!nextItem) {
        return;
      }

      if (nextItem.id === prefetchedItemIdRef.current) {
        return;
      }
      if (isPrefetchingRef.current) {
        return;
      }

      const existingCandidates = nextItem.track.streamCandidates?.filter(
        (candidate) => !candidate.failed && !isStreamExpired(candidate),
      );
      if (existingCandidates && existingCandidates.length > 0) {
        prefetchedItemIdRef.current = nextItem.id;
        return;
      }

      isPrefetchingRef.current = true;
      prefetchedItemIdRef.current = nextItem.id;
      Logger.queue.debug(
        `Prefetching stream for next track: ${nextItem.track.title}`,
      );

      try {
        const candidates = await candidatesForTrack(nextItem.track);
        if (!candidates || candidates.length === 0) {
          return;
        }

        const headCandidate = candidates[0];
        if (!headCandidate.stream || isStreamExpired(headCandidate)) {
          const resolved =
            await streamingHost.resolveStreamForCandidate(headCandidate);
          if (resolved && !resolved.failed) {
            useQueueStore.getState().updateCandidate(nextItem.id, resolved);
            Logger.queue.debug(
              `Prefetch complete for: ${nextItem.track.title}`,
            );
          }
        } else {
          useQueueStore.getState().updateItemState(nextItem.id, {
            track: { ...nextItem.track, streamCandidates: candidates },
          });
          Logger.queue.debug(
            `Prefetch used cached candidates for: ${nextItem.track.title}`,
          );
        }
      } catch {
        Logger.queue.warn(`Prefetch failed for ${nextItem.track.title}`);
      } finally {
        isPrefetchingRef.current = false;
      }
    };

    const interval = setInterval(() => {
      void prefetchNext();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = useQueueStore.subscribe((state, prevState) => {
      if (state.currentIndex !== prevState.currentIndex) {
        prefetchedItemIdRef.current = null;
        isPrefetchingRef.current = false;
      }
    });
    return unsubscribe;
  }, []);
};
