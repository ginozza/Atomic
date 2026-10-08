import type { FC } from 'react';
import { useEffect, useRef } from 'react';

import type { AudioSource, SoundStatus } from '@nuclearplayer/hifi';

type YouTubeSoundProps = {
  src: AudioSource;
  status: SoundStatus;
  seek?: number;
  volume?: number;
  onTimeUpdate?: (args: { position: number; duration: number }) => void;
  onEnd?: () => void;
  onCanPlay?: () => void;
  onError?: (error: Error) => void;
  onSourceInvalid?: () => void;
};

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (args: { videoId: string; startSeconds?: number }) => void;
  cueVideoById?: (args: { videoId: string; startSeconds?: number }) => void;
  getPlayerState?: () => number;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: Record<string, unknown>,
      ) => YTPlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const extractVideoId = (inputUrl: string): string => {
  if (inputUrl.includes('v=')) {
    const match = inputUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) {
      return match[1];
    }
  }
  if (inputUrl.includes('youtu.be/')) {
    const match = inputUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) {
      return match[1];
    }
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(inputUrl)) {
    return inputUrl;
  }
  return inputUrl;
};

const loadYouTubeApi = (): Promise<void> => {
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existingScript) {
      const scriptElement = document.createElement('script');
      scriptElement.src = 'https://www.youtube.com/iframe_api';
      scriptElement.async = true;
      document.head.appendChild(scriptElement);
    }
  });
};

export const YouTubeSound: FC<YouTubeSoundProps> = ({
  src,
  status,
  seek,
  volume,
  onTimeUpdate,
  onEnd,
  onCanPlay,
  onError,
  onSourceInvalid,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const isReadyRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  const lastReportedPositionRef = useRef<number>(0);

  const statusRef = useRef(status);
  statusRef.current = status;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    let isDisposed = false;
    const videoId = extractVideoId(src.url);
    currentVideoIdRef.current = videoId;

    void loadYouTubeApi().then(() => {
      const wrapper = wrapperRef.current;
      if (isDisposed || !wrapper) {
        return;
      }

      if (playerRef.current && isReadyRef.current) {
        try {
          if (statusRef.current === 'playing') {
            playerRef.current.loadVideoById({
              videoId,
              startSeconds: src.startPositionSeconds ?? 0,
            });
            playerRef.current.playVideo();
          } else if (playerRef.current.cueVideoById) {
            playerRef.current.cueVideoById({
              videoId,
              startSeconds: src.startPositionSeconds ?? 0,
            });
          } else {
            playerRef.current.loadVideoById({
              videoId,
              startSeconds: src.startPositionSeconds ?? 0,
            });
            playerRef.current.pauseVideo();
          }
        } catch {
        }
        return;
      }

      if (!window.YT?.Player) {
        return;
      }

      try {
        wrapper.innerHTML = '';
        const playerElement = document.createElement('div');
        wrapper.appendChild(playerElement);

        playerRef.current = new window.YT.Player(playerElement, {
          videoId,
          playerVars: {
            autoplay: statusRef.current === 'playing' ? 1 : 0,
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
          },
          events: {
            onReady: (event: { target: YTPlayer }) => {
              isReadyRef.current = true;
              if (volumeRef.current !== undefined) {
                event.target.setVolume(volumeRef.current);
              }

              const targetVideoId = currentVideoIdRef.current;
              if (targetVideoId && targetVideoId !== videoId) {
                if (statusRef.current === 'playing') {
                  event.target.loadVideoById({ videoId: targetVideoId });
                } else if (event.target.cueVideoById) {
                  event.target.cueVideoById({ videoId: targetVideoId });
                }
              }

              if (statusRef.current === 'playing') {
                event.target.playVideo();
              }
              onCanPlay?.();
            },
            onStateChange: (event: { data: number }) => {
              if (event.data === 1) {
                onCanPlay?.();
              } else if (event.data === 0) {
                if (statusRef.current === 'playing') {
                  onEnd?.();
                }
              } else if (event.data === 2 && statusRef.current === 'playing') {
                playerRef.current?.playVideo();
              } else if (event.data === 5 && statusRef.current === 'playing') {
                playerRef.current?.playVideo();
              }
            },
            onError: (event: { data: number }) => {
              const errorCode = event.data;
              if (errorCode === 150 || errorCode === 101 || errorCode === 2) {
                onSourceInvalid?.();
              }
              onError?.(new Error(`YouTube playback failed (${errorCode})`));
            },
          },
        });
      } catch {
      }
    });

    return () => {
      isDisposed = true;
      try {
        playerRef.current?.stopVideo();
        playerRef.current?.destroy();
      } catch {
      }
      playerRef.current = null;
      isReadyRef.current = false;
      if (wrapperRef.current) {
        wrapperRef.current.innerHTML = '';
      }
    };
  }, [src.url, src.startPositionSeconds]);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.stopVideo();
        playerRef.current?.destroy();
      } catch {
      }
      playerRef.current = null;
      isReadyRef.current = false;
      if (wrapperRef.current) {
        wrapperRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) {
      return;
    }

    try {
      if (status === 'playing') {
        playerRef.current.playVideo();
      } else if (status === 'paused') {
        playerRef.current.pauseVideo();
      } else if (status === 'stopped') {
        playerRef.current.pauseVideo();
        playerRef.current.seekTo(0, true);
      }
    } catch {
    }
  }, [status]);

  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current || seek === undefined) {
      return;
    }

    const delta = Math.abs(seek - lastReportedPositionRef.current);
    if (delta > 1.5) {
      lastReportedPositionRef.current = seek;
      try {
        playerRef.current.seekTo(seek, true);
      } catch {
        // Safe seek
      }
    }
  }, [seek]);

  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current || volume === undefined) {
      return;
    }

    try {
      playerRef.current.setVolume(volume);
    } catch {
      // Safe volume update
    }
  }, [volume]);

  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const intervalTimer = setInterval(() => {
      if (!playerRef.current || !isReadyRef.current) {
        return;
      }

      try {
        const position = playerRef.current.getCurrentTime() || 0;
        const duration = playerRef.current.getDuration() || 0;
        lastReportedPositionRef.current = position;
        if (duration > 0) {
          onTimeUpdate?.({ position, duration });
        }
      } catch {
        // Transition state
      }
    }, 250);

    return () => {
      clearInterval(intervalTimer);
    };
  }, [status, onTimeUpdate]);

  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const keepAliveTimer = setInterval(() => {
      if (statusRef.current === 'playing' && playerRef.current && isReadyRef.current) {
        try {
          const state = playerRef.current.getPlayerState?.();
          if (state === 2) {
            playerRef.current.playVideo();
          }
        } catch {
        }
      }
    }, 1000);

    return () => {
      clearInterval(keepAliveTimer);
    };
  }, [status]);

  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      if (statusRef.current === 'playing' && playerRef.current && isReadyRef.current) {
        try {
          playerRef.current?.playVideo();
        } catch {
        }
      }
    };

    window.addEventListener('blur', handleVisibilityOrBlur);
    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    return () => {
      window.removeEventListener('blur', handleVisibilityOrBlur);
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="fixed bottom-0 right-0 w-1 h-1 pointer-events-none opacity-0 z-0 overflow-hidden"
    />
  );
};
