import { RefObject, useEffect, useRef } from 'react';

import { SoundStatus } from '../types';

const HAVE_CURRENT_DATA = 2;

const isReadyToPlay = (audio: HTMLAudioElement): boolean =>
  audio.readyState >= HAVE_CURRENT_DATA;

export const usePlaybackStatus = (
  audioRef: RefObject<HTMLAudioElement | null>,
  status: SoundStatus,
  srcUrl: string | null,
  onError?: (error: Error) => void,
) => {
  const activeSrcRef = useRef(srcUrl);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!srcUrl) {
      audio.pause();
      return;
    }

    const srcChanged = srcUrl !== activeSrcRef.current;

    const tryPlay = () => {
      if (!isReadyToPlay(audio)) {
        return;
      }
      if (!audio.paused) {
        return;
      }
      activeSrcRef.current = srcUrl;
      audio.play().then(undefined, (domException: DOMException) => {
        if (domException.name === 'AbortError') {
          return;
        }
        onError?.(domException);
      });
    };

    switch (status) {
      case 'playing': {
        if (!srcChanged || isReadyToPlay(audio)) {
          tryPlay();
        }
        let pauseRetryTimeout: number | null = null;

        const onReady = () => tryPlay();
        const onPause = () => {
          if (status === 'playing' && !audio.ended) {
            pauseRetryTimeout = setTimeout(() => {
              if (status === 'playing' && audio.paused) {
                tryPlay();
              }
            }, 100);
          }
        };
        audio.addEventListener('canplay', onReady);
        audio.addEventListener('canplaythrough', onReady);
        audio.addEventListener('loadeddata', onReady);
        audio.addEventListener('pause', onPause);
        return () => {
          audio.removeEventListener('canplay', onReady);
          audio.removeEventListener('canplaythrough', onReady);
          audio.removeEventListener('loadeddata', onReady);
          audio.removeEventListener('pause', onPause);
          if (pauseRetryTimeout !== null) {
            clearTimeout(pauseRetryTimeout);
          }
        };
      }
      case 'paused': {
        audio.pause();
        return;
      }
      case 'stopped': {
        audio.pause();
        audio.currentTime = 0;
        return;
      }
    }
  }, [status, srcUrl, audioRef, onError]);
};
