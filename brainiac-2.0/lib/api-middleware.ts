/**
 * API route middleware — per-route rate limiting wrapper.
 *
 * Auth is now handled at the edge by middleware.ts (see project root).
 * This module only handles rate limiting, which varies per route.
 *
 * Usage:
 *   export const POST = withRateLimit(handler, { maxRequests: 30, windowMs: 60_000 });
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from './rate-limit';

export interface RateLimitConfig {
  /** Max requests per window. Default: 30. */
  maxRequests?: number;
  /** Window duration in ms. Default: 60_000 (1 min). */
  windowMs?: number;
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

export function withRateLimit(
  handler: RouteHandler,
  config: RateLimitConfig = {},
): RouteHandler {
  const { maxRequests = 30, windowMs = 60_000 } = config;

  return async (request: NextRequest, context?) => {
    // Rate limiting
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

    // Run handler
    const response = await handler(request, context);

    // Attach rate limit headers to successful responses
    if (response instanceof NextResponse) {
      response.headers.set('X-RateLimit-Limit', String(maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    }

    return response;
  };
}

/**
 * @deprecated Use `withRateLimit` instead. Auth is now handled by edge middleware.
 * Kept as an alias for backward compatibility during migration.
 */
export const withMiddleware = withRateLimit;
