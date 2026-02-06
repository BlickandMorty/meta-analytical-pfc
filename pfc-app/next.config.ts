import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Enable server actions
  },
  // Allow better-sqlite3 to work on the server side
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
