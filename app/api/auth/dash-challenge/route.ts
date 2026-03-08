/**
 * ─── /api/auth/dash-challenge ─────────────────────────────────────────────
 * Step 1 of Dash Identity login.
 * POST { dpnsName: "august" }
 * → Looks up identity on Dash Platform via DPNS
 * → Generates a signing challenge nonce (expires in 5 min)
 * → Returns nonce + dashAddress for the user to sign
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/db';
import { resolveDashUsername } from '@/lib/dpns';
import { rateLimit } from '@/lib/ratelimit';
import { buildSigningMessage } from '@/lib/dash-auth';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const limit = rateLimit(ip, 'dash-challenge', { max: 10, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const dpnsName = typeof body.dpnsName === 'string'
      ? body.dpnsName.replace(/^@/, '').replace(/\.dash$/, '').toLowerCase().trim()
      : '';

    if (!dpnsName || dpnsName.length < 3) {
      return NextResponse.json({ error: 'Valid Dash username required (e.g. august)' }, { status: 400 });
    }

    // Resolve DPNS name → identity + address on Dash Platform
    const resolved = await resolveDashUsername(dpnsName);
    if (!resolved.found || !resolved.identityId || !resolved.dashAddress) {
      return NextResponse.json({
        error: `Dash username "${dpnsName}" not found on Dash Platform`,
        dpnsName,
      }, { status: 404 });
    }

    // Generate a unique nonce
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.dashChallenge.create({
      data: { nonce, dpnsName, identityId: resolved.identityId, dashAddress: resolved.dashAddress, expiresAt },
    });

    // Clean up expired challenges
    await prisma.dashChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });

    const message = buildSigningMessage(nonce, dpnsName);

    return NextResponse.json({
      ok: true, nonce, dpnsName,
      dashAddress: resolved.dashAddress,
      identityId:  resolved.identityId,
      message,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    console.error('[dash-challenge]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
