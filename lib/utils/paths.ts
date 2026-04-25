import * as path from 'path';
import * as os from 'os';

// App data path:
// - macOS: ~/Library/Application Support/Pachinko/
// - Linux: ~/.config/pachinko/
// - Windows: %APPDATA%\Pachinko\

/**
 * Get the application data directory path for the current OS
 * @returns The path to the app data directory
 */
export function getAppDataPath(): string {
    const platform = os.platform();

    if (platform === 'win32') {
        return path.join(process.env.APPDATA || '', 'Pachinko');
    } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Pachinko');
    } else {
        return path.join(os.homedir(), '.config', 'pachinko');
    }
}

/**
 * Get the api configuration file path
 * @returns The path to api.json
 */
export function getApiConfigPath(): string {
    return path.join(getAppDataPath(), 'api.json');
}
