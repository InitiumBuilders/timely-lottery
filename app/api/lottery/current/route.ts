export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getActiveLottery, getEntriesForLottery } from '@/lib/store';

// Fast endpoint — returns state from store immediately (no blockchain call)
// Use /api/lottery/pool for live blockchain balance
export async function GET() {
  try {
    const lottery = getActiveLottery();
    if (!lottery) {
      return NextResponse.json({ lottery: null, entries: [], poolDash: 0 });
    }
    const rawEntries = getEntriesForLottery(lottery.id);
    // Strip private fields before sending to the client — never expose deposit addresses
    const entries = rawEntries.map(({ entryAddress: _ea, entryAddressIndex: _eai, splitTxIds: _sp, verifiedTxIds: _vt, ...safe }) => safe);
    return NextResponse.json({ lottery, entries, poolDash: lottery.totalDash });
  } catch (err: unknown) {
    console.error('[current] Error:', err);
    return NextResponse.json(
      { error: String(err), lottery: null, entries: [], poolDash: 0 },
      { status: 500 }
    );
  }
}
