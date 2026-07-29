import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, errors } from '@rcos/shared';
import { logger } from '../lib/logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const wrapped = errors.validation(err.flatten());
    res.status(wrapped.status).json({
      success: false,
      error: {
        code: wrapped.code,
        message: wrapped.bilingual,
        details: wrapped.details,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.bilingual,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error({ err }, 'unhandled error');
  const wrapped = errors.internal();
  res.status(wrapped.status).json({
    success: false,
    error: { code: wrapped.code, message: wrapped.bilingual },
  });
};
