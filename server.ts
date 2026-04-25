#!/usr/bin/env node

import './loadEnv';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { ModelFactory } from '@/lib/models';
import { getApiConfigPath } from '@/lib/utils/paths';
import { removePachinkoAppData } from '@/lib/cleanAppData';
import { resetDefaultTenantUsers } from '@/lib/resetDefaultTenantUsers';
import { logger } from '@/lib/logging/server';
import { warnIfUnsetSessionSecretAtStartup } from '@/lib/auth/warnSessionSecretAtStartup';
import * as fs from 'fs';
import * as path from 'path';
import packageJson from './package.json';

const dev = false; // process.env.NODE_ENV !== 'production';
const hostname = 'localhost';

// Handle all commands
async function handleCommands(): Promise<boolean> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    handleHelpCommand();
    return true;
  }

  if (args.includes('--clean')) {
    try {
      console.log('🧹 Removing Pachinko app data (same as npm run clean from source)...');
      removePachinkoAppData();
    } catch (error) {
      console.error('❌ Error removing app data:', error);
      process.exit(1);
    }
    process.exit(0);
  }

  if (args.includes('--admin-reset')) {
    try {
      const removed = await resetDefaultTenantUsers();
      console.log(
        `Removed ${removed} user(s) for default tenant. Open /login to create a new admin account.`
      );
    } catch (error) {
      console.error('❌ admin-reset failed:', error);
      process.exit(1);
    }
    process.exit(0);
  }

  return false;
}

function handleHelpCommand(): void {
  console.log(`
Pachinko Server

Usage: pachinko [options]

Options:
  --port <number>      Specify port to run on (default: auto-detect)
  --log-level <level>  Specify log level (error, warn, info, debug, trace)
  --clean              Delete Pachinko app data (DB, logs, api.json, etc.) and exit
  --admin-reset        Delete all users for the default tenant and exit (stop server first)
  --help, -h           Show this help message

Environment Variables:
  PACHINKO_PORT        Specify port via environment variable
  PACHINKO_LOG_LEVEL   Specify log level via environment variable

Examples:
  pachinko                      # Run on auto-detected port
  pachinko --port 3000          # Run on port 3000
  pachinko --log-level debug    # Set log level to debug
  pachinko --clean              # Remove app data directory and exit
  pachinko --admin-reset       # Remove default-tenant users; then use /login to create admin

The server will automatically detect an available port if none is specified.

From a git checkout you can also run: npm run clean
`);
  process.exit(0);
}

// Parse port from command line args or environment variable
function parsePort(): number | undefined {
  // Check command line arguments for --port
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && portArgIndex + 1 < process.argv.length) {
    const portArg = process.argv[portArgIndex + 1];
    const port = parseInt(portArg, 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return port;
    }
  }
  
  // Check environment variable PACHINKO_PORT
  if (process.env.PACHINKO_PORT) {
    const port = parseInt(process.env.PACHINKO_PORT, 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return port;
    }
  }
    
  return undefined; // Will trigger available port detection
}

// No need for findAvailablePort - we'll use server.listen(0) instead

// Next.js will be initialized in start() function

let shuttingDown = false;

async function start() {
  try {
    // Check for commands first
    const handledCommand = await handleCommands();
    if (handledCommand) {
      return; // Exit after handling command
    }

    logger.info('Starting server');
    logger.info(`Log level set to: ${logger.getCurrentLogLevel()}`);
    warnIfUnsetSessionSecretAtStartup();

    // Determine port to use
    let port = parsePort();
    let useAutoPort = false;
    
    if (port === undefined) {
      // No port specified, will use auto-port detection
      useAutoPort = true;
      port = 0; // This tells Node.js to find an available port
      logger.info('No port specified, will use auto-port detection');
    }
    
    // Initialize database through model factory
    await ModelFactory.getInstance().initialize();

    // Prepare Next.js
    const app = next({ dev: false, hostname, port: port, dir: __dirname }); // Point to the directory containing the executable
    const handle = app.getRequestHandler();
    await app.prepare();

    // Create and start HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        logger.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    server.listen(port, async () => {
      // Get the actual port that was assigned
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      
      logger.info(`> Ready on http://${hostname}:${actualPort}`);
      
      // Write API configuration for shim discovery
      try {
        const apiConfigPath = getApiConfigPath();
        const configDir = path.dirname(apiConfigPath);
        
        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        const apiConfig = {
          apiPath: `http://${hostname}:${actualPort}`
        };
        
        fs.writeFileSync(apiConfigPath, JSON.stringify(apiConfig, null, 2));
        logger.debug(`API config written to: ${apiConfigPath}`);
      } catch (error) {
        logger.error('Failed to write API config:', error);
      }
    }).on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${port} is already in use!`);
        logger.error(`Exiting...`);
        process.exit(1);
      } else {
        logger.error('Server error:', err);
        process.exit(1);
      }
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      if (shuttingDown) {
        logger.info('Shutdown already in progress, skipping...');
        return;
      }
      shuttingDown = true;
      logger.info('Shutting down...');
      
      // Clean up gateway config file
      try {
        const apiConfigPath = getApiConfigPath();
        if (fs.existsSync(apiConfigPath)) {
          fs.unlinkSync(apiConfigPath);
          logger.debug('API config file cleaned up');
        }
      } catch (error) {
        logger.error('Failed to cleanup API config:', error);
      }

      logger.info('Closing server');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };

    logger.debug('Setting SIGINT/SIGTERM up signal handlers');
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
}

logger.info(`Pachinko v${packageJson.version}`);
start();