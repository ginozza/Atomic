import { FC, useEffect } from 'react';
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
import { useShallow } from 'zustand/react/shallow';

import { pickArtwork } from '@nuclearplayer/model';
import { FavoriteButton, formatTimeSeconds, MarqueeText } from '@nuclearplayer/ui';
import { RepeatMode } from '@nuclearplayer/plugin-sdk';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { playbackManager } from '../../services/playback';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useNowPlayingModalStore } from '../../stores/nowPlayingModalStore';
import { usePlayerDecorationsStore } from '../../stores/playerDecorationsStore';
import { PlayerDecorationsOverlay } from './PlayerDecorationsOverlay';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';

const formatSafeTime = (seconds: number | undefined): string => {
  if (typeof formatTimeSeconds === 'function') {
    try {
      return formatTimeSeconds(seconds);
    } catch {
      // fallback
    }
  }
  const safe =
    Number.isFinite(seconds) && seconds && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ConnectedNowPlayingModal: FC = () => {
  const { isOpen, close } = useNowPlayingModalStore();

  const currentItem = useQueueStore((state) => state.getCurrentItem());
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
    if (!isOpen) return;
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
              : artistCredit?.name ?? '',
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
  const safeDuration = Number.isFinite(duration) && duration >= 0 ? duration : 0;

  const isFavorite = Boolean(track?.source && isTrackFavorite(track.source));
  const handleToggleFavorite = () => {
    if (!track?.source) return;
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
      className="fixed inset-0 z-50 flex flex-col justify-between bg-background/95 backdrop-blur-3xl px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),2.5rem)] select-none animate-in fade-in duration-200"
    >
      {/* Player Decorations Overlay */}
      <PlayerDecorationsOverlay
        isEditMode={isEditMode}
        onExitEditMode={() => setEditMode(false)}
      />

      {/* Top Bar */}
      <div className="relative z-30 flex items-center justify-between shrink-0">
        <button
          type="button"
          data-testid="now-playing-close-button"
          onClick={() => {
            if (isEditMode) {
              setEditMode(false);
            }
            close();
          }}
          className="p-2 -ml-2 rounded-full text-foreground/80 hover:text-foreground active:scale-90 transition-transform"
          aria-label="Close"
        >
          <ChevronDown className="w-7 h-7" />
        </button>

        <div className="flex flex-col items-center min-w-0 px-2 text-center">
          <span className="text-[10px] uppercase font-bold tracking-widest text-primary">
            {isEditMode ? 'Modo Decoración' : 'Playing From'}
          </span>
          <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
            {isEditMode ? 'Toca, arrastra, escala o rota' : albumName}
          </span>
        </div>

        {isEditMode ? (
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="px-3 py-1 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md active:scale-95 transition-transform"
          >
            Listo
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleOpenQueue}
              className="p-2 -mr-2 rounded-full text-foreground/80 hover:text-foreground active:scale-90 transition-transform"
              aria-label="Queue"
            >
              <ListOrdered className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* Album Artwork */}
      <div
        className={`relative z-10 flex-1 flex items-center justify-center my-4 min-h-0 ${
          isEditMode ? 'pointer-events-none' : ''
        }`}
      >
        <div className="relative w-full max-w-[340px] aspect-square rounded-3xl overflow-hidden shadow-2xl bg-muted/40 flex items-center justify-center">
          {artworkUrl ? (
            <img
              key={artworkUrl}
              src={artworkUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Music key="modal-placeholder-music" className="w-20 h-20 text-muted-foreground/40" />
          )}
        </div>
      </div>

      {/* Track Info & Like Button */}
      <div
        className={`relative z-30 flex items-center justify-between gap-4 mb-4 shrink-0 ${
          isEditMode ? 'pointer-events-none' : ''
        }`}
      >
        <div className="min-w-0 flex-1">
          <MarqueeText
            key="modal-title"
            text={title}
            className="text-2xl font-black text-foreground tracking-tight"
          />
          <MarqueeText
            key="modal-artist"
            text={artist}
            className="text-sm font-semibold text-muted-foreground mt-0.5"
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
        className={`relative z-30 space-y-1 mb-6 shrink-0 ${
          isEditMode ? 'pointer-events-none' : ''
        }`}
      >
        <div className="relative w-full h-2 flex items-center">
          <input
            type="range"
            min={0}
            max={safeDuration || 1}
            value={safePosition}
            onChange={(e) => useSoundStore.getState().seekTo(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer focus:outline-none"
            style={{
              background: `linear-gradient(to right, var(--seekbar-track, var(--primary)) ${safeDuration > 0 ? (safePosition / safeDuration) * 100 : 0}%, color-mix(in srgb, var(--seekbar, var(--primary)) 20%, transparent) ${safeDuration > 0 ? (safePosition / safeDuration) * 100 : 0}%)`,
              accentColor: 'var(--seekbar-track, var(--primary))',
            }}
            aria-label="Seek progress"
          />
        </div>
        <div className="flex justify-between text-xs font-mono font-medium text-muted-foreground">
          <span>{formatSafeTime(safePosition)}</span>
          <span>{formatSafeTime(safeDuration)}</span>
        </div>
      </div>

      {/* Main Playback Controls */}
      <div
        className={`relative z-30 flex items-center justify-between px-2 mb-4 shrink-0 ${
          isEditMode ? 'pointer-events-none' : ''
        }`}
      >
        <button
          type="button"
          onClick={handleToggleShuffle}
          className={`p-3 rounded-full transition-transform active:scale-90 ${
            shuffleEnabled
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Shuffle"
        >
          <Shuffle className="w-5 h-5" />
        </button>

        <button
          type="button"
          data-testid="now-playing-previous-button"
          onClick={goToPrevious}
          className="p-3 rounded-full text-foreground hover:text-primary active:scale-90 transition-transform"
          aria-label="Previous"
        >
          <SkipBack className="w-7 h-7 fill-current" />
        </button>

        <button
          type="button"
          data-testid="now-playing-play-pause-button"
          onClick={playbackManager.toggle}
          className="w-16 h-16 rounded-full bg-foreground text-background flex items-center justify-center shadow-xl active:scale-90 transition-transform"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 fill-current" />
          ) : (
            <Play className="w-7 h-7 fill-current ml-1" />
          )}
        </button>

        <button
          type="button"
          data-testid="now-playing-next-button"
          onClick={goToNext}
          className="p-3 rounded-full text-foreground hover:text-primary active:scale-90 transition-transform"
          aria-label="Next"
        >
          <SkipForward className="w-7 h-7 fill-current" />
        </button>

        <button
          type="button"
          onClick={handleToggleRepeat}
          className={`p-3 rounded-full transition-transform active:scale-90 ${
            repeatMode !== 'off'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Repeat"
        >
          {repeatMode === 'one' ? (
            <Repeat1 className="w-5 h-5" />
          ) : (
            <Repeat className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};
