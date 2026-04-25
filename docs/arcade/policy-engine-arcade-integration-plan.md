# Policy engine, messages, and reporting for Arcade webhooks

This document describes how Pachinko applies **policies** when **Arcade Engine** calls our **pre** and **post** HTTP hooks. Wire shapes follow Arcade’s contract in [`webhook.yaml`](./webhook.yaml). **Authentication** for those routes (tenant API keys, Bearer format) is documented in [`docs/auth-and-multitenancy.md`](../auth-and-multitenancy.md).

---

## As-built checklist

| Area | Status |
|------|--------|
| **Routes** | **`POST /api/v1/webhooks/arcade/pre`** and **`POST /api/v1/webhooks/arcade/post`** (`server/app/api/v1/webhooks/arcade/*/route.ts`) |
| **Handler** | **`handleArcadeFilterWebhook`** in **`server/lib/webhooks/mcpWebhookFilter.ts`** — validates body, **Bearer-only** tenant auth, synthetic JSON-RPC, **`MessageFilterService.processMessage`** |
| **Auth** | **`Authorization: Bearer {keyLookupId}.{secret}`**; **`tenant_api_keys`** resolution (no session cookie on webhooks) |
| **Ingress mapping** | Arcade **`inputs`** → synthetic **`tools/call`** **`params`**; **`output`** / errors → **`result`** / JSON-RPC **`error`** (`server/lib/types/arcadeWebhook.ts`) |
| **Policy run** | Same stack as other JSON-RPC paths: **`applyPolicies`** → **`PolicyEngine.processMessage`** → **`applyModifications`**; **`RegexCondition`** and other registered conditions |
| **Persistence** | **`messages`** with **`source: 'arcade'`**; **`payloadMessageId`** = Arcade **`execution_id`** (same as JSON-RPC **`id`**); post updates pre row or inserts orphan **server** row |
| **Downstream** | **`alerts`**, **`message_actions`** on policy hits / actions |
| **Schema** | **`server/appData/migrations/001_initial_arcade.sql`** (Arcade-oriented messages columns, tenant-scoped tables) |
| **Hook URLs in UI** | Settings shows pre/post paths; optional **public base URL** for copy/paste (`EditAppSettingsModal` / app settings) |

**Not implemented:** tenant-level **enable/disable** for pre vs post (both routes always run the full pipeline if called with valid auth). **Not implemented:** policy applicability filters on **tool name** or **toolkit** (see **Follow-up work**).

---

## 1. Purpose and scope

**Goal:** When Arcade invokes **pre** (before a tool) or **post** (after), run the same policy machinery used elsewhere: conditions and actions over **tool inputs** and **tool output**, with results translated into Arcade’s **`PreHookResult`** / **`PostHookResult`**.

**Payload mapping:** Arcade uses **`inputs`** (pre) and **`output`** (post). Internally we treat them as JSON-RPC **`params`** and **`result`** on a synthetic **`tools/call`** message so **`validateJsonRpcMessage`** and **`PolicyEngine`** stay unchanged. Arcade **`override.inputs`** / **`override.output`** correspond to mutating those same logical payloads.

**Direction = `origin`:** Pre → **`origin: 'client'`**. Post → **`origin: 'server'`**. Policy **`origin`** may be **`client`**, **`server`**, or **`either`** (both hooks).

**In scope here:** Only the **pre** and **post** policy hooks Pachinko implements. Other paths in [`webhook.yaml`](./webhook.yaml) (e.g. **/access**, **/health**) are out of scope for this document.

### 1.1 Webhook bearer auth

Arcade’s OpenAPI names the scheme **`bearerAuth`**. Pachinko expects **`Authorization: Bearer`** with a **tenant API key** **`{keyLookupId}.{secret}`** from **Settings → API keys**. Invalid or missing credentials → **401**. Session cookies are not accepted on these routes.

---

## 2. Arcade webhook contract — pre / post

### 2.1 Hooks

| Hook | Purpose | Pachinko auth |
|------|---------|----------------|
| **POST …/pre** | Gate or modify a tool **before** execution | Tenant API key Bearer |
| **POST …/post** | Validate or modify the tool **response** after execution | Same |

Arcade configures the exact URLs; **JSON bodies** match [`webhook.yaml`](./webhook.yaml).

### 2.2 Pre-hook (`PreHookRequest`)

`execution_id`, **`tool`** (name, toolkit, version, …), **`inputs`**, **`context`** (e.g. **`user_id`**). Mapped to a client-origin **`tools/call`** request for policy evaluation.

**Response:** **`PreHookResult`** — `code`, optional `error_message`, optional **`override`** (`inputs` / `secrets`).

