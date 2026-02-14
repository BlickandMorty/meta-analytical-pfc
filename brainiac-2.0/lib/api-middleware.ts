/**
 * API route middleware — auth + rate limiting wrapper.
 *
 * Usage:
 *   export const POST = withMiddleware(handler, { maxRequests: 30, windowMs: 60_000 });
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from './rate-limit';

export interface MiddlewareConfig {
  /** Max requests per window. Default: 30. */
  maxRequests?: number;
  /** Window duration in ms. Default: 60_000 (1 min). */
  windowMs?: number;
  /** Skip auth check. Default: false. */
  skipAuth?: boolean;
}

type RouteHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) => Promise<Response>;

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function checkAuth(request: NextRequest): boolean {
  const token = process.env.PFC_API_TOKEN;
  // No token configured → open access (local dev default)
  if (!token) return true;

  const headerToken = request.headers.get('x-pfc-token');
  if (headerToken === token) return true;

  // Also check cookie for browser-based access
  const cookieToken = request.cookies.get('pfc-auth')?.value;
  if (cookieToken === token) return true;

  return false;
}

export function withMiddleware(
  handler: RouteHandler,
  config: MiddlewareConfig = {},
): RouteHandler {
  const { maxRequests = 30, windowMs = 60_000, skipAuth = false } = config;

  return async (request: NextRequest, context?) => {
    // 1. Auth check
    if (!skipAuth && !checkAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized — set x-pfc-token header or pfc-auth cookie' },
        { status: 401 },
      );
    }

    // 2. Rate limiting
    const ip = getClientIP(request);
    const routeKey = `${ip}:${request.nextUrl.pathname}`;
    const result = checkRateLimit(routeKey, maxRequests, windowMs);

    if (!result.allowed) {
      const retryAfter = Math.ceil(result.resetMs / 1000);
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    // 3. Run handler
    const response = await handler(request, context);

    // Attach rate limit headers to successful responses
    if (response instanceof NextResponse) {
      response.headers.set('X-RateLimit-Limit', String(maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    }

    return response;
  };
}
