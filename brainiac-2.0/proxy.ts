import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter
// ---------------------------------------------------------------------------

const RATE_LIMIT = 60; // requests
const WINDOW_MS = 60 * 1000; // 1 minute
const API_TOKEN = process.env.PFC_API_TOKEN?.trim() || '';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
let requestCounter = 0;

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

function getClientIdentity(request: NextRequest): string {
  const authHeader = request.headers.get('authorization') || '';
  if (API_TOKEN && authHeader.startsWith('Bearer ') && authHeader.slice(7).trim() === API_TOKEN) {
    return 'authenticated';
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return realIp || forwarded || 'anonymous';
}

function getClientKey(request: NextRequest): string {
  const identity = getClientIdentity(request);
  const pathname = request.nextUrl.pathname;
  // Keep a shared bucket for research tool actions.
  const routeBucket = pathname.startsWith('/api/research/') ? '/api/research' : pathname;
  return `${identity}:${routeBucket}`;
}

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();

  // Periodic cleanup every 100 requests to prevent memory leak
  requestCounter++;
  if (requestCounter % 100 === 0) {
    cleanupExpiredEntries();
  }

  const entry = rateLimitMap.get(clientKey);

  if (!entry || now > entry.resetTime) {
    // First request in this window or window expired -- start fresh
    rateLimitMap.set(clientKey, { count: 1, resetTime: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Security headers applied to every response
// ---------------------------------------------------------------------------

const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: ws: wss: http://localhost:* http://127.0.0.1:*; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; worker-src 'self' blob:;",
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  if (!API_TOKEN) return true;
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const supplied = authHeader.slice(7).trim();
  return supplied.length > 0 && supplied === API_TOKEN;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate-limit API routes only
  const isApiRoute = pathname.startsWith('/api/');

  if (isApiRoute) {
    if (!isAuthorized(request)) {
      const unauthorized = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
      unauthorized.headers.set('WWW-Authenticate', 'Bearer');
      return applySecurityHeaders(unauthorized);
    }

    const clientKey = getClientKey(request);
    if (isRateLimited(clientKey)) {
      const errorResponse = NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
      errorResponse.headers.set('Retry-After', '60');
      return applySecurityHeaders(errorResponse);
    }
  }

  // Pass through with security headers
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

// ---------------------------------------------------------------------------
// Matcher -- all routes except static assets
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
