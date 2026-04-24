# TeamSpark Pachinko

## Overview

Pachinko is a **policy engine and review console** for Model Context Protocol (MCP) traffic. It ingests JSON-RPC style messages (including flows mediated by [Arcade Engine](https://arcade.dev) webhooks), stores them with source and toolkit metadata, evaluates **policies** built from reusable conditions and actions, and surfaces **alerts** when rules fire.

It complements—not replaces—your MCP clients and servers: you configure Arcade (or another integration) to POST tool context to Pachinko, then use the web UI to triage messages and alerts and tune policies.

## Key capabilities

- **Arcade Engine webhooks** — Pre- and post-execution hooks documented under `docs/arcade/`; optional bearer auth via app settings.
- **Message review** — List and filter by source, toolkit, method, and tool name; open a message to inspect payload and linked alerts.
- **Policies** — Author rules that reference configured policy elements (conditions and actions); severity and findings drive alerting.
- **Alerts** — Review unseen counts, mark seen, bulk mark-all; analytics for aggregates and time series.
- **Settings** — Retention, filter API token, public base URL for correct Arcade callback URLs.
- **HTTP API** — OpenAPI spec at `/openapi.yaml`, interactive docs at in-app **API** (Swagger UI).

## Architecture (high level)

- **Next.js app** (`server/`) — UI, REST routes under `/api/v1`, static OpenAPI.
- **SQLite** — Messages, alerts, policies, policy elements, app settings (see migrations under `server/lib/models/sqlite/migrations`).
- **Policy engine** — Evaluates stored message shape against policy definitions; records alerts when conditions match.

## Getting started

1. Clone the repo: [github.com/TeamSparkAI/pachinko](https://github.com/TeamSparkAI/pachinko).
2. Follow the root **README** for Node/Docker prerequisites and workspace scripts.
3. Configure Arcade pre/post URLs to your deployment’s webhook routes (see **Settings** in the app and `docs/arcade/webhook.yaml`).
4. Define policies and policy elements, then exercise traffic and review **Messages** and **Alerts**.

## Support and resources

- **Issues and feature requests:** [github.com/TeamSparkAI/pachinko/issues](https://github.com/TeamSparkAI/pachinko/issues)
- **In-app help:** `/help` — Quick start and links (including repository and TeamSpark site).
- **Licensing:** See [LICENSE.md](../LICENSE.md) at the repository root.

---

*TeamSpark Pachinko — policy, visibility, and control over MCP traffic.*
