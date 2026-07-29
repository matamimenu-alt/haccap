# Phase 1 — Foundation

Scope of this branch. Later phases build on top of what's here.

## Delivered

| Area | What's in |
|---|---|
| Monorepo | pnpm workspaces (`artifacts/*`, `lib/*`), shared `tsconfig.base.json`, `.env.example`, root scripts |
| Database | Drizzle ORM schema for the tenant + RBAC layer — `companies`, `brands`, `branches`, `org_levels`, `departments`, `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_sessions`, `audit_logs` |
| Auth | JWT access + opaque refresh tokens (hashed in DB), rotation on refresh, `requireAuth` / `requireRole` middleware, tenant derived from JWT |
| API | Express 5. Endpoints under `/api/v1`: `auth/{login,refresh,logout,me}`, `companies/me`, `brands`, `branches`, `users`, `roles`, `roles/permissions`, `departments`, `org-levels`, `health` |
| OpenAPI | `lib/api-spec/openapi.yaml` — single source of truth for Phase 1 shapes |
| Web | Vite + React 18 + Tailwind + shadcn/ui primitives + TanStack Query + Zustand. Full sidebar shell, dark topbar, i18n Arabic RTL ↔ English LTR, login page, dashboard, and read views for all Phase 1 domain tables |
| Seed | `pnpm db:seed` creates Al-Nakheel demo company: 2 brands, 4 branches (Riyadh × 2, Jeddah, Dammam), 10 system roles + permission catalog, 3 demo users |

## Demo credentials

- `owner@rcos.demo` / `Admin@2026` — Company Owner
- `ops@rcos.demo` / `Admin@2026` — Operations Director
- `fso@rcos.demo` / `Admin@2026` — Food Safety Officer

## Run locally

```bash
pnpm install
cp .env.example .env       # set DATABASE_URL + JWT secrets
pnpm db:push
pnpm db:seed
pnpm dev                   # http://localhost:5173  +  http://localhost:3001
```

## What Phase 1 explicitly does not include

Anything from these later modules is a placeholder in the sidebar or absent:

- Municipality Compliance (inspections, scoring, violations)
- HACCP plans + CCP monitoring logs
- Food safety logs (temperature, receiving, cleaning, pest control)
- Task management, CAPA
- Executive dashboard, branch dashboards
- AI Compliance Engine (needs OPENAI_API_KEY)
- Reports engine (PDF/Excel)
- Notifications
- Object storage for photos/videos
- Fine-grained permission checks in write routes (Phase 2 replaces the coarse `requireRole` guard with the permission catalog)
- OpenAPI codegen wiring (orval config) — spec is complete but generated hooks are not wired

## Notes on multi-tenancy

Every domain table has `company_id`. `req.tenant.companyId` is derived from the JWT, and every query on a tenant table goes through the `scoped()` helper in `artifacts/api-server/src/middleware/tenant-scope.ts`. Bypassing that helper on a tenant table is a code-review failure.

The `companies` table currently exposes only `/companies/me` because a tenant never sees other companies. A Platform Super Admin surface (across-tenant management) is a separate future concern.
