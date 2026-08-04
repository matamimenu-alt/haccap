# Phase 4 — Inspection Engine

Graded checklists tied to branches / areas / assets, with automated finding + follow-up task creation on finalize. This is the joint that Municipality (Phase 7) and HACCP (Phase 6) will hook into.

## Delivered

### Data layer (5 new tables)

| Table | Role |
|---|---|
| `inspection_templates` | Versioned graded checklists. `sections[]` + `items[]` stored inline as jsonb (template configuration). Scoring model: weighted sum per section, then weighted sum across sections. `passThreshold` and `critical` flags baked in. |
| `inspections` | The instance. Snapshots the template into `templateSnapshot` on create so historical inspections stay reproducible regardless of later template edits. Lifecycle: scheduled → in_progress → submitted → finalized. |
| `inspection_responses` | One row per (inspection, item). `value` enum (pass/fail/partial/not_applicable/observed), plus `numericValue`, `textValue`, computed `isPass` and weighted `score`. |
| `findings` | Failed responses become findings. Severity (observation/minor/major/critical) + status (open/in_capa/resolved/accepted_risk/closed/reopened). Cross-linked with `followupTaskId`. Also reusable by Phase 6 (CCP deviations) and Phase 7 (municipality violations). |
| `inspection_events` | Immutable timeline mirroring asset_events / task_events. 16 event types. |

New enums: `inspection_kind` (11), `inspection_status` (5), `inspection_response_value` (5), `finding_severity` (4), `finding_status` (6), `inspection_event_type` (16).

### Scoring service

`services/inspection-scoring.ts`:

- **`scoreResponse(item, response)`** — Normalized 0–1 score + isPass boolean. Numeric items honor `passIf: {op: gte|lte|between, value?, min?, max?}`.
- **`recomputeInspection(id)`** — Weighted section aggregate → weighted overall. `overallPass = (criticalFailures === 0 && overall >= passThreshold)`. Called after every response mutation and on submit/finalize.
- **`materializeFindingsFromResponses(id, actorUserId)`** — Idempotent per response. Emits one finding per failed non-N/A response, then auto-creates a follow-up task with `source='inspection'`, `sourceId=<inspectionId>`, `kind='inspection_followup'`, priority derived from severity. Cross-links via `findings.followupTaskId` and `tasks.metadata.findingId`.

### API layer (11 new endpoints)

**Templates** — `GET / POST /inspection-templates`, `GET /inspection-templates/:id`, `PATCH /inspection-templates/:id`
**Inspections** — list (with branchId/status/kind filters), get (hydrated with responses + findings), `POST` (creates + pre-seeds empty response rows from template), `PATCH /inspections/:id/responses/:itemKey` (records value, recomputes totals), `POST /inspections/:id/submit`, `POST /inspections/:id/finalize` (materializes findings + tasks), `GET /inspections/:id/events`
**Findings** — `GET / PATCH /findings/:id`

### Permissions

8 new keys under the `inspections` module: `inspection_templates:read|write`, `inspections:read|write|conduct|finalize`, `findings:read|write`. Roles updated — Inspector gets conduct, Internal Auditor gets finalize + templates:write, Employee gets read + conduct on their assigned inspections.

### Seed

- **Municipality Kitchen Inspection v1** — 7 sections (personal, facility, storage, temp, cleaning, pest, safety), 16 items with 5 critical items (health certs, raw/cooked separation, walk-in ≤4°C, freezer ≤-18°C, no pest signs, fire extinguishers, exit clear), `passThreshold: 85`, cited to "Riyadh Municipality — Food Safety Guideline 2024"
- **Daily supervisor walkthrough v1** — 3 sections (open/peak/close), 3 items including the shawarma CCP (≥75°C)

### Web UI

- Sidebar now shows **Compliance → Inspections + Findings** (both live).
- **`/inspections`** — table with score badge, critical count, status.
- **`/inspections/new`** — start from a template + branch.
- **`/inspections/:id`** — fill-out UI: sections rendered as cards, items with type-appropriate controls (numeric input for temp readings, yes/no/N/A buttons for boolean items, textarea for notes). Every response PATCHes the API and refreshes the score badge.
- **`/inspection-templates`** — template list with section + item counts and passThreshold.
- **`/findings`** — findings list with severity/status badges and jump links to their auto-created follow-up tasks.

## AI-readiness recap

- Templates carry `aiHints` with compliance frameworks + related asset categories — Phase 8 uses this to auto-suggest inspections when it detects risk elsewhere.
- Every inspection has `aiSummary`, `aiMetadata`, `aiRiskScore` (nullable Phase 8 slot).
- Findings have `aiSummary` + `aiMetadata` — Phase 8 clusters findings across branches to spot systemic issues.
- `inspection_events` has `aiAnnotation` write-back slot per row.
- Closed enum surface (5 response values, 4 severities, 6 statuses, 11 kinds) — LLM tool-use loop can enumerate everything.

## Seams to future phases

- **Phase 5 — Knowledge Engine**: consumes template `aiHints` + finding `aiSummary` for the retrieval corpus (compliance references, guideline citations).
- **Phase 6 — HACCP**: reuses the `findings` table for CCP deviations. CCP monitoring failure → finding with `severity='critical'` bound to the asset (the shawarma cone) + auto follow-up task.
- **Phase 7 — Municipality + SFDA**: reuses the `municipality_visit` inspection kind and the finding severity ladder. Municipality dashboard reads finalized inspections with `kind='municipality_visit'`.
- **Phase 8 — AI Engine**: reads inspection scores and finding patterns; writes back `inspections.aiRiskScore`. Predicts likely upcoming failures per branch and pre-generates recommended inspections.

## Explicitly not in Phase 4

- Recurring inspection schedules (equivalent of `maintenance_schedules`) — the seam is defined but the table lands with Phase 6 when the HACCP monitoring cadence needs it too.
- Attachment-required enforcement on transition — `evidenceRequiredOnFail` is stored on items and can be checked by the UI, but the server doesn't reject transitions yet.
- Full CAPA workflow with separate corrective / preventive actions rows — kept inline on the finding for Phase 4; Phase 6 formalizes it if scope grows.
- Inspection PDF export / audit-trail packet — Phase 7 (Municipality) delivers.
