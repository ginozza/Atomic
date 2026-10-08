import { FC, ReactNode } from 'react';

import { BottomBar } from '..';
import { cn } from '../../utils';

export type PlayerBarRootProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
};
export const PlayerBarRoot: FC<PlayerBarRootProps> = ({
  left,
  center,
  right,
  className = '',
}) => (
  <BottomBar className={cn('h-auto px-4 py-2.5 md:h-16 md:py-0', className)}>
    <div className="flex w-full flex-col gap-2.5 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-4">
      {left && <div className="w-full min-w-0 md:w-auto">{left}</div>}
      {center && (
        <div className="flex w-full justify-center md:w-auto md:justify-self-center">
          {center}
        </div>
      )}
      {right && (
        <div className="flex w-full justify-center md:w-auto md:justify-self-end">
          {right}
        </div>
      )}
    </div>
  </BottomBar>
);
