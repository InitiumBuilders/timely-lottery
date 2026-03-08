export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { COOKIE_NAME, getSessionUser, hashPassword, verifyPassword } from '@/lib/auth';
import { sendPasswordChangedEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ user: sanitize(user) });
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { displayName, dashUsername, xHandle, timelyTruth, avatarUrl, currentPassword, newPassword } = body;

  // Build update data
  const data: Record<string, unknown> = {};
  if (displayName !== undefined) data.displayName = displayName?.trim() || null;
  if (dashUsername !== undefined) data.dashUsername = dashUsername?.trim().replace(/^@/, '') || null;
  if (xHandle !== undefined) data.xHandle = xHandle?.trim().replace(/^@/, '') || null;
  if (timelyTruth !== undefined) data.timelyTruth = timelyTruth?.trim() || null;
  if ((body as any).bio !== undefined) data.bio = (body as any).bio?.trim() || null;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;

  // Password change
  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 });
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 });
    if (newPassword.length < 8) return NextResponse.json({ error: 'New password must be 8+ characters' }, { status: 400 });
    data.passwordHash = await hashPassword(newPassword);
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });

  // Notify user of password change
  if (newPassword) {
    sendPasswordChangedEmail(user.email).catch(() => {}); // non-blocking
  }

  return NextResponse.json({ ok: true, user: sanitize(updated as any) });
}

// DELETE — delete account
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.user.delete({ where: { id: user.id } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE_NAME, value: '', maxAge: 0, path: '/' });
  return res;
}

function sanitize(u: any) {
  return { id: u.id, email: u.email, displayName: u.displayName, emailVerified: u.emailVerified, dashUsername: u.dashUsername, xHandle: u.xHandle, timelyTruth: u.timelyTruth, avatarUrl: u.avatarUrl, bio: u.bio, createdAt: u.createdAt };
}
