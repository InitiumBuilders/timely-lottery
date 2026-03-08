export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, deleteSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token) await deleteSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE_NAME, value: '', maxAge: 0, path: '/' });
  return res;
}
