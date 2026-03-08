export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { COOKIE_NAME, getSessionUser, generateVerifyToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  if (user.emailVerified) return NextResponse.json({ ok: true, message: 'Email already verified' });

  const verifyToken = generateVerifyToken();
  await prisma.user.update({ where: { id: user.id }, data: { verifyToken } });

  const result = await sendVerificationEmail(user.email, verifyToken);
  if (!result.ok) {
    // Fallback: return the link
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.timely.works';
    const verifyUrl = `${siteUrl}/api/auth/verify-email?token=${verifyToken}`;
    return NextResponse.json({ ok: false, verifyUrl, message: 'Email service not configured' });
  }
  return NextResponse.json({ ok: true, message: 'Verification email sent! Check your inbox.' });
}
