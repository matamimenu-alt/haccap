import { Router } from 'express';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  knowledgeArticleLinks,
  knowledgeArticleVersions,
  knowledgeArticles,
  knowledgeCategories,
} from '@rcos/db';
import { errors, ok } from '@rcos/shared';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const knowledgeRouter: Router = Router();
knowledgeRouter.use(requireAuth);

const writeRoles = ['platform_super_admin', 'company_owner', 'operations_director', 'food_safety_officer', 'internal_auditor'];

const kind = z.enum([
  'sop','policy','guideline','faq','reference','training_material','procedure','checklist','incident_playbook','regulatory_citation','other',
]);
const status = z.enum(['draft', 'in_review', 'published', 'archived']);
const linkTarget = z.enum([
  'asset_category','inspection_template','task_template','area_kind','compliance_framework','asset','branch','supplier','other',
]);

/* ---------------- CATEGORIES ---------------- */

knowledgeRouter.get('/categories', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const rows = await db
      .select()
      .from(knowledgeCategories)
      .where(
        and(
          or(isNull(knowledgeCategories.companyId), eq(knowledgeCategories.companyId, req.tenant.companyId)),
          isNull(knowledgeCategories.deletedAt),
        ),
      );
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

const categorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  key: z.string().min(1).max(128).regex(/^[a-z0-9._-]+$/),
  nameAr: z.string().min(1).max(128),
  nameEn: z.string().min(1).max(128),
  description: z.string().nullable().optional(),
  iconKey: z.string().max(64).nullable().optional(),
  colorHex: z.string().max(8).nullable().optional(),
  aiHints: z.record(z.unknown()).optional(),
});

knowledgeRouter.post('/categories', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = categorySchema.parse(req.body);
    let path = input.key;
    let depth = 0;
    if (input.parentId) {
      const [p] = await db.select({ path: knowledgeCategories.path, depth: knowledgeCategories.depth }).from(knowledgeCategories).where(eq(knowledgeCategories.id, input.parentId)).limit(1);
      if (!p) throw errors.notFound('Parent category');
      path = `${p.path}/${input.key}`;
      depth = p.depth + 1;
    }
    const [created] = await db
      .insert(knowledgeCategories)
      .values({ ...input, companyId: req.tenant.companyId, path, depth })
      .returning();
    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

/* ---------------- ARTICLES ---------------- */

const listQuery = z.object({
  categoryId: z.string().uuid().optional(),
  kind: kind.optional(),
  status: status.optional(),
  q: z.string().max(128).optional(),
});

knowledgeRouter.get('/articles', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = listQuery.parse(req.query);
    const filters = [eq(knowledgeArticles.companyId, req.tenant.companyId), isNull(knowledgeArticles.deletedAt)];
    if (q.categoryId) filters.push(eq(knowledgeArticles.categoryId, q.categoryId));
    if (q.kind)       filters.push(eq(knowledgeArticles.kind, q.kind));
    if (q.status)     filters.push(eq(knowledgeArticles.status, q.status));
    if (q.q) {
      const term = q.q.toLowerCase();
      filters.push(sql`${knowledgeArticles.searchText} LIKE ${'%' + term + '%'}`);
    }
    const rows = await db
      .select()
      .from(knowledgeArticles)
      .where(and(...filters))
      .orderBy(desc(knowledgeArticles.updatedAt))
      .limit(500);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.get('/articles/:id', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [row] = await db
      .select()
      .from(knowledgeArticles)
      .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.companyId, req.tenant.companyId), isNull(knowledgeArticles.deletedAt)))
      .limit(1);
    if (!row) throw errors.notFound('Article');

    const links = await db.select().from(knowledgeArticleLinks).where(eq(knowledgeArticleLinks.articleId, id));
    const versions = await db
      .select({ id: knowledgeArticleVersions.id, version: knowledgeArticleVersions.version, createdAt: knowledgeArticleVersions.createdAt, changelog: knowledgeArticleVersions.changelog })
      .from(knowledgeArticleVersions)
      .where(eq(knowledgeArticleVersions.articleId, id))
      .orderBy(desc(knowledgeArticleVersions.version));

    // Increment view count best-effort
    void db.update(knowledgeArticles).set({ viewCount: sql`${knowledgeArticles.viewCount} + 1` }).where(eq(knowledgeArticles.id, id)).catch(() => {});

    res.json(ok({ ...row, links, versions }));
  } catch (err) {
    next(err);
  }
});

