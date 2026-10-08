import { Music, Pause, Play, SkipForward } from 'lucide-react';
import { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { pickArtwork } from '@nuclearplayer/model';
import { cn, MarqueeText } from '@nuclearplayer/ui';

import { playbackManager } from '../../services/playback';
import { useNowPlayingModalStore } from '../../stores/nowPlayingModalStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';

export const ConnectedFloatingMiniPlayer: FC = () => {
  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const goToNext = useQueueStore((state) => state.goToNext);
  const openNowPlaying = useNowPlayingModalStore((state) => state.open);

  const { status, seek, duration } = useSoundStore(
    useShallow((state) => ({
      status: state.status,
      seek: state.seek,
      duration: state.duration,
    })),
  );

  const track = currentItem?.track;
  const isPlaying = status === 'playing';
  const isLoading = currentItem?.status === 'loading';
  const artwork = pickArtwork(track?.artwork, 'thumbnail', 64);
  const coverUrl =
    artwork?.url ??
    (track?.source?.provider === 'youtube' && track.source.id
      ? `https://i.ytimg.com/vi/${track.source.id}/hq720.jpg`
      : undefined);
  const title = track?.title ?? 'Not Playing';
  const artist = track?.artists?.[0]?.name ?? 'Tap a song to start listening';

  const safePosition = Number.isFinite(seek) && seek >= 0 ? seek : 0;
  const safeDuration =
    Number.isFinite(duration) && duration >= 0 ? duration : 0;
  const progressPercent =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (safePosition / safeDuration) * 100))
      : 0;

  return (
    <div
      data-testid="floating-mini-player"
      className="surface-liquid-pill fixed right-3 bottom-[calc(4.75rem+max(env(safe-area-inset-bottom),0.75rem))] left-3 z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl p-2 shadow-2xl transition-all duration-300 md:hidden"
    >
      {/* Artwork & Track Info (clickable to open Now Playing modal) */}
      <button
        type="button"
        onClick={() => openNowPlaying()}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 pr-1 text-left focus:outline-none"
        aria-label="Open Now Playing"
      >
        <div className="bg-muted/60 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm">
          {coverUrl ? (
            <img
              key={coverUrl}
              src={coverUrl}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Music
              key="mini-placeholder-music"
              className="text-muted-foreground h-5 w-5"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <MarqueeText
            key="mini-title"
            text={title}
            className="text-foreground text-sm leading-tight font-semibold"
          />
          <MarqueeText
            key="mini-artist"
            text={artist}
            className="text-muted-foreground mt-0.5 text-xs leading-tight"
          />
        </div>
      </button>

      {/* Playback Controls */}
      <div className="flex shrink-0 items-center gap-1 pl-1">
        <button
          type="button"
          data-testid="mini-player-play-pause-button"
          onClick={(event) => {
            event.stopPropagation();
            playbackManager.toggle();
          }}
          className={cn(
            'text-foreground flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 hover:bg-white/10 focus:outline-none active:scale-90',
            isLoading &&
              'surface-toxic-shimmer text-black ring-2 ring-primary/80 animate-toxic-glow',
          )}
          aria-label={isLoading ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
          aria-busy={isLoading ? 'true' : undefined}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play
              className={cn(
                'ml-0.5 h-5 w-5 fill-current',
                isLoading && 'animate-pulse',
              )}
            />
          )}
        </button>

        <button
          type="button"
          data-testid="mini-player-next-button"
          onClick={(event) => {
            event.stopPropagation();
            goToNext();
          }}
          className="text-foreground flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 hover:bg-white/10 focus:outline-none active:scale-90"
          aria-label="Next Track"
        >
          <SkipForward className="h-5 w-5 fill-current" />
        </button>
      </div>

      {/* Progress Line */}
      <div className="bg-foreground/10 pointer-events-none absolute right-3 bottom-0 left-3 h-[2px] overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
