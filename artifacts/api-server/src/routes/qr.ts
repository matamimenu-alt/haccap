import { Router } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, assetQrCodes, assets, areas, branches } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth } from '../middleware/auth.js';

export const qrRouter: Router = Router();

/**
 * Scan resolver. This is called after a scanner opens {QR_SCAN_BASE_URL}/{token}
 * and the front-end forwards the token to /qr/scan/:token to get the resolved
 * asset payload. Requires auth — an anonymous scan should fail rather than
 * leak tenant data.
 */
qrRouter.get('/scan/:token', requireAuth, async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const token = z.string().min(8).max(64).parse(req.params.token);

    const [row] = await db
      .select({ qr: assetQrCodes, asset: assets, areaNameEn: areas.nameEn, branchNameEn: branches.nameEn })
      .from(assetQrCodes)
      .innerJoin(assets, eq(assets.id, assetQrCodes.assetId))
      .leftJoin(areas, eq(areas.id, assets.areaId))
      .leftJoin(branches, eq(branches.id, assets.branchId))
      .where(and(eq(assetQrCodes.token, token), eq(assetQrCodes.companyId, req.tenant.companyId)))
      .limit(1);

    if (!row) throw errors.notFound('QR code');
    if (!row.qr.isActive || row.qr.revokedAt) {
      throw errors.badRequest({
        ar: 'رمز QR غير نشط. يُرجى استخدام الرمز المطبوع حديثًا.',
        en: 'This QR is inactive. Use the freshly-printed label.',
      });
    }
    if (row.asset.deletedAt) throw errors.notFound('Asset');

    // Update scan telemetry — non-blocking best-effort
    void db
      .update(assetQrCodes)
      .set({
        lastScannedAt: sql`now()`,
        scanCount: sql`(coalesce(nullif(${assetQrCodes.scanCount}, '')::bigint, 0) + 1)::text`,
      })
      .where(eq(assetQrCodes.id, row.qr.id))
      .catch(() => {});

    res.json(
      ok({
        assetId: row.asset.id,
        code: row.asset.code,
        nameEn: row.asset.nameEn,
        nameAr: row.asset.nameAr,
        status: row.asset.status,
        criticality: row.asset.criticality,
        branch: { id: row.asset.branchId, nameEn: row.branchNameEn },
        area: row.asset.areaId ? { id: row.asset.areaId, nameEn: row.areaNameEn } : null,
      }),
    );
  } catch (err) {
    next(err);
  }
});

// Silence unused
void isNull;