### 2.3 Post-hook (`PostHookRequest`)

`execution_id`, **`tool`**, **`context`**, optional **`inputs`**, **`success`**, **`output`**, execution fields. Mapped to a server-origin JSON-RPC **result** or **error** for evaluation.

**Response:** **`PostHookResult`** — `code`, optional `error_message`, optional **`override.output`**.

---

## 3. Ingress pipeline (implementation)

**Entry:** **`handleArcadeFilterWebhook`** (`server/lib/webhooks/mcpWebhookFilter.ts`) + types in **`server/lib/types/arcadeWebhook.ts`**.

**Steps:**

1. Parse JSON body; reject malformed shapes with **400** and clear messages (wrong hook on wrong URL, etc.).
2. **`resolveRequestContext`** — require **Bearer** tenant key; **401** if not authorized.
3. Build synthetic JSON-RPC via **`arcadePreToJsonRpcRequest`**, **`arcadePostSuccessToJsonRpc`**, **`arcadePostFailureToJsonRpc`**; validate with **`validateJsonRpcMessage`**.
4. **`MessageFilterService.processMessage`** (`server/lib/services/messageFilter.ts`) — persist/update **`messages`**, run **`applyPolicies`**, create **`alerts`** / **`message_actions`**, apply modifications.
5. Map back to Arcade with **`mapProcessedJsonRpcToArcadePreResult`** / **`mapProcessedJsonRpcToArcadePostResult`** — **200** with native Arcade result JSON (not the JSON-API **`meta`** envelope used elsewhere).

**Synthetic message context:** **`MessageFilterContext`** sets **`source: 'arcade'`**, **`user`** from **`context.user_id`**, **`payloadToolkit`** / **`payloadToolVersion`** from **`tool`**. **`payloadMethod`** on stored **`MessageData`** is **`tools/call`** for pre; **`payloadToolName`** comes from synthetic **`params.name`**.

---

## 4. Policy applicability (as-built)

Policies are rows read in **`applyPolicies`** (`server/lib/services/messageFilter.ts`).

| Filter | Behavior |
|--------|----------|
| **`enabled`** | Disabled policies are skipped. |
| **`origin`** | Policy must match message **`origin`** (`client` / `server`), or policy **`origin`** is **`either`**. |
| **`methods`** | Optional JSON array on the policy. If **non-empty**, the message’s **`payloadMethod`** must be listed. If **empty or omitted**, all methods match. |

**Arcade consequence:** Synthetic traffic uses **`payloadMethod === 'tools/call'`** on the pre path. A policy with a **non-empty** **`methods`** list that does **not** include **`tools/call`** will **never** run on Arcade pre/post. Empty/omitted **`methods`** means “all methods” and is the usual setting for Arcade-only tenants.

**Stored but not used for policy matching today:** **`payloadToolName`** (Arcade **`tool.name`**) and **`payloadToolkit`** / **`payloadToolVersion`** are persisted and available for **UI / analytics filters**, but **`applyPolicies`** does **not** filter on them — only on **`methods`** vs **`payloadMethod`**.

---

## 5. Messages, persistence, and correlation

- **Correlation:** Arcade **`execution_id`** is stored in **`payloadMessageId`** and matches JSON-RPC **`id`**. Post updates the existing pre row when it finds a match; otherwise it may create an orphan **server** row.
- **Forensics:** **`userId`** on the row comes from context (e.g. **`unknown`**), **`source`** = **`arcade`**, toolkit/version from **`tool`**.

### 5.1 `messages` columns ↔ Arcade (as-built)

Schema: **`server/appData/migrations/001_initial_arcade.sql`**. Older client/server/session IP columns are **not** present on **`messages`** in this migration.

| Pachinko column | Arcade **pre** | Arcade **post** | Notes |
|-----------------|----------------|------------------|--------|
| **`messageId`** | — | — | Surrogate PK. |
| **`tenantId`** | Resolved from Bearer | Same | From **`tenant_api_keys`**. |
| **`timestamp`** | Set on pre **insert** | Set on orphan **server** **insert** if no matching pre | Ingest wall time unless overridden. |
| **`timestampResult`** | `NULL` | Set when post **updates** a matched pre row on success | Post completion time. |
| **`origin`** | **`client`** | **`server`** | |
| **`userId`** | `context.user_id` trimmed, or **`unknown`** | Same | Via **`MessageFilterContext.user`**. |
| **`source`** | **`arcade`** | **`arcade`** | |
| **`payloadToolkit`** | `tool.toolkit` | Same | |
| **`payloadToolVersion`** | `tool.version` | Same | |
| **`payloadMessageId`** | **`execution_id`** | **`execution_id`** | Correlation key; same as JSON-RPC **`id`**. |
| **`payloadMethod`** | **`tools/call`** | From stored/updated message (often sparse on response path) | |
| **`payloadToolName`** | **`tool.name`** (via synthetic **`params.name`**) | May be **empty** on orphan server insert | |
| **`payloadParams`** | Synthetic **`params`** `{ name, arguments }` | Unchanged on update of pre row | **`arguments`** ← Arcade **`inputs`**. |
| **`payloadResult`** | `NULL` at pre | **`result`** after policy on success | |
| **`payloadError`** | `NULL` at pre | JSON-RPC **error** shape on failure | |
| **`createdAt`** | DB default | | |