const articleSchema = z.object({
  key: z.string().min(1).max(128).regex(/^[a-z0-9._-]+$/),
  categoryId: z.string().uuid().nullable().optional(),
  kind: kind.default('sop'),
  titleAr: z.string().min(1).max(255),
  titleEn: z.string().min(1).max(255),
  summaryAr: z.string().nullable().optional(),
  summaryEn: z.string().nullable().optional(),
  bodyMd: z.string().default(''),
  bodyMdAr: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  references: z
    .array(z.object({ authority: z.string(), ref: z.string(), url: z.string().url().optional(), note: z.string().optional() }))
    .default([]),
  requiresAcknowledgement: z.boolean().default(false),
  reviewDueAt: z.string().datetime().nullable().optional(),
});

function composeSearchText(a: { titleEn: string; titleAr: string; summaryEn?: string | null; summaryAr?: string | null; bodyMd: string; tags?: string[] }) {
  return [a.titleEn, a.titleAr, a.summaryEn, a.summaryAr, a.bodyMd, (a.tags ?? []).join(' ')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .slice(0, 32_000);
}

knowledgeRouter.post('/articles', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const input = articleSchema.parse(req.body);
    const searchText = composeSearchText(input);
    const aiSummary = input.summaryEn ?? input.titleEn;
    const [created] = await db
      .insert(knowledgeArticles)
      .values({
        ...input,
        companyId: req.tenant.companyId,
        authorUserId: req.tenant.userId,
        searchText,
        aiSummary,
        aiMetadata: { kind: input.kind, tags: input.tags, referencesCount: input.references.length },
        reviewDueAt: input.reviewDueAt ? new Date(input.reviewDueAt) : null,
      })
      .returning();

    // Snapshot v1
    await db.insert(knowledgeArticleVersions).values({
      companyId: req.tenant.companyId,
      articleId: created.id,
      version: 1,
      titleAr: created.titleAr,
      titleEn: created.titleEn,
      bodyMd: created.bodyMd,
      bodyMdAr: created.bodyMdAr,
      authoredByUserId: req.tenant.userId,
      changelog: 'Initial version',
    });

    res.status(201).json(ok(created));
  } catch (err) {
    next(err);
  }
});

const patchSchema = articleSchema.partial().extend({ changelog: z.string().max(500).optional() });

knowledgeRouter.patch('/articles/:id', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const patch = patchSchema.parse(req.body);

    const [before] = await db
      .select()
      .from(knowledgeArticles)
      .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.companyId, req.tenant.companyId), isNull(knowledgeArticles.deletedAt)))
      .limit(1);
    if (!before) throw errors.notFound('Article');

    const shouldBumpVersion = Boolean(patch.titleAr || patch.titleEn || patch.bodyMd !== undefined || patch.bodyMdAr !== undefined);
    const nextVersion = shouldBumpVersion ? before.version + 1 : before.version;

    const merged = { ...before, ...patch };
    const searchText = composeSearchText({
      titleEn: merged.titleEn,
      titleAr: merged.titleAr,
      summaryEn: merged.summaryEn ?? null,
      summaryAr: merged.summaryAr ?? null,
      bodyMd: merged.bodyMd ?? '',
      tags: merged.tags ?? [],
    });

    const [updated] = await db
      .update(knowledgeArticles)
      .set({
        ...patch,
        reviewDueAt: patch.reviewDueAt !== undefined ? (patch.reviewDueAt ? new Date(patch.reviewDueAt) : null) : undefined,
        version: nextVersion,
        searchText,
        aiSummary: merged.summaryEn ?? merged.titleEn ?? before.aiSummary,
        aiMetadata: {
          ...(before.aiMetadata ?? {}),
          kind: merged.kind,
          tags: merged.tags,
          referencesCount: (merged.references ?? []).length,
        },
        updatedAt: sql`now()`,
      })
      .where(eq(knowledgeArticles.id, id))
      .returning();

    if (shouldBumpVersion) {
      await db.insert(knowledgeArticleVersions).values({
        companyId: req.tenant.companyId,
        articleId: id,
        version: nextVersion,
        titleAr: updated.titleAr,
        titleEn: updated.titleEn,
        bodyMd: updated.bodyMd,
        bodyMdAr: updated.bodyMdAr,
        authoredByUserId: req.tenant.userId,
        changelog: patch.changelog ?? null,
      });
    }

    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

