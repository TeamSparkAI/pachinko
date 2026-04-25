# Authentication and multi-tenancy (as built)

This document describes how **multi-tenant isolation**, **human sign-in**, and **machine authentication** work in the current codebase. It is the single reference for security-related behavior and data shapes; **open issues and follow-ups** are listed at the end.

---

## Goals

- **Tenant isolation:** Rows that belong to a customer include **`tenantId`** (foreign key to **`tenants`**). Application code passes **`tenantId` explicitly** into the SQLite model layer; queries and writes for tenant-owned data are scoped with **`tenant_id = ?`** (or equivalent).
- **Humans:** Browser users sign in at **`/login`**; the UI and authenticated APIs use a **signed session** in an **httpOnly** cookie (**`pachinko_session`**) whose JWT carries **`userId`**, **`tenantId`**, and **`exp`**.
- **Machines and webhooks:** Callers without a browser session send **`Authorization: Bearer`** with a **tenant API key** string **`{keyLookupId}.{secret}`**. The matching **`tenant_api_keys`** row supplies **`tenantId`** for the request.
- **Empty install → first login:** Migrations plus server init **idempotently** ensure a default tenant and a **bootstrap admin user** when **`users`** is empty, so development can log in without hand-written SQL. API keys are **not** created at bootstrap; operators create them in **Settings** after login.

---

## Data model

### `tenants`

| Field | Purpose |
|-------|---------|
| `tenantId` | Primary key |
| `name`, `slug` | Display; **`slug`** is unique |
| `createdAt` | Row creation time (`TIMESTAMP`, default `CURRENT_TIMESTAMP`) |

### `users` (per tenant)

| Field | Purpose |
|-------|---------|
| `userId` | Primary key |
| `tenantId` | Foreign key — each user belongs to **one** tenant in v1 |
| `email` | **`UNIQUE(tenantId, email)`** |
| `passwordHash` | **Argon2id** hash of password |
| `role` | Optional (e.g. admin) |
| `createdAt` | Row creation time (`TIMESTAMP`, default `CURRENT_TIMESTAMP`) |

### `tenant_api_keys`

Each row is one issuable secret for one tenant (multiple keys per tenant allowed).

| Field | Purpose |
|-------|---------|
| `keyId` | Surrogate primary key |
| `tenantId` | Foreign key |
| `keyLookupId` | **`nanoid`**, unique, indexed — **public** lookup id (not secret) |
| `name` | Operator label (e.g. “Arcade production”) |
| `secretHash` | **Argon2id** hash of the **secret segment only** |
| `createdAt` | When the key was issued (`TIMESTAMP`, default `CURRENT_TIMESTAMP`) |
| `revokedAt` | When the key was revoked, if ever (`TIMESTAMP`, nullable) |

**Wire format:** At creation, the UI shows **`{keyLookupId}.{secret}`** once. **`Authorization: Bearer`** sends that full string. Resolution: split on the **first** **`.`** → lookup id + secret segment → **`SELECT`** active row by **`keyLookupId`** → **Argon2id verify** → **`tenantId`**.

### Tenant-scoped application tables

**`tenantId`** is present on tenant-owned tables (e.g. **`messages`**, **`alerts`**, **`policies`**, **`policy_elements`**, **`message_actions`**, **`settings`**, and related shapes). Handlers must not read or write those rows without scoping by the **resolved** **`tenantId`**.

### Cryptography

- **User passwords** and **API key secret halves** both use **Argon2id** via the **`argon2`** package, with shared hash/verify helpers.
- **`argon2`** is a **native** dependency; the production bundle treats it as **external** so it loads from **`node_modules`** at runtime (same pattern as **`sqlite3`**).

---

## Bootstrap and migrations

- **Schema** lives in **`server/appData/migrations/001_initial_arcade.sql`**. It includes DDL, the default **`tenants`** row where needed, and non-secret static data (e.g. built-in **`policy_elements`** tied to the default tenant). **No** **`users`** rows with precomputed password hashes in SQL; **no** **`tenant_api_keys`** rows in migrations.
- After migrations run, **`ensureBootstrapData`** (see **`server/lib/auth/bootstrap.ts`**) runs from database initialization: if **`users`** is empty, it inserts the bootstrap **`users`** row with **`argon2.hash`** at runtime. Email and initial password come from **`server/lib/auth/constants.ts`** (**`BOOTSTRAP_ADMIN_EMAIL`**, **`BOOTSTRAP_ADMIN_PASSWORD`**). The **`/login`** form does **not** pre-fill credentials.
- **Production:** treat fixed bootstrap credentials as **development convenience** only; harden with env gating, forced password change, invites, or SSO as the product matures.
- **Schema evolution:** v1 still assumes **fresh installs or wipe-and-recreate** when **`001`** changes in breaking ways.

---

## Authentication modes

### Browser session (humans)

1. **`POST /api/auth/login`** — JSON body **`email`**, **`password`**. Server finds **`users`** by **email**, verifies **Argon2id**, then sets an **httpOnly** cookie **`pachinko_session`** containing a **signed JWT** (**`jsonwebtoken`**) with **`userId`**, **`tenantId`**, and **`exp`**.
2. **`POST /api/auth/logout`** — Clears the session cookie.
3. **`GET /api/auth/session`** — Validates the session and returns **`{ user, tenant }`** from the database (or **401**).
4. **`POST /api/auth/password`** — **Session required**; verifies current password and updates **`passwordHash`**.

