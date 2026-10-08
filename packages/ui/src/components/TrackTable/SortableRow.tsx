import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flexRender, Row } from '@tanstack/react-table';

import { Track } from '@nuclearplayer/model';

import { cn } from '../../utils';
import { useTrackTableContext } from './TrackTableContext';

type SortableRowProps<T extends Track = Track> = {
  row: Row<T>;
  itemId: string;
  isReorderable?: boolean;
  style?: React.CSSProperties;
};

export function SortableRow<T extends Track = Track>({
  row,
  itemId,
  isReorderable = false,
  style: externalStyle,
}: SortableRowProps<T>) {
  const { actions, activeTrackId, isLoading } = useTrackTableContext<T>();
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

  const isCurrent = Boolean(
    activeTrackId &&
      (itemId === activeTrackId ||
        ('id' in row.original &&
          (row.original as { id?: unknown }).id === activeTrackId) ||
        row.original.source?.id === activeTrackId),
  );
  const isRowLoading = isCurrent && Boolean(isLoading);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...externalStyle,
  };

  return (
    <tr
      data-testid="track-row"
      data-loading={isRowLoading ? 'true' : undefined}
      aria-busy={isRowLoading ? 'true' : undefined}
      ref={setNodeRef}
      style={style}
      onClick={() => {
        if (!isDragging) {
          actions.onPlayNow?.(row.original);
        }
      }}
      className={cn(
        'border-border bg-muted group border-b-(length:--border-width) select-none cursor-pointer transition-colors hover:bg-white/5 active:bg-white/10',
        {
          '': !isDragging,
          'z-50': isDragging,
          'cursor-grab': isReorderable,
        },
        isRowLoading && 'surface-toxic-shimmer animate-toxic-glow',
      )}
      {...attributes}
      {...listeners}
    >
      {row.getVisibleCells().map((cell) => (
        <Cell key={cell.id} cell={cell} />
      ))}
    </tr>
  );
}

type CellProps<T extends Track> = {
  cell: ReturnType<Row<T>['getVisibleCells']>[number];
};

const Cell = <T extends Track>({ cell }: CellProps<T>) => {
  return flexRender(cell.column.columnDef.cell, cell.getContext());
};
