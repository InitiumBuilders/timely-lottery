export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified, dashUsername: user.dashUsername, xHandle: user.xHandle, timelyTruth: user.timelyTruth, avatarUrl: user.avatarUrl },
  });
}
