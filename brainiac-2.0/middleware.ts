/**
 * Next.js Edge Middleware — Authentication gate for all API routes.
 *
 * Runs in the Edge Runtime before the request reaches the route handler.
 * When PFC_API_TOKEN is set, every API request must present the token
 * via the `x-pfc-token` header or the `pfc-auth` cookie.
 *
 * If PFC_API_TOKEN is not set, all requests pass through (local-first model).
 *
 * Rate limiting remains per-route via `withRateLimit` in lib/api-middleware.ts.
 */

import { NextResponse, type NextRequest } from 'next/server';

/**
 * Constant-time string comparison for Edge Runtime.
 * `crypto.timingSafeEqual` is not available in Edge Runtime,
 * so we use a manual XOR-based comparison.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

export function middleware(request: NextRequest) {
  const token = process.env.PFC_API_TOKEN;

  // No token configured → open access (local-first default)
  if (!token) return NextResponse.next();

  const headerToken = request.headers.get('x-pfc-token');
  const cookieToken = request.cookies.get('pfc-auth')?.value;
  const providedToken = headerToken ?? cookieToken;

  if (!providedToken || !timingSafeEqual(token, providedToken)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/(chat)/api/:path*'],
};
