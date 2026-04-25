# Policy engine, messages, and reporting for Arcade webhooks

This document describes how Pachinko runs **policies against Arcade Engine pre/post webhooks** (see [`webhook.yaml`](./webhook.yaml)). **Ingress is Arcade webhooks only** for the shipped product path—no parallel MCP connector in this flow. It combines the **original design intent** with an **as-built** summary so future work is clear.

**Auth (as built):** Pre/post require **`Authorization: Bearer`** with a **tenant API key** (`{keyLookupId}.{secret}` from **Settings → API keys**). Arcade’s OpenAPI still names the scheme **`bearerAuth`**; Pachinko resolves the tenant via **`tenant_api_keys`** (see [`docs/auth-and-multitenancy.md`](../auth-and-multitenancy.md)). The legacy app-setting **`filterApiBearerToken`** is removed.

**As-built status (current repo):** Arcade **pre/post** routes, **required** tenant Bearer auth, synthetic **`tools/call`** JSON-RPC ingress, **`MessageFilterService`** persistence, **`PolicyEngine`** + alerts + **`message_actions`**, and OpenAPI/UI for settings and review are **implemented**. The **schema** is **`server/appData/migrations/001_initial_arcade.sql`** (Arcade-first; legacy `002_*` migrations are not used for new installs). **Not implemented vs earlier design notes:** **`toolNames`** applicability (**policies still use `methods[]` vs `payloadMethod`**—see §4). Pre/post correlation uses Arcade **`execution_id`** stored in **`payloadMessageId`** (with the same value as JSON-RPC **`id`**)—no separate column is required.

---

## 1. Purpose and scope

**Goal:** Define, apply, and report policies when Arcade calls our **pre** and **post** hooks. Arcade’s wire names are **`inputs`** (pre) and **`output`** (post); in our system those are the **same payloads** we already use everywhere: **`params`** (tool inputs) and **`result`** (tool output). **Policy application does not use a separate Arcade-only model**—Arcade JSON is mapped into **`params` / `result`** (and **`MessageData`** fields) and the same **`RegexCondition`** / engine paths run. Wire-level **`override.inputs` / `override.output`** in [`webhook.yaml`](./webhook.yaml) correspond to mutating those same logical payloads. **`context.user_id`**, **`tool`**, and post execution fields are carried for logging and correlation.

**Direction = `origin` (unchanged):** Arcade **pre** is **client → server** → **`origin: 'client'`**. Arcade **post** is **server → client** → **`origin: 'server'`**. **`either`** applies to both. No separate “hook phase” field.

**In scope (implemented):**

- **POST** `/api/v1/webhooks/arcade/pre` and **`/post`** (see §2).
- Bearer auth: **`Authorization: Bearer {keyLookupId}.{secret}`** (tenant API key) ↔ Arcade **`bearerAuth`** in [`webhook.yaml`](./webhook.yaml) (§1.1).
- Map each request into evaluation shape (**`MessageData` + message wrapper**, **`origin`**) with **`params`** ← Arcade **`inputs`** (pre) and **`result`** ← Arcade **`output`** (post), through **`JsonRpcMessageWrapper`** and **`validateJsonRpcMessage`**.
- Map policy outcomes to **`PreHookResult` / `PostHookResult`** (`code`, `error_message`, `override`).
- Persist messages with **`source: 'arcade'`**, **`payloadToolkit` / `payloadToolVersion`** from **`tool`**, **`payloadMessageId`** = Arcade **`execution_id`** (same value as JSON-RPC **`id`** on the synthetic message).

**Explicitly out of scope (not documented here):**

- **POST /access**, **GET /health**, and any paths other than pre/post in [`webhook.yaml`](./webhook.yaml).

### 1.1 Webhook bearer auth

Arcade lists **`security: bearerAuth`** on `/pre` and `/post` → an **`Authorization: Bearer …`** header. Pachinko expects the value to be a **tenant API key** shown once when the key is created in **Settings**: **`{keyLookupId}.{secret}`** (split on the first dot server-side). **`handleArcadeFilterWebhook`** accepts **Bearer only** (no session cookie); missing or invalid credentials → **401**.

