/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Next 14: hoisted registry client deps use package.json "exports" that webpack mishandles.
    serverComponentsExternalPackages: ['npm-registry-fetch', 'make-fetch-happen'],
  },
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