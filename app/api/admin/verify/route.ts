import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/verify
 * Server-side password verification — keeps the admin password out of the client bundle.
 * Returns {ok: true} on success so the client knows to show the admin panel.
 */
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const adminPass = process.env.ADMIN_PASSWORD || '';
  if (password !== adminPass) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
