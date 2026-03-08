export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/auth?error=invalid-token', req.url));
  const user = await prisma.user.findFirst({ where: { verifyToken: token } });
  if (!user) return NextResponse.redirect(new URL('/auth?error=invalid-token', req.url));
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, verifyToken: null } });
  return NextResponse.redirect(new URL('/profile?verified=1', req.url));
}
