import path from 'path';
import { config } from 'dotenv';

/** Bundled `server.js` / `pachinko` both live in a directory named `dist`. */
const isBundledServer = path.basename(__dirname) === 'dist';

/**
 * - **Bundled:** load from the install directory (parent of `dist`), then **`process.cwd()`** with
 *   override so a project **`.env`** wins when you run from that directory (e.g. repo root).
 * - **Dev (`tsx`):** load from this file’s directory (repo root next to `loadEnv.ts`).
 */
if (isBundledServer) {
  const packageRoot = path.join(__dirname, '..');
  config({ path: path.join(packageRoot, '.env') });
  config({ path: path.join(packageRoot, '.env.local'), override: true });
  config({ path: path.join(process.cwd(), '.env'), override: true });
  config({ path: path.join(process.cwd(), '.env.local'), override: true });
} else {
  config({ path: path.join(__dirname, '.env') });
  config({ path: path.join(__dirname, '.env.local'), override: true });
}
