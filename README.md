# TeamSpark Pachinko Policy Engine

**An AI tool call policy engine designed for Arcade.dev**

## Overview

Apply security policies to tool calls happening in Arcade.dev to protect your API tokens, secrets, PII, and more. Pachinko provides webhook entrypoints and bearer token auth making it quick and easy to integration with Arcade.dev.

## Installation requirements

- **Node.js 20 or newer** — the production server bundle is built for **Node 20** (`esbuild --target=node20`).
- **macOS**, **Windows**, or **Linux** (native modules include `sqlite3`, `argon2`, and `sharp`).
- **From npm:** package **`teamspark-pachinko`** (`npm install teamspark-pachinko`). The CLI binary name is **`pachinko`**.

## Running the server

- **From a git checkout (development):** from the repo root, `npm run start:dev` (runs Next build then `tsx server.ts`). Default dev script uses port **3000**; adjust in `package.json` if needed.
- **From a git checkout (production build):** `npm run build`, then `npm run start:prod` or `node dist/server.js`, or `./dist/pachinko` / `npm run start:server` (same bundled entry as `dist/pachinko`).
- **After `npm install teamspark-pachinko`:** run **`pachinko`** or **`npx pachinko`** (same CLI flags as below). The published tarball only includes **`dist/`**; run **`npm run build`** before **`npm publish`** so `dist/` is populated.

## Command-line options (`pachinko` / `dist/pachinko` / `node dist/server.js`)

| Option | Description |
|--------|-------------|
| `--port <n>` | Listen on TCP port `n` (1–65535). |
| `--log-level <level>` | One of: `error`, `warn`, `info`, `debug`, `trace`. |
| `--clean` | Delete the Pachinko **app data directory** (SQLite, logs, `api.json`, etc.) and **exit**. |
| `--help`, `-h` | Print help and exit. |

From a **git checkout** you can also run **`npm run clean`** (same logic via `scripts/clean.ts`).

If neither **`--port`** nor **`PACHINKO_PORT`** is set, the server uses **port 0** (OS assigns a free port); check logs for the URL. **`--log-level`** overrides **`PACHINKO_LOG_LEVEL`** when both are relevant.

## Environment variables

**`.env`** and **`.env.local`** in the **app root** are loaded first by **`loadEnv.ts`** (and **`next.config.js`** for Next). When running from **`dist/`**, that root is the **parent directory of `dist/`** (so a `.env` next to the installed `dist/` folder is picked up). **`.env.local`** overrides **`.env`** for duplicate keys. You can set the same names in the process environment (containers, systemd, etc.) instead of files.

| Variable | Role |
|----------|------|
| **`PACHINKO_SESSION_JWT_SECRET`** | Signs and verifies the **httpOnly** session cookie (**JWT**) for the web UI. **Not** a user password or tenant API key. **Strongly set in production**; if unset in development the app may use a fixed default with a warning — do not rely on that outside local use. |
| **`PACHINKO_PORT`** | Default HTTP port (integer 1–65535). Ignored if **`--port`** is passed. |
| **`PACHINKO_LOG_LEVEL`** | Server log level: `error`, `warn`, `info`, `debug`, `trace`. Default **`info`**. Ignored if **`--log-level`** is passed. |
| **`NODE_ENV`** | Standard Node/Next flag (e.g. `production` vs `development`) — affects cookie **`Secure`**, DB driver verbosity, and similar behavior. |

See **`.env.example`** for a copy-paste template (including optional **`PACHINKO_PORT`** / **`PACHINKO_LOG_LEVEL`**).

### Session signing secret (`PACHINKO_SESSION_JWT_SECRET`) in more detail

The web UI uses a signed, httpOnly session cookie. **`PACHINKO_SESSION_JWT_SECRET`** is **only** used to sign and verify that cookie.

**Local files (repo root when developing from git)**

1. Copy **`cp .env.example .env.local`** (or `.env`).
2. Set a strong value, e.g. generate with:

```bash
openssl rand -base64 48
```

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

3. Paste the **single line** of output as the value after `=` (no surrounding quotes in the file unless you intend quotes to be part of the secret).

**Without a file**

```bash
export PACHINKO_SESSION_JWT_SECRET="$(openssl rand -base64 48)"
```

Use your host’s usual mechanism (Docker `env_file`, Kubernetes Secrets, cloud app settings, CI secrets). **Do not commit** real `.env` / `.env.local` files.

### When the secret is unset (not recommended for production)

If **`PACHINKO_SESSION_JWT_SECRET`** is unset, the app may still start using a **development default** and log a warning (or stronger log outside development). Use that only for quick local experiments.
