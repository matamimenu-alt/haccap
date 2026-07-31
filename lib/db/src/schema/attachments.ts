import { index, integer, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { attachmentKindEnum, polymorphicTargetTypeEnum } from './enums.js';
import { companies } from './companies.js';

/**
 * Polymorphic file attachments. One table serves every entity that can hold
 * documents, photos, videos: assets, warranties, suppliers, inspections,
 * tasks, incidents, etc. `target_type` is a controlled enum so an AI tool-use
 * loop can enumerate what it can attach to.
 *
 * Storage: files are stored by a pluggable driver (local for dev, S3/GCS for
 * prod). `storage_driver` + `storage_key` identify where the bytes live.
 * `signed_url` is transient — never persisted here.
 */
export const attachments = pgTable(
  'attachments',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    targetType: polymorphicTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),

    kind: attachmentKindEnum('kind').notNull().default('document'),

    // File descriptor
    filename: varchar('filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksumSha256: varchar('checksum_sha256', { length: 64 }),

    // Storage placement — pluggable
    storageDriver: varchar('storage_driver', { length: 32 }).notNull().default('local'),
    storageKey: text('storage_key').notNull(),
    thumbnailKey: text('thumbnail_key'),

    // For photos/videos
    widthPx: integer('width_px'),
    heightPx: integer('height_px'),
    durationSec: integer('duration_sec'),

    // Provenance
    uploadedByUserId: uuid('uploaded_by_user_id'),
    caption: text('caption'),
    // For location-tagged photos (compliance inspections)
    capturedAt: timestamps.createdAt,
    latitude: varchar('latitude', { length: 16 }),
    longitude: varchar('longitude', { length: 16 }),

    // AI-ready — extraction bag (OCR text, detected objects, EXIF, etc.)
    aiExtracted: jsonb('ai_extracted').$type<Record<string, unknown>>().notNull().default({}),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('attachments_company_idx').on(t.companyId),
    index('attachments_target_idx').on(t.targetType, t.targetId),
    index('attachments_kind_idx').on(t.companyId, t.kind),
  ],
);

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
