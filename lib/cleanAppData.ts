import { getAppDataPath } from '@/lib/utils/paths';
import * as fs from 'fs';

/** Remove the OS Pachinko app-data directory (SQLite, logs, api.json, etc.). */
export function removePachinkoAppData(): void {
  const appDataPath = getAppDataPath();
  console.log(`Removing installation at ${appDataPath}...`);
  if (fs.existsSync(appDataPath)) {
    fs.rmSync(appDataPath, { recursive: true, force: true });
    console.log('Installation removed');
  } else {
    console.log('Installation not found');
  }
}
