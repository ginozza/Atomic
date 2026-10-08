import { useNavigate } from '@tanstack/react-router';
import {
  ChevronDown,
  ListOrdered,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { FC, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { pickArtwork } from '@nuclearplayer/model';
import { RepeatMode } from '@nuclearplayer/plugin-sdk';
import {
  cn,
  FavoriteButton,
  formatTimeSeconds,
  MarqueeText,
} from '@nuclearplayer/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { playbackManager } from '../../services/playback';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useNowPlayingModalStore } from '../../stores/nowPlayingModalStore';
import { usePlayerDecorationsStore } from '../../stores/playerDecorationsStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { PlayerDecorationsOverlay } from './PlayerDecorationsOverlay';

const formatSafeTime = (seconds: number | undefined): string => {
  if (typeof formatTimeSeconds === 'function') {
    try {
      return formatTimeSeconds(seconds);
    } catch {
      // fallback
    }
  }
  const safe =
    Number.isFinite(seconds) && seconds && seconds > 0
      ? Math.floor(seconds)
      : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ConnectedNowPlayingModal: FC = () => {
  const { isOpen, close } = useNowPlayingModalStore();

  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const isLoading = currentItem?.status === 'loading';
  const { goToNext, goToPrevious } = useQueueStore(
    useShallow((state) => ({
      goToNext: state.goToNext,
      goToPrevious: state.goToPrevious,
    })),
  );

  const { status, seek, duration } = useSoundStore(
    useShallow((state) => ({
      status: state.status,
      seek: state.seek,
      duration: state.duration,
    })),
  );

  const [shuffleEnabled, setShuffleEnabled] =
    useCoreSetting<boolean>('playback.shuffle');
  const [repeatMode, setRepeatMode] =
    useCoreSetting<RepeatMode>('playback.repeat');

  const { isTrackFavorite, addTrack, removeTrack } = useFavoritesStore();
  const { isEditMode, setEditMode } = usePlayerDecorationsStore(
    useShallow((state) => ({
      isEditMode: state.isEditMode,
      setEditMode: state.setEditMode,
    })),
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleBack = () => {
      if (isEditMode) {
        setEditMode(false);
      } else {
        close();
      }
    };
    window.addEventListener('nuclear:android:back', handleBack);
    return () => window.removeEventListener('nuclear:android:back', handleBack);
  }, [isOpen, isEditMode, setEditMode, close]);

  if (!isOpen) {
    return null;
  }

  const track = currentItem?.track;
  const isPlaying = status === 'playing';
  const artworkItems = Array.isArray(track?.artwork?.items)
    ? track.artwork.items
    : undefined;
  const artwork =
    pickArtwork(track?.artwork, 'cover', 1200) ??
    pickArtwork(track?.artwork, 'thumbnail', 600) ??
    artworkItems?.find((item) => item?.purpose === 'cover') ??
    (artworkItems && artworkItems.length > 0
      ? artworkItems[artworkItems.length - 1]
      : undefined);

  const artworkUrl =
    artwork?.url ??
    (track?.source?.provider === 'youtube' && track.source?.id
      ? `https://i.ytimg.com/vi/${track.source.id}/hq720.jpg`
      : undefined);

  const title = track?.title ?? 'Not Playing';
  const artist =
    (Array.isArray(track?.artists)
      ? track.artists
          .map((artistCredit) =>
            typeof artistCredit === 'string'
              ? artistCredit
              : (artistCredit?.name ?? ''),
          )
          .filter(Boolean)
          .join(', ')
      : typeof track?.artists === 'string'
        ? track.artists
        : '') || 'Unknown Artist';
  const albumName =
    track?.album?.title ??
    (track?.album as unknown as { name?: string } | undefined)?.name ??
    'Queue';

  const safePosition = Number.isFinite(seek) && seek >= 0 ? seek : 0;
  const safeDuration =
    Number.isFinite(duration) && duration >= 0 ? duration : 0;

  const isFavorite = Boolean(track?.source && isTrackFavorite(track.source));
  const handleToggleFavorite = () => {
    if (!track?.source) {
      return;
    }
    if (isFavorite) {
      removeTrack(track.source);
    } else {
      addTrack(track);
    }
  };

  const handleToggleShuffle = () => {
    setShuffleEnabled(!shuffleEnabled);
  };

  const handleToggleRepeat = () => {
    const modes: Array<RepeatMode> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode ?? 'off');
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  const handleOpenQueue = () => {
    close();
    navigate({ to: '/queue' });
  };

  return (
    <div
      data-testid="now-playing-modal"
      className="bg-background/95 animate-in fade-in fixed inset-0 z-50 flex flex-col justify-between px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),2.5rem)] backdrop-blur-3xl duration-200 select-none"
    >
      {/* Player Decorations Overlay */}
      <PlayerDecorationsOverlay
        isEditMode={isEditMode}
        onExitEditMode={() => setEditMode(false)}
      />

      {/* Top Bar */}
      <div className="relative z-30 flex shrink-0 items-center justify-between">
        <button
          type="button"
          data-testid="now-playing-close-button"
          onClick={() => {
            if (isEditMode) {
              setEditMode(false);
            }
            close();
          }}
          className="text-foreground/80 hover:text-foreground -ml-2 rounded-full p-2 transition-transform active:scale-90"
          aria-label="Close"
        >
          <ChevronDown className="h-7 w-7" />
        </button>

        <div className="flex min-w-0 flex-col items-center px-2 text-center">
          <span className="text-primary text-[10px] font-bold tracking-widest uppercase">
            {isEditMode ? 'Modo Decoración' : 'Playing From'}
          </span>
          <span className="text-foreground max-w-[200px] truncate text-xs font-bold">
            {isEditMode ? 'Toca, arrastra, escala o rota' : albumName}
          </span>
        </div>

        {isEditMode ? (
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="bg-primary text-primary-foreground rounded-xl px-3 py-1 text-xs font-bold shadow-md transition-transform active:scale-95"
          >
            Listo
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleOpenQueue}
              className="text-foreground/80 hover:text-foreground -mr-2 rounded-full p-2 transition-transform active:scale-90"
              aria-label="Queue"
            >
              <ListOrdered className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>

      {/* Album Artwork */}
      <div
        className={`relative z-10 my-4 flex min-h-0 flex-1 items-center justify-center ${
          isEditMode ? 'pointer-events-none' : ''
        }`}
      >
        <div className="bg-muted/40 relative flex aspect-square w-full max-w-[340px] items-center justify-center overflow-hidden rounded-3xl shadow-2xl">
          {artworkUrl ? (
            <img
              key={artworkUrl}
              src={artworkUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <Music
              key="modal-placeholder-music"
              className="text-muted-foreground/40 h-20 w-20"
            />
          )}
        </div>
      </div>

      {/* Track Info & Like Button */}
      <div
        className={`relative z-30 mb-4 flex shrink-0 items-center justify-between gap-4 ${
          isEditMode ? 'pointer-events-none' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <MarqueeText
            key="modal-title"
            text={title}
            className="text-foreground text-2xl font-black tracking-tight"
          />
          <MarqueeText
            key="modal-artist"
            text={artist}
            className="text-muted-foreground mt-0.5 text-sm font-semibold"
          />
        </div>
        {track?.source && (
          <FavoriteButton
            size="default"
            isFavorite={isFavorite}
            onToggle={handleToggleFavorite}
            ariaLabelAdd="Add to favorites"
            ariaLabelRemove="Remove from favorites"
          />
        )}
      </div>

      {/* Scrubber / Progress Bar */}
      <div
        className={`relative z-30 mb-6 shrink-0 space-y-1 ${
          isEditMode ? 'pointer-events-none' : ''
        }`}
      >
        <div className="relative flex h-2 w-full items-center">
          <input
            type="range"
            min={0}
            max={safeDuration || 1}
            value={safePosition}
            onChange={(e) =>
              useSoundStore.getState().seekTo(Number(e.target.value))
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full focus:outline-none"
            style={{
              background: `linear-gradient(to right, var(--seekbar-track, var(--primary)) ${safeDuration > 0 ? (safePosition / safeDuration) * 100 : 0}%, color-mix(in srgb, var(--seekbar, var(--primary)) 20%, transparent) ${safeDuration > 0 ? (safePosition / safeDuration) * 100 : 0}%)`,
              accentColor: 'var(--seekbar-track, var(--primary))',
            }}
            aria-label="Seek progress"
          />
        </div>
        <div className="text-muted-foreground flex justify-between font-mono text-xs font-medium">
          <span>{formatSafeTime(safePosition)}</span>
          <span>{formatSafeTime(safeDuration)}</span>
        </div>
      </div>

      {/* Main Playback Controls */}
      <div
        className={`relative z-30 mb-4 flex shrink-0 items-center justify-between px-2 ${
          isEditMode ? 'pointer-events-none' : ''
        }`}
      >
        <button
          type="button"
          onClick={handleToggleShuffle}
          className={`rounded-full p-3 transition-transform active:scale-90 ${
            shuffleEnabled
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Shuffle"
        >
          <Shuffle className="h-5 w-5" />
        </button>

        <button
          type="button"
          data-testid="now-playing-previous-button"
          onClick={goToPrevious}
          className="text-foreground hover:text-primary rounded-full p-3 transition-transform active:scale-90"
          aria-label="Previous"
        >
          <SkipBack className="h-7 w-7 fill-current" />
        </button>

        <button
          type="button"
          data-testid="now-playing-play-pause-button"
          onClick={playbackManager.toggle}
          className={cn(
            'bg-foreground text-background flex h-16 w-16 items-center justify-center rounded-full shadow-xl transition-transform active:scale-90',
            isLoading &&
              'surface-toxic-shimmer text-black ring-4 ring-primary shadow-[0_0_28px_rgba(0,255,163,0.7)] animate-toxic-glow',
          )}
          aria-label={isLoading ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
          aria-busy={isLoading ? 'true' : undefined}
        >
          {isPlaying ? (
            <Pause className="h-7 w-7 fill-current" />
          ) : (
            <Play
              className={cn(
                'ml-1 h-7 w-7 fill-current',
                isLoading && 'animate-pulse',
              )}
            />
          )}
        </button>

        <button
          type="button"
          data-testid="now-playing-next-button"
          onClick={goToNext}
          className="text-foreground hover:text-primary rounded-full p-3 transition-transform active:scale-90"
          aria-label="Next"
        >
          <SkipForward className="h-7 w-7 fill-current" />
        </button>

        <button
          type="button"
          onClick={handleToggleRepeat}
          className={`rounded-full p-3 transition-transform active:scale-90 ${
            repeatMode !== 'off'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Repeat"
        >
          {repeatMode === 'one' ? (
            <Repeat1 className="h-5 w-5" />
          ) : (
            <Repeat className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
};
