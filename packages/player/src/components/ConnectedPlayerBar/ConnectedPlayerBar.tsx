import { FC } from 'react';

import { PlayerBar } from '@nuclearplayer/ui';

import { ConnectedControls } from './ConnectedControls';
import { ConnectedFloatingMiniPlayer } from './ConnectedFloatingMiniPlayer';
import { ConnectedNowPlaying } from './ConnectedNowPlaying';
import { ConnectedSeekBar } from './ConnectedSeekBar';
import { ConnectedVolume } from './ConnectedVolume';

export const ConnectedPlayerBar: FC = () => {
  return (
    <>
      <div className="hidden md:contents">
        <ConnectedSeekBar />
        <PlayerBar
          left={<ConnectedNowPlaying />}
          center={<ConnectedControls />}
          right={<ConnectedVolume />}
        />
      </div>
      <ConnectedFloatingMiniPlayer />
    </>
  );
};
