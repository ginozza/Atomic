import type { AudioSource } from '@nuclearplayer/hifi';
import type { QueueItem } from '@nuclearplayer/model';

import { useQueueStore } from '../../stores/queueStore';
import { getSetting } from '../../stores/settingsStore';
import { useSoundStore } from '../../stores/soundStore';
import { eventBus } from '../eventBus';

const PREVIOUS_RESTART_THRESHOLD_SECONDS = 3;

export type StartTrackOptions = {
  autoPlay: boolean;
};

export class PlaybackManager {
  private mountedItemId: string | null = null;
  private playRequested = false;

  constructor() {
    useSoundStore.subscribe((state) => {
      if (!state.src) {
        this.mountedItemId = null;
      }
    });
  }

  play = (): void => {
    const { status } = useSoundStore.getState();
    if (status === 'playing') {
      return;
    }
    if (status === 'paused') {
      useSoundStore.getState().play();
      return;
    }

    const item = useQueueStore.getState().getCurrentItem();
    if (!item) {
      return;
    }
    if (this.mountedItemId !== item.id) {
      this.playRequested = true;
      return;
    }

    useSoundStore.getState().play();
    eventBus.emit('trackStarted', item.track);
  };

  pause = (): void => {
    this.playRequested = false;
    useSoundStore.getState().pause();
  };

  toggle = (): void => {
    if (useSoundStore.getState().status === 'playing') {
      this.pause();
      return;
    }
    this.play();
  };

  previous = (): void => {
    const { seek, status } = useSoundStore.getState();
    if (status === 'playing' && seek > PREVIOUS_RESTART_THRESHOLD_SECONDS) {
      useSoundStore.getState().seekTo(0);
      return;
    }

    useQueueStore.getState().goToPrevious();
  };

  startTrack = (
    item: QueueItem,
    source: AudioSource,
    options: StartTrackOptions,
  ): void => {
    useSoundStore.getState().setSrc(source);
    this.mountedItemId = item.id;

    const isExplicitlyPaused = useSoundStore.getState().status === 'paused';
    const shouldPlay =
      (options.autoPlay && !isExplicitlyPaused) || this.playRequested;
    this.playRequested = false;

    if (!shouldPlay) {
      return;
    }

    useSoundStore.getState().play();

    const isResumingMidTrack = source.startPositionSeconds !== undefined;
    if (isResumingMidTrack) {
      return;
    }

    eventBus.emit('trackStarted', item.track);
  };

  finishTrack = (): void => {
    const item = useQueueStore.getState().getCurrentItem();
    if (!item) {
      return;
    }

    eventBus.emit('trackFinished', item.track);

    const repeatMode = (getSetting('core.playback.repeat') as string) ?? 'off';
    if (repeatMode === 'one') {
      useSoundStore.getState().seekTo(0);
      eventBus.emit('trackStarted', item.track);
      return;
    }

    const shuffleEnabled =
      (getSetting('core.playback.shuffle') as boolean) ?? false;
    if (shuffleEnabled) {
      useQueueStore.getState().goToNext();
      return;
    }

    const { items, currentIndex } = useQueueStore.getState();
    const isAtEnd = currentIndex >= items.length - 1 && repeatMode !== 'all';
    if (isAtEnd) {
      useSoundStore.getState().stop();
      useSoundStore.getState().setSrc(null);
      return;
    }

    useQueueStore.getState().goToNext();
  };
}

export const playbackManager = new PlaybackManager();
