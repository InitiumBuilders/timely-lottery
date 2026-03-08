export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const initiums = await prisma.initium.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ initiums });
}
