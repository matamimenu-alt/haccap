# RCOS — Restaurant Compliance OS

Multi-tenant SaaS platform for restaurant chain compliance, HACCP, and food safety operations in Saudi Arabia. Bilingual (Arabic RTL / English LTR).

## Status

**Phase 1 — Foundation** (in progress). Delivers the monorepo, database schema, tenant + RBAC, JWT auth, OpenAPI spec, and the web app shell (login, organization management, i18n RTL).

Later phases add municipality inspections, HACCP + CCPs, tasks/CAPA, executive dashboards, and the AI compliance engine.

## Stack

- **Backend:** Node.js 20+, Express 5, Drizzle ORM, Zod v4
- **Database:** PostgreSQL 15+ (row-level tenant isolation via `company_id`)
- **Frontend:** React 18 + Vite, shadcn/ui, Tailwind CSS, TanStack Query, react-i18next
- **Auth:** JWT access + refresh tokens
- **Codegen:** OpenAPI 3.1 → orval → typed React Query hooks

## Repository layout

```
artifacts/
  api-server/        # Express 5 REST API
  web/               # React + Vite web app
lib/
  db/                # Drizzle schema, migrations, seed
  api-spec/          # openapi.yaml (single source of truth)
  api-client-react/  # Generated typed hooks (do not edit by hand)
  shared/            # Shared types + utilities (env, errors, i18n keys)
```

## Getting started

Requires **Node 20+**, **pnpm 9+**, and a running **PostgreSQL 15+**.

```bash
# Install
pnpm install

# Env
cp .env.example .env
# edit DATABASE_URL and JWT secrets

# Database
pnpm db:push          # create schema
pnpm db:seed          # load demo data

# Dev servers
pnpm dev              # runs api + web in parallel
# or individually:
pnpm dev:api
pnpm dev:web
```

Web: <http://localhost:5173> · API: <http://localhost:3001>

## Demo credentials (after seed)

- `owner@rcos.demo` / `Admin@2026` — Company Owner
- `ops@rcos.demo` / `Admin@2026` — Operations Director
- `fso@rcos.demo` / `Admin@2026` — Food Safety Officer

## Multi-tenancy

Every domain table has a `company_id`. Tenant is derived from the JWT on every request and injected into `req.tenant` by middleware. All DB queries are scoped through helper functions that enforce the filter — direct `.select()` on tenant tables without the scope is a code-review failure.

## Contributing

Branch naming: `claude/<slug>-<hash>`. See `docs/` for the SRS and phase plans.
