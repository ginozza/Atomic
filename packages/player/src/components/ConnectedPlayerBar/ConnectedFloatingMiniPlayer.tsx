import { FC } from 'react';
import { Music, Pause, Play, SkipForward } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { pickArtwork } from '@nuclearplayer/model';
import { MarqueeText } from '@nuclearplayer/ui';

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
  const artwork = pickArtwork(track?.artwork, 'thumbnail', 64);
  const coverUrl =
    artwork?.url ??
    (track?.source?.provider === 'youtube' && track.source.id
      ? `https://i.ytimg.com/vi/${track.source.id}/hq720.jpg`
      : undefined);
  const title = track?.title ?? 'Not Playing';
  const artist = track?.artists?.[0]?.name ?? 'Tap a song to start listening';

  const safePosition = Number.isFinite(seek) && seek >= 0 ? seek : 0;
  const safeDuration = Number.isFinite(duration) && duration >= 0 ? duration : 0;
  const progressPercent =
    safeDuration > 0 ? Math.min(100, Math.max(0, (safePosition / safeDuration) * 100)) : 0;

  return (
    <div
      data-testid="floating-mini-player"
      className="fixed bottom-[calc(4.75rem+max(env(safe-area-inset-bottom),0.75rem))] left-3 right-3 z-30 max-w-md mx-auto surface-liquid-pill rounded-2xl p-2 flex items-center justify-between shadow-2xl transition-all duration-300 md:hidden"
    >
      {/* Artwork & Track Info (clickable to open Now Playing modal) */}
      <button
        type="button"
        onClick={() => openNowPlaying()}
        className="flex-1 min-w-0 flex items-center gap-3 text-left focus:outline-none cursor-pointer pr-1"
        aria-label="Open Now Playing"
      >
        <div className="w-11 h-11 rounded-xl overflow-hidden shadow-sm flex items-center justify-center bg-muted/60 shrink-0">
          {coverUrl ? (
            <img
              key={coverUrl}
              src={coverUrl}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Music key="mini-placeholder-music" className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <MarqueeText
            key="mini-title"
            text={title}
            className="text-sm font-semibold text-foreground leading-tight"
          />
          <MarqueeText
            key="mini-artist"
            text={artist}
            className="text-xs text-muted-foreground leading-tight mt-0.5"
          />
        </div>
      </button>

      {/* Playback Controls */}
      <div className="flex items-center gap-1 shrink-0 pl-1">
        <button
          type="button"
          data-testid="mini-player-play-pause-button"
          onClick={(event) => {
            event.stopPropagation();
            playbackManager.toggle();
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 text-foreground transition-all duration-150 focus:outline-none"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        <button
          type="button"
          data-testid="mini-player-next-button"
          onClick={(event) => {
            event.stopPropagation();
            goToNext();
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90 text-foreground transition-all duration-150 focus:outline-none"
          aria-label="Next Track"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* Progress Line */}
      <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-foreground/10 rounded-full overflow-hidden pointer-events-none">
        <div
          className="h-full bg-primary transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