---

## 2. Arcade webhook contract — pre / post only

### 2.1 Hooks

| Hook | Purpose | Auth (spec) |
|------|---------|-------------|
| **POST /pre** | Gate or modify a tool **before** execution | Arcade `bearerAuth` → `Authorization: Bearer` = tenant API key (`keyLookupId.secret`) |
| **POST /post** | Validate or modify the tool **response** after execution | Same |

Paths are configurable in Arcade; **payload shapes** are stable.

**`origin` mapping:** **pre** → **`client`**. **post** → **`server`**. **`either`** → both hooks.

### 2.2 Pre-hook (`PreHookRequest`)

- `execution_id`, `tool` (`ToolInfo`: name, toolkit, version, optional metadata), **`inputs`**, **`context`** (incl. `user_id`). **Internally:** treat as **`params`** (tool inputs)—same as today’s pre / client-side policy payload.

**Response:** `PreHookResult` — `code`, optional `error_message`, optional `override` (`inputs` / `secrets`) — same logical content as **`params`** overrides.

### 2.3 Post-hook (`PostHookRequest`)

- `execution_id`, `tool`, `context`; optional `inputs`; **`success`**; **`output`** (schema: JSON value per property description in [`webhook.yaml`](./webhook.yaml)); `execution_code`, `execution_error`. **Internally:** treat **`output`** as **`result`** (tool output)—same as today’s post / server-side policy payload.

**Response:** `PostHookResult` — `code`, optional `error_message`, optional `override.output` — same logical content as **`result`** overrides.

---

## 3. What we reuse from the current stack

**Ingress** is implemented in **`server/lib/webhooks/mcpWebhookFilter.ts`** (`handleArcadeFilterWebhook`) and Arcade types/helpers in **`server/lib/types/arcadeWebhook.ts`**. **`MessageFilterService.processMessage`** in **`server/lib/services/messageFilter.ts`** persists and runs **`applyPolicies`**.

We **reuse**:

- **`PolicyData.origin`** (`client` | `server` | `either`) — gates which hook a policy applies to (§2.1).
- **`PolicyEngine`** + **`RegexCondition`** (and other registered conditions) — evaluate on the payload we supply.
- **`applyPolicies`** — filters on **`enabled`**, **`origin`**, and **`methods`** (see §4).
- **`MessageData`** / alerts / **`message_actions`** — for persistence and reporting once populated from Arcade fields.

### 3.1 v1 ingress: synthetic `tools/call` JSON-RPC

**Objective:** Ingress builds a **JSON-RPC 2.0** request or response compatible with **`tools/call`** (including **`result`** / **`error`** on post), runs **`validateJsonRpcMessage`** and **`JsonRpcMessageWrapper`**, and feeds the **same** policy pipeline—**implemented** via **`arcadePreToJsonRpcRequest`**, **`arcadePostSuccessToJsonRpc`**, **`arcadePostFailureToJsonRpc`**, and **`mapProcessedJsonRpcToArcadePreResult` / `mapProcessedJsonRpcToArcadePostResult`**.

| Phase | `origin` | Shape |
|-------|----------|--------|
| **Pre** | `client` | Request: `method: "tools/call"`, `params: { name: <tool.name>, arguments: <Arcade inputs> }`. **`id`** ← **`execution_id`**. |
| **Post** | `server` | Success: **`result`** ← Arcade **`output`**. Failure: JSON-RPC **`error`** from **`execution_error`**. Same **`id`** as pre for correlation. |

**Persistence / UX:** **`payloadMethod`** is **`tools/call`** on the client row; **`payloadToolName`** is taken from synthetic **`params.name`**. **`payloadToolkit` / `payloadToolVersion`** come from **`MessageFilterContext`** populated from **`tool`** in **`syntheticMessageFilterContextForArcade`**.

