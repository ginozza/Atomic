import { LazyStore } from '@tauri-apps/plugin-store';
import { produce } from 'immer';
import partition from 'lodash-es/partition';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';

import type {
  Queue,
  QueueItem,
  StreamCandidate,
  Track,
} from '@nuclearplayer/model';
import { stripResolutionState } from '@nuclearplayer/model';

import { eventBus } from '../services/eventBus';
import { Logger } from '../services/logger';
import { errorMessage } from '../utils/errorMessage';
import { secondsToMs } from '../utils/time';
import { getSetting } from './settingsStore';
import { useSoundStore } from './soundStore';

const QUEUE_FILE = 'queue.json';
const store = new LazyStore(QUEUE_FILE);
let persistenceQueue: Promise<void> = Promise.resolve();

type QueueStore = Queue & {
  isLoading: boolean;
  isReady: boolean;
  shuffleOrder: number[];
  shufflePosition: number;
  loadFromDisk: () => Promise<void>;
  addToQueue: (tracks: Track[]) => void;
  addNext: (tracks: Track[]) => void;
  addAt: (tracks: Track[], index: number) => void;
  removeByIds: (ids: string[]) => void;
  removeByIndices: (indices: number[]) => void;
  clearQueue: () => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  updateItemState: (id: string, updates: Partial<QueueItem>) => void;
  updateCandidate: (itemId: string, candidate: StreamCandidate) => void;
  removeCandidate: (itemId: string, candidateId: string) => void;
  selectCandidate: (itemId: string, candidateId: string) => void;
  goToNext: () => void;
  goToPrevious: () => void;
  goToIndex: (index: number) => void;
  goToId: (id: string) => void;
  getCurrentItem: () => QueueItem | undefined;
  getItemById: (id: string) => QueueItem | undefined;
  buildShuffleDeck: (fixedCurrentIndex?: number) => void;
  clearShuffleDeck: () => void;
};

const createQueueItem = (track: Track): QueueItem => ({
  id: uuidv4(),
  track: stripResolutionState(track),
  status: 'idle',
  addedAtIso: new Date().toISOString(),
});

const fisherYatesShuffle = (indices: number[]): number[] => {
  const result = [...indices];
  for (let position = result.length - 1; position > 0; position--) {
    const swapPosition = Math.floor(Math.random() * (position + 1));
    const temp = result[position];
    result[position] = result[swapPosition];
    result[swapPosition] = temp;
  }
  return result;
};

const getLinearIndex = (
  state: Pick<QueueStore, 'items' | 'currentIndex'>,
  direction: 'forward' | 'backward',
): number => {
  const { items, currentIndex } = state;
  const repeatMode = (getSetting('core.playback.repeat') as string) ?? 'off';

  if (items.length === 0) {
    return currentIndex;
  }

  if (direction === 'forward') {
    if (currentIndex < items.length - 1) {
      return currentIndex + 1;
    }
    return repeatMode === 'all' ? 0 : currentIndex;
  }

  if (currentIndex > 0) {
    return currentIndex - 1;
  }

  return repeatMode === 'all' ? items.length - 1 : currentIndex;
};

const emitSkip = (): void => {
  eventBus.emit('playbackSkipped', {
    positionMs: secondsToMs(useSoundStore.getState().seek),
  });
};

const resetPlaybackOnTrackChange = (): void => {
  const isPlaying = useSoundStore.getState().status === 'playing';
  if (isPlaying) {
    useSoundStore.getState().setSrc(null);
  } else {
    useSoundStore.getState().stop();
    useSoundStore.getState().setSrc(null);
  }
};

const saveToDisk = (): void => {
  persistenceQueue = persistenceQueue.then(async () => {
    try {
      const state = useQueueStore.getState();
      await store.set('queue.items', state.items);
      await store.set('queue.currentIndex', state.currentIndex);
      await store.save();
    } catch (error) {
      Logger.queue.error(`Failed to save queue: ${errorMessage(error)}`);
    }
  });
};

const withPersistence = <T extends unknown[]>(
  fn: (...args: T) => void,
): ((...args: T) => void) => {
  return (...args: T) => {
    fn(...args);
    void saveToDisk();
  };
};

