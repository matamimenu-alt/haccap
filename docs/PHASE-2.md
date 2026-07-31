# Phase 2 — Operations Core

Assets are the root. Every downstream module (Tasks Phase 3, Inspections Phase 4, HACCP Phase 6, Municipality Phase 7, AI Phase 8) plugs into this layer through the seams defined here.

## Delivered

### Data layer (12 new tables)

| Table | Role |
|---|---|
| `areas` | Functional zones inside a branch (kitchen, walk-in cooler, cook line, etc.). Hierarchical. Carries risk level, compliance scope, temperature targets. |
| `asset_categories` | Hierarchical taxonomy with materialized `path`. System defaults (companyId=null) + per-tenant custom. `ai_hints` for failure modes / compliance scope. |
| `suppliers` + `supplier_contacts` | Vendor records with tax/contact/address/categories + certifications bag. |
| `assets` | **Root entity**. FKs to company, branch, area, category, supplier. Physical identity + spec + lifecycle + AI-ready columns (`ai_summary`, `ai_metadata`, `search_text`, `embedding_ref` reserved for pgvector). |
| `asset_qr_codes` | Active + historical QR tokens. Opaque URL-safe tokens. Partial unique index enforces one active QR per asset. |
| `asset_tags` + `asset_tag_assignments` | Tenant-defined labels with color. |
| `warranties` | Per-asset warranties with provider (supplier), dates, cost, terms, `ai_extracted` bag for future OCR of certificates. |
| `attachments` | **Polymorphic** files (`target_type` enum + `target_id`). Handles documents, photos, videos across assets/warranties/suppliers/(later) inspections/tasks/incidents. Pluggable `storage_driver`. |
| `maintenance_schedules` | Per-asset OR per-category recurrence rules. Phase 3 Task Engine subscribes to `next_due_at` to materialize tasks. AI-prediction slots reserved. |
| `asset_events` | **Immutable** append-only event log with strict `event_type` enum and `{before, after, delta}` payloads. **This is the AI training corpus.** |

Full enum surface added: `area_kind`, `asset_status`, `asset_criticality`, `asset_kind`, `warranty_type`, `attachment_kind`, `polymorphic_target_type`, `asset_event_type`, `maintenance_frequency`, `maintenance_kind`, `risk_level`.

### Storage layer (`lib/storage`, new package)

Pluggable driver contract with local implementation. S3 / GCS drivers slot in behind the same interface without touching route code. HMAC-signed transient URLs. Tenant-prefixed keys (`companies/{cid}/{target}/{id}/…`) enforce plane isolation on disk.

### API layer (23 new endpoints across 8 route modules)

All authenticated, tenant-scoped, and enforcing coarse RBAC via `requireRole(...)`.

**Areas** — `GET /areas` (opt. `?branchId=`), `POST /areas`, `PATCH /areas/:id`, `DELETE /areas/:id`
**Asset Categories** — `GET /asset-categories` (system + custom), `POST /asset-categories`, `PATCH /asset-categories/:id`, `DELETE /asset-categories/:id` — computes `path` + `depth` from parent
**Suppliers** — `GET /suppliers`, `GET /suppliers/:id` (with contacts), `POST /suppliers`, `PATCH /suppliers/:id`, `DELETE /suppliers/:id`, `POST /suppliers/:id/contacts`, `DELETE /suppliers/:id/contacts/:contactId`
**Assets** — `GET /assets` (filters: branchId/areaId/categoryId/status/criticality/kind/supplierId/q, paginated), `GET /assets/:id` (hydrated with branch/area/category/supplier/activeQr/tags), `POST /assets` (creates + mints QR + emits `created` + `qr_generated` events), `PATCH /assets/:id` (diffs old vs new, emits typed events per changed field), `POST /assets/:id/decommission`, `GET /assets/:id/events`, `POST /assets/:id/tags`, `DELETE /assets/:id/tags/:tagId`, `GET /assets/:id/warranties`, `POST /assets/:id/warranties`, `GET /assets/:id/maintenance-schedules`, `POST /assets/:id/maintenance-schedules`, `POST /assets/:id/qr/reprint` (revokes old, mints new, emits `qr_reprinted`)
**Asset Tags** — `GET /asset-tags`, `POST /asset-tags`, `PATCH /asset-tags/:id`, `DELETE /asset-tags/:id`
**Attachments** — `POST /attachments` (multipart upload, up to 25MB, emits `photo_added`/`document_added` when target=asset), `GET /attachments?targetType=&targetId=` (each item includes short-lived signed URL), `DELETE /attachments/:id`, `GET /attachments/blob/*` (signed-URL streamer, HMAC verified)
**Maintenance Schedules** — `GET /maintenance-schedules` (tenant-wide with `?dueInDays=`), `PATCH /maintenance-schedules/:id`, `DELETE /maintenance-schedules/:id`
**QR** — `GET /qr/scan/:token` (auth-required scan resolver returning asset summary)

Every mutation on `assets` (and every attachment lifecycle event where target=asset) writes an `asset_events` row so the timeline is complete. The event-emission service (`services/asset-events.ts`) is non-fatal on write failure so observability never blocks a business mutation.

### OpenAPI

`lib/api-spec/openapi.yaml` extended with 8 new tags, 23 new paths, and ~20 new schemas covering every Operations Core surface.

### Permissions

19 new permission keys under the `operations` module: `assets:*`, `areas:*`, `asset_categories:*`, `suppliers:*`, `warranties:*`, `maintenance:*`, `attachments:*`, `asset_events:read`, `asset_tags:*`, `qr:scan`. Default role → permission mapping updated for all 10 system roles.

