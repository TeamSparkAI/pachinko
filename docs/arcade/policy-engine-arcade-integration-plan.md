# Policy engine, messages, and reporting for Arcade webhooks

This document plans how Pachinko will run **policies against Arcade Engine pre/post webhooks** (see [`webhook.yaml`](./webhook.yaml)). **Ingress is Arcade webhooks only**—we are not maintaining a parallel “MCP connector” or MCP-specific policy path in this plan. Existing code (policy engine, `RegexCondition`, `MessageData`, **`origin`**) is the starting point; this note describes the mapping and the **minimum** work to get policies working, then defers everything else to **§11 Future work**. Research and design only—no implementation commitments.

---

## 1. Purpose and scope

**Goal:** Define, apply, and report policies when Arcade calls our **pre** and **post** hooks. Arcade’s wire names are **`inputs`** (pre) and **`output`** (post); in our system those are the **same payloads** we already use everywhere: **`params`** (tool inputs) and **`result`** (tool output). **Policy application should not treat them as a different model**—map Arcade JSON into **`params` / `result`** (and existing **`MessageData`** fields) and run the same **`RegexCondition`** / engine paths as today. Wire-level **`override.inputs` / `override.output`** in [`webhook.yaml`](./webhook.yaml) correspond to mutating those same logical payloads. Also carry **`context.user_id`**, **`tool`**, and post execution fields for logging and correlation.

**Direction = `origin` (unchanged):** Arcade **pre** is **client → server** → **`origin: 'client'`**. Arcade **post** is **server → client** → **`origin: 'server'`**. **`either`** applies to both. No separate “hook phase” field.

**In scope (minimum to get policies working on Arcade):**

- **POST /pre** and **POST /post** only (see §2).
- Bearer auth via **`filterApiBearerToken`** ↔ Arcade **`bearerAuth`** (§1.1).
- Map each request into our existing evaluation shape (**`MessageData` + message wrapper**, **`origin`**) with **`params`** ← Arcade **`inputs`** (pre) and **`result`** ← Arcade **`output`** (post), so **current conditions** (starting with **regex**) run on **`params` / `result`** exactly as they do for tool calls today—no parallel “Arcade payload” branch inside the policy engine.
- **Policy applicability:** **`origin`** (which hook) plus **`toolNames`**—a list of one or more tool names that must match Arcade **`tool.name`** (replacing the old MCP **`methods[]`** criterion for Arcade policy matching).
- Map policy outcomes to **`PreHookResult` / `PostHookResult`** (`code`, `error_message`, `override`).
- Persist and correlate messages (e.g. **`execution_id`**), reuse **`origin`** for pre/post in storage and alerts.

**Explicitly out of scope (not documented here):**

- **POST /access**, **GET /health**, and any paths other than pre/post in [`webhook.yaml`](./webhook.yaml).

### 1.1 Webhook bearer auth

Arcade lists **`security: bearerAuth`** on `/pre` and `/post` → **`Authorization: Bearer …`**. Pachinko’s **`filterApiBearerToken`** is that same shared secret: when set, Arcade sends it on pre/post; when unset, our hook does not require the header.

---

## 2. Arcade webhook contract — pre / post only

### 2.1 Hooks

| Hook | Purpose | Auth (spec) |
|------|---------|-------------|
| **POST /pre** | Gate or modify a tool **before** execution | `bearerAuth` → `Authorization: Bearer` |
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

The repo today still contains an **MCP-shaped filter webhook** (JSON-RPC, legacy **`methods`** on policies, **`MessageFilterContext`**, etc.). For **Arcade-only** operation we **replace** per-policy **MCP method** lists with **`toolNames`**: one or more strings compared to Arcade **`tool.name`** on each pre/post request (see §4).

We **reuse**:

- **`PolicyData.origin`** (`client` | `server` | `either`) — gates which hook a policy applies to (§2.1).
- **`PolicyEngine`** + **`RegexCondition`** (and other registered conditions) — evaluate on a **payload** we supply.
- **`applyPolicies`** — for Arcade: filter on **`enabled`**, **`origin`**, and **`toolNames`** (see §4). **Do not** use **`methods`** for Arcade applicability.
- **`MessageData`** / alerts — for persistence and reporting once populated from Arcade fields.

### 3.1 v1 ingress: synthetic `tools/call` JSON-RPC

**Objective:** Ingress builds a **JSON-RPC 2.0** request or response compatible with **`tools/call`** (including **`result`** / **`error`** on post), runs **`validateJsonRpcMessage`** and **`JsonRpcMessageWrapper`**, and feeds the **same** policy pipeline as MCP-shaped traffic—no separate evaluator for Arcade wire shapes.

| Phase | `origin` | Shape |
|-------|----------|--------|
| **Pre** | `client` | Request: `method: "tools/call"`, `params: { name: <tool.name>, arguments: <Arcade inputs> }`. Arcade **`inputs`** maps to **`arguments`** (name→value object). Optional: `id` ← **`execution_id`** (stringified if required) for pairing with **`messageId`** / session behavior. |
| **Post** | `server` | Success: response with **`result`** ← Arcade **`output`**, same **`id`** as pre when correlating. Failure: JSON-RPC **`error`** instead of **`result`** so server-path handling matches MCP-style responses. **`execution_code` / `execution_error`** on **`MessageData`** or ancillary fields for alerts if needed (TBD). |

