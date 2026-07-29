import type { NextFunction, Request, Response } from 'express';
import { errors } from '@rcos/shared';
import { verifyAccessToken } from '../lib/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    tenant?: {
      userId: string;
      companyId: string;
      roles: string[];
      branchIds: string[];
    };
  }
}

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
