# Authentication, authorization, and multi-tenancy

This document describes a **practical path** to multi-tenant Pachinko with a **login page**, **simple credentials now**, room to adopt **OAuth / an external IDP later**, and **consistent protection of HTTP APIs—including Arcade webhooks**. It is design-only; implementation can follow in phases.

---

## 1. Goals

- **Multi-tenant data:** Every domain row that belongs to a customer carries **`tenantId`** (FK to **`tenants`**). Queries and writes are always scoped to the active tenant.
- **Human access:** Browser users sign in on a **login page**; subsequent UI and API calls carry proof of identity **without** putting tenant id in the URL as the sole trust mechanism. **v1 UI** covers **login, logout, and change password** while signed in only—see **§3.3** (no forgot-password / email recovery yet).
- **Machine access (Arcade, scripts, integrations):** Callers that do not use cookies authenticate with **`Authorization: Bearer <token>`**.
- **Per-tenant API / webhook secrets (assumption):** **Each tenant has at least one key row.** The credential is a **two-part** value: a **public `nanoid` lookup id** (indexed, non-secret) plus a **secret** (shown once at creation, stored only as an **Argon2id hash** — same scheme as user passwords; §2.5). Incoming requests parse the lookup id → **`SELECT` that row** → verify the secret against **`secretHash`**; **the row determines `tenantId`**. There is **no** reliance on a shared deployment-wide secret for tenant resolution in production multi-tenant mode (optional **local-dev** override is noted in §6). Use the **`nanoid`** package as a **direct** `server` dependency when implementing.
- **Future OAuth / IDP:** The same abstractions (session subject, tenant binding, token verification) should map cleanly to **OIDC** (Auth.js, WorkOS, Clerk, etc.) without rewriting the data model.
- **Fresh database:** There is always a path from **empty DB → first login** without manual SQL: **one default tenant** and **one bootstrap user** (fixed email/password for early dev; **§2.6**). Production deployments should replace or harden this path (see §2.6).

---

## 2. Core data model

### 2.1 `tenants`

| Field | Purpose |
|-------|---------|
| `tenantId` | Primary key |
| `name`, `slug` | Display + optional URL/subdomain routing later |
| `createdAt`, … | Audit |

### 2.2 `users` (per tenant)

| Field | Purpose |
|-------|---------|
| `userId` | Primary key |
| `tenantId` | FK — user belongs to exactly one tenant in v1 |
| `email` | Unique **per tenant** (`UNIQUE(tenantId, email)`). **v1 login** still uses **email + password** only (no tenant field in the form; **§3.3**); early deployments treat user lookup by email as unambiguous (e.g. single tenant). |
| `passwordHash` | **Argon2id** hash (see §2.5); empty when user is SSO-only later |
| `role` | e.g. `admin`, `member` (optional v1) |
| `createdAt`, … | Audit |

Later, for OAuth: add `provider`, `providerSubject` (or a separate `user_identities` table) and leave `passwordHash` null for SSO-linked accounts.

### 2.3 Tenant-scoped application tables

Add **`tenantId`** to: **`messages`**, **`alerts`**, **`policies`**, **`policy_elements`**, **`message_actions`**, **`settings`**, and any other tenant-owned table. **Foreign keys** to `tenants` where appropriate.

**Invariant:** No API handler performs a read/write without **`tenantId` in the WHERE clause or equivalent** (see §7 for Postgres RLS as a safety net later).

### 2.4 `tenant_api_keys` (or equivalent per-tenant secret store)

**Required for machine auth:** Each row is one issuable secret for one tenant (multiple keys per tenant are allowed, e.g. “Arcade prod” vs “CI script”).

| Field | Purpose |
|-------|---------|
| `keyId` | PK (surrogate integer or ULID—implementation choice) |
| `tenantId` | FK |
| `keyLookupId` | **`nanoid`** (or same alphabet/length policy), **unique**, **indexed**; **non-secret** public identifier used to find the row before secret verification |
| `name` | e.g. “Arcade production” |
| `secretHash` | **Argon2id** hash of **only the secret portion** of the credential (never store plaintext; see §2.5) |
| `createdAt`, `revokedAt` | Rotation / audit |

