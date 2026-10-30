import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from '../queue/email.queue.js';
import { env } from '../config/env.js';

export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(env.BULL_BOARD_PATH);

createBullBoard({
  // @ts-expect-error BullMQ v5 and BullBoard type compatibility
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});