**Persistence / UX:** Set **`payloadMethod`** to **`tools/call`** and **`payloadToolName`** from **`tool.name`** so stored messages and UI stay consistent with tool-call traffic.

**Hook responses:** **`PreHookResult` / `PostHookResult`** (including **`override`**) are produced by **translating** policy output from the wrapped message back to Arcade response bodies—not by returning the MCP filter webhook envelope. Arcade HTTP routes may need **`MessageFilterContext`** / auth behavior distinct from the legacy MCP webhook when no MCP server row exists; treat as ingress-layer work, not policy-engine changes. Refinements or replacement of this shim: **§11**.

---

## 4. Policy applicability for Arcade-only

| Concern | Approach |
|---------|----------|
| **Which hook** | **`origin`**: `client` = pre, `server` = post, `either` = both. |
| **Which tool** | **`toolNames`**: array of **one or more** tool name strings. A policy applies when Arcade **`tool.name`** equals **any** entry in the list (exact string match unless we later add normalization—TBD). **Empty or omitted list** = apply to **all** tools (same idea as “no method filter” today). |
| **MCP `methods[]`** | **Replaced** by **`toolNames`** for Arcade. Remove **`methods`** from applicability and from policy UI for Arcade-only mode; migrate stored policies / schema from **`methods`** → **`toolNames`** as needed. |
| **User / toolkit / version scoping** | **Not required for v1**; deferred to **§11**. |

---

## 5. Core implementation plan (Arcade webhooks only)

1. **Arcade routes** — Pre/post handlers: validate bearer if **`filterApiBearerToken`** set; parse body per [`webhook.yaml`](./webhook.yaml); set **`origin`**; build the **synthetic `tools/call` JSON-RPC** per **§3.1** so **`inputs` → `params`**, **`output` → `result`** (or **`error`** on failed post) flow through **`JsonRpcMessageWrapper`** and persistence unchanged.
2. **Applicability** — `applyPolicies` (or equivalent): **`enabled`** + **`origin`** + **`toolNames`** (match Arcade **`tool.name`**); **no `methods`**.
3. **Conditions** — Run **regex** (and existing actions) on **`params` / `result`** as today; extend **`MessageData`** from Arcade **`tool`** + **`context.user_id`** for display and analytics.
4. **Responses** — Translate engine outcome to **`PreHookResult` / `PostHookResult`**: `OK` vs `CHECK_FAILED`, `error_message`, and **`override`** when rewrite/redact actions apply (merge rules TBD for v1).
5. **Persistence** — Store **`execution_id`** (dedicated column preferred); correlate pre/post rows; keep **`origin`** as `client` / `server`.

---

## 6. Messages, persistence, and correlation

- **`execution_id`** — Primary correlation between pre and post for one tool run (replace or supplement MCP-style session + JSON-RPC `id` pairing).
- **Analytics / forensics** — At minimum: `userId` from `context.user_id`, tool name / toolkit / version from `tool`, **`origin`**, `execution_id`, timestamps, policy hits, alert ids. **Tenant / server binding** for Arcade can stay a single configured integration unless product requires more (defer detail to **§11**).

### 6.1 Persisted `messages` columns ↔ Arcade wire fields

The **`messages`** table is defined in `server/appData/migrations/002_initial_tables_v2.sql`. Below is how each stored column is populated for **Arcade pre/post** ingress (see concrete request bodies in [`payloads.md`](./payloads.md)). Values are after **synthetic JSON-RPC** construction and **policy** application unless noted.

| Pachinko column | Arcade **pre** (`PreHookRequest`) | Arcade **post** (`PostHookRequest`) | Notes |
|------------------|-----------------------------------|--------------------------------------|--------|
| **`messageId`** | — | — | Surrogate primary key (auto). |
| **`timestamp`** | Set when the pre hook row is created | Set on orphan **server** insert if no matching pre row | Wall-clock ingest time, not an Arcade-supplied instant. |
| **`timestampResult`** | `NULL` on pre create | Set when a **matching** pre row is updated with the post response | Update keyed by `sessionId` + `payloadMessageId` = `execution_id`. |
| **`origin`** | Always **`client`** | Always **`server`** | Encodes hook direction (§2.1). |
| **`userId`** | `context.user_id` | Same | Falls back to e.g. `'unknown'` if missing. |
| **`clientId`** | — | — | Not present on Arcade wire; from **`MessageFilterContext`** (often `NULL` for synthetic Arcade context). |
| **`sourceIP`** | — | — | Not on Arcade body; synthetic context uses a placeholder (e.g. **`arcade`**). |
| **`serverId`** | — | — | Not on Arcade body; synthetic Arcade context may use **`0`** / null per implementation. |
| **`serverName`** | — | — | Not on Arcade body; synthetic label (e.g. **`Arcade`**). |
| **`sessionId`** | **`execution_id`** | **`execution_id`** | Correlates pre and post for one tool run. |
| **`payloadMessageId`** | **`execution_id`** | **`execution_id`** | Same value as JSON-RPC **`id`** on the synthetic message. |
| **`payloadMethod`** | **`tools/call`** on the synthetic pre request | Usually empty on the synthetic **response** row | Post is modeled as JSON-RPC **result** / **error**, not a named method. |
| **`payloadToolName`** | **`tool.name`** | **`tool.name`** on orphan server create; may be empty on update-only path | Taken from synthetic **`params.name`** where that exists; **`tool`** is on every Arcade body. |
| **`payloadParams`** | Object from synthetic **`params`** (see §3.1: MCP-shaped `{ name, arguments }` with **`arguments`** ← **`inputs`**) | Unchanged on **update** of the pre row | Logical source of tool inputs is always Arcade **`inputs`** ([`payloads.md`](./payloads.md)). |
| **`payloadResult`** | `NULL` at pre create | Synthetic JSON-RPC **`result`** after policy (source: Arcade **`output`** on success) | On successful post, the matched pre row is **updated** with this column. |
| **`payloadError`** | `NULL` at pre create | `{ code, message }` when the synthetic message is JSON-RPC **error** (e.g. failed post → Arcade **`execution_error`** text) | Success post leaves this unset on update. |
| **`createdAt`** | — | — | DB default. |

