import { FC } from 'react';

import { PlayerBar } from '@nuclearplayer/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';

export const ConnectedVolume: FC = () => {
  const [volume, setVolume] = useCoreSetting<number>('playback.volume');
  const [muted, setMuted] = useCoreSetting<boolean>('playback.muted');

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume / 100);
  };

  const handleMuteToggle = () => {
    setMuted(!muted);
  };

  return (
    <PlayerBar.Volume
      value={Math.round((volume ?? 1) * 100)}
      onValueChange={handleVolumeChange}
      isMuted={Boolean(muted)}
      onMuteToggle={handleMuteToggle}
    />
  );
};
