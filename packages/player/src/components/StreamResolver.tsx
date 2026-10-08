import type { FC } from 'react';

import { useNextTrackPrefetch } from '../hooks/useNextTrackPrefetch';
import { useStreamResolution } from '../hooks/useStreamResolution';

export const StreamResolver: FC = () => {
  useStreamResolution();
  useNextTrackPrefetch();
  return null;
};
