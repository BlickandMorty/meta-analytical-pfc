import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  experimental: {
    // Enable server actions
  },
  // Allow better-sqlite3 to work on the server side
  serverExternalPackages: ['better-sqlite3'],
  // Tell Turbopack the workspace root so it resolves hoisted packages (d3, etc.)
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
};

export default nextConfig;