**Wire format (example):** Single string shown once to the operator, e.g. **`{keyLookupId}.{secret}`** (or `pk_{keyLookupId}_{secret}`). **`Authorization: Bearer`** carries that full string (or a convention-equivalent split if a product needs two fields). Parsing: split on the **first** separator after the lookup id length, or use a fixed delimiter documented for your generator.

**Tenant resolution:** (1) Parse **`keyLookupId`** from the bearer material. (2) **`SELECT * FROM tenant_api_keys WHERE key_lookup_id = ? AND revoked_at IS NULL`** (and tenant active, etc.). (3) If no row → **401**. (4) **Argon2id verify** (`secretHash` vs secret portion) using the same helper as password checks. (5) On success → **`tenantId`** (+ `keyId` for audit). All subsequent DB access uses that **`tenantId`**.

### 2.5 Cryptography — Argon2id for passwords and API key secrets

Use **one hashing approach** for both human passwords and the **secret half** of `tenant_api_keys`:

- **Algorithm:** **Argon2id** (hybrid Argon2 variant).
- **Implementation:** the **`argon2`** npm package as a **direct** `server` dependency (shared `hash` / `verify` helper). The bundled server (`esbuild`) should list **`argon2`** in **`--external:`** so the native binding loads from `node_modules` at runtime, same idea as **`sqlite3`**.
- **`users.passwordHash`** — Argon2id of the password at signup/password change.
- **`tenant_api_keys.secretHash`** — Argon2id of the **raw secret segment** only (after separating **`keyLookupId`**).
- **Tuning:** pick time/memory (`type` Argon2id, cost params) for your latency target; use the library’s **constant-time** verify API.

### 2.6 Initial database bootstrap (default tenant + admin user)

When the database is **created for the first time** (migrations applied to an empty store, or equivalent “init” run), insert **exactly one** row in **`tenants`** (the only tenant in early single-tenant mode) and **one** row in **`users`** tied to that tenant so you can open the login page and sign in immediately.

| Item | Value |
|------|--------|
| User **email** | `admin@teamspark.ai` |
| User **password** | `admin` |
| `passwordHash` | **Argon2id** of `admin` (§2.5) |
| Tenant | One sensible default (e.g. display name “Default” / slug `default`—exact strings are an implementation detail) |

**Intent:** **Development and early product iteration**—always know how to log into the **only** tenant without ad-hoc seed steps.

**Not a production security model:** Treat fixed credentials as **convenience only**. For real deployments, choose at least one of: **omit** this seed, **gate** it on `NODE_ENV` / an explicit env flag, **force password change** on first login, or use **invites / SSO** instead. Idempotency (“insert only if no users exist”) and whether bootstrap lives in a **migration** vs a **post-migrate script** are implementation details.

---

## 3. Two authentication modes (same app)

### 3.1 Browser / session (humans)

1. **`POST /api/auth/login`** — Body: **`email`**, **`password`** only (no tenant slug; **§3.3**). Resolve the **`users`** row by **email**, verify **Argon2id** against **`passwordHash`**; on success issue a **session** for that row’s **`userId`** + **`tenantId`**:
   - **Option A (simple):** Encrypted/signed **httpOnly** cookie (e.g. iron-session, jose JWT in cookie) containing **`userId`**, **`tenantId`**, **`exp`**.
   - **Option B:** Server-side session row + opaque cookie id (better revocation, slightly more storage).

2. **`POST /api/auth/logout`** — Clear session.
3. **`GET /api/auth/session`** (optional) — Return `{ user, tenant }` for the SPA shell.

**Next.js:** `middleware.ts` redirects unauthenticated users from protected pages to **`/login`**. Public routes: **`/login`**, static assets, health if any. **Change-password** UI and API require an **existing session** (§3.3).

