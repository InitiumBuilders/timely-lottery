/**
 * ─── /api/auth/dash-sign ──────────────────────────────────────────────────
 *
 * Helper endpoint: signs a message with a provided WIF key.
 * The WIF is used once and immediately discarded — never stored.
 * Sent over HTTPS only. For production, use a hardware wallet or DashPay.
 *
 * POST { wif: string, message: string }
 * → { signature: string }
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/ratelimit';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dashcore = require('@dashevo/dashcore-lib');
const { Message, PrivateKey } = dashcore;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const limit = rateLimit(ip, 'dash-sign', { max: 10, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = await req.json();
    const wif     = typeof body.wif     === 'string' ? body.wif.trim()     : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!wif || !message) {
      return NextResponse.json({ error: 'wif and message required' }, { status: 400 });
    }
    if (message.length > 500) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    // Sign — WIF is used here and immediately goes out of scope
    const privKey   = PrivateKey.fromWIF(wif);
    const signature = new Message(message).sign(privKey);

    // privKey and wif are now eligible for GC — never stored
    return NextResponse.json({ ok: true, signature });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('WIF') || msg.includes('base58') || msg.includes('checksum')) {
      return NextResponse.json({ error: 'Invalid WIF key format' }, { status: 400 });
    }
    console.error('[dash-sign]', msg);
    return NextResponse.json({ error: 'Signing failed' }, { status: 500 });
  }
}