**Hook responses:** Native **`PreHookResult` / `PostHookResult`** (not the JSON-API `{ meta, … }` envelope used elsewhere).

---

## 4. Policy applicability (as-built vs planned)

### As-built

| Concern | Approach |
|---------|----------|
| **Which hook** | **`origin`**: `client` = pre, `server` = post, `either` = both. |
| **Method list** | **`policy.methods`** (optional JSON array on **`policies`**) compared to **`messageData.payloadMethod`** in **`applyPolicies`**. For Arcade ingress, **`payloadMethod`** is always **`tools/call`**. **Empty or omitted `methods`** ⇒ policy applies to all methods; **non-empty** ⇒ **`tools/call`** must be included for Arcade traffic to match. |
| **Per-tool name** | **Not** a separate policy field today. Arcade **`tool.name`** is stored as **`payloadToolName`** but is **not** used in **`applyPolicies`** filtering. |

### Planned (not shipped)

| Concern | Approach (original design) |
|---------|----------------------------|
| **Which tool** | **`toolNames`**: match Arcade **`tool.name`**; retire **`methods`** for Arcade-only applicability. |

---

## 5. Implemented components (Arcade path)

1. **Arcade routes** — Pre/post: require valid **tenant API key** Bearer; parse body per [`webhook.yaml`](./webhook.yaml); set **`origin`**; build synthetic **`tools/call`** JSON-RPC; **`MessageFilterService.processMessage`**.
2. **Applicability** — **`applyPolicies`**: **`enabled`** + **`origin`** + **`methods`** vs **`payloadMethod`** (see §4).
3. **Conditions / actions** — **`PolicyEngine.processMessage`** then **`applyModifications`**; outcomes mapped to Arcade hook results.
4. **Persistence** — **`messages`** row on pre; post updates matching row by **`payloadMessageId`** / **`message.messageId`** or creates orphan **server** row if no match; **`alerts`** and **`message_actions`** as today.

---

## 6. Messages, persistence, and correlation

- **Correlation** — Arcade **`execution_id`** is stored in **`payloadMessageId`** (and matches JSON-RPC **`id`** on the synthetic message). Post updates the pre row (or creates an orphan server row) by matching on that value—**implemented**; a dedicated **`execution_id`** column is unnecessary.
- **Analytics / forensics** — **`userId`** from `context.user_id`, **`source`** = `arcade`, **`payloadToolkit` / `payloadToolVersion`** from `tool`, **`origin`**, timestamps, policy hits, alert ids.

### 6.1 Persisted `messages` columns ↔ Arcade (as-built)

Schema: **`server/appData/migrations/001_initial_arcade.sql`**. Legacy columns **`sessionId`**, **`clientId`**, **`serverId`**, **`serverName`**, **`sourceIP`** are **removed** in this migration.

| Pachinko column | Arcade **pre** | Arcade **post** | Notes |
|-----------------|----------------|------------------|--------|
| **`messageId`** | — | — | Surrogate PK. |
| **`timestamp`** | Set on pre **create** | Set on orphan **server** **create** if no matching pre | Ingest wall time unless overridden by caller. |
| **`timestampResult`** | `NULL` | Set on **update** of matched pre row when post succeeds | Post completion time. |
| **`origin`** | **`client`** | **`server`** | |
| **`userId`** | `context.user_id` (or **`unknown`**) | Same | Via **`MessageFilterContext.user`**. |
| **`source`** | **`arcade`** | **`arcade`** | From synthetic context. |
| **`payloadToolkit`** | `tool.toolkit` | Same | |
| **`payloadToolVersion`** | `tool.version` | Same | |
| **`payloadMessageId`** | **`execution_id`** | **`execution_id`** | Correlation key for pre/post; same value as JSON-RPC **`id`**. |
| **`payloadMethod`** | **`tools/call`** | From message (often empty on response path) | |
| **`payloadToolName`** | **`tool.name`** (from **`params.name`**) | May be **empty** on orphan server insert | |
| **`payloadParams`** | Synthetic **`params`** `{ name, arguments }` | Unchanged on update of pre row | **`arguments`** ← Arcade **`inputs`**. |
| **`payloadResult`** | `NULL` at pre | **`result`** after policy on success | |
| **`payloadError`** | `NULL` at pre | JSON-RPC **error** shape on failure | |
| **`createdAt`** | DB default | | |

