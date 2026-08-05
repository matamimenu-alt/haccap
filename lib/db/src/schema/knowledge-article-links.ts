import { index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { knowledgeLinkTargetEnum } from './enums.js';
import { companies } from './companies.js';
import { knowledgeArticles } from './knowledge-articles.js';

/**
 * A polymorphic cross-reference. An article can link to:
 *  - asset_category (targetRef = category.key or id)
 *  - inspection_template (targetRef = template.key)
 *  - task_template (targetRef = template.key)
 *  - area_kind (targetRef = area_kind enum value)
 *  - compliance_framework (targetRef = 'municipality', 'sfda', 'haccp', ...)
 *  - asset / branch / supplier (targetRef = row uuid)
 *
 * The AI Engine (Phase 8) uses these edges to build the retrieval graph:
 * "user opens the shawarma asset detail → pull articles linked to
 * asset_category=cooking.shawarma_machine + compliance_framework=haccp".
 */
export const knowledgeArticleLinks = pgTable(
  'knowledge_article_links',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id')
      .notNull()
      .references(() => knowledgeArticles.id, { onDelete: 'cascade' }),

    targetType: knowledgeLinkTargetEnum('target_type').notNull(),
    // Reference — a key (for taxonomy-level targets) or a uuid (for row targets)
    targetRef: varchar('target_ref', { length: 256 }).notNull(),
    // Human-readable label for the link (shown in the article's related list)
    label: text('label'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('knowledge_article_links_uidx').on(t.articleId, t.targetType, t.targetRef),
    index('knowledge_article_links_target_idx').on(t.targetType, t.targetRef),
    index('knowledge_article_links_company_idx').on(t.companyId),
  ],
);

export type KnowledgeArticleLink = typeof knowledgeArticleLinks.$inferSelect;
export type NewKnowledgeArticleLink = typeof knowledgeArticleLinks.$inferInsert;
