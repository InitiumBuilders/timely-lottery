export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { COOKIE_NAME, getSessionUser, generateVerifyToken, verifyPassword } from '@/lib/auth';
import { Resend } from 'resend';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.timely.works';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { newEmail, currentPassword } = await req.json();
  if (!newEmail || !currentPassword) return NextResponse.json({ error: 'New email and current password required' }, { status: 400 });

  const emailLower = newEmail.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });

  // Verify password
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 });

  // Check not already taken
  const conflict = await prisma.user.findUnique({ where: { email: emailLower } });
  if (conflict) return NextResponse.json({ error: 'That email is already in use' }, { status: 409 });

  const changeToken = generateVerifyToken();
  await prisma.user.update({ where: { id: user.id }, data: { pendingEmail: emailLower, changeEmailToken: changeToken } });

  const confirmUrl = `${SITE_URL}/api/auth/confirm-email-change?token=${changeToken}`;

  // Send confirmation to new email
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.FROM_EMAIL || 'Timely.Works <noreply@unitium.one>';
      await resend.emails.send({
        from, to: emailLower,
        subject: '📧 Confirm your new Timely.Works email',
        html: `<div style="background:#050510;padding:40px;font-family:sans-serif">
          <h2 style="color:#00e5ff">Confirm Email Change</h2>
          <p style="color:rgba(255,255,255,0.6)">Click below to confirm changing your Timely.Works email to <strong style="color:#fff">${emailLower}</strong>:</p>
          <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;background:rgba(0,200,255,0.15);border:1px solid rgba(0,200,255,0.3);border-radius:12px;color:#00dcff;text-decoration:none;font-weight:600;margin:20px 0">Confirm New Email →</a>
          <p style="color:rgba(255,255,255,0.3);font-size:12px">If you didn't request this, ignore this email. Your current email remains unchanged.</p>
        </div>`,
      });
      return NextResponse.json({ ok: true, message: 'Confirmation email sent to your new address.', emailSent: true });
    } catch {
      return NextResponse.json({ ok: true, confirmUrl, message: 'Could not send email — use this link directly:', emailSent: false });
    }
  }
  return NextResponse.json({ ok: true, confirmUrl, message: 'Email service not configured. Use this link:', emailSent: false });
}
