export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveLottery, getEntriesForLottery, upsertLottery } from '@/lib/store';
import fs from 'fs';
import path from 'path';

const DATA_DIR  = process.env.LOTTERY_DATA_DIR || '/root/.openclaw/workspace/timely-lottery-data';
const DATA_FILE = path.join(DATA_DIR, 'store.json');

export async function POST(req: NextRequest) {
  try {
    const { password, entryId } = await req.json();

    if (password !== (process.env.ADMIN_PASSWORD || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!entryId) {
      return NextResponse.json({ error: 'entryId required' }, { status: 400 });
    }

    // Load raw store
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);

    if (!data.entries[entryId]) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const lotteryId = data.entries[entryId].lotteryId;
    delete data.entries[entryId];

    // Recalculate lottery stats
    const lotteryEntries = Object.values(data.entries as Record<string, { lotteryId: string; dashContributed: number; totalTickets: number }>)
      .filter((e) => e.lotteryId === lotteryId);

    if (data.lotteries[lotteryId]) {
      data.lotteries[lotteryId].totalDash        = lotteryEntries.reduce((s, e) => s + (e.dashContributed || 0), 0);
      data.lotteries[lotteryId].totalTickets      = lotteryEntries.reduce((s, e) => s + (e.totalTickets || 0), 0);
      data.lotteries[lotteryId].participantCount  = lotteryEntries.length;
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ ok: true, message: `Entry ${entryId} deleted` });
  } catch (err: unknown) {
    console.error('[delete] Error:', err);
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
