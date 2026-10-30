import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, code?: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const correlationId = req.correlationId;

  if (err instanceof AppError) {
    logger.warn({ err: err.message, correlationId, code: err.code }, 'Handled application error');
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
      correlationId,
    });
    return;
  }

  logger.error({ err, correlationId }, 'Unhandled server error');
  console.error('Unhandled server error details:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    correlationId,
  });
}
