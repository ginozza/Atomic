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
        resolutionKeyRef.current = null;
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

      if (
        currentItem.status === 'success' &&
        resolutionKeyRef.current?.startsWith(`${currentItem.id}:`)
      ) {
        const previousCandidateId = resolutionKeyRef.current.split(':')[1];
        const currentCandidateId = currentItem.track.streamCandidates?.[0]?.id;
        const candidateChanged =
          Boolean(currentCandidateId) &&
          Boolean(previousCandidateId) &&
          currentCandidateId !== previousCandidateId;

        const candidateFailedChanged =
          resolutionKeyRef.current !== resolutionKey && !candidateChanged;

        if (!candidateChanged && !candidateFailedChanged) {
          resolutionKeyRef.current = resolutionKey;
          return;
        }
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
      if (
        currentItem &&
        (!currentItem.status || currentItem.status === 'idle')
      ) {
        resolutionKeyRef.current = null;
        void streamResolution.resolve(currentItem, {
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

    const originalGoToIndex = useQueueStore.getState().goToIndex;
    useQueueStore.setState({
      goToIndex: (selectedIndex: number) => {
        const { items, currentIndex } = useQueueStore.getState();
        const item = items[selectedIndex];
        if (item && selectedIndex === currentIndex && item.status === 'error') {
          resolutionKeyRef.current = null;
          void streamResolution.resolveWithFreshStreams(item, {
            autoPlay: true,
          });
        }
        originalGoToIndex(selectedIndex);
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
      useQueueStore.setState({
        goToId: originalGoToId,
        goToIndex: originalGoToIndex,
      });
      unsubscribe();
    };
  }, []);
};