**Not first-class columns:** full **`context`**, **`tool.metadata`**, **`success`**, **`execution_code`**, optional post **`inputs`**—unless copied into params/result by policy, they appear only in webhook logs.

**`message_actions`:** Table exists in **`001_initial_arcade.sql`**; rows created when actions run, same as non-Arcade path.

---

## 7. Reporting and UX (as-built)

- **Policy editor:** **`origin`** + **`methods`** list (UI copy still references MCP-style method names; for Arcade, **`tools/call`** is the relevant method string).
- **Message / alert views:** Params / result and **`origin`**; filters include **`source`**, **`payloadToolkit`**, etc.

---

## 8. Implementation status (Arcade migration)

| Item | Status |
|------|--------|
| Single Arcade-first migration **`001_initial_arcade.sql`** | Done |
| Messages schema: **`source`**, **`payloadToolkit`**, **`payloadToolVersion`**, no client/server/session columns | Done |
| **`/webhooks/arcade/pre`** and **`/post`** + required tenant Bearer | Done |
| Synthetic **`tools/call`** + **`PreHookResult` / `PostHookResult`** | Done |
| **`applyPolicies`** + alerts + **`message_actions`** | Done |
| **`toolNames`** + drop **`methods`** for Arcade | **Not done** (see §4, §11) |

---

## 9. References (code)

- [`docs/auth-and-multitenancy.md`](../auth-and-multitenancy.md) — sessions, **`tenant_api_keys`**, webhook auth
- [`docs/arcade/webhook.yaml`](./webhook.yaml)
- [`docs/arcade/payloads.md`](./payloads.md)
- `server/appData/migrations/001_initial_arcade.sql`
- `server/lib/webhooks/mcpWebhookFilter.ts`
- `server/lib/types/arcadeWebhook.ts`
- `server/lib/services/messageFilter.ts` — **`applyPolicies`**, **`MessageFilterService`**
- `server/lib/models/types/policy.ts` — **`methods?: string[]`** (no **`toolNames`** yet)
- `server/lib/policy-engine/core/PolicyEngine.ts`
- `server/lib/policy-engine/conditions/` — e.g. **`RegexCondition`**

---

## 10. Open questions (blocking or ambiguous for v1)

1. **Blocking vs monitoring:** When policies “fire,” must we always return **`CHECK_FAILED`**, or is **`OK`** with logging/alerts only allowed? Affects Arcade agent UX.
2. **Overrides:** How exactly do rewrite/redact **actions** map into **`override.inputs`** / **`override.output`** (full replace vs partial merge) for v1?

---

## 11. Future work

The following is **after** the current as-built path (Arcade pre/post, **`origin`**, **`methods`** + **`tools/call`**, regex/actions on **`params` / `result`**).

- **`toolNames`** — Per **`tool.name`** (or pattern) policy applicability; **retire or repurpose `methods`** for Arcade-only UX (**original §4**).
- **Toolkit / version / user scoping** — Policy filters beyond method/tool name lists.
- **`EvaluationContext` / engine refactor** — First-class context if we outgrow JSON-RPC wrapper.
- **Tool identity guarantees** — Version hashes, allowlists, etc.
- **`RATE_LIMIT_EXCEEDED`** — Whether and how we emit Arcade’s rate-limit code.
- **OAuth / `context.authorization`** — Conditions on scopes or JWT claims.
- **Tenancy** — Multiple Arcade orgs vs one deployment.
- **Richer analytics** — Extra dimensions.
- **Match semantics** — Case sensitivity / normalization for tool names.

This document should be updated as Arcade’s contract or product choices evolve.