### Seed

Extended to load:
- 27 system asset categories in a proper tree (refrigeration/, cooking/, warewashing/, prep/, sensors/, safety/, hvac/, storage/, pest_control/) with `ai_hints` where the domain implies known failure modes or compliance scope
- 6 areas per branch × 4 branches (Kitchen, Walk-in Cooler w/ temp targets 0–4°C, Walk-in Freezer w/ -25 to -15°C, Prep Line, Dishwash, Dining)
- 4 suppliers (cooling equipment, restaurant equipment, safety, pest control) with categories + preferred flag
- 3 tag catalog entries
- 3 sample assets at the Riyadh Olaya branch (walk-in cooler, chicken shawarma machine, kitchen CO2 extinguisher) each with an active QR and populated `ai_summary` / `ai_metadata` / `search_text`

### Web UI (Operations sidebar section + 8 new pages)

New shadcn wrappers added: `Dialog`, `Select`, `Tabs`, `Textarea`. New shared: `EmptyState`, `AssetStatusBadge`, `CriticalityBadge`.

| Route | Purpose |
|---|---|
| `/operations/assets` | Filterable, searchable table (search across text, filter by branch and status) |
| `/operations/assets/new` | Create form with dependent branch → area select and category picker showing full paths |
| `/operations/assets/:id` | 7-tab detail view: Overview (with QR image via `qrcode.react`), Specification, Warranties, Maintenance, Documents, Photos, History (immutable event feed) |
| `/operations/areas` | List with branch, kind, risk badge, temperature target |
| `/operations/asset-categories` | Indented tree render showing path, risk badge, default kind, system/custom |
| `/operations/suppliers` | List with categories chips and preferred star |
| `/operations/maintenance` | Upcoming (30-day) schedule board |
| `/s/:token` | Public QR-scan resolver page inside the SPA — authenticated call resolves the token to the asset and offers a jump link |

Sidebar now has a dedicated **Operations** section (Assets, Areas, Asset Categories, Suppliers, Maintenance). Compliance / HACCP / Food Safety / CAPA / Reports links remain marked "soon" since they belong to Phases 3–8.

## AI-readiness — what's baked in (Phase 8 will consume)

- **Immutable event log** (`asset_events`) with strict enum + `{before, after, delta}` payloads is the training corpus for predictive maintenance and anomaly detection. `ai_annotation` column is a write-back slot for Phase 8 pipelines (severity classification, pattern tag, root-cause hypothesis) that never touches CRUD writes.
- **`assets.ai_summary`** — human-readable one-liner refreshed by `composeAssetAiFields()` on every write. Directly LLM-consumable in a prompt.
- **`assets.ai_metadata`** — machine-readable feature bag: criticality, category path, area kind, spec keys, downtime impact. This is what an embedding model will see.
- **`assets.search_text`** — precomputed FTS bridge that can later be converted to a `tsvector` GIN index without a schema flip.
- **`assets.embedding_ref`** — reserved slot. Phase 8's migration will `CREATE EXTENSION vector` and swap this to `vector(1536)`.
- **`asset_categories.ai_hints`** — declared failure modes, monitors, and compliance scope per category. Enables an AI assistant to reason about a "walk-in cooler" without knowing anything domain-specific.
- **`warranties.ai_extracted`, `attachments.ai_extracted`** — reserved bags for future OCR + document-extraction pipelines. Upload flow is ready; extraction can be added asynchronously without a shape change.
- **Every enum is closed** — an LLM tool-use loop can enumerate the entire surface (statuses, event types, area kinds, kinds, attachment kinds, target types, etc.) with a single tool.
- **`polymorphic_target_type` enum** — the `attachments` table and the coming Phase 3–8 event/tag/note tables reuse this exact enum. One taxonomy, everywhere.

## Seams to Phase 3+

- **Phase 3 — Task Engine**: subscribes to `maintenance_schedules.next_due_at` (existing column, indexed). On task completion writes `asset_events` with type `service_performed` or `maintenance_completed`.
- **Phase 4 — Inspection Engine**: inspection scope = `{ area | asset } × checklist_template`. Attachments and photos already flow through the polymorphic attachments table with `target_type='inspection'` reserved.
- **Phase 5 — Knowledge Engine**: pulls `assets.ai_summary`, `asset_events.payload`, category `ai_hints`, and warranty `ai_extracted` to build the retrieval corpus.
- **Phase 6 — HACCP**: CCPs reference assets (a "reach-in cooler must be ≤4°C" CCP is bound to a specific `assets.id`, with the target already coming from `areas.target_temp_max_c` or `assets.spec.target_temp_c`).
- **Phase 7 — Municipality + SFDA**: leverages `suppliers.approvals` (already jsonb-keyed per authority), `assets.ai_metadata.compliance`, and area-scoped inspections.
- **Phase 8 — AI Engine**: reads `asset_events` (subscribable via LISTEN/NOTIFY or CDC on the immutable table), writes predictions to `maintenance_schedules.predicted_failure_score` and `asset_events.ai_annotation`.

## Explicitly out of scope for Phase 2

- Full-text tsvector conversion (kept `search_text` as text for portability; conversion is a later migration)
- pgvector extension activation (Phase 8)
- Attachment thumbnail generation (column reserved; a Phase 3 worker will populate `thumbnail_key`)
- QR label PDF batch printing UI (individual QR renders on asset detail via `qrcode.react`; batch print sheet is a Phase 3 task)
- Maintenance-schedule → task materialization (Phase 3)
- OCR / document-extraction pipeline (`ai_extracted` columns exist; Phase 8 fills them)
