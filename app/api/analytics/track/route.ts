/**
 * POST /api/analytics/track
 * Receives page-view and time-on-page events from the client tracker.
 * Lightweight, fire-and-forget — always returns { ok: true }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolveCountry, recordPageView } from '@/lib/analytics';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sessionId?: unknown;
      page?: unknown;
      userId?: unknown;
      timeOnPageMs?: unknown;
      prevPage?: unknown;
    };

    const { sessionId, page, userId, timeOnPageMs, prevPage } = body;

    if (
      !sessionId || typeof sessionId !== 'string' ||
      !page      || typeof page      !== 'string'
    ) {
      return NextResponse.json({ ok: false, error: 'bad input' }, { status: 400 });
    }

    // Get real IP from proxy headers (Vercel / nginx both set x-forwarded-for)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const country = await resolveCountry(ip);

    recordPageView({
      sessionId:    sessionId.slice(0, 64),
      page:         page.slice(0, 200),
      userId:       typeof userId === 'string' ? userId : null,
      country,
      timeOnPageMs: typeof timeOnPageMs === 'number' && timeOnPageMs > 0 ? timeOnPageMs : undefined,
      prevPage:     typeof prevPage === 'string' ? prevPage.slice(0, 200) : undefined,
    });

    return NextResponse.json({ ok: true, country });
  } catch (e) {
    // Never crash on analytics errors — just silently fail
    console.error('[analytics/track]', e);
    return NextResponse.json({ ok: true });
  }
}
