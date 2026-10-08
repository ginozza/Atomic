import type { FC, PropsWithChildren } from 'react';
import { Component, useCallback, useEffect } from 'react';

import { LoggerProvider, Sound, SoundError } from '@nuclearplayer/hifi';
import type { TFunction } from '@nuclearplayer/i18n';
import { useTranslation } from '@nuclearplayer/i18n';

import { useCoreSetting } from '../hooks/useCoreSetting';
import { useHyperIslandBridge } from '../hooks/useHyperIslandBridge';
import { eventBus } from '../services/eventBus';
import { Logger } from '../services/logger';
import { playbackManager } from '../services/playback';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { errorMessage } from '../utils/errorMessage';
import { YouTubeSound } from './YouTubeSound';

type AudioErrorBoundaryState = { hasError: boolean };

class AudioErrorBoundary extends Component<
  PropsWithChildren,
  AudioErrorBoundaryState
> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AudioErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[AudioErrorBoundary] Caught audio component error:', error);
    setTimeout(() => {
      this.setState({ hasError: false });
    }, 200);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const describePlaybackError = (error: Error, t: TFunction): string => {
  if (error instanceof SoundError) {
    return t(`errors.hifi.${error.code}`, { details: error.details });
  }
  return errorMessage(error);
};

export const SoundProvider: FC<PropsWithChildren> = ({ children }) => {
  useHyperIslandBridge();
  const { t } = useTranslation('streaming');
  const { src, status, seek } = useSoundStore();
  const source = src;
  const [crossfadeMs] = useCoreSetting<number>('playback.crossfadeMs');
  const preload: HTMLAudioElement['preload'] = 'auto';
  const crossOrigin = '' as const;
  const [volume01] = useCoreSetting<number>('playback.volume');
  const [muted] = useCoreSetting<boolean>('playback.muted');
  const volumePercent = muted ? 0 : Math.round((volume01 ?? 1) * 100);

  useEffect(() => {
    LoggerProvider.init(Logger.streaming);
    try {
      Object.defineProperty(document, 'hidden', {
        get: () => false,
        configurable: true,
      });
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true,
      });
      Object.defineProperty(document, 'webkitVisibilityState', {
        get: () => 'visible',
        configurable: true,
      });
      const suppressVisibility = (visibilityEvent: Event) => {
        visibilityEvent.stopImmediatePropagation();
      };
      window.addEventListener('visibilitychange', suppressVisibility, true);
      document.addEventListener('visibilitychange', suppressVisibility, true);
      return () => {
        window.removeEventListener(
          'visibilitychange',
          suppressVisibility,
          true,
        );
        document.removeEventListener(
          'visibilitychange',
          suppressVisibility,
          true,
        );
      };
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (crossfadeMs !== undefined) {
      useSoundStore.getState().setCrossfadeMs(crossfadeMs);
    }
  }, [crossfadeMs]);

  const handleTimeUpdate = useCallback(
    ({ position, duration }: { position: number; duration: number }) => {
      if (useSoundStore.getState().src !== source) {
        return;
      }
      useSoundStore.getState().updatePlayback(position, duration);
    },
    [source],
  );

  const handleEnd = useCallback(() => {
    if (useSoundStore.getState().src !== source) {
      return;
    }
    playbackManager.finishTrack();
  }, [source]);

  const handleCanPlay = useCallback(() => {
    if (useSoundStore.getState().src !== source) {
      return;
    }
    const currentItem = useQueueStore.getState().getCurrentItem();
    if (currentItem) {
      useQueueStore
        .getState()
        .updateItemState(currentItem.id, { status: 'success' });
    }
  }, [source]);

  const handleSourceInvalid = useCallback(() => {
    if (useSoundStore.getState().src !== source) {
      return;
    }
    const currentTrack = useQueueStore.getState().getCurrentItem()?.track;
    if (currentTrack) {
      eventBus.emit('streamSourceInvalid', currentTrack);
    }
  }, [source]);

  const handleError = useCallback(
    (error: Error) => {
      if (useSoundStore.getState().src !== source) {
        return;
      }
      // AbortError and DOMException are expected when skipping tracks —
      // the browser interrupts in-flight play()/fetch() calls. Suppress them.
      if (error.name === 'AbortError' || error instanceof DOMException) {
        return;
      }
      // 'Unknown audio error' with no MediaError means the element was reset
      // mid-play (e.g. src changed on skip). Not a real error, ignore it.
      if (!error.message || error.message === 'Unknown audio error') {
        return;
      }
      // MEDIA_ERR_ABORTED (code 1) fires when the browser aborts loading
      // because the src was changed (normal on skip). Not a real error.
      if (
        error.message.includes('MEDIA_ERR_ABORTED') ||
        error.message.includes('The operation was aborted') ||
        error.message.includes('interrupted')
      ) {
        return;
      }
      const message = describePlaybackError(error, t);
      Logger.streaming.error(`Playback error: ${message}`);

      const currentItem = useQueueStore.getState().getCurrentItem();
      if (currentItem) {
        useQueueStore
          .getState()
          .updateItemState(currentItem.id, { status: 'error', error: message });
      }
    },
    [source, t],
  );

  const isYouTubeSource = src?.protocol === 'youtube';

  return (
    <>
      <AudioErrorBoundary>
        {!isYouTubeSource && (
          <Sound
            src={src}
            status={status}
            seek={seek}
            volume={volumePercent}
            preload={preload}
            crossOrigin={crossOrigin}
            onTimeUpdate={handleTimeUpdate}
            onEnd={handleEnd}
            onCanPlay={handleCanPlay}
            onError={handleError}
            onSourceInvalid={handleSourceInvalid}
          />
        )}
        {src && isYouTubeSource && status !== 'stopped' && (
          <YouTubeSound
            key={src.url}
            src={src}
            status={status}
            seek={seek}
            volume={volumePercent}
            onTimeUpdate={handleTimeUpdate}
            onEnd={handleEnd}
            onCanPlay={handleCanPlay}
            onError={handleError}
            onSourceInvalid={handleSourceInvalid}
          />
        )}
      </AudioErrorBoundary>
      {children}
    </>
  );
};
