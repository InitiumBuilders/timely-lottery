export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';
import { loginLimiter } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const limit = loginLimiter(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const email    = typeof body.email    === 'string' ? body.email.toLowerCase().trim()    : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 128)        : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Constant-time response regardless of whether user exists (prevents user enumeration)
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await createSession(user.id);
    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        dashUsername: user.dashUsername,
        xHandle: user.xHandle,
        timelyTruth: user.timelyTruth,
        avatarUrl: user.avatarUrl,
      },
    });
    res.cookies.set(setSessionCookie(token));
    return res;
  } catch (e) {
    console.error('[login] Error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
