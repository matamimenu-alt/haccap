# RCOS — Complete Project Inventory

> Snapshot of what currently exists on branch `claude/architectural-blueprint-suite-k42f14` (commit `a8f94b9`, 90 tracked files, ~4,925 LOC).
>
> **Read this first:** RCOS is a **B2B multi-tenant compliance platform** for Saudi restaurant chains — municipality compliance, HACCP, food safety, tasks, CAPA. It is **not** a customer-facing food-delivery or e-commerce system. Sections in the requested inventory that assume that shape (Customer Website, Cart, Checkout, Payments, Coupons, Loyalty, Driver Features, Products, Menu-as-menu-items, Reviews, etc.) are marked **N/A to project domain** and truthfully report zero implementation — nothing was scaffolded for them because they are not part of the SRS scope.
>
> The current commit is **Phase 1 — Foundation**. Later phases (2–5) that would add municipality inspections, HACCP plans, CCP monitoring, tasks, CAPA, executive dashboards, and the AI compliance engine are **not** implemented in this commit.

---

## 1. Project Overview

- **Project name:** RCOS — Restaurant Compliance OS
- **Purpose:** Multi-tenant SaaS platform for restaurant chain compliance, HACCP, and food safety operations in Saudi Arabia. Bilingual (Arabic RTL / English LTR).
- **Tech stack (from `package.json` files, actually installed dependencies):**
  - Runtime: Node.js ≥ 20, pnpm ≥ 9
  - Backend: Express 5, Drizzle ORM 0.38, `jose` 5 (JWT), `argon2` 0.41, `zod` 3.24, `pino` 9 + `pino-http` 10, `helmet` 8, `cors` 2.8, `dotenv` 16
  - Database: PostgreSQL (via `postgres` 3.4 driver)
  - Frontend: React 18.3, Vite 6, TypeScript 5.7, Tailwind CSS 3.4, `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate`, shadcn-style primitives on top of Radix UI (`@radix-ui/react-*`), `@tanstack/react-query` 5.62, `react-router-dom` 6.28, `zustand` 5, `react-i18next` 15 + `i18next` 24 + `i18next-browser-languagedetector` 8, `react-hook-form` 7.54, `lucide-react` 0.469
  - Codegen source-of-truth: OpenAPI 3.1 (`lib/api-spec/openapi.yaml`) — spec authored, generated clients **not yet wired**
- **Folder structure (actual):**
  ```
  haccap/
  ├── .env.example
  ├── .gitignore
  ├── .prettierrc
  ├── README.md
  ├── package.json                # root (pnpm workspaces)
  ├── pnpm-workspace.yaml
  ├── tsconfig.base.json
  ├── docs/
  │   ├── PHASE-1.md
  │   └── INVENTORY.md            # this file
  ├── artifacts/
  │   ├── api-server/             # Express 5 REST API
  │   │   ├── package.json
  │   │   ├── tsconfig.json / tsconfig.build.json
  │   │   └── src/
  │   │       ├── index.ts
  │   │       ├── config/env.ts
  │   │       ├── lib/{logger,jwt}.ts
  │   │       ├── middleware/{auth,error-handler,tenant-scope}.ts
  │   │       └── routes/{index,auth,companies,brands,branches,users,roles,departments,org-levels}.ts
  │   └── web/                    # Vite + React web app
  │       ├── package.json
  │       ├── index.html
  │       ├── vite.config.ts
  │       ├── tsconfig.json
  │       ├── tailwind.config.ts
  │       ├── postcss.config.js
  │       ├── public/favicon.svg
  │       └── src/
  │           ├── main.tsx / App.tsx
  │           ├── styles/globals.css
  │           ├── i18n/{index.ts, ar/common.json, en/common.json}
  │           ├── lib/{api,utils}.ts
  │           ├── stores/auth.ts
  │           ├── components/
  │           │   ├── layout/{app-shell,sidebar,topbar}.tsx
  │           │   ├── shared/{page-header,require-auth}.tsx
  │           │   └── ui/{badge,button,card,input,label,table}.tsx
  │           └── pages/
  │               ├── LoginPage.tsx
  │               ├── DashboardPage.tsx
  │               └── organization/{CompanyPage,BrandsPage,BranchesPage,UsersPage,RolesPage,DepartmentsPage,OrgLevelsPage}.tsx
  └── lib/
      ├── db/                     # Drizzle schema + seed
      │   ├── package.json
      │   ├── drizzle.config.ts
      │   ├── tsconfig.json
      │   └── src/
      │       ├── index.ts
      │       ├── seed.ts
      │       └── schema/{index,_shared,enums,companies,brands,branches,org-levels,departments,users,roles,permissions,user-sessions,audit-logs}.ts
      ├── shared/                 # cross-package types (@rcos/shared)
      │   ├── package.json / tsconfig.json
      │   └── src/{index,errors,roles,permissions,response}.ts
      └── api-spec/               # OpenAPI 3.1 source of truth
          ├── package.json
          └── openapi.yaml
  ```
- **Architecture:** Cloud-native multi-tenant SaaS. Single shared PostgreSQL. Every domain table carries `company_id`. Tenant is derived from JWT on every request; queries pass through a `scoped()` helper that enforces the `company_id` filter. Front-end is a single-page app that consumes the JSON API. There is a single monolithic Express server and a single React client — no gateway, no microservices, no worker, no queue.

---

## 2. Frontend

All routes live under a single React SPA at `artifacts/web`.

