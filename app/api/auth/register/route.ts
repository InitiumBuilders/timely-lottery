export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, createSession, setSessionCookie, generateVerifyToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    const emailLower = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const verifyToken = generateVerifyToken();
    const user = await prisma.user.create({
      data: { email: emailLower, passwordHash, displayName: displayName?.trim() || null, verifyToken, emailVerified: false },
    });

    const token = await createSession(user.id);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.timely.works';
    const verifyUrl = `${siteUrl}/api/auth/verify-email?token=${verifyToken}`;

    // Send verification email (non-blocking)
    const emailResult = await sendVerificationEmail(emailLower, verifyToken);

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified },
      emailSent: emailResult.ok,
      // Only include verifyUrl if email send failed (fallback for dev/unconfigured)
      ...(emailResult.ok ? {} : { verifyUrl }),
    });
    res.cookies.set(setSessionCookie(token));
    return res;
  } catch (e) {
    console.error('[register]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
