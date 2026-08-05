import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { knowledgeKindEnum, knowledgeStatusEnum } from './enums.js';
import { companies } from './companies.js';
import { knowledgeCategories } from './knowledge-categories.js';

/**
 * Knowledge article — SOP, guideline, policy, playbook, regulatory citation,
 * training material. Body is stored as Markdown (rendered client-side).
 *
 * AI-readiness:
 *  - ai_summary   — one-liner refreshed on every publish (LLM prompt-ready)
 *  - ai_metadata  — feature bag (kind, categoryPath, links[])
 *  - embedding_ref — reserved for pgvector activation in Phase 8
 *  - search_text  — precomputed FTS bridge
 *
 * `version` mirrors the latest immutable snapshot in
 * `knowledge_article_versions` so callers don't need a join for a card view.
 */
export const knowledgeArticles = pgTable(
  'knowledge_articles',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => knowledgeCategories.id, {
      onDelete: 'set null',
    }),

    key: varchar('key', { length: 128 }).notNull(),
    version: integer('version').notNull().default(1),

    kind: knowledgeKindEnum('kind').notNull().default('sop'),
    status: knowledgeStatusEnum('status').notNull().default('draft'),

    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    summaryAr: text('summary_ar'),
    summaryEn: text('summary_en'),
    // Markdown, primary language of the article. Bilingual bodies live inline
    // via `## AR` / `## EN` sections at the author's discretion — enterprise
    // teams that need full parallel bodies use two articles cross-linked.
    bodyMd: text('body_md').notNull().default(''),
    // Optional Arabic variant when a single article carries both fully
    bodyMdAr: text('body_md_ar'),

    // Free-tag style
    tags: text('tags').array().notNull().default([]),
    // Bag of regulatory refs (authority + article/clause)
    references: jsonb('references')
      .$type<Array<{ authority: string; ref: string; url?: string; note?: string }>>()
      .notNull()
      .default([]),

    // Lifecycle telemetry
    authorUserId: uuid('author_user_id'),
    reviewerUserId: uuid('reviewer_user_id'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    reviewDueAt: timestamp('review_due_at', { withTimezone: true }),
    // Set by the acceptance flow (users mark they've read an SOP)
    requiresAcknowledgement: boolean('requires_acknowledgement').notNull().default(false),

    viewCount: integer('view_count').notNull().default(0),

    aiSummary: text('ai_summary'),
    aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>().notNull().default({}),
    embeddingRef: text('embedding_ref'),
    searchText: text('search_text').notNull().default(''),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('knowledge_articles_company_idx').on(t.companyId),
    index('knowledge_articles_category_idx').on(t.categoryId),
    index('knowledge_articles_key_idx').on(t.companyId, t.key),
    index('knowledge_articles_kind_status_idx').on(t.companyId, t.kind, t.status),
    index('knowledge_articles_status_idx').on(t.companyId, t.status),
  ],
);

export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;
export type NewKnowledgeArticle = typeof knowledgeArticles.$inferInsert;
