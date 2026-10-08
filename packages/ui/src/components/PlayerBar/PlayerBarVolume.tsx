import { Volume2, VolumeX } from 'lucide-react';
import { FC } from 'react';

import { Button, Slider } from '..';
import { cn } from '../../utils';

type PlayerBarVolumeProps = {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
  isMuted?: boolean;
  onMuteToggle?: () => void;
};

export const PlayerBarVolume: FC<PlayerBarVolumeProps> = ({
  value,
  defaultValue,
  onValueChange,
  disabled,
  className = '',
  isMuted = false,
  onMuteToggle,
}) => {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <Button
        size="icon"
        variant="text"
        disabled={disabled}
        onClick={onMuteToggle}
        data-testid="player-mute-button"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </Button>
      <div
        className="flex min-h-[40px] w-28 items-center md:w-24"
        data-testid="player-volume-slider"
      >
        <Slider
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          disabled={disabled}
          showValue={false}
          showFooter={false}
        />
      </div>
    </div>
  );
};
