/**
 * ─── /api/auth/dash-verify ────────────────────────────────────────────────
 *
 * Step 2 of Dash Identity login.
 *
 * POST { nonce, signature, dpnsName }
 * → Verifies signature against the Dash address from the challenge
 * → Creates/updates User account (Dash-only, no password)
 * → Returns session cookie
 *
 * Signature format: Base64-encoded Dash message signature
 * (produced by dashcore-lib Message.sign or any Dash wallet)
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { buildSigningMessage } from '@/lib/dash-auth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dashcore = require('@dashevo/dashcore-lib');
const { Message, Address } = dashcore;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const limit = rateLimit(ip, 'dash-verify', { max: 10, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const nonce     = typeof body.nonce     === 'string' ? body.nonce.trim()     : '';
    const signature = typeof body.signature === 'string' ? body.signature.trim() : '';
    const dpnsName  = typeof body.dpnsName  === 'string' ? body.dpnsName.replace(/^@/, '').toLowerCase().trim() : '';

    if (!nonce || !signature || !dpnsName) {
      return NextResponse.json({ error: 'nonce, signature, and dpnsName are required' }, { status: 400 });
    }

    // Look up challenge
    const challenge = await prisma.dashChallenge.findUnique({ where: { nonce } });
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found or already used' }, { status: 401 });
    }
    if (challenge.expiresAt < new Date()) {
      await prisma.dashChallenge.delete({ where: { nonce } });
      return NextResponse.json({ error: 'Challenge expired. Please request a new one.' }, { status: 401 });
    }
    if (challenge.dpnsName !== dpnsName) {
      return NextResponse.json({ error: 'Username mismatch' }, { status: 401 });
    }

    // Verify signature
    const message = buildSigningMessage(nonce, dpnsName);
    let verified = false;
    try {
      verified = new Message(message).verify(challenge.dashAddress, signature);
    } catch (e) {
      console.error('[dash-verify] Signature verification error:', e);
      return NextResponse.json({ error: 'Invalid signature format' }, { status: 401 });
    }

    if (!verified) {
      return NextResponse.json({ error: 'Signature verification failed. Did you sign with the correct Dash address?' }, { status: 401 });
    }

    // Consume the challenge (one-time use)
    await prisma.dashChallenge.delete({ where: { nonce } });

    // Find or create user by Dash identity ID
    const email = `${dpnsName}.dash@timely.works`; // synthetic email for Dash-only accounts
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { dashIdentityId: challenge.identityId },
          { email },
        ],
      },
    });

    if (!user) {
      // First time login — create account
      user = await prisma.user.create({
        data: {
          email,
          passwordHash:    '', // no password for Dash-only accounts
          emailVerified:   true, // identity verified via cryptographic proof
          dashIdentityId:  challenge.identityId,
          dashIdentityAddr: challenge.dashAddress,
          dashLoginOnly:   true,
          dashUsername:    dpnsName,
          displayName:     `${dpnsName}.dash`,
        },
      });
      console.log(`[dash-verify] ✅ New Dash user created: ${dpnsName}.dash (${challenge.identityId})`);
    } else if (!user.dashIdentityId) {
      // Existing email account — link Dash identity to it
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          dashIdentityId:   challenge.identityId,
          dashIdentityAddr: challenge.dashAddress,
          dashUsername:     user.dashUsername || dpnsName,
        },
      });
      console.log(`[dash-verify] ✅ Linked Dash identity to existing account: ${user.email}`);
    } else {
      // Update address if changed (key rotation)
      if (user.dashIdentityAddr !== challenge.dashAddress) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { dashIdentityAddr: challenge.dashAddress },
        });
      }
    }

    // Create session
    const token = await createSession(user.id);
    const res = NextResponse.json({
      ok: true,
      new: !user.displayName || user.dashLoginOnly,
      user: {
        id:            user.id,
        email:         user.email,
        displayName:   user.displayName,
        dashUsername:  user.dashUsername,
        dashIdentityId: user.dashIdentityId,
        emailVerified: user.emailVerified,
        xHandle:       user.xHandle,
        timelyTruth:   user.timelyTruth,
        avatarUrl:     user.avatarUrl,
        dashLoginOnly: user.dashLoginOnly,
      },
    });
    res.cookies.set(setSessionCookie(token));
    return res;

  } catch (e) {
    console.error('[dash-verify]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
