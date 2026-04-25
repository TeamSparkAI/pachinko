# TeamSpark Pachinko Policy Engine

**An integrated platform for AI agent tool management and security**

## Overview

Apply security policies to the traffic flowing between agents and MCP servers to protect your API tokens, secrets, PII, and more.

## Installation Requirements

Node.js v18+ and Docker (or compatible, aliased runtime)

Supported operating systems: MacOS, Windows, and Linux

## Configuration: session signing secret (`PACHINKO_SESSION_JWT_SECRET`)

The web UI uses a signed, httpOnly session cookie. The server variable **`PACHINKO_SESSION_JWT_SECRET`** is **only** used to sign (and verify) that cookie. It is not an API key, not a user password, and is not the same as the tenant bearer tokens you create in Settings.

### Local development (`.env` at the **repository root**)

Environment files live at the **repository root** (same directory as `package.json`, `next.config.js`, and `server.ts`), alongside the app source.

1. In the **root directory** of the clone, copy the sample file: `cp .env.example .env.local` (or `.env` — see precedence below)
2. Set a strong random value for `PACHINKO_SESSION_JWT_SECRET` using either command below, then paste the **entire output line** (no quotes) as the value after `=` in the file

```bash
openssl rand -base64 48
```

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

3. From the repository root, run `npm run start:prod` or `npm run start:dev` (or `npm run build` then start the bundled output). The custom server (`server.ts`) and Next config load **`.env`** first, then **`.env.local`**, with the latter **overriding** the former for any duplicate keys. Committed `/.env.example` at the root documents variables; real `.env` files are **gitignored**—do not commit secrets.

### Without a file (injected environment)

Set the same variable in the process environment, for example:

```bash
export PACHINKO_SESSION_JWT_SECRET="$(openssl rand -base64 48)"
```

Use your host’s usual mechanism: Docker `--env` / `env_file`, Kubernetes Secrets, cloud provider “app settings,” CI secrets, and so on. **Production and any shared or internet-facing deployment** should set a unique secret (not the dev fallback) and should **not** commit it to the repository.

### When you can skip the file (not recommended for production)

If `PACHINKO_SESSION_JWT_SECRET` is unset, the app still starts but uses a **fixed development default** and logs a warning (or an error-level log in non-development). That path exists for convenience only; for anything beyond solo local use, set the variable as above.