### 3.2 Bearer token (machines — tenant from API key)

- Require header **`Authorization: Bearer <token>`** on routes that accept machine auth (including **Arcade webhooks** and any automation-facing `/api/v1/...` you choose to expose without a session).
- **Resolution:** Parse **`keyLookupId`** from the token → indexed **`SELECT`** on **`tenant_api_keys`** → **Argon2id verify** of the secret against **`secretHash`**. On success, set **`tenantId`** (and `keyId` for audit). Missing row or bad secret → **401**. (Single-row-per-tenant secret on **`tenants`** is still “one value per tenant,” but the **nanoid + Argon2id** pattern above is the default for multiple keys and scalable lookup.)

Today’s single-tenant **`filterApiBearerToken`** in app settings maps to this model as: **one tenant, one key** in the migration period; production multi-tenant replaces it with **per-tenant keys** as above.

### 3.3 Human-facing UX (v1 — no email recovery yet)

Design-level **routes and scope** only (no layout or visual spec).

| Area | v1 scope |
|------|-----------|
| **Login** | Page **`/login`**: **email** + **password**. **No tenant slug**—the form does not ask which tenant; the server resolves the user by **email** and reads **`tenantId`** from that row. This matches **`UNIQUE(tenantId, email)`** plus **early single-tenant** (or any deployment where at most one user row matches a given email). If the product later allows the **same email in multiple tenants**, add explicit disambiguation (e.g. tenant slug or domain)—**out of v1**. |
| **Logout** | Control (header/menu) calling **`POST /api/auth/logout`**, then redirect to **`/login`** (or home). |
| **Change password** | Authenticated page (e.g. **`/account/password`** or under settings): **current password** + **new password** + confirm; **`POST`/`PATCH`** to an API such as **`/api/auth/password`** (session required). Re-hash with **Argon2id** (§2.5). |
| **Not in v1** | Forgot-password, email magic links, or invite-based reset—defer until outbound email (or another channel) is a product requirement. |

**API sketch (names are indicative):** `POST /api/auth/login`, `POST /api/auth/logout` (public, rate-limited); **`GET /api/auth/session`**, **`POST /api/auth/password`** (body: current + new password; **session required**—§5.1).

---

## 4. OAuth / IDP later (same shape)

