/**
 * ─── middleware.ts ─ Vercel Edge Proxy ───────────────────────────────────────
 *
 * PURPOSE: When deployed on Vercel, all /api/* requests are proxied to the VPS
 * backend. Pages are served from Vercel CDN; API logic runs on VPS.
 *
 * WHY: The JSON store, SQLite DB, uploads, and DASH wallet only exist on VPS.
 * Vercel serverless functions would be stateless and lose data between requests.
 *
 * CRITICAL AUTH HEADERS — do not remove these without understanding the impact:
 *
 *   REQUEST  → VPS: forward 'cookie' header
 *     Without this: VPS never sees the session token → every auth check fails
 *     → user appears logged out even after successful login
 *
 *   RESPONSE → Browser: forward 'set-cookie' header
 *     Without this: login/register cookies never reach the browser
 *     → login page appears "frozen" (redirects to /account, which 401s, loops back)
 *
 * ARCHITECTURE:
 *   Browser → Vercel Edge (this middleware) → VPS :3000 → Next.js API handler
 *
 * VPS URL: Uses sslip.io DNS trick to give the VPS a stable hostname
 *   (Vercel edge cannot fetch raw IPs — requires a hostname)
 *   e.g. http://187.77.3.35.sslip.io:3000
 *
 * LOCAL DEV: process.env.VERCEL !== '1' → middleware is bypassed,
 *   API routes run locally as normal Next.js handlers.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  if (process.env.VERCEL !== '1') return NextResponse.next();

  // ── Reserve balance is served directly by Vercel (no VPS needed) ──────────
  // The live balance only requires a public Insight API call — no persistent
  // store or wallet needed. Bypassing VPS proxy so it always works even when
  // VPS env vars (DASH_MNEMONIC) are not configured.
  if (request.nextUrl.pathname === '/api/reserve/balance') {
    return NextResponse.next();
  }

  const VPS = process.env.VPS_URL || 'http://187.77.3.35.sslip.io:3000';
  const url = `${VPS}${request.nextUrl.pathname}${request.nextUrl.search}`;

  try {
    const isReadOnly = request.method === 'GET' || request.method === 'HEAD';

    const upstream = await fetch(url, {
      method:  request.method,
      headers: {
        'content-type':    request.headers.get('content-type') || 'application/json',
        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
        'user-agent':      request.headers.get('user-agent') || '',
        // ✅ Forward session cookie so VPS can authenticate the user
        'cookie':          request.headers.get('cookie') || '',
      },
      body: isReadOnly ? undefined : request.body,
      // @ts-ignore — needed for body streaming on edge
      duplex: isReadOnly ? undefined : 'half',
    });

    const body = await upstream.arrayBuffer();

    const res = new NextResponse(body, {
      status:  upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });

    // ✅ Forward Set-Cookie from VPS so the browser actually stores the session
    // Without this: login works on VPS but cookie never reaches browser on Vercel
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) {
      res.headers.set('set-cookie', setCookie);
    }

    return res;

  } catch (err) {
    console.error('[middleware] VPS proxy failed:', err);
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}

export const config = {
  matcher: '/api/:path*',
};
