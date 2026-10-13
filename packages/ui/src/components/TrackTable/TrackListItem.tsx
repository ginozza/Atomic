import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CassetteTape,
  EllipsisVertical,
  Heart,
  Plus,
  Trash2,
} from 'lucide-react';
import { FC } from 'react';

import { pickArtwork, Track } from '@nuclearplayer/model';

import { cn } from '../../utils';
import { formatTimeMillis } from '../../utils/time';
import { Button } from '../Button';
import {
  ContextMenuWrapperProps,
  TrackTableActions,
  TrackTableLabels,
} from './types';

type TrackListItemProps<T extends Track = Track> = {
  track: T;
  index: number;
  itemId: string;
  isReorderable?: boolean;
  isCurrent?: boolean;
  isLoading?: boolean;
  isFavorite?: boolean;
  displayDeleteButton?: boolean;
  displayFavorite?: boolean;
  displayDuration?: boolean;
  labels: TrackTableLabels;
  actions: TrackTableActions<T>;
  ContextMenuWrapper?: FC<ContextMenuWrapperProps<T>>;
};

export function TrackListItem<T extends Track = Track>({
  track,
  index,
  itemId,
  isReorderable = false,
  isCurrent = false,
  isLoading = false,
  isFavorite = false,
  displayDeleteButton = false,
  displayFavorite = true,
  displayDuration = true,
  labels,
  actions,
  ContextMenuWrapper,
}: TrackListItemProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: itemId,
    disabled: !isReorderable,
  });

  const isRowLoading = isCurrent && isLoading;
  const thumbnail =
    pickArtwork(track.artwork, 'thumbnail', 96) ||
    pickArtwork(track.artwork, 'cover', 96);
  const duration =
    track.durationMs != null ? formatTimeMillis(track.durationMs) : null;
  const artistNames =
    track.artists
      ?.map((artist) => artist.name)
      .filter(Boolean)
      .join(', ') ||
    track.album?.title ||
    '';

  const isExplicit =
    'explicit' in track
      ? Boolean((track as { explicit?: boolean }).explicit)
      : false;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      {...attributes}
      {...listeners}
      role="row"
      data-testid="track-row"
      data-loading={isRowLoading ? 'true' : undefined}
      aria-busy={isRowLoading ? 'true' : undefined}
      aria-disabled={isReorderable ? 'false' : 'true'}
      ref={setNodeRef}
      style={style}
      onClick={(event) => {
        if (isDragging) {
          return;
        }
        const target = event.target as HTMLElement | null;
        if (
          target?.closest(
            'button, a, input, select, textarea, [role="button"], [role="menuitem"]',
          )
        ) {
          return;
        }
        actions.onPlayNow?.(track);
      }}
      className={cn(
        'group border-border/20 flex cursor-pointer items-center gap-3.5 rounded-xl border-b px-3 py-2.5 transition-all select-none last:border-b-0 hover:bg-white/5 active:bg-white/10',
        isRowLoading && 'surface-toxic-shimmer animate-toxic-glow',
        isReorderable && 'cursor-grab',
        isDragging && 'z-50 opacity-50',
      )}
    >
      <div className="bg-card border-border/40 relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-xs">
        {thumbnail?.url ? (
          <img
            src={thumbnail.url}
            alt={track.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <CassetteTape
            size={24}
            className="text-muted-foreground opacity-30"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span
          data-testid="track-title"
          className={cn(
            'truncate text-sm leading-tight font-semibold',
            isCurrent ? 'text-primary' : 'text-foreground',
          )}
        >
          {track.title}
        </span>
        <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
          {isExplicit && (
            <span className="py-0.2 shrink-0 rounded bg-zinc-700/90 px-1 text-[10px] leading-none font-bold text-white">
              E
            </span>
          )}
          <span className="truncate">{artistNames}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {displayDuration && duration && (
          <span className="text-muted-foreground mr-2 hidden text-xs tabular-nums sm:inline">
            {duration}
          </span>
        )}

        {displayFavorite && actions.onToggleFavorite && (
          <Button
            type="button"
            size="icon-sm"
            variant="text"
            className="text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              actions.onToggleFavorite?.(track);
            }}
            aria-label={isFavorite ? labels.unfavorite : labels.favorite}
          >
            <Heart
              size={18}
              className={cn(isFavorite && 'fill-primary text-primary')}
            />
          </Button>
        )}

        {actions.onAddToQueue && (
          <Button
            type="button"
            data-testid="add-to-queue-button"
            size="icon-sm"
            variant="text"
            className="text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              actions.onAddToQueue?.(track);
            }}
            aria-label={labels.addToQueue || 'Add to queue'}
          >
            <Plus size={16} />
          </Button>
        )}

        {displayDeleteButton && actions.onRemove && (
          <Button
            type="button"
            size="icon-sm"
            variant="text"
            className="text-muted-foreground hover:text-accent-red"
            onClick={(event) => {
              event.stopPropagation();
              actions.onRemove?.(track, index);
            }}
            aria-label={labels.remove}
          >
            <Trash2 size={16} />
          </Button>
        )}

        {ContextMenuWrapper && (
          <ContextMenuWrapper track={track}>
            <Button
              type="button"
              data-testid="track-context-menu-button"
              size="icon-sm"
              variant="text"
              className="text-muted-foreground hover:text-foreground"
              onClick={(event) => event.stopPropagation()}
              aria-label={labels.trackOptions}
            >
              <EllipsisVertical size={18} />
            </Button>
          </ContextMenuWrapper>
        )}
      </div>
    </div>
  );
}
