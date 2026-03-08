import { NextRequest, NextResponse } from 'next/server';
import { getAdminSettings, saveAdminSettings } from '@/lib/store';

const ADMIN_PASS = process.env.ADMIN_PASSWORD || '';

// GET removed — all admin requests use POST with password in body (never in URL)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.password !== ADMIN_PASS) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // action=get just reads settings; default updates them
    if (body.action === 'get') {
      return NextResponse.json({ ok: true, settings: getAdminSettings() });
    }

    const current = getAdminSettings();
    const updated = {
      autoAdmin: body.autoAdmin ?? current.autoAdmin,
      autoAdminDurationDays: body.autoAdminDurationDays ?? current.autoAdminDurationDays,
      autoAdminLastStarted: current.autoAdminLastStarted,
    };
    saveAdminSettings(updated);
    return NextResponse.json({ ok: true, settings: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
