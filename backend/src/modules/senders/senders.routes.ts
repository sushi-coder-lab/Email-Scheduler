import { Router } from 'express';
import { sendersController } from './senders.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createSenderSchema } from './senders.schema.js';

export const sendersRouter = Router();

sendersRouter.use(authenticate);

sendersRouter.get('/', (req, res, next) => sendersController.listSenders(req, res, next));
sendersRouter.post('/', validate({ body: createSenderSchema }), (req, res, next) =>
  sendersController.createSender(req, res, next)
);
