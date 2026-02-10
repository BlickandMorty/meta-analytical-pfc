import type { NextConfig } from 'next';
import path from 'path';

const workspaceRoot = path.resolve(__dirname, '..');

const nextConfig: NextConfig = {
  experimental: {
    // Enable server actions
  },
  // Allow better-sqlite3 to work on the server side
  serverExternalPackages: ['better-sqlite3'],
  // Tell Turbopack the workspace root so it resolves hoisted packages (d3, etc.)
  turbopack: {
    root: workspaceRoot,
    resolveAlias: {
      d3: '../node_modules/d3',
    },
  },
};

export default nextConfig;
