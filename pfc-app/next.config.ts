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
      'd3-force': '../node_modules/d3-force',
      'd3-selection': '../node_modules/d3-selection',
      'd3-zoom': '../node_modules/d3-zoom',
      'd3-drag': '../node_modules/d3-drag',
      'd3-dispatch': '../node_modules/d3-dispatch',
      'd3-timer': '../node_modules/d3-timer',
      'd3-ease': '../node_modules/d3-ease',
      'd3-interpolate': '../node_modules/d3-interpolate',
      'd3-color': '../node_modules/d3-color',
      'd3-transition': '../node_modules/d3-transition',
      'd3-quadtree': '../node_modules/d3-quadtree',
    },
  },
};

export default nextConfig;