| Route | File | Purpose | Components used | Features | Status |
|---|---|---|---|---|---|
| `/login` | `pages/LoginPage.tsx` | Email + password sign-in with locale toggle and pre-filled demo credentials panel | `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`, `Button`, `Input`, `Label`, `Languages` icon | Login form (email/password, submit, error surface), language toggle button, static list of demo credentials | Complete |
| `/` (index) | `pages/DashboardPage.tsx` | Landing dashboard after login | `PageHeader`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, lucide icons, TanStack Query | 4 stat tiles (branches count, brands count, active users count, "Open violations" placeholder always `—`), Phase-1 notice card | Partial (Open violations is a hard-coded placeholder because Phase 2 is not built) |
| `/organization/company` | `pages/organization/CompanyPage.tsx` | Read view of the current tenant company profile | `PageHeader`, `Card`, `Badge`, TanStack Query | Displays name (AR + EN), status badge, slug, country, timezone, default locale, commercial registration, VAT number | Complete (read-only) |
| `/organization/brands` | `pages/organization/BrandsPage.tsx` | Table of brands for the tenant | `PageHeader`, `Card`, `Table` family, TanStack Query | Table (slug, name, description), empty + loading states | Complete (read-only) |
| `/organization/branches` | `pages/organization/BranchesPage.tsx` | Table of branches | `PageHeader`, `Card`, `Table` family, `Badge`, TanStack Query | Table (code, name, city, restaurant type, status badge), status → color mapping, empty + loading states | Complete (read-only) |
| `/organization/users` | `pages/organization/UsersPage.tsx` | Table of users | `PageHeader`, `Card`, `Table` family, `Badge`, TanStack Query, `formatDate` | Table (full name, email, status badge, last-login formatted) | Complete (read-only) |
| `/organization/roles` | `pages/organization/RolesPage.tsx` | Roles list (system + custom) | `PageHeader`, `Card`, `Table` family, `Badge`, TanStack Query | Table (key, name, priority, system/custom badge) | Complete (read-only) |
| `/organization/departments` | `pages/organization/DepartmentsPage.tsx` | Departments list | `PageHeader`, `Card`, `Table` family, TanStack Query | Table (code, name), empty state | Complete (read-only) |
| `/organization/org-levels` | `pages/organization/OrgLevelsPage.tsx` | Org hierarchy levels | `PageHeader`, `Card`, `Table` family, TanStack Query | Table (depth, name), empty state | Complete (read-only) |
| `*` (fallback) | `App.tsx` | Redirects unknown routes to `/` | `<Navigate>` | Redirect only | Complete |

Auth gate: `RequireAuth` wraps every authenticated route and redirects unauthenticated users to `/login`.

Nav shell sections defined in `sidebar.tsx` but disabled with a "soon" tag (no route, no page): `/compliance`, `/haccp`, `/food-safety`, `/tasks`, `/capa`, `/reports`, `/settings`. These are shown as greyed-out sidebar items only — clicking them does nothing.

---

## 3. Backend

All routes are mounted under `/api/v1` in `artifacts/api-server/src/routes/index.ts`. Response envelope is `{ success: true, data, meta? }` on success, `{ success: false, error: { code, message: { ar, en }, details? } }` on failure.

