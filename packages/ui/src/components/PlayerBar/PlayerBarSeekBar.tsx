import { FC } from 'react';

import { cn } from '../../utils';
import { formatTimeSeconds } from '../../utils/time';
import { useSeekBar } from './useSeekBar';

export type PlayerSeekBarProps = {
  progress: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  isLoading?: boolean;
  onSeek?: (percent: number) => void;
  className?: string;
};

export const PlayerBarSeekBar: FC<PlayerSeekBarProps> = ({
  progress,
  elapsedSeconds,
  remainingSeconds,
  isLoading = false,
  onSeek,
  className = '',
}) => {
  const {
    clamped,
    containerRef,
    handleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    isInteractive,
  } = useSeekBar({
    progress,
    isLoading,
    onSeek,
  });

  return (
    <div className={cn('w-full select-none', className)}>
      <div className="text-muted-foreground flex items-center justify-between px-2 pt-1 text-xs leading-none">
        <span className="tabular-nums">
          {formatTimeSeconds(elapsedSeconds)}
        </span>
        <span className="tabular-nums">
          {formatTimeSeconds(-Math.abs(remainingSeconds))}
        </span>
      </div>
      <div
        ref={containerRef}
        data-testid="player-seek-bar"
        className={cn('relative flex h-8 w-full touch-none items-center py-2', {
          'pointer-events-none cursor-not-allowed': isLoading,
          'cursor-pointer': isInteractive,
        })}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        aria-disabled={isLoading}
      >
        <div
          className={cn(
            'border-border relative h-1.5 w-full overflow-hidden rounded-full border-(length:--border-width)',
          )}
        >
          {/* Unplayed portion — lighter/dimmer fill */}
          <div className="surface-seekbar absolute inset-0 rounded-full opacity-20" />
          {isLoading && (
            <div className="bg-stripes-diagonal absolute inset-0 opacity-80" />
          )}
          {!isLoading && (
            <div
              className="surface-seekbar-track absolute inset-y-0 left-0 rounded-full transition-none"
              style={{ width: `${clamped}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
