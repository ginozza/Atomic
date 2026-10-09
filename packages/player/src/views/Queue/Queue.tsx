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
      <div className="mb-2 flex shrink-0 items-center justify-end">
        <QueueHeaderActions />
      </div>
      <div className="min-h-0 flex-1">
        <ConnectedQueuePanel isCollapsed={false} />
      </div>
    </ViewShell>
  );
};