export const useQueueStore = create<QueueStore>((set, get) => ({
  items: [],
  currentIndex: 0,
  isReady: false,
  isLoading: false,
  shuffleOrder: [],
  shufflePosition: -1,

  buildShuffleDeck: (fixedCurrentIndex?: number) => {
    const { items } = get();
    const current = fixedCurrentIndex ?? get().currentIndex;
    if (items.length === 0) return;

    const remaining = items
      .map((_, idx) => idx)
      .filter((idx) => idx !== current);
    const shuffled = fisherYatesShuffle(remaining);
    set({ shuffleOrder: [current, ...shuffled], shufflePosition: 0 });
  },

  clearShuffleDeck: () => {
    set({ shuffleOrder: [], shufflePosition: -1 });
  },

  loadFromDisk: async () => {
    set({ isLoading: true });
    const storedItems = await store.get<QueueItem[]>('queue.items');
    const storedCurrentIndex = await store.get<number>('queue.currentIndex');
    const items = Array.isArray(storedItems) ? storedItems : [];
    const currentIndex =
      typeof storedCurrentIndex === 'number' ? storedCurrentIndex : 0;

    const sanitizedIndex =
      currentIndex >= 0 && currentIndex < items.length ? currentIndex : 0;

    const resetItems = items.map((item) => ({
      ...item,
      status: 'idle' as const,
      error: undefined,
    }));

    set({
      items: resetItems,
      currentIndex: sanitizedIndex,
      shuffleOrder: [],
      shufflePosition: -1,
      isReady: true,
      isLoading: false,
    });

    Logger.queue.info(`Loaded ${resetItems.length} items from disk`);
  },

  addToQueue: withPersistence((tracks: Track[]) => {
    set(
      produce((state: QueueStore) => {
        const newItems = tracks.map(createQueueItem);
        state.items.push(...newItems);
      }),
    );
    Logger.queue.debug(`Added ${tracks.length} tracks to queue`);
  }),

  addNext: (tracks: Track[]) => {
    const { currentIndex } = get();
    get().addAt(tracks, currentIndex + 1);
  },

  addAt: withPersistence((tracks: Track[], index: number) => {
    set(
      produce((state: QueueStore) => {
        const newItems = tracks.map(createQueueItem);
        state.items.splice(index, 0, ...newItems);
        if (index <= state.currentIndex) {
          state.currentIndex += newItems.length;
        }
      }),
    );
  }),

  removeByIds: withPersistence((ids: string[]) => {
    const currentItem = get().getCurrentItem();
    const currentItemRemoved = currentItem && ids.includes(currentItem.id);

    set(
      produce((state: QueueStore) => {
        const idsSet = new Set(ids);
        const removedBeforeCurrent = state.items
          .slice(0, state.currentIndex)
          .filter((item) => idsSet.has(item.id)).length;

        state.items = state.items.filter((item) => !idsSet.has(item.id));
        state.currentIndex = Math.max(
          0,
          state.currentIndex - removedBeforeCurrent,
        );

        if (state.currentIndex >= state.items.length) {
          state.currentIndex = Math.max(0, state.items.length - 1);
        }
        state.shuffleOrder = [];
        state.shufflePosition = -1;
      }),
    );

    if (currentItemRemoved || get().items.length === 0) {
      useSoundStore.getState().stop();
      useSoundStore.getState().setSrc(null);
    }
  }),

  removeByIndices: withPersistence((indices: number[]) => {
    const currentIndex = get().currentIndex;
    const currentIndexRemoved = indices.includes(currentIndex);

    set(
      produce((state: QueueStore) => {
        const indicesSet = new Set(indices);
        const removedBeforeCurrent = indices.filter(
          (idx) => idx < state.currentIndex,
        ).length;

        state.items = state.items.filter((_, idx) => !indicesSet.has(idx));
        state.currentIndex = Math.max(
          0,
          state.currentIndex - removedBeforeCurrent,
        );

        if (state.currentIndex >= state.items.length) {
          state.currentIndex = Math.max(0, state.items.length - 1);
        }
        state.shuffleOrder = [];
        state.shufflePosition = -1;
      }),
    );

    if (currentIndexRemoved || get().items.length === 0) {
      useSoundStore.getState().stop();
      useSoundStore.getState().setSrc(null);
    }
  }),

  clearQueue: withPersistence(() => {
    const itemCount = get().items.length;
    set({ items: [], currentIndex: 0, shuffleOrder: [], shufflePosition: -1 });
    useSoundStore.getState().stop();
    useSoundStore.getState().setSrc(null);
    Logger.queue.info(`Cleared queue (${itemCount} items removed)`);
  }),

  reorder: withPersistence((fromIndex: number, toIndex: number) => {
    set(
      produce((state: QueueStore) => {
        const [movedItem] = state.items.splice(fromIndex, 1);
        state.items.splice(toIndex, 0, movedItem);

        if (state.currentIndex === fromIndex) {
          state.currentIndex = toIndex;
        } else if (
          fromIndex < state.currentIndex &&
          toIndex >= state.currentIndex
        ) {
          state.currentIndex -= 1;
        } else if (
          fromIndex > state.currentIndex &&
          toIndex <= state.currentIndex
        ) {
          state.currentIndex += 1;
        }
        state.shuffleOrder = [];
        state.shufflePosition = -1;
      }),
    );
  }),

  updateItemState: withPersistence(
    (id: string, updates: Partial<QueueItem>) => {
      set(
        produce((state: QueueStore) => {
          const item = state.items.find((item) => item.id === id);
          if (item) {
            Object.assign(item, updates);
          }
        }),
      );
    },
  ),

  updateCandidate: (itemId: string, candidate: StreamCandidate) => {
    const item = get().getItemById(itemId);
    if (!item) {
      return;
    }
    const { track } = item;
    get().updateItemState(itemId, {
      track: {
        ...track,
        streamCandidates: track.streamCandidates?.map((current) => {
          if (current.id === candidate.id) {
            return candidate;
          }
          return current;
        }),
      },
    });
  },

  removeCandidate: (itemId: string, candidateId: string) => {
    const item = get().getItemById(itemId);
    if (!item) {
      return;
    }
    const { track } = item;
    get().updateItemState(itemId, {
      track: {
        ...track,
        streamCandidates: track.streamCandidates?.filter(
          (current) => current.id !== candidateId,
        ),
      },
    });
  },

  selectCandidate: (itemId: string, candidateId: string) => {
    const item = get().getItemById(itemId);
    if (!item) {
      return;
    }
    const { track } = item;
    const [selected, rest] = partition(
      track.streamCandidates ?? [],
      (candidate) => candidate.id === candidateId,
    );
    const retried = selected.map((candidate) => ({
      ...candidate,
      failed: false,
    }));
    get().updateItemState(itemId, {
      track: { ...track, streamCandidates: [...retried, ...rest] },
    });
  },

  goToNext: withPersistence(() => {
    const state = get();
    const shuffleEnabled = (getSetting('core.playback.shuffle') as boolean) ?? false;
    const repeatMode = (getSetting('core.playback.repeat') as string) ?? 'off';

    if (shuffleEnabled) {
      let { shuffleOrder, shufflePosition } = state;

      if (shuffleOrder.length === 0 || shufflePosition === -1) {
        get().buildShuffleDeck(state.currentIndex);
        shuffleOrder = get().shuffleOrder;
        shufflePosition = get().shufflePosition;
      }

      const nextPosition = shufflePosition + 1;

      if (nextPosition < shuffleOrder.length) {
        const nextIndex = shuffleOrder[nextPosition];
        emitSkip();
        resetPlaybackOnTrackChange();
        set({ currentIndex: nextIndex, shufflePosition: nextPosition });
        Logger.queue.debug(`Shuffle: moved to deck position ${nextPosition} (track index ${nextIndex})`);
      } else if (repeatMode === 'all') {
        get().buildShuffleDeck(state.currentIndex);
        const freshOrder = get().shuffleOrder;
        const freshPosition = 1;
        if (freshOrder.length > 1) {
          const nextIndex = freshOrder[freshPosition];
          emitSkip();
          resetPlaybackOnTrackChange();
          set({ currentIndex: nextIndex, shufflePosition: freshPosition });
        }
      } else {
        useSoundStore.getState().stop();
        useSoundStore.getState().setSrc(null);
      }
      return;
    }

    const nextIndex = getLinearIndex(state, 'forward');
    if (nextIndex !== state.currentIndex) {
      emitSkip();
      resetPlaybackOnTrackChange();
      set({ currentIndex: nextIndex });
      Logger.queue.debug(`Moved to next track (index ${nextIndex})`);
    } else {
      useSoundStore.getState().stop();
      useSoundStore.getState().setSrc(null);
    }
  }),

  goToPrevious: withPersistence(() => {
    const state = get();
    const shuffleEnabled = (getSetting('core.playback.shuffle') as boolean) ?? false;

    if (shuffleEnabled) {
      const { shuffleOrder, shufflePosition } = state;

      if (shuffleOrder.length > 0 && shufflePosition > 0) {
        const prevPosition = shufflePosition - 1;
        const prevIndex = shuffleOrder[prevPosition];
        emitSkip();
        resetPlaybackOnTrackChange();
        set({ currentIndex: prevIndex, shufflePosition: prevPosition });
        Logger.queue.debug(`Shuffle: stepped back to deck position ${prevPosition} (track index ${prevIndex})`);
      }
      return;
    }

    const previousIndex = getLinearIndex(state, 'backward');
    if (previousIndex !== state.currentIndex) {
      emitSkip();
      resetPlaybackOnTrackChange();
      set({ currentIndex: previousIndex });
      Logger.queue.debug(`Moved to previous track (index ${previousIndex})`);
    }
  }),

  goToIndex: withPersistence((index: number) => {
    const { items, currentIndex } = get();
    if (index >= 0 && index < items.length && index !== currentIndex) {
      emitSkip();
      resetPlaybackOnTrackChange();
      set({ currentIndex: index, shuffleOrder: [], shufflePosition: -1 });
    }
  }),

  goToId: withPersistence((id: string) => {
    const { items, currentIndex } = get();
    const index = items.findIndex((item) => item.id === id);
    if (index !== -1 && index !== currentIndex) {
      emitSkip();
      resetPlaybackOnTrackChange();
      set({ currentIndex: index, shuffleOrder: [], shufflePosition: -1 });
    }
  }),

  getCurrentItem: () => {
    const { items, currentIndex } = get();
    return items[currentIndex];
  },

  getItemById: (id: string) => {
    return get().items.find((item) => item.id === id);
  },
}));

export const initializeQueueStore = async (): Promise<void> => {
  await useQueueStore.getState().loadFromDisk();
};
