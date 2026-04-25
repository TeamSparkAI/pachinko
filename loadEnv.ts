import path from 'path';
import { config } from 'dotenv';

/** Bundled `server.js` / `pachinko` both live in a directory named `dist`. */
const isBundledServer = path.basename(__dirname) === 'dist';

/**
 * - **Bundled** (`dist/server.js`, `dist/pachinko`): load **`.env`** / **`.env.local`** from
 *   **`process.cwd()`** — where you run the command — not from inside `node_modules` or the global
 *   package install path.
 * - **Dev** (`tsx server.ts`): load from **`__dirname`** (directory of `server.ts`, i.e. repo root
 *   in this layout) so repo **`.env`** works even if cwd differs.
 */
const envDir = isBundledServer ? process.cwd() : __dirname;

config({ path: path.join(envDir, '.env') });
config({ path: path.join(envDir, '.env.local'), override: true });