**Next.js middleware** (**`server/middleware.ts`**): for **HTML pages** (excluding **`/login`**, **`/api/*`**, **`/_next/*`**, and common static file extensions), if the **`pachinko_session`** cookie is **missing**, the user is redirected to **`/login`**. Middleware does **not** verify JWT signature or expiry in Edge — only **cookie presence**. **`/api/*`** is never redirected by this middleware; each API handler performs **full** auth where required.

### Tenant API key (machines, including Arcade)

- **`Authorization: Bearer {keyLookupId}.{secret}`** on routes that accept machine auth.
- **`resolveRequestContext`** (see below) validates the Bearer token against **`tenant_api_keys`**; on success **`tenantId`** is known and **`userId`** is **null** (machine principal).

---

## Human-facing UX (v1)

| Area | Behavior |
|------|----------|
| **Login** | **`/login`** — email and password; server finds **`users`** by email and reads **`tenantId`** from that row. |
| **Logout** | UI control → **`POST /api/auth/logout`**, then redirect to **`/login`**. |
| **Change password** | **`/account/password`** — current + new password → **`POST /api/auth/password`**. |
| **Not implemented** | Forgot-password, email magic links, invites, OAuth. |

---

## Protecting HTTP surfaces

### Request context

**`server/lib/auth/resolveRequestContext.ts`** implements:

1. Valid **session cookie** → **`authMode: 'session'`**, **`userId`**, **`tenantId`**.
2. Else valid **Bearer API key** → **`authMode: 'bearer'`**, **`tenantId`**, **`userId`** null.
3. Else unauthenticated (callers map this to **401** on protected routes).

### API helpers

- **`getApiTenantOr401`** (**`server/lib/api/apiAuth.ts`**) — Used by most **`/api/v1/*`** routes: **session or tenant Bearer**; returns **`tenantId`** and **`userId`** (null for Bearer-only).
- **`getApiSessionOr403`** — Stricter: **session login only** (e.g. **API key management** in Settings). Bearer-only requests get **403 Session required**.

### Route categories (summary)

| Category | Auth |
|----------|------|
| **`/api/v1/*` data APIs** | Session **or** tenant Bearer (**`getApiTenantOr401`**) |
| **API key CRUD** | Session only (**`getApiSessionOr403`**) |
| **`/api/v1/webhooks/arcade/pre`**, **`/post`** | Tenant Bearer only (Arcade is an HTTP client with a configured bearer) |
| **`/api/auth/login`**, **`logout`** | Public |
| **`/api/auth/session`**, **`password`** | Session required |

Webhook request handling is centralized in **`server/lib/webhooks/mcpWebhookFilter.ts`** (Bearer + **`tenant_api_keys`**).

---

## Environment and secrets

| Secret / config | Role |
|-----------------|------|
| **`PACHINKO_SESSION_JWT_SECRET`** | Signs and verifies the **session cookie JWT** only. Loaded from the **repository root** **`.env`** / **`.env.local`** (with **`server/loadEnv.ts`** and **`server/next.config.js`** wiring). If unset, development may use a fixed default with a warning; production should set a strong random value. |
| **Bootstrap password** | Literal initial password for the first user lives in **`server/lib/auth/constants.ts`** (**`BOOTSTRAP_ADMIN_PASSWORD`**), not in env. |

User passwords and API key secrets are **never** stored except as **Argon2id** hashes in **`users`** / **`tenant_api_keys`**.

---

## Main code locations

| Concern | Location |
|---------|----------|
| Bootstrap user | **`server/lib/auth/bootstrap.ts`**, constants **`server/lib/auth/constants.ts`** |
| Session JWT + cookie | **`server/lib/auth/session.ts`** |
| Password / API key hashing | **`server/lib/auth/password.ts`** (and related) |
| Bearer key parsing | **`server/lib/auth/apiKeyFormat.ts`** |
| Request context | **`server/lib/auth/resolveRequestContext.ts`** |
| API route auth wrappers | **`server/lib/api/apiAuth.ts`** |
| Auth HTTP routes | **`server/app/api/auth/*/route.ts`** |
| API keys HTTP routes | **`server/app/api/v1/apiKeys/**`** |
| Edge middleware | **`server/middleware.ts`** |
| OpenAPI / Swagger auth description | **`server/public/openapi.yaml`** |

---

## Hardening not implemented yet

Examples of follow-up hardening (no commitment in v1):

- **Postgres row-level security** as a second line of defense after application **`tenantId`** checks.
- **Rate limiting** on **`/api/auth/login`** and webhooks.
- **Structured audit log** (tenant, user, action, resource, timestamp).

---

## Future direction (not built)

- **OAuth / OIDC:** Map external identity to **`users`** (and **`tenantId`**); keep session payload shape **`userId` + tenantId`** so API scoping stays the same; **`passwordHash`** can be null for SSO-only accounts.
- **Multi-tenant login UX:** If the same email can exist in multiple tenants, add explicit tenant choice (slug, domain, etc.) at login.

---

## Open issues and follow-ups

- **Middleware vs valid session:** Middleware only checks **cookie presence**; invalid or expired JWTs still reach the app shell until a server route fails. Optional improvements: JWT verify in middleware, and/or a mandatory **`GET /api/auth/session`** on app load with redirect on **401**.
- **SPA session bootstrap:** The shell does **not** yet call **`GET /api/auth/session`** globally on load to hydrate user/tenant or to fail fast on stale cookies.
- **Rate limiting:** Not implemented on login or webhooks.
- **Tests:** No dedicated unit tests yet for password hash round-trip or Bearer **`keyLookupId.secret`** parsing edge cases.
- **Production bootstrap:** No env gate, no forced password change on first login, no invite-only path.
