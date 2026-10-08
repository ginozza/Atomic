import { useCallback } from 'react';

type AudioEventsProps = {
  onTimeUpdate?: (args: { position: number; duration: number }) => void;
  onError?: (error: Error) => void;
};

export const useAudioEvents = ({ onTimeUpdate, onError }: AudioEventsProps) => {
  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      if (onTimeUpdate) {
        const el = e.currentTarget;
        onTimeUpdate({ position: el.currentTime, duration: el.duration });
      }
    },
    [onTimeUpdate],
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      if (onError) {
        const el = e.currentTarget as HTMLAudioElement & {
          error: MediaError | null;
        };
        // MEDIA_ERR_ABORTED (code 1) means the browser stopped loading because
        // the src was changed or load() was called — normal during skip/track change.
        if (el.error?.code === MediaError.MEDIA_ERR_ABORTED) {
          return;
        }
        onError(new Error(el.error?.message || 'Unknown audio error'));
      }
    },
    [onError],
  );

  return {
    handleTimeUpdate,
    handleError,
  };
};
