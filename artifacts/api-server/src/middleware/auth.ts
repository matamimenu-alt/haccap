import type { NextFunction, Request, Response } from 'express';
import { errors } from '@rcos/shared';
import { verifyAccessToken } from '../lib/jwt.js';
// The `Express.Request.tenant` property assigned below is declared in
// src/types/express.d.ts, which augments the global Express namespace.
// Ambient .d.ts files are picked up automatically by the "src/**/*"
// include glob in tsconfig.json, so no explicit import is required.

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw errors.unauthorized();
    }
    const token = header.slice(7).trim();
    const payload = await verifyAccessToken(token);
    req.tenant = {
      userId: payload.sub,
      companyId: payload.cid,
      roles: payload.roles,
      branchIds: payload.branchIds,
    };
    next();
  } catch (err) {
    if (err instanceof Error && err.name !== 'AppError') {
      next(errors.unauthorized());
      return;
    }
    next(err);
  }
}

// Coarse role check — Phase 1 keeps this simple. Phase 2 adds fine-grained
// permission checks via the permission catalog.
export function requireRole(...allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.tenant) return next(errors.unauthorized());
    if (!req.tenant.roles.some((r) => allowed.includes(r))) {
      return next(errors.forbidden());
    }
    next();
  };
}
