export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/account?error=invalid-token', req.url));

  const user = await prisma.user.findFirst({ where: { changeEmailToken: token } });
  if (!user || !user.pendingEmail) return NextResponse.redirect(new URL('/account?error=invalid-token', req.url));

  await prisma.user.update({
    where: { id: user.id },
    data: { email: user.pendingEmail, pendingEmail: null, changeEmailToken: null, emailVerified: true },
  });
  return NextResponse.redirect(new URL('/account?emailChanged=1', req.url));
}
