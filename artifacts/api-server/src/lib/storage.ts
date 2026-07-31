import { createStorageDriver } from '@rcos/storage';
import { env } from '../config/env.js';

export const storage = createStorageDriver({
  STORAGE_DRIVER: env.STORAGE_DRIVER,
  STORAGE_LOCAL_PATH: env.STORAGE_LOCAL_PATH,
  STORAGE_PUBLIC_BASE_URL: env.STORAGE_PUBLIC_BASE_URL,
  STORAGE_SIGNING_SECRET: env.STORAGE_SIGNING_SECRET,
});

// Prefix helper — enforces tenant isolation on the storage plane
export function tenantKey(companyId: string, targetType: string, targetId: string, filename: string) {
  const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(-96);
  return `companies/${companyId}/${targetType}/${targetId}/${Date.now()}-${safeName}`;
}