**Not stored as first-class columns** (today): full **`context`** (authorization, `secrets`, etc.), **`tool.toolkit`**, **`tool.version`**, **`tool.metadata`**, **`success`**, **`execution_code`**, optional post **`inputs`**. Those exist only inside JSON blobs if a policy copies them into **`params`** / **`result`**; otherwise they are visible in raw webhook logs only.

**Alerts:** Keep **`origin`** as `client` / `server`; optional UI labels **Pre (client)** / **Post (server)**.

---

## 7. Reporting and UX (v1)

- **Policy editor:** **`origin`** for hook selection; **`toolNames`** as a list editor (one or more names), **replacing** the old MCP **method** picker for Arcade-only mode.
- **Message / alert views:** Continue to present **params** (tool inputs) and **result** (tool output) as today—the same values Arcade sends as **`inputs`** / **`output`**. Optionally label columns **Inputs (params)** / **Output (result)** for operators reading Arcade docs; **`origin`** encodes pre vs post.

---

## 8. Suggested implementation order (minimal)

1. Arcade pre/post routes + auth + payload mapping + **`origin`**.
2. **Policy model + `applyPolicies`:** add **`toolNames`** (and matching logic vs **`tool.name`**); **remove `methods`** from Arcade applicability; policy API + UI.
3. Wire **PolicyEngine** + **regex** + actions → **PreHookResult** / **PostHookResult**.
4. **Persistence** + **`execution_id`** + **`MessageData`** fields from Arcade.

---

## 9. References

- [`docs/arcade/webhook.yaml`](./webhook.yaml)
- `server/lib/models/types/policy.ts` — introduce **`toolNames`** (string array); **retire `methods`** for Arcade applicability (schema / migration per product rollout).
- `server/lib/services/messageFilter.ts` — `applyPolicies`
- `server/lib/policy-engine/core/PolicyEngine.ts`
- `server/lib/policy-engine/conditions/` — e.g. `RegexCondition`

---

## 10. Open questions (blocking or ambiguous for v1)

1. **Blocking vs monitoring:** When policies “fire,” must we always return **`CHECK_FAILED`**, or is **`OK`** with logging/alerts only allowed? Affects Arcade agent UX.
2. **Overrides:** How exactly do rewrite/redact **actions** map into **`override.inputs`** / **`override.output`** (full replace vs partial merge) for v1?

---

## 11. Future work (not required for basic Arcade policies)

The following is **explicitly after** a working pre/post path with **`origin`** + **`toolNames`** applicability and **regex** (plus existing actions) on **`params`** / **`result`** (sourced from Arcade **`inputs`** / **`output`**).

- **Toolkit / version / pattern scoping** — Beyond the **`toolNames`** list (e.g. **`tool.toolkit`**, semver ranges, glob patterns on name).
- **User-based policy scoping** — Filter policies by **`context.user_id`** (allowlist, patterns, dedicated condition types).
- **`EvaluationContext` / engine refactor** — First-class context type if we outgrow JSON-RPC wrapper + fixed `payloadMethod`; should still treat tool payload as **`params` / `result`** semantically.
- **Tool identity guarantees** — Expected **ToolInfo** / version hashes, allowlists beyond name lists, etc.
- **`RATE_LIMIT_EXCEEDED`** — Whether and how we emit Arcade’s rate-limit code.
- **OAuth / `context.authorization`** — Conditions on scopes or JWT claims.
- **Tenancy** — Multiple Arcade orgs vs one deployment; how **`serverId`** (or replacement) maps to Arcade.
- **Richer analytics** — Extra dimensions beyond the v1 minimum in §6.
- **Match semantics** — Case sensitivity, Unicode normalization, or Arcade-specific aliases for **`tool.name`** vs **`toolNames`**.

This document should be updated as Arcade’s contract or product choices evolve.