- **OIDC flow** (Auth.js, etc.) produces **`sub`** + email claims.
- Map **`(issuer, sub)`** → **`user`** (and **`tenantId`**) via `user_identities` or tenant chosen at first login (“join this org”).
- Session cookie content stays **`userId` + tenantId`**; only the **login step** changes from password to OAuth.
- **Password users** and **SSO users** can coexist in **`users`** with nullable `passwordHash`.

No need to put the IDP in every API route—only the **session/JWT verification** layer changes.

---

## 5. Protecting endpoints

### 5.1 Categories

| Category | Examples | Auth |
|----------|----------|------|
| **Tenant UI API** | `/api/v1/messages`, policies, alerts, … | **Session** (SPA) **or** Bearer using a **tenant’s** API key (scripts / server-to-server) |
| **Webhooks** | `/api/v1/webhooks/arcade/pre`, `/post` | **Bearer** (same guard as other machine routes; see §5.3) |
| **Auth bootstrap** | `/api/auth/login`, `/api/auth/logout` | Public (rate-limited) |
| **Account (session)** | `/api/auth/session`, `/api/auth/password` (change password) | **Session** |
| **Static / Next** | `_next`, public assets | Public |

### 5.2 Central guard

Introduce a single helper used by route handlers (or a thin wrapper):

```text
resolveRequestContext(request) → { tenantId, userId | null, authMode: 'session' | 'bearer' } | UNAUTHORIZED
```

- **If cookie session present and valid:** `tenantId` + `userId` from claims.
- **Else if Bearer valid:** `tenantId` from **`tenant_api_keys`** via **`keyLookupId`** lookup + **secret** verification; `userId` null unless you later add service-user tokens.
- **Else:** 401 for protected routes.

Every **`ModelFactory`** / repository call receives **`tenantId`** (e.g. via `AsyncLocalStorage` or explicit parameter) so **all SQL** includes `tenant_id = ?`.

### 5.3 Arcade webhooks

[Arcade Engine](https://arcade.dev) can send **`Authorization: Bearer …`** on pre/post policy hooks. Our **`/api/v1/webhooks/arcade/pre`** and **`/post`** endpoints use **that same Bearer mechanism** for access: validate the header per §2.4 / §5.2 (no cookies involved—Arcade is just an HTTP client with a configurable bearer).

---

## 6. Local development and legacy single-tenant

- **Local / single-tenant shortcut:** A single env-based secret (e.g. current **`filterApiBearerToken`** behavior) can map implicitly to a **default tenant** so developers do not rotate keys on every run. Production multi-tenant mode should **not** use one shared secret across customers for tenant resolution.
- **Migration from today:** Replace global app setting with **`tenant_api_keys`** (or one secret column on **`tenants`**) and **lookup → `tenantId`**; Arcade Engine is configured in each tenant’s Arcade project with **that tenant’s** Bearer value.

---

## 7. Hardening (later, especially with Postgres)

- **Row Level Security (RLS):** `SET app.tenant_id = '<id>'` per connection/request; policies on tables enforce `tenant_id = current_setting(...)`.
- **Rate limiting** on `/api/auth/login` and webhooks.
- **Audit log** table: `tenantId`, `userId`, action, resource id, timestamp.

---

## 8. Suggested implementation order

1. **Schema + bootstrap:** `tenants`, `users`, add **`tenantId`** everywhere + backfill for single default tenant during migration. **On a brand-new database,** apply **§2.6** (default tenant + `admin@teamspark.ai` / `admin`) so local login works immediately; harden or skip for production as noted there.
2. **Dependencies:** add **`argon2`** to `server`; wire **`esbuild`** `external` for the server bundle.
3. **Auth API:** login/logout/session + change-password endpoint + **Argon2id** password hashing; cookie session with **`tenantId`**.
4. **SPA + middleware:** **`/login`**, authenticated **change-password** page (§3.3); protect app routes; redirect anonymous users to **`/login`**.
5. **API guard:** `resolveRequestContext` + inject `tenantId` into all model/repository calls.
6. **Webhooks:** require Bearer; **resolve `tenantId` only via `tenant_api_keys`** (`keyLookupId` + **Argon2id** secret verification); remove optional unauthenticated webhooks for cloud if product requires lockdown.
7. **OAuth:** add provider + identity table; gate login UI behind “Sign in with …”.

---

## 9. Summary

| Concern | Recommendation |
|----------|----------------|
| Tenant in URL? | **Optional** for UX or webhooks; **never** the only proof of tenant. |
| Tenant for humans | **Session (cookie)** with **`tenantId`** (and `userId`) after password or later OAuth. |
| Tenant for webhooks / machine API | **Bearer** carrying **`keyLookupId` (nanoid) + secret**; indexed lookup on **`tenant_api_keys.keyLookupId`**, then **Argon2id verify `secretHash`** → **`tenantId`**. |
| Passwords & API key secrets | **Argon2id** via **`argon2`** package; **one** shared hash/verify helper (§2.5). |
| Shared secret across tenants | **Not used** for tenant resolution in production; optional **dev-only** default tenant mapping. |
| Brand-new database | **§2.6:** one default tenant + user **`admin@teamspark.ai`** / **`admin`** (Argon2id); dev-oriented; production must not rely on this blindly. |
| Human UX (v1) | **`/login`** (email + password, no tenant field), logout, **change password** while signed in (**§3.3**). No forgot-password until email recovery is in scope. |
| OAuth later | Keep session payload stable; swap login verification for OIDC; same **`tenantId`** scoping everywhere. |

This document can live next to product-specific notes (`docs/arcade/`, etc.) and be revised when implementation choices (Auth.js vs hand-rolled, Postgres RLS timing) are locked in.
