import { Router } from 'express';
import argon2 from 'argon2';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, users, userRoles, roles as rolesTable, userSessions } from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  ttlToSeconds,
} from '../lib/jwt.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter: Router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function issueTokens(user: { id: string; companyId: string; branchIds: string[] }, req: {
  userAgent?: string;
  ipAddress?: string;
}) {
  const roleRows = await db
    .select({ key: rolesTable.key })
    .from(userRoles)
    .innerJoin(rolesTable, eq(userRoles.roleId, rolesTable.id))
    .where(eq(userRoles.userId, user.id));

  const roleKeys = roleRows.map((r) => r.key);
  const access = await signAccessToken({
    sub: user.id,
    cid: user.companyId,
    roles: roleKeys,
    branchIds: user.branchIds,
  });

  const { token: refresh, hash } = generateRefreshToken();
  const refreshTtl = ttlToSeconds(env.JWT_REFRESH_TTL);
  const expiresAt = new Date(Date.now() + refreshTtl * 1000);

  await db.insert(userSessions).values({
    companyId: user.companyId,
    userId: user.id,
    refreshTokenHash: hash,
    expiresAt,
    userAgent: req.userAgent?.slice(0, 512),
    ipAddress: req.ipAddress?.slice(0, 64),
  });

  return {
    accessToken: access,
    accessTokenExpiresIn: ttlToSeconds(env.JWT_ACCESS_TTL),
    refreshToken: refresh,
    refreshTokenExpiresAt: expiresAt.toISOString(),
    roles: roleKeys,
  };
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
      .limit(1);

    if (!user || user.status !== 'active') {
      throw errors.unauthorized({
        ar: 'بيانات الاعتماد غير صحيحة',
        en: 'Invalid credentials',
      });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw errors.unauthorized({
        ar: 'بيانات الاعتماد غير صحيحة',
        en: 'Invalid credentials',
      });
    }

    await db
      .update(users)
      .set({ lastLoginAt: sql`now()` })
      .where(eq(users.id, user.id));

    const tokens = await issueTokens(user, {
      userAgent: req.header('user-agent') ?? undefined,
      ipAddress: req.ip,
    });

    res.json(
      ok({
        user: {
          id: user.id,
          email: user.email,
          fullNameAr: user.fullNameAr,
          fullNameEn: user.fullNameEn,
          preferredLocale: user.preferredLocale,
          companyId: user.companyId,
          branchIds: user.branchIds,
        },
        ...tokens,
      }),
    );
  } catch (err) {
    next(err);
  }
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const hash = hashRefreshToken(refreshToken);

    const [session] = await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.refreshTokenHash, hash),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) throw errors.unauthorized({ en: 'Invalid or expired refresh token', ar: 'رمز التحديث غير صالح أو منتهي' });

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user || user.status !== 'active') throw errors.unauthorized();

    // Rotate — revoke the old session and issue a new one
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.id, session.id));

    const tokens = await issueTokens(user, {
      userAgent: req.header('user-agent') ?? undefined,
      ipAddress: req.ip,
    });

    res.json(ok(tokens));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.partial().parse(req.body ?? {});
    if (refreshToken) {
      const hash = hashRefreshToken(refreshToken);
      await db
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(eq(userSessions.refreshTokenHash, hash));
    } else if (req.tenant) {
      // Revoke every active session for this user
      await db
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(userSessions.userId, req.tenant.userId), isNull(userSessions.revokedAt)));
    }
    res.json(ok({ ok: true }));
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const [user] = await db.select().from(users).where(eq(users.id, req.tenant.userId)).limit(1);
    if (!user) throw errors.notFound('User');
    res.json(
      ok({
        id: user.id,
        email: user.email,
        fullNameAr: user.fullNameAr,
        fullNameEn: user.fullNameEn,
        preferredLocale: user.preferredLocale,
        avatarUrl: user.avatarUrl,
        companyId: user.companyId,
        branchIds: user.branchIds,
        roles: req.tenant.roles,
      }),
    );
  } catch (err) {
    next(err);
  }
});
