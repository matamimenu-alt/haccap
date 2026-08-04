import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  // Storage
  STORAGE_DRIVER: z.string().default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),
  STORAGE_PUBLIC_BASE_URL: z.string().default('http://localhost:3001/api/v1/attachments/blob'),
  STORAGE_SIGNING_SECRET: z.string().min(16),
  // Upload
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  // QR
  QR_SCAN_BASE_URL: z.string().default('http://localhost:5173/s'),
  // Jobs (Phase 3+)
  JOBS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  JOBS_MATERIALIZER_INTERVAL_SEC: z.coerce.number().int().positive().default(300),
  JOBS_MATERIALIZER_HORIZON_HOURS: z.coerce.number().int().positive().default(24),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
