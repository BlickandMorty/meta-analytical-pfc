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
      'd3-array': '../node_modules/d3-array',
      'd3-scale': '../node_modules/d3-scale',
      'd3-shape': '../node_modules/d3-shape',
      'd3-brush': '../node_modules/d3-brush',
      'd3-path': '../node_modules/d3-path',
      'd3-format': '../node_modules/d3-format',
      'd3-time': '../node_modules/d3-time',
      'd3-time-format': '../node_modules/d3-time-format',
      'internmap': '../node_modules/internmap',
    },
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            // Report-only CSP: logs violations without breaking the app.
            // Allows inline styles/scripts (Next.js needs them), local resources,
            // and common CDN origins used for fonts/assets.
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:* ws://localhost:* https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.semanticscholar.org",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
