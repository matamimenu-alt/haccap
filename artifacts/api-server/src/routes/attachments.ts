import { Router } from 'express';
import multer from 'multer';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, attachments } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { verifySignature } from '@rcos/storage';
import { requireAuth } from '../middleware/auth.js';
import { storage, tenantKey } from '../lib/storage.js';
import { env } from '../config/env.js';
import { emitAssetEvent } from '../services/asset-events.js';

export const attachmentsRouter: Router = Router();

// Upload: POST /attachments (multipart/form-data)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
});

const targetType = z.enum([
  'asset','area','branch','brand','company','supplier','warranty','maintenance_schedule','inspection','task','incident',
]);
const kind = z.enum(['document', 'photo', 'video', 'audio', 'other']);

attachmentsRouter.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    if (!req.file) throw errors.badRequest({ ar: 'ملف مطلوب', en: 'file is required (multipart form field "file")' });

    const meta = z
      .object({
        targetType,
        targetId: z.string().uuid(),
        kind: kind.default('document'),
        caption: z.string().max(500).nullable().optional(),
        capturedAt: z.string().datetime().nullable().optional(),
        latitude: z.string().max(16).nullable().optional(),
        longitude: z.string().max(16).nullable().optional(),
      })
      .parse({
        targetType: req.body.targetType,
        targetId: req.body.targetId,
        kind: req.body.kind ?? 'document',
        caption: req.body.caption ?? null,
        capturedAt: req.body.capturedAt ?? null,
        latitude: req.body.latitude ?? null,
        longitude: req.body.longitude ?? null,
      });

    const key = tenantKey(req.tenant.companyId, meta.targetType, meta.targetId, req.file.originalname);
    const put = await storage.put({
      key,
      contentType: req.file.mimetype,
      body: req.file.buffer,
      sizeBytes: req.file.size,
      metadata: { companyId: req.tenant.companyId, targetType: meta.targetType, targetId: meta.targetId },
    });

    const [created] = await db
      .insert(attachments)
      .values({
        companyId: req.tenant.companyId,
        targetType: meta.targetType,
        targetId: meta.targetId,
        kind: meta.kind,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: put.sizeBytes,
        checksumSha256: put.checksumSha256,
        storageDriver: storage.name,
        storageKey: key,
        uploadedByUserId: req.tenant.userId,
        caption: meta.caption ?? null,
        capturedAt: meta.capturedAt ? new Date(meta.capturedAt) : null,
        latitude: meta.latitude ?? null,
        longitude: meta.longitude ?? null,
      })
      .returning();

    // Emit an asset event when applicable
    if (meta.targetType === 'asset') {
      await emitAssetEvent({
        companyId: req.tenant.companyId,
        assetId: meta.targetId,
        eventType: meta.kind === 'photo' ? 'photo_added' : 'document_added',
        actorUserId: req.tenant.userId,
        after: { attachmentId: created.id, filename: req.file.originalname, kind: meta.kind },
      });
    }

    const signed = await storage.signedGetUrl(key, 300);
    res.status(201).json(ok({ ...created, url: signed.url, urlExpiresAt: signed.expiresAt }));
  } catch (err) {
    next(err);
  }
});

attachmentsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = z
      .object({ targetType, targetId: z.string().uuid() })
      .parse({ targetType: req.query.targetType, targetId: req.query.targetId });

    const rows = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.companyId, req.tenant.companyId),
          eq(attachments.targetType, q.targetType),
          eq(attachments.targetId, q.targetId),
        ),
      );

    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const signed = await storage.signedGetUrl(r.storageKey, 300);
        return { ...r, url: signed.url, urlExpiresAt: signed.expiresAt };
      }),
    );
    res.json(ok(hydrated));
  } catch (err) {
    next(err);
  }
});

attachmentsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.companyId, req.tenant.companyId)))
      .limit(1);
    if (!row) throw errors.notFound('Attachment');

    await storage.delete(row.storageKey).catch(() => {
      /* best-effort — DB row is the source of truth */
    });
    await db.delete(attachments).where(eq(attachments.id, id));

    if (row.targetType === 'asset') {
      await emitAssetEvent({
        companyId: req.tenant.companyId,
        assetId: row.targetId,
        eventType: row.kind === 'photo' ? 'photo_removed' : 'document_removed',
        actorUserId: req.tenant.userId,
        before: { attachmentId: id, filename: row.filename, kind: row.kind },
      });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * Signed-URL fetcher — a browser or downloader hits this URL directly.
 * Signature is HMAC(secret, key:expires). No tenant check by design — the
 * signature IS the authorization. If the secret leaks we rotate it and
 * every outstanding URL is invalidated.
 */
attachmentsRouter.get('/blob/*', async (req, res, next) => {
  try {
    const key = String((req.params as { 0: string })[0] ?? '');
    const expires = Number(req.query.e);
    const sig = String(req.query.s ?? '');
    if (!key || !expires || !sig) throw errors.badRequest({ ar: 'رابط غير صالح', en: 'Invalid URL' });
    if (!verifySignature(env.STORAGE_SIGNING_SECRET, key, expires, sig)) {
      throw errors.forbidden({ ar: 'التوقيع منتهي أو غير صالح', en: 'Signature expired or invalid' });
    }
    const obj = await storage.get(key);
    // Fetch DB record for real content-type + filename
    const [row] = await db.select().from(attachments).where(eq(attachments.storageKey, key)).limit(1);
    res.setHeader('content-type', row?.mimeType ?? obj.contentType);
    if (row?.filename) res.setHeader('content-disposition', `inline; filename="${row.filename.replace(/"/g, '')}"`);
    obj.body.pipe(res);
  } catch (err) {
    next(err);
  }
});

// Silence unused-import warning for sql
void sql;
