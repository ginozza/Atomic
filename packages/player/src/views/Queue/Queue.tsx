import { FC } from 'react';

import { ViewShell } from '@nuclearplayer/ui';

import {
  ConnectedQueuePanel,
  QueueHeaderActions,
} from '../../components/ConnectedQueuePanel';

export const Queue: FC = () => {
  return (
    <ViewShell
      title="Queue"
      classes={{
        root: 'p-4 pb-36 h-full flex flex-col',
        scrollableArea: 'flex-1 min-h-0',
      }}
    >
      <div className="flex items-center justify-end mb-2 shrink-0">
        <QueueHeaderActions />
      </div>
      <div className="flex-1 min-h-0">
        <ConnectedQueuePanel isCollapsed={false} />
      </div>
    </ViewShell>
  );
};
