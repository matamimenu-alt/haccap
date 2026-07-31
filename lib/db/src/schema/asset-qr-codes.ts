import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryId, timestamps } from './_shared.js';
import { assets } from './assets.js';
import { companies } from './companies.js';

/**
 * QR code registry. Each asset has exactly one *active* QR (`is_active=true,
 * revoked_at IS NULL`), plus a history of retired tokens so a reprinted label
 * still resolves after the token rotation.
 *
 * `token` is a URL-safe opaque string (24+ bytes base64url). The scan URL
 * that gets encoded looks like: https://{host}/s/{token} and hits
 * GET /api/v1/qr/scan/{token} which returns the resolved asset.
 */
export const assetQrCodes = pgTable(
  'asset_qr_codes',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),

    token: varchar('token', { length: 64 }).notNull().unique(),
    label: varchar('label', { length: 64 }),

    isActive: boolean('is_active').notNull().default(true),

    printedAt: timestamp('printed_at', { withTimezone: true }),
    printedByUserId: uuid('printed_by_user_id'),
    lastScannedAt: timestamp('last_scanned_at', { withTimezone: true }),
    scanCount: text('scan_count').notNull().default('0'), // stored as text to avoid overflow; app treats as bigint
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('asset_qr_codes_asset_idx').on(t.assetId),
    index('asset_qr_codes_company_idx').on(t.companyId),
    // Only one active QR per asset (partial unique)
    uniqueIndex('asset_qr_codes_active_uidx')
      .on(t.assetId)
      .where(sql`is_active = true AND revoked_at IS NULL`),
  ],
);

export type AssetQrCode = typeof assetQrCodes.$inferSelect;
export type NewAssetQrCode = typeof assetQrCodes.$inferInsert;
