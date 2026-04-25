import path from 'path';
import { config } from 'dotenv';

/**
 * Repository / app root (directory containing `.env`).
 * - `loadEnv.ts` via tsx: __dirname is repo root
 * - Bundled `dist/server.js`: __dirname is `.../dist` → one level up to repo root
 */
const envFileRoot =
  path.basename(__dirname) === 'dist' ? path.join(__dirname, '..') : __dirname;

config({ path: path.join(envFileRoot, '.env') });
config({ path: path.join(envFileRoot, '.env.local'), override: true });
