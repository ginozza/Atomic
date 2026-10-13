import { FC } from 'react';

import {
  ConnectedQueuePanel,
  QueueHeaderActions,
} from '../../components/ConnectedQueuePanel';

export const Queue: FC = () => {
  return (
    <div
      data-testid="queue-view"
      className="surface-background relative flex h-full min-h-0 w-full flex-1 flex-col px-4 pt-2 md:px-6 md:pt-4"
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="title">
          Queue
        </h1>
        <div className="flex items-center gap-2">
          <QueueHeaderActions />
        </div>
      </div>
      <div className="min-h-0 flex-1 pb-36 md:pb-6">
        <ConnectedQueuePanel isCollapsed={false} />
      </div>
    </div>
  );
};
