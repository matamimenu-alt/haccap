import { date, index, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './_shared.js';
import { certificationStatusEnum } from './enums.js';
import { companies } from './companies.js';
import { users } from './users.js';

/**
 * Employee health cards, food safety training certs, HACCP certifications.
 * Powers the Employee Hygiene + Medical Certificates + Training tracking
 * requested for Phase 6. Expiring items auto-trigger tasks via a scheduled
 * job (Phase 3 seam).
 */
export const employeeCertifications = pgTable(
  'employee_certifications',
  {
    id: primaryId(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // kind key: health_card, food_safety_level_2, haccp_practitioner, first_aid, fire_safety, allergen, other
    kind: varchar('kind', { length: 64 }).notNull(),
    titleEn: varchar('title_en', { length: 255 }).notNull(),
    titleAr: varchar('title_ar', { length: 255 }).notNull(),

    issuingAuthority: varchar('issuing_authority', { length: 128 }),
    referenceNumber: varchar('reference_number', { length: 128 }),

    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    status: certificationStatusEnum('status').notNull().default('active'),

    certificateUrl: text('certificate_url'),
    notes: text('notes'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index('employee_certifications_user_idx').on(t.userId),
    index('employee_certifications_company_idx').on(t.companyId),
    index('employee_certifications_expires_idx').on(t.companyId, t.expiresOn),
    index('employee_certifications_kind_idx').on(t.companyId, t.kind),
  ],
);

export type EmployeeCertification = typeof employeeCertifications.$inferSelect;
export type NewEmployeeCertification = typeof employeeCertifications.$inferInsert;
