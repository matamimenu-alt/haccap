import { index, integer, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { companies } from './companies.js';
import { knowledgeArticles } from './knowledge-articles.js';

/**
 * Immutable version snapshots. Every publish appends. Never mutated —
 * historical citations always resolve to the exact text they cited.
 */
export const knowledgeArticleVersions = pgTable(
  'knowledge_article_versions',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id')
      .notNull()
      .references(() => knowledgeArticles.id, { onDelete: 'cascade' }),

    version: integer('version').notNull(),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    bodyMd: text('body_md').notNull(),
    bodyMdAr: text('body_md_ar'),
    changelog: text('changelog'),
    authoredByUserId: uuid('authored_by_user_id'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('knowledge_article_versions_uidx').on(t.articleId, t.version),
    index('knowledge_article_versions_article_idx').on(t.articleId),
  ],
);

export type KnowledgeArticleVersion = typeof knowledgeArticleVersions.$inferSelect;
export type NewKnowledgeArticleVersion = typeof knowledgeArticleVersions.$inferInsert;