**Not first-class columns:** full Arcade **`context`**, **`tool.metadata`**, **`success`**, **`execution_code`**, optional post **`inputs`** — unless copied into params/result by policy, they appear in logs / inspection only, not as dedicated DB fields.

**`message_actions`:** Created when actions emit events, same as non-Arcade flows.

---

## 6. Reporting and UX (as-built)

- **Policy editor:** **`origin`** and **`methods`** lists. For Arcade, **`tools/call`** is the method string that matters when **`methods`** is non-empty.
- **Message / alert views:** Params, result, **`origin`**, filters on **`source`**, **`payloadToolkit`**, etc.

---

## 7. Open questions (product / behavior)

1. **Blocking vs monitoring:** When a policy fires, must the hook always return **`CHECK_FAILED`**, or is **`OK`** with alerts/logging only acceptable? Affects Arcade agent UX.
2. **Overrides:** How rewrite/redact **actions** map to **`override.inputs`** / **`override.output`** (full replace vs merge) for Arcade consumers.

---

## 8. Follow-up work (not built)

These items are **intentionally not implemented** in the current codebase; they are candidates for future milestones.

### 8.1 Policy scope: tool name and toolkit (and related)

**Today:** Applicability is **`enabled`** + **`origin`** + **`methods`** vs **`payloadMethod`**. For Arcade, **`payloadMethod`** is effectively always **`tools/call`**, so **`methods`** is a weak lever.

**Likely direction:** Extend policies (schema + UI + **`applyPolicies`**) so operators can restrict policies by **tool name** (`payloadToolName` / Arcade **`tool.name`**) and **toolkit** (`payloadToolkit` / Arcade **`tool.toolkit`**), in the same spirit as **`methods`** — e.g. optional allowlists or pattern lists, and optionally **tool version**. Exact UX (replace **`methods`** for Arcade vs additive fields) is TBD.

### 8.2 Per-hook enable / disable (pre vs post)

**Today:** If Arcade calls **`…/pre`** or **`…/post`** with a valid key, Pachinko always runs the pipeline. There is **no** tenant setting to turn off **pre only**, **post only**, or both while leaving routes registered.

**Possible direction:** Tenant or app settings (e.g. booleans or enums) to **skip policy processing** for one hook and return a **no-op success** (or **503** / documented **200** stub — product choice). Arcade can also stop invoking a URL independently; server-side toggles help when the Engine is left configured but the tenant wants Pachinko to ignore one phase.

### 8.3 Other backlog (non-blocking)

- **`EvaluationContext` / engine refactor** if the JSON-RPC wrapper becomes limiting.
- **Stronger tool identity** (hashes, allowlists) and **match normalization** (case, aliases).
- **Arcade rate-limit** response mapping (`RATE_LIMIT_EXCEEDED`) if we enforce limits.
- **OAuth / `context.authorization`**-style conditions if Arcade exposes richer auth context.
- **Multi–Arcade-org / multi-tenant** operator workflows beyond today’s single-tenant-first UX.
- **Analytics** — extra dimensions once policy matching grows.

---

## 9. References (code)

- [`docs/auth-and-multitenancy.md`](../auth-and-multitenancy.md)
- [`docs/arcade/webhook.yaml`](./webhook.yaml)
- [`docs/arcade/payloads.md`](./payloads.md)
- `server/appData/migrations/001_initial_arcade.sql`
- `server/app/api/v1/webhooks/arcade/pre/route.ts`, `…/post/route.ts`
- `server/lib/webhooks/mcpWebhookFilter.ts`
- `server/lib/types/arcadeWebhook.ts`
- `server/lib/services/messageFilter.ts` — **`applyPolicies`**, **`MessageFilterService`**
- `server/lib/models/types/policy.ts` — **`PolicyData`** (**`methods?: string[]`** today)
- `server/lib/policy-engine/core/PolicyEngine.ts`
- `server/lib/policy-engine/conditions/` — e.g. **`RegexCondition`**

Update this file when Arcade’s contract or Pachinko’s hook behavior changes.
