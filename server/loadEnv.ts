import path from 'path';
import { config } from 'dotenv';

/**
 * Monorepo / package **root** (parent of `server/`), not `server/` itself.
 * - `server/loadEnv.ts` via tsx: __dirname is `.../server` → one level up
 * - Bundled `server/dist/server.js`: __dirname is `.../server/dist` → two levels up
 */
const envFileRoot =
  path.basename(__dirname) === 'dist' ? path.join(__dirname, '..', '..') : path.join(__dirname, '..');

config({ path: path.join(envFileRoot, '.env') });
config({ path: path.join(envFileRoot, '.env.local'), override: true });