// Publish / archive transitions
knowledgeRouter.post('/articles/:id/publish', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [updated] = await db
      .update(knowledgeArticles)
      .set({ status: 'published', publishedAt: sql`now()`, reviewerUserId: req.tenant.userId, updatedAt: sql`now()` })
      .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Article');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.post('/articles/:id/archive', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const [updated] = await db
      .update(knowledgeArticles)
      .set({ status: 'archived', archivedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.companyId, req.tenant.companyId)))
      .returning();
    if (!updated) throw errors.notFound('Article');
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});

// Version log
knowledgeRouter.get('/articles/:id/versions', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db
      .select()
      .from(knowledgeArticleVersions)
      .where(and(eq(knowledgeArticleVersions.articleId, id), eq(knowledgeArticleVersions.companyId, req.tenant.companyId)))
      .orderBy(desc(knowledgeArticleVersions.version));
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

/* ---------------- LINKS ---------------- */
knowledgeRouter.post('/articles/:id/links', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const id = z.string().uuid().parse(req.params.id);
    const input = z.object({ targetType: linkTarget, targetRef: z.string().min(1).max(256), label: z.string().nullable().optional() }).parse(req.body);
    const [created] = await db
      .insert(knowledgeArticleLinks)
      .values({ ...input, companyId: req.tenant.companyId, articleId: id })
      .onConflictDoNothing()
      .returning();
    res.status(201).json(ok(created ?? null));
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.delete('/articles/:id/links/:linkId', requireRole(...writeRoles), async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const linkId = z.string().uuid().parse(req.params.linkId);
    await db.delete(knowledgeArticleLinks).where(and(eq(knowledgeArticleLinks.id, linkId), eq(knowledgeArticleLinks.companyId, req.tenant.companyId)));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/* ---------------- SEARCH (cross-article) ---------------- */
knowledgeRouter.get('/search', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = z.object({ q: z.string().min(1).max(128) }).parse(req.query);
    const term = q.q.toLowerCase();
    const rows = await db
      .select({
        id: knowledgeArticles.id,
        key: knowledgeArticles.key,
        titleEn: knowledgeArticles.titleEn,
        titleAr: knowledgeArticles.titleAr,
        summaryEn: knowledgeArticles.summaryEn,
        kind: knowledgeArticles.kind,
        status: knowledgeArticles.status,
        updatedAt: knowledgeArticles.updatedAt,
      })
      .from(knowledgeArticles)
      .where(
        and(
          eq(knowledgeArticles.companyId, req.tenant.companyId),
          isNull(knowledgeArticles.deletedAt),
          sql`${knowledgeArticles.searchText} LIKE ${'%' + term + '%'}`,
        ),
      )
      .orderBy(desc(knowledgeArticles.updatedAt))
      .limit(50);
    res.json(ok(rows));
  } catch (err) {
    next(err);
  }
});

/* ---------------- RELATED (given a target, return linked articles) ---------------- */
knowledgeRouter.get('/related', async (req, res, next) => {
  try {
    if (!req.tenant) throw errors.unauthorized();
    const q = z.object({ targetType: linkTarget, targetRef: z.string().min(1).max(256) }).parse(req.query);
    const rows = await db
      .select({
        article: knowledgeArticles,
        link: knowledgeArticleLinks,
      })
      .from(knowledgeArticleLinks)
      .innerJoin(knowledgeArticles, eq(knowledgeArticles.id, knowledgeArticleLinks.articleId))
      .where(
        and(
          eq(knowledgeArticleLinks.companyId, req.tenant.companyId),
          eq(knowledgeArticleLinks.targetType, q.targetType),
          eq(knowledgeArticleLinks.targetRef, q.targetRef),
          eq(knowledgeArticles.status, 'published'),
        ),
      )
      .limit(50);
    res.json(ok(rows.map((r) => ({ ...r.article, linkLabel: r.link.label }))));
  } catch (err) {
    next(err);
  }
});
