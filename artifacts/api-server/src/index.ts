import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { v1Router } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.WEB_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(pinoHttp({ logger }));

app.use('/api/v1', v1Router);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: { ar: 'المسار غير موجود', en: 'Route not found' },
    },
  });
});

app.use(errorHandler);

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(`RCOS API listening on http://${env.API_HOST}:${env.API_PORT}/api/v1`);
});

const shutdown = (sig: string) => {
  logger.info({ sig }, 'shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
