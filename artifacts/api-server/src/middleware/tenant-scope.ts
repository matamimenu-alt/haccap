import { and, eq, isNull } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

// Helper: build a tenant-scoped WHERE clause. Every domain query MUST go through
// one of these helpers to guarantee zero cross-tenant leakage.
export function scoped(companyIdColumn: PgColumn, companyId: string, deletedAtColumn?: PgColumn) {
  if (deletedAtColumn) {
    return and(eq(companyIdColumn, companyId), isNull(deletedAtColumn));
  }
  return eq(companyIdColumn, companyId);
}
