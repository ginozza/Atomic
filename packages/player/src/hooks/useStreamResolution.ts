import { useEffect, useRef } from 'react';

import type { QueueItem } from '@nuclearplayer/model';

import { playbackManager } from '../services/playback';
import { streamResolution } from '../services/streamResolution';
import { useQueueStore } from '../stores/queueStore';
import { useStreamRecovery } from './useStreamRecovery';

const buildResolutionKey = (item: QueueItem): string => {
  const headCandidate = item.track.streamCandidates?.[0];
  return [item.id, headCandidate?.id, headCandidate?.failed].join(':');
};

export const useStreamResolution = (): void => {
  const resolutionKeyRef = useRef<string | null>(null);
  const isFirstResolutionRef = useRef(true);

  useStreamRecovery();

  useEffect(() => {
    const onCurrentItemChanged = (currentItem: QueueItem | undefined): void => {
      if (!currentItem) {
        return;
      }

      if (currentItem.status === 'loading') {
        return;
      }

      if (currentItem.status === 'error') {
        resolutionKeyRef.current = null;
        return;
      }

      const resolutionKey = buildResolutionKey(currentItem);
      if (resolutionKey === resolutionKeyRef.current) {
        return;
      }
      resolutionKeyRef.current = resolutionKey;

      const autoPlay = !isFirstResolutionRef.current;
      isFirstResolutionRef.current = false;
      void streamResolution.resolve(currentItem, { autoPlay });
    };

    const originalPlay = playbackManager.play;
    playbackManager.play = () => {
      const currentItem = useQueueStore.getState().getCurrentItem();
      if (currentItem?.status === 'error') {
        resolutionKeyRef.current = null;
        void streamResolution.resolveWithFreshStreams(currentItem, {
          autoPlay: true,
        });
        return;
      }
      originalPlay();
    };

    const originalGoToId = useQueueStore.getState().goToId;
    useQueueStore.setState({
      goToId: (selectedId: string) => {
        const currentItem = useQueueStore.getState().getCurrentItem();
        if (
          currentItem &&
          currentItem.id === selectedId &&
          currentItem.status === 'error'
        ) {
          resolutionKeyRef.current = null;
          void streamResolution.resolveWithFreshStreams(currentItem, {
            autoPlay: true,
          });
        }
        originalGoToId(selectedId);
      },
    });

    const unsubscribe = useQueueStore.subscribe((state) => {
      onCurrentItemChanged(state.getCurrentItem());
    });

    const initialItem = useQueueStore.getState().getCurrentItem();
    if (!initialItem) {
      isFirstResolutionRef.current = false;
    } else {
      onCurrentItemChanged(initialItem);
    }

    return () => {
      playbackManager.play = originalPlay;
      useQueueStore.setState({ goToId: originalGoToId });
      unsubscribe();
    };
  }, []);
};