| Method | Route | Description | Auth | Roles required | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/health` | Liveness probe. Returns `{ status: "ok", ts }` | ❌ | — | Complete |
| POST | `/api/v1/auth/login` | Email + password → issues access + refresh tokens; updates `users.last_login_at` | ❌ | — | Complete |
| POST | `/api/v1/auth/refresh` | Rotates refresh token → new access + refresh pair; revokes the old session | ❌ | — | Complete |
| POST | `/api/v1/auth/logout` | Revokes the passed refresh token, or every active session for the current user if body omitted | ✅ | any | Complete |
| GET | `/api/v1/auth/me` | Current user profile + roles derived from JWT | ✅ | any | Complete |
| GET | `/api/v1/companies/me` | Fetch the current tenant company | ✅ | any | Complete |
| PATCH | `/api/v1/companies/me` | Update the current tenant company (nameAr/En, CR, VAT, defaultLocale, timezone, logoUrl, settings) | ✅ | `company_owner` or `platform_super_admin` | Complete |
| GET | `/api/v1/brands` | List brands (tenant-scoped) | ✅ | any | Complete |
| POST | `/api/v1/brands` | Create brand | ✅ | `platform_super_admin`, `company_owner`, `operations_director` | Complete |
| PATCH | `/api/v1/brands/:id` | Update brand | ✅ | as above | Complete |
| DELETE | `/api/v1/brands/:id` | Soft-delete brand | ✅ | as above | Complete |
| GET | `/api/v1/branches` | List branches (tenant-scoped) | ✅ | any | Complete |
| GET | `/api/v1/branches/:id` | Fetch single branch | ✅ | any | Complete |
| POST | `/api/v1/branches` | Create branch (validates lat/lng, restaurant type, expiry-date format) | ✅ | `platform_super_admin`, `company_owner`, `operations_director`, `area_manager` | Complete |
| PATCH | `/api/v1/branches/:id` | Update branch | ✅ | as above | Complete |
| DELETE | `/api/v1/branches/:id` | Soft-delete branch | ✅ | as above | Complete |
| GET | `/api/v1/users` | List users (tenant-scoped, `passwordHash` omitted) | ✅ | any | Complete |
| POST | `/api/v1/users` | Create user; hashes password with argon2; assigns roles by key; enforces email uniqueness per tenant | ✅ | `platform_super_admin`, `company_owner`, `operations_director` | Complete |
| PATCH | `/api/v1/users/:id` | Update user profile / status / branch assignments | ✅ | as above | Complete |
| DELETE | `/api/v1/users/:id` | Soft-delete user; blocks deleting self | ✅ | as above | Complete |
| GET | `/api/v1/roles` | List system roles + this tenant's custom roles | ✅ | any | Complete |
| GET | `/api/v1/roles/permissions` | List every permission in the global catalog | ✅ | any | Complete |
| GET | `/api/v1/roles/:id/permissions` | Permissions granted to a role | ✅ | any | Complete |
| GET | `/api/v1/departments` | List departments (tenant-scoped) | ✅ | any | Complete |
| POST | `/api/v1/departments` | Create department | ✅ | `platform_super_admin`, `company_owner`, `operations_director` | Complete |
| PATCH | `/api/v1/departments/:id` | Update department | ✅ | as above | Complete |
| DELETE | `/api/v1/departments/:id` | Soft-delete department | ✅ | as above | Complete |
| GET | `/api/v1/org-levels` | List org-hierarchy levels ordered by depth | ✅ | any | Complete |
| POST | `/api/v1/org-levels` | Create org level | ✅ | `platform_super_admin`, `company_owner` | Complete |
| PATCH | `/api/v1/org-levels/:id` | Update org level | ✅ | as above | Complete |
| DELETE | `/api/v1/org-levels/:id` | Soft-delete org level | ✅ | as above | Complete |
| ANY | `*` | 404 fallback returning envelope error | ❌ | — | Complete |

**Total endpoints:** 30 (29 domain + 1 fallback).

---

## 4. Database

Defined in `lib/db/src/schema/*.ts`. All tables use UUID PKs (`gen_random_uuid()`), soft-delete via `deleted_at`, and standard `created_at` / `updated_at` timestamps.

### Enums (`enums.ts`)
- `restaurant_type` — fast_food, casual_dining, fine_dining, shawarma, bakery, coffee_shop, buffet, cloud_kitchen, catering, other
- `company_status` — trial, active, suspended, archived
- `branch_status` — active, inactive, closed_for_renovation, permanently_closed
- `user_status` — active, invited, suspended, deactivated
- `locale` — ar, en
- `audit_action` — create, update, delete, login, logout, export, assign, approve, reject

### Tables

| Table | Fields | Relationships | Purpose |
|---|---|---|---|
| `companies` | `id`, `slug` (unique), `name_ar`, `name_en`, `commercial_registration`, `vat_number`, `country` (default SA), `default_locale`, `timezone` (default Asia/Riyadh), `status`, `logo_url`, `enabled_modules jsonb`, `settings jsonb`, `owner_user_id`, `created_at`, `updated_at`, `deleted_at` | Root tenant; parent of every other domain row | Tenant record + feature-flag/settings blob |
| `brands` | `id`, `company_id` (FK → companies, cascade), `name_ar`, `name_en`, `slug`, `logo_url`, `description`, timestamps | belongs to `companies` | Brand under a company |
| `branches` | `id`, `company_id` (FK), `brand_id` (FK → brands, set-null), `code`, `name_ar`, `name_en`, `restaurant_type`, `status`, `city`, `region`, `address_line`, `latitude`, `longitude` (numeric 10,7), `municipality_license_number`, `municipality_license_expiry_date`, `seating_capacity`, `staff_headcount`, `open_hours jsonb`, timestamps | belongs to `companies` and (optionally) `brands` | Individual restaurant location |
| `org_levels` | `id`, `company_id` (FK), `depth`, `name_ar`, `name_en`, `parent_level_id` (self-ref, no FK constraint declared), timestamps | belongs to `companies` | Dynamic organizational hierarchy per tenant |
| `departments` | `id`, `company_id` (FK), `name_ar`, `name_en`, `code`, timestamps | belongs to `companies` | Departments (Operations, Kitchen, etc.) |
| `users` | `id`, `company_id` (FK), `email`, `phone`, `password_hash`, `full_name_ar`, `full_name_en`, `avatar_url`, `preferred_locale`, `status`, `branch_ids uuid[]`, `department_id` (FK → departments, set-null), `org_level_id`, `metadata jsonb`, `last_login_at`, timestamps | belongs to `companies`; optional FK to `departments` | Tenant user with multi-branch access via array (no pivot) |
| `roles` | `id`, `company_id` (nullable → shared system roles), `key`, `name_ar`, `name_en`, `description`, `is_system`, `priority` (stored as varchar), timestamps | scoped to a `company` or global (companyId = null) | Role catalog (10 system roles + optional custom) |
| `user_roles` | `id`, `company_id` (FK), `user_id` (FK → users), `role_id` (FK → roles), timestamps | m:n between `users` and `roles` | Assigns a user 1+ roles |
| `permissions` | `id`, `key` (unique, e.g. `branches:write`), `module`, `action`, `description_ar`, `description_en`, timestamps | referenced by `role_permissions` | Global permission catalog |
| `role_permissions` | `id`, `role_id` (FK), `permission_id` (FK), timestamps | m:n between `roles` and `permissions` | Which permissions each role grants |
| `user_sessions` | `id`, `company_id` (FK), `user_id` (FK), `refresh_token_hash` (sha256), `user_agent`, `ip_address`, `expires_at`, `revoked_at`, timestamps | belongs to `users` | Refresh-token store; access tokens stateless |
| `audit_logs` | `id`, `company_id` (FK), `actor_user_id`, `action` (enum), `entity_type`, `entity_id`, `payload jsonb`, `ip_address`, `user_agent`, timestamps | append-only per tenant | Immutable action trail (table defined, **no writes currently emitted from any route** — infrastructure only) |

**Total tables:** 12.

---

## 5. Authentication

Implemented in `artifacts/api-server/src/routes/auth.ts`, `lib/jwt.ts`, `middleware/auth.ts`.

- Email + password login with argon2 password hashing (`argon2.verify` on login, `argon2.hash` on user create)
- JWT access token issuance (HS256, `jose`) with configurable TTL (`JWT_ACCESS_TTL`, default 15m)
- Opaque random refresh token (48 bytes, base64url) with sha256 stored server-side in `user_sessions`; raw token never persisted
- Refresh-token rotation on `/auth/refresh` (old session revoked, new one issued)
- Configurable refresh TTL (`JWT_REFRESH_TTL`, default 30d)
- Logout: revoke a single passed refresh token, or all active sessions for the current user if body omitted
- `requireAuth` middleware verifies bearer token and attaches `req.tenant = { userId, companyId, roles, branchIds }`
- `requireRole(...allowed)` coarse role gate used on write endpoints
- `session.userAgent` and `session.ipAddress` captured for the session row
- Rejects users whose `status !== 'active'`
- Records `last_login_at` on successful login
- Web client stores tokens via Zustand + `persist` middleware in `localStorage` (`rcos.auth`)
- Web client attaches `Authorization: Bearer <access>` on every API call via `lib/api.ts`

**Not implemented:** registration/self-signup, password reset, forgot-password, email verification, MFA/2FA, OAuth/SSO, magic-link, remember-me flag, session listing UI, refresh-on-401 auto-retry.

---

## 6. User Roles

Defined in `lib/shared/src/roles.ts` and seeded into `roles` at seed time. Default permission mappings are in `lib/shared/src/permissions.ts` (`ROLE_DEFAULT_PERMISSIONS`).

| Key | Ar | En | Priority | Default permissions |
|---|---|---|---:|---|
| `platform_super_admin` | مسؤول عام للمنصة | Platform Super Admin | 0 | **All** |
| `company_owner` | مالك الشركة | Company Owner | 10 | **All** |
| `operations_director` | مدير العمليات | Operations Director | 20 | `companies:read`, `brands:read`, `brands:write`, `branches:read`, `branches:write`, `org_levels:write`, `departments:write`, `users:read`, `users:write`, `roles:read`, `audit:read` |
| `area_manager` | مدير منطقة | Area Manager | 30 | `companies:read`, `brands:read`, `branches:read`, `branches:write`, `users:read` |
| `branch_manager` | مدير فرع | Branch Manager | 40 | `companies:read`, `brands:read`, `branches:read`, `users:read` |
| `food_safety_officer` | مسؤول سلامة الغذاء | Food Safety Officer | 45 | `branches:read`, `users:read` |
| `internal_auditor` | مدقق داخلي | Internal Auditor | 50 | `companies:read`, `brands:read`, `branches:read`, `users:read`, `roles:read`, `audit:read` |
| `supervisor` | مشرف | Supervisor | 60 | `branches:read`, `users:read` |
| `inspector` | مفتش | Inspector | 65 | `branches:read` |
| `employee` | موظف | Employee | 70 | `branches:read` |

**Permission catalog (currently declared 13 keys):**
- Organization: `companies:read`, `companies:write`, `brands:read`, `brands:write`, `branches:read`, `branches:write`, `org_levels:write`, `departments:write`
- Users & RBAC: `users:read`, `users:write`, `roles:read`, `roles:write`
- Audit: `audit:read`

**Note on enforcement:** Write endpoints currently use the coarse `requireRole(...)` guard on role keys, not the fine-grained permission catalog. The catalog is seeded and browsable via API but not consulted by any route.

**Total roles:** 10.

---

## 7. Customer Website

**N/A to project domain.** RCOS is an internal B2B compliance platform, not a customer-facing storefront. No customer-facing pages, no product browsing, no cart, no checkout, no order tracking, no customer accounts.

Implemented customer features: **none**.

---

## 8. Restaurant Admin Panel

There is no separate "restaurant admin panel" — the single web app in `artifacts/web` IS the admin surface, and it's used by every role. Pages that exist there today are enumerated in **§2 Frontend** (Dashboard + 7 Organization pages + Login). All operational domain modules named in the SRS (Compliance, HACCP, Food Safety, Tasks, CAPA, Reports, Settings) appear only as disabled sidebar links marked "soon" — no page files exist for them.

---

## 9. Super Admin Panel

**Not implemented as a distinct surface.** The `platform_super_admin` role exists in the role catalog with permissions, but there is no dedicated cross-tenant admin UI or endpoint (e.g., there is no `GET /companies` that lists across tenants — only `/companies/me`). No super-admin page files exist.

---

## 10. Driver Features

**N/A to project domain.** Nothing implemented — no driver model, table, endpoints, pages, tracking, dispatch, or delivery flows.

---

## 11. Orders System

**N/A to project domain.** Nothing implemented — no orders table, endpoints, pages, or POS integration.

---

## 12. Menu System

**N/A to project domain.** No "menu" as in customer-facing dishes/products. The only "menus" in the codebase are the sidebar navigation menus described in §2.

---

## 13. Categories

**Not implemented.** No category table, endpoints, or pages.

---

## 14. Products

**N/A to project domain.** No product model.

---

## 15. Cart

**N/A to project domain.** Not implemented.

---

## 16. Checkout

**N/A to project domain.** Not implemented.

---

## 17. Payments

**Not implemented.** No payment gateway integration, no billing table, no invoice model. The SRS mentions billing as a Phase 5 item; nothing is scaffolded.

---

## 18. Coupons

**N/A to project domain.** Not implemented.

---

## 19. Loyalty System

**N/A to project domain.** Not implemented.

---

## 20. Reviews

**N/A to project domain.** Not implemented.

---

## 21. Notifications

**Not implemented in Phase 1.** No notifications table, no email/SMS driver, no in-app notification UI. The SRS marks Notifications as module #13; it will be added in a later phase.

---

## 22. Reports

**Not implemented in Phase 1.** No report endpoints, PDF/Excel generators, or report pages. Sidebar shows a "Reports" link marked "soon".

---

## 23. Analytics

**Not implemented.** The dashboard shows 4 stat tiles computed client-side from `GET /branches`, `GET /brands`, `GET /users` counts (see §2). There is no analytics service, no time-series storage, no charting library integrated, no ClickHouse/BigQuery/etc.

---

## 24. Settings

**Not implemented as a page.** `companies.settings` is a `jsonb` column that can be mutated via `PATCH /companies/me`, but no settings UI exists. Sidebar shows a "Settings" link marked "soon".

---

## 25. Localization

- **Languages implemented:** Arabic (`ar`) and English (`en`). Arabic is the default and locale (`html[dir]` and `html[lang]`) switches automatically on locale change.
- **Direction:** RTL for `ar`, LTR for `en`. Handled by `src/i18n/index.ts::setDirection`.
- **Framework:** `react-i18next` 15 + `i18next-browser-languagedetector` (order: localStorage → navigator, cache key `rcos.locale`).
- **Toggle:** Chip in the topbar and on the login page (`toggleLocale()`).
- **Font stack:** LTR uses Inter fallback; RTL body uses `IBM Plex Sans Arabic` / `Noto Sans Arabic` (declared in `tailwind.config.ts`, applied via `html[dir='rtl'] body`).
- **Translation coverage:** Two flat namespaces (`ar/common.json`, `en/common.json`) mirroring each other. Keys grouped as `app`, `actions`, `auth`, `nav`, `dashboard`, `branches`, `brands`, `users`, `roles`, `restaurantType`, `status`, `common`. Both files contain the same key tree — no keys are missing between locales.
- **Backend bilingual:** Error envelope always returns `{ message: { ar, en } }`. Domain records store `name_ar` and `name_en` side-by-side; frontend picks by current locale.
- **Not yet localized:** dates on the client are formatted with `Intl.DateTimeFormat('ar-SA' | 'en-GB')` in `formatDate`; there is no Hijri calendar support (Phase 5 SRS item).

---

## 26. Currency System

**Not implemented.** There is no currency field on any table, no currency helper in `lib/shared/`, no i18n formatter dedicated to money, no exchange-rate service, no per-tenant currency setting. Nothing in the code references SAR, USD, or any currency. The only monetary concept anywhere is the `vat_number` string on `companies` (a tax-ID, not an amount).

---

## 27. Theme System

- Tailwind is configured with `darkMode: ['class']` in `tailwind.config.ts`, and both `:root` and `.dark` CSS-variable palettes are defined in `src/styles/globals.css`.
- Semantic tokens defined: `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `sidebar`, `sidebar-foreground`, `sidebar-accent`, plus `success`, `warning`, `danger`.
- **There is no user-facing theme toggle wired.** The `.dark` class is never applied by any component. The app renders in light mode only until a toggle is added.
- Sidebar/topbar use dedicated dark-tone tokens by design (dark slate sidebar on a light body).

---

## 28. File Upload System

**Not implemented.** No upload endpoint, no S3/GCS driver, no `multer`/`busboy` middleware, no upload UI. `.env.example` declares `STORAGE_DRIVER=local` and `STORAGE_LOCAL_PATH=./storage` as placeholders for a future Phase 3 delivery, but nothing consumes them.

---

## 29. Search System

**Not implemented.** No search endpoints, no full-text index, no search bar in UI. Domain lists are unpaginated `SELECT *` queries filtered only by `company_id` and `deleted_at`.

---

## 30. Filters

**Not implemented.** List endpoints (`GET /brands`, `/branches`, `/users`, `/roles`, `/departments`, `/org-levels`) accept no query parameters — they always return the full tenant-scoped set. No filter UI in any page.

---

## 31. Dashboard Widgets

Four stat cards on `/` (see §2 Dashboard row). No charts, no time-series, no filters, no drill-down. The "Open violations" tile is a static `—` because there is no violations model.

---

## 32. Integrations

**External services connected in code:** none.

`.env.example` reserves `OPENAI_API_KEY` for a future AI compliance engine (Phase 4), but no OpenAI client is imported anywhere and no code path calls out to it.

---

## 33. Security Features

- Helmet middleware on the API (default header set)
- CORS restricted to `WEB_ORIGIN` from env (comma-separated allowed)
- `express.json({ limit: '2mb' })` payload cap
- Argon2 password hashing (industry-recommended KDF)
- JWT signed with HS256 using separate access/refresh secrets, minimum 16-char enforced by the env schema
- Refresh tokens stored as sha256 hash server-side, opaque and rotated on every use
- Rejects requests whose user is not `active`
- Prevents self-deletion in `DELETE /users/:id`
- Enforces email uniqueness per company on user create
- `disable('x-powered-by')` on Express
- `trust proxy` set to 1 so `req.ip` is honest behind one hop
- Tenant scoping helper `scoped()` prevents cross-tenant reads by construction
- Zod validates every request body / path param, converted to 422 with structured details
- No secret in code — everything comes from `process.env` and is validated at boot

**Not implemented:** rate limiting, brute-force lockout, CSRF (SPA doesn't use cookies), request-signing, WAF rules, IP allowlist, CSP header, HSTS override, secret rotation.

---

## 34. Performance Features

- TanStack Query on the client with `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false` — sensible caching defaults
- Drizzle indexes declared:
  - `companies.status`
  - `brands.company_id`
  - `branches.company_id`, `brand_id`, `status`
  - `org_levels.company_id`, and composite `(company_id, depth)`
  - `departments.company_id`
  - `users` composite `(company_id, email)` and `(company_id, status)`
  - `roles.company_id`, `(company_id, key)`
  - `user_roles.user_id`, `.role_id`, `.company_id`
  - `permissions.module`
  - `role_permissions.role_id`, `.permission_id`
  - `user_sessions.user_id`, `.refresh_token_hash`
  - `audit_logs.company_id`, `.actor_user_id`, `(entity_type, entity_id)`
- Postgres connection pool sized via `DB_POOL_MAX` (default 10) with 20 s idle and 10 s connect timeouts
- Vite bundler for fast dev + prod build

**Not implemented:** Redis/HTTP caching layer, CDN, image optimization pipeline, pagination on list endpoints, request-scoped batching, N+1 protection tooling.

---

## 35. Responsive Design

- Tailwind default breakpoints. Sidebar is hidden below `md` (`hidden md:flex md:w-64`), so on mobile the shell is topbar + main only — there is **no hamburger drawer wired**, so mobile users lose sidebar navigation until one is added.
- Grid stats on the dashboard collapse: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- Login screen collapses from two columns (`md:grid-cols-2`) to a single column below `md`.
- Tables are wrapped in `overflow-auto` so they scroll horizontally on narrow viewports.
- No dedicated tablet route, no mobile-specific pages.

---

## 36. SEO Features

- Single `<title>` in `index.html`: "RCOS — Restaurant Compliance OS".
- Favicon (`public/favicon.svg`), inline SVG.
- `<html lang>` and `<html dir>` kept in sync with active locale.

**Not implemented:** meta description, Open Graph, Twitter cards, sitemap, robots.txt, canonical tags, JSON-LD, SSR/prerender. This is expected for an authenticated B2B app but noting it truthfully.

---

## 37. Environment Variables Used

From `.env.example` (server-side, validated by Zod at boot):

| Var | Purpose | Default | Required |
|---|---|---|:---:|
| `NODE_ENV` | development/test/production | development | — |
| `DATABASE_URL` | Postgres connection string | — | ✅ |
| `DB_POOL_MAX` | postgres pool size | 10 | — |
| `API_PORT` | Express listen port | 3001 | — |
| `API_HOST` | Express bind host | 0.0.0.0 | — |
| `API_BASE_URL` | Advertised base URL | http://localhost:3001 | — |
| `JWT_ACCESS_SECRET` | HS256 secret for access tokens | — | ✅ (min 16 chars) |
| `JWT_REFRESH_SECRET` | HS256 secret for refresh tokens (note: current impl treats refresh tokens as opaque; secret is present for future signed variant) | — | ✅ (min 16 chars) |
| `JWT_ACCESS_TTL` | Access token TTL, e.g. `15m` | 15m | — |
| `JWT_REFRESH_TTL` | Refresh token TTL, e.g. `30d` | 30d | — |
| `WEB_ORIGIN` | CORS allow-list (comma-separated) | http://localhost:5173 | — |
| `WEB_PORT` | Vite dev port (client only) | 5173 | — |
| `VITE_API_BASE_URL` | Client override for API base | (proxy) | — |
| `OPENAI_API_KEY` | Placeholder for future AI engine | — | ❌ (unused today) |
| `STORAGE_DRIVER` | Placeholder for future storage layer | local | ❌ (unused today) |
| `STORAGE_LOCAL_PATH` | Placeholder | ./storage | ❌ (unused today) |

---

## 38. Third-Party Libraries

**Runtime — API server:**
`express@5.0.1`, `helmet@8.0.0`, `cors@2.8.5`, `pino@9.5.0`, `pino-http@10.3.0`, `pino-pretty` (transitive), `dotenv@16.4.7`, `zod@3.24.1`, `jose@5.9.6`, `argon2@0.41.1`, `drizzle-orm@0.38.3`, `@rcos/db` (workspace), `@rcos/shared` (workspace).

**Runtime — DB package:**
`drizzle-orm@0.38.3`, `postgres@3.4.5`, `argon2@0.41.1`, `dotenv@16.4.7`, `@rcos/shared` (workspace).

**Runtime — Shared:**
`zod@3.24.1`.

**Runtime — Web:**
`react@18.3.1`, `react-dom@18.3.1`, `react-router-dom@6.28.0`, `@tanstack/react-query@5.62.11`, `zustand@5.0.2`, `i18next@24.2.0`, `react-i18next@15.4.0`, `i18next-browser-languagedetector@8.0.2`, `react-hook-form@7.54.2` (installed but no forms use it yet), `zod@3.24.1`, `class-variance-authority@0.7.1`, `clsx@2.1.1`, `tailwind-merge@2.6.0`, `tailwindcss-animate@1.0.7`, `lucide-react@0.469.0`, `@radix-ui/react-avatar@1.1.2`, `@radix-ui/react-dialog@1.1.4`, `@radix-ui/react-dropdown-menu@2.1.4`, `@radix-ui/react-label@2.1.1`, `@radix-ui/react-select@2.1.4`, `@radix-ui/react-separator@1.1.1`, `@radix-ui/react-slot@1.1.1`, `@radix-ui/react-tabs@1.1.2`, `@radix-ui/react-toast@1.2.4`, `@rcos/shared` (workspace).

Radix packages `avatar`, `dialog`, `dropdown-menu`, `select`, `separator`, `tabs`, `toast` are installed but no shadcn wrapper components exist yet for them — only `button`, `input`, `label`, `card`, `badge`, `table` have wrappers.

**Dev / tooling:**
`typescript@5.7.3`, `tsx@4.19.2`, `prettier@3.4.2`, `vite@6.0.7`, `@vitejs/plugin-react@4.3.4`, `tailwindcss@3.4.17`, `postcss@8.4.49`, `autoprefixer@10.4.20`, `drizzle-kit@0.30.1`, `@types/node`, `@types/express`, `@types/cors`, `@types/react`, `@types/react-dom`.

---

## 39. Custom Hooks

**None.** No `hooks/` files exist yet. Components use built-in React hooks and TanStack Query's `useQuery` directly.

---

## 40. Reusable Components

- **UI primitives (`components/ui/`)**: `Button` (with cva variants), `Input`, `Label`, `Badge` (variants: default, secondary, outline, success, warning, danger), `Card` + `CardHeader` + `CardTitle` + `CardDescription` + `CardContent` + `CardFooter`, `Table` + `TableHeader` + `TableBody` + `TableRow` + `TableHead` + `TableCell`.
- **Layout (`components/layout/`)**: `Sidebar`, `Topbar`, `AppShell`.
- **Shared (`components/shared/`)**: `RequireAuth` (route guard), `PageHeader` (title + optional description + optional actions slot).

**Total reusable components:** 16 (6 UI primitives + 6 card sub-components counted as one family = 11 exports, plus 3 layout, 2 shared).

---

## 41. Utilities

- `lib/utils.ts`
  - `cn(...classes)` — `clsx` + `tailwind-merge` combinator
  - `formatDate(iso, locale)` — Intl.DateTimeFormat wrapper handling null and errors
- `lib/api.ts` — `api.get/post/patch/delete` typed fetch helpers that inject Bearer token, throw on failure with `{ code, bilingual, status }` on the Error.

---

## 42. Services

There is no dedicated `services/` folder. Business logic lives inline in each route module. The web app talks to the API exclusively via `lib/api.ts` + TanStack Query.

---

## 43. Middleware

Under `artifacts/api-server/src/middleware/`:
- `auth.ts` → `requireAuth` (Bearer verification + `req.tenant` injection), `requireRole(...allowed)` (coarse role gate)
- `tenant-scope.ts` → `scoped(companyIdColumn, companyId, deletedAtColumn?)` helper that returns a Drizzle `WHERE` condition to guarantee tenant + soft-delete filtering
- `error-handler.ts` → `errorHandler` — converts `ZodError` → 422, `AppError` → its declared status, everything else → 500 with a bilingual envelope

Global middleware chain (`src/index.ts` order): `helmet` → `cors` → `express.json({limit:'2mb'})` → `pino-http` → `/api/v1` router → 404 fallback → `errorHandler`.

---

## 44. Scheduled Jobs

**None.** No cron, no BullMQ, no worker process. `pnpm dev` starts exactly two processes: the API server and the Vite dev server.

---

## 45. Storage System

**None implemented.** No object storage adapter, no S3 client, no image upload/serve endpoint. Reserved env vars only (see §37).

---

## 46. Logging

- `pino@9` structured JSON logger (`src/lib/logger.ts`).
- Log level: `debug` in development, `info` in production.
- Development uses `pino-pretty` transport for colorized output with `HH:MM:ss.l` timestamps.
- `pino-http` attaches a per-request logger under `req.log`.
- Client-side has no telemetry — plain `console` only.

---

## 47. Error Handling

- Shared `AppError` class in `lib/shared/src/errors.ts` carrying `status`, `code`, `bilingual: { ar, en }`, optional `details`.
- Factory helpers: `errors.unauthorized`, `errors.forbidden`, `errors.notFound(entity)`, `errors.badRequest`, `errors.validation`, `errors.conflict`, `errors.internal`.
- Global `errorHandler` middleware converts Zod validation failures and `AppError`s to the envelope; unknown errors become 500 with a generic bilingual message, and the full error is logged server-side.
- Client wraps API failures in an Error carrying `code`, `bilingual`, `status` — the LoginPage catches this and surfaces the translated string. Other pages currently show a raw `common.error` string only if used (not wired everywhere).

---

## 48. Build Configuration

- Root `tsconfig.base.json`: ES2022, strict mode + `noUncheckedIndexedAccess` + `noImplicitOverride` + `noFallthroughCasesInSwitch`, `isolatedModules`, declaration maps on.
- Each package extends the base and overrides module resolution appropriately.
- API server has a separate `tsconfig.build.json` that disables declaration output and excludes tests.
- Web app uses `tsc -b && vite build` for production build.
- pnpm workspaces manage the monorepo (`pnpm-workspace.yaml`).
- `.prettierrc` enforces single quotes, trailing commas, 100-col print width, 2-space indent, always parens on arrow params.

---

## 49. Deployment Configuration

**None yet.** There is no Dockerfile, no docker-compose, no Kubernetes manifests, no CI workflow file, no `.github/`, no Vercel/Netlify/Fly/Railway config, no PaaS blueprint, no Terraform/Pulumi, no PM2 config, no systemd unit. The README documents local dev only.

---

## 50. Anything Else Implemented

- `docs/PHASE-1.md` — a written scope document that explicitly lists what Phase 1 delivers and what it deliberately does not include (very useful for reviewers).
- `docs/INVENTORY.md` — this file.
- Drizzle `drizzle.config.ts` wired for `pnpm db:generate` and `pnpm db:push` (but no migration SQL has been generated yet — using `push` for now).
- Seed script `pnpm db:seed` that upserts idempotently (safe to re-run).
- Root scripts on `package.json`: `dev` (parallel), `dev:api`, `dev:web`, `build`, `typecheck`, `lint`, `db:generate`, `db:push`, `db:seed`, `api:codegen` (the last one is a placeholder pointing to `@rcos/api-client-react` which does not yet exist as a package).
- The OpenAPI spec exists and validates as a full document even though no code has been generated from it yet.

---

## Totals

| Metric | Count |
|---|---:|
| **Pages** (routed React screens) | **9** (Login + Dashboard + 7 organization pages) |
| **Reusable components** (exports) | **16** (Button, Input, Label, Badge, Card family × 6, Table family × 6 — counting the family exports individually) |
| **API endpoints** | **30** (29 domain + 1 fallback) |
| **Database models / tables** | **12** |
| **Dashboards** | **1** (the `/` dashboard) |
| **User roles** | **10** |
| **Implemented features (see checklist below)** | **~65** |

---

## IMPLEMENTED FEATURES CHECKLIST

✅ Monorepo scaffold (pnpm workspaces, `artifacts/*` + `lib/*`)
✅ Shared TypeScript base config with strict mode
✅ Prettier config
✅ `.env.example` with a documented variable set
✅ Root pnpm scripts for dev / build / typecheck / db push / seed
✅ Env validation via Zod at API boot
✅ PostgreSQL connection pool with configurable size + timeouts
✅ Drizzle ORM schema for tenant + RBAC (12 tables)
✅ Six database enums (restaurant type, company/branch/user status, locale, audit action)
✅ Soft-delete convention (`deleted_at`) on every domain table
✅ Standard created/updated timestamps helper
✅ Indexes on every high-traffic column (see §34)
✅ `drizzle-kit` config for `db:push` and `db:generate`
✅ Idempotent seed script (Al-Nakheel demo company)
✅ Seed loads 2 brands, 4 branches, 5-level org hierarchy, 4 departments, 10 system roles, permission catalog, and 3 demo users
✅ Argon2 password hashing on user create + login verify
✅ JWT access-token issuance (HS256, jose)
✅ Opaque refresh-token with sha256 store in `user_sessions`
✅ Refresh-token rotation with old-session revocation
✅ Access and refresh TTLs configurable via env
✅ Login endpoint records `last_login_at`
✅ Logout endpoint (single session or all sessions)
✅ `GET /auth/me` returning tenant profile + roles
✅ `requireAuth` middleware injecting `req.tenant`
✅ `requireRole(...)` coarse role gate
✅ Tenant-scoping helper `scoped()` for zero-leakage queries
✅ Standard `{ success, data, meta }` response envelope helper
✅ Bilingual error envelope `{ code, message: { ar, en }, details? }`
✅ `AppError` class + factories for 400/401/403/404/409/422/500
✅ Global Express error handler bridging Zod → 422, `AppError` → its status
✅ Helmet security headers
✅ CORS restricted to `WEB_ORIGIN`
✅ `x-powered-by` disabled
✅ `trust proxy` set
✅ Structured JSON logs via `pino` + `pino-http`
✅ Prettified dev logs (`pino-pretty`)
✅ Graceful SIGINT/SIGTERM shutdown
✅ 30 REST endpoints across auth / companies / brands / branches / users / roles / permissions / departments / org-levels / health
✅ Full CRUD (list / create / update / soft-delete) for brands, branches, users, departments, org-levels
✅ Read + patch for the current company (`/companies/me`)
✅ Zod validation on every mutating endpoint (body + params)
✅ Email uniqueness enforced per tenant on user create
✅ Self-deletion blocked in `DELETE /users/:id`
✅ Coarse role gates on write endpoints (per-endpoint allowlists)
✅ OpenAPI 3.1 specification covering every Phase 1 endpoint + schemas + security scheme
✅ Vite + React 18 + TypeScript web app
✅ Tailwind CSS with light + dark palette CSS variables (dark toggle not wired)
✅ shadcn-style UI primitives: Button (cva variants), Input, Label, Card family, Badge (6 variants), Table family
✅ Layout shell: dark Sidebar with grouped nav, Topbar with user chip + language toggle + logout, AppShell wrapper
✅ `RequireAuth` route guard redirecting to `/login`
✅ Reusable `PageHeader` component
✅ TanStack Query wired at the root with sensible defaults
✅ Zustand `auth` store persisted to localStorage
✅ Fetch wrapper (`lib/api.ts`) attaching Bearer token + throwing typed errors
✅ `formatDate` helper honoring `ar-SA` / `en-GB`
✅ `cn(...)` classname helper (clsx + tailwind-merge)
✅ Login page with email/password form, error surface, demo-creds panel, language toggle
✅ Dashboard page with 4 KPI tiles from live counts
✅ Company profile read view
✅ Brands table view
✅ Branches table view (name, city, restaurant type, status badge)
✅ Users table view (with last-login formatting)
✅ Roles table view (system vs custom badge)
✅ Departments table view
✅ Org-levels table view
✅ Bilingual UI: Arabic (default) + English, full translation coverage on all keys used
✅ Automatic `<html dir>` and `<html lang>` switching on locale change
✅ Locale persisted to `localStorage.rcos.locale`
✅ Arabic body font stack (IBM Plex Sans Arabic / Noto Sans Arabic) via Tailwind
✅ Dev proxy from Vite (`/api`) to the API server
✅ `docs/PHASE-1.md` scope document
✅ `docs/INVENTORY.md` (this file)

## NOT IMPLEMENTED (called out truthfully)

❌ Customer-facing storefront (out of project scope)
❌ Products / menu items / categories (out of project scope)
❌ Cart / checkout / payments (out of project scope)
❌ Coupons / loyalty / reviews (out of project scope)
❌ Driver / delivery / orders (out of project scope)
❌ Municipality inspections module (Phase 2)
❌ HACCP plans + CCP monitoring (Phase 2)
❌ Food-safety logs — temperature, receiving, cleaning (Phase 3)
❌ Task management + CAPA (Phase 3)
❌ Executive dashboard + branch dashboards (Phase 4)
❌ AI compliance engine (Phase 4)
❌ Reports engine (PDF/Excel) (Phase 4)
❌ Notifications system (Phase 4)
❌ Object storage for photos/videos (Phase 3)
❌ Registration / self-signup
❌ Password reset / forgot-password flow
❌ Email verification
❌ MFA / 2FA
❌ OAuth / SSO
❌ Session listing UI
❌ Automatic refresh-on-401 retry in the client
❌ Fine-grained permission checks in write routes (catalog exists, not consumed)
❌ Audit-log writes from any route (table defined, no emitters)
❌ Rate limiting / brute-force lockout
❌ CSP / HSTS / stricter security headers beyond helmet defaults
❌ Pagination / sorting / filtering on list endpoints
❌ Search functionality
❌ File upload endpoint
❌ Dark-mode toggle wired to a user control
❌ Mobile hamburger drawer (sidebar hidden < md)
❌ Currency system
❌ Hijri calendar
❌ Scheduled jobs / workers / queues
❌ CI workflow, Dockerfile, deployment config
❌ Generated API client (spec is authored but codegen not wired)
❌ Any test suite (unit / integration / e2e)
