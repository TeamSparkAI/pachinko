const path = require('path');
const { config: loadEnv } = require('dotenv');

// Load `.env` from the repository / app root (same directory as this config).
const rootDir = __dirname;
loadEnv({ path: path.join(rootDir, '.env') });
loadEnv({ path: path.join(rootDir, '.env.local'), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude test files from the build
    config.module.rules.push({
      test: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      use: 'ignore-loader'
    });
    
    return config;
  },
};

module.exports = nextConfig; 