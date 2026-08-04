# Phase 3 — Task Engine

The work-item layer. Phase 2's `maintenance_schedules` now materialize into concrete `tasks`. Phase 4 (Inspections) and Phase 6 (HACCP CCP deviations) will emit tasks through the same seam.

## Delivered

### Data layer (7 new tables)

| Table | Role |
|---|---|
| `task_templates` | Reusable blueprints — `checklistItems`, `requiredAttachments`, `playbook`, `aiHints`. System + per-tenant. |
| `tasks` | **The work item.** FK to branch + area + polymorphic target (asset/area/branch/…). Carries kind, status, priority, riskLevel, dueAt, checklistState, ai_summary + ai_metadata + ai_risk_score + ai_predicted_overdue. |
| `task_assignments` | M:N users ↔ tasks with primary flag + accepted_at. |
| `task_comments` | Flat thread per task with mentions[] and `ai_annotation` write-back slot. |
| `task_events` | **Immutable** timeline mirroring the `asset_events` shape — 28 event types, before/after payloads, ai_annotation slot. |
| `task_dependencies` | task_a blocks task_b (soft-enforced in app layer). |
| `task_time_entries` | Time logged per user per task; feeds Phase 8's productivity model. |

New enums: `task_kind` (11), `task_status` (9), `task_priority` (5), `task_source` (7), `task_event_type` (28).

### Services

- **`services/task-events.ts`** — Non-fatal event emitter + `composeTaskAiFields()` helper.
- **`services/task-materializer.ts`** — `materializeFromSchedule()` is idempotent per (scheduleId, nextDueAt) so a re-run never double-books. `runMaterializationTick(horizonHours)` scans every active asset-scoped schedule due within the horizon. `advanceNextDue()` handles all 8 calendar-based frequencies; `usage_based` / `condition_based` / `custom` are left for the trigger owner to advance externally.
- **`services/jobs.ts`** — In-process interval job runner started at API boot. Guarded by `JOBS_ENABLED`. Non-overlapping ticks. Kicks the materializer once immediately on startup so seeded data lights up on first run. Replaceable with BullMQ or a k8s CronJob without touching callers.

### API layer (24 new endpoints)

**Templates** — `GET / POST /task-templates`, `PATCH / DELETE /task-templates/:id`
**Tasks** — list with filters (branchId/areaId/target/status[]/priority[]/kind[]/source/assignedToMe/dueBefore/overdue/q, paginated), summary aggregate, hydrated get, patch, 6 state transitions (`start`, `submit`, `complete`, `verify`, `cancel`, `block`), events log, comments (list + post), assignments (add / remove), checklist item mutation, time entries (list + post), dependency add
**Jobs** — `POST /jobs/materialize?horizonHours=24`, `POST /jobs/materialize/:scheduleId`

Every mutation emits a `task_events` row via the shared service.

### Permissions

11 new keys under the `tasks` module: `task_templates:*`, `tasks:read|write|transition|verify|assign|comment|time`, `task_events:read`, `jobs:admin`. All 10 system roles updated — Employee gets read + transition + comment + time on their own tasks; Internal Auditor gets read + verify + event log; management roles get full write.

### Seed

- 3 realistic task templates: monthly walk-in cooler maintenance (5-step), monthly fire extinguisher inspection (4-step), daily shawarma CCP monitoring (2-step, ≥75°C threshold, cited in `ai_hints.ccpTemperature`)
- One live maintenance schedule wired to the walk-in cooler asset with `nextDueAt` set 30 minutes into the future — the first materialization tick after boot produces a visible task on the board

### Web UI

- Sidebar now has a **Tasks** section (removed the "soon" tag).
- **`/tasks`** — filterable list (search across title, branch, status dropdown, Overdue and Mine toggles).
- **`/tasks/new`** — creation form with dependent branch → asset pickers, optional template that auto-fills title/kind/priority.
- **`/tasks/:id`** — 4-tab detail: Overview, Checklist (interactive with API round-trip), Comments (list + add), History (event feed).
- **`/tasks/templates`** — templates browser (system + custom).
- Dashboard now shows Assets, Tasks, and Overdue tiles alongside the org counts.
- New shared component `TaskStatusBadge` / `TaskPriorityBadge`.

### Runtime jobs configuration

New env: `JOBS_ENABLED` (default true), `JOBS_MATERIALIZER_INTERVAL_SEC` (default 300), `JOBS_MATERIALIZER_HORIZON_HOURS` (default 24). Graceful shutdown clears the interval before closing the HTTP server.

## AI-readiness recap

- Every task carries `ai_summary`, `ai_metadata`, `ai_risk_score` (nullable Phase 8 slot), and `ai_predicted_overdue` flag.
- `task_events` is the timeline corpus — 28 stable enum values means any LLM tool-use loop can enumerate the surface.
- Templates carry `ai_hints` so downstream ranking has structured hints (compliance scope, related category keys, thresholds like `ccpTemperature`).
- Comments carry `ai_annotation` for Phase 8 sentiment / action-item extraction.
- Every enum is closed and every polymorphic target uses the shared `polymorphic_target_type` enum introduced in Phase 2.

## Seams to future phases

- **Phase 4 — Inspection Engine**: on finding, creates a task with `source='inspection'`, `source_id=<inspection_id>`, `kind='inspection_followup'`. Attachments and photos already flow through the polymorphic attachments table.
- **Phase 5 — Knowledge Engine**: consumes `tasks.aiSummary`, `task_events.payload`, template `playbook` + `aiHints` to build the ops retrieval corpus.
- **Phase 6 — HACCP**: on CCP deviation, emits a task with `source='ccp_deviation'`, `kind='compliance'`, `priority='critical'` bound to the affected asset. The shawarma seed template is ready for that flow.
- **Phase 7 — Municipality**: reads templates tagged with `aiHints.compliance` and generates the audit-trail packet.
- **Phase 8 — AI Engine**: subscribes to `task_events`, writes back to `tasks.aiRiskScore` and `tasks.aiPredictedOverdue`. Reads `task_time_entries` for productivity modelling.

## Explicitly not in Phase 3

- Batch printing / assignment via drag-and-drop kanban board (list + detail is enough for the phase)
- Notifications on assignment/mention (Phase 4 adds the notifications table)
- Category-scoped maintenance schedule expansion into per-asset tasks (currently only asset-scoped schedules materialize; category-scoped are seeded but skipped by the materializer — flagged in the service)
- Slack/Email/SMS delivery of task assignments
- Enforcement of `requiredAttachments.minCount` before transition (validation stub is in place; strict enforcement lands with Phase 4)
