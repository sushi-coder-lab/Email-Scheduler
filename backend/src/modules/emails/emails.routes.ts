import { Router } from 'express';
import multer from 'multer';
import { emailsController } from './emails.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { scheduleEmailSchema, emailListQuerySchema } from './emails.schema.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const emailsRouter = Router();

emailsRouter.use(authenticate);

emailsRouter.get('/scheduled', validate({ query: emailListQuerySchema }), (req, res, next) =>
  emailsController.listScheduled(req, res, next)
);

emailsRouter.get('/sent', validate({ query: emailListQuerySchema }), (req, res, next) =>
  emailsController.listSent(req, res, next)
);

emailsRouter.get('/metrics', (req, res, next) =>
  emailsController.getMetrics(req, res, next)
);

emailsRouter.post('/upload-leads', upload.single('file'), (req, res, next) =>
  emailsController.uploadLeads(req, res, next)
);

emailsRouter.post('/schedule', validate({ body: scheduleEmailSchema }), (req, res, next) =>
  emailsController.scheduleEmails(req, res, next)
);

emailsRouter.get('/:id', (req, res, next) =>
  emailsController.getEmailById(req, res, next)
);

emailsRouter.post('/:id/cancel', (req, res, next) =>
  emailsController.cancelEmail(req, res, next)
);
