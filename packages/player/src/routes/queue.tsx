import { createFileRoute } from '@tanstack/react-router';

import { Queue } from '../views/Queue';

export const Route = createFileRoute('/queue')({
  component: Queue,
});
