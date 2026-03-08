import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { upsertLottery, getNextAddressIndex, getActiveLottery, getReserveStats } from '@/lib/store';
import { deriveLotteryAddress, sweepNextLotteryFundsToLottery } from '@/lib/dash';
import { publishLottery } from '@/lib/platform';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, title, description, durationMinutes } = body;

    const adminPass = process.env.ADMIN_PASSWORD || '';
    if (password !== adminPass) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = getActiveLottery();
    if (existing) {
      return NextResponse.json({ error: 'A lottery is already active. End it first.' }, { status: 400 });
    }

    const addressIndex = getNextAddressIndex();
    let address: string;
    try {
      const derived = deriveLotteryAddress(addressIndex);
      address = derived.address;
    } catch (err: unknown) {
      console.error('[create] deriveLotteryAddress failed:', err);
      return NextResponse.json(
        { error: `Address generation failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 }
      );
    }

    const now = Date.now();
    const id  = nanoid(10);
    const dur = Number(durationMinutes) || 60;

    const lottery = {
      id, title: title?.trim() || 'Timely Lottery',
      description: description?.trim() || 'Submit your Initium. Buy tickets with $DASH. One winner takes all.',
      address, addressIndex, status: 'active' as const,
      durationMinutes: dur, startTime: now, endTime: now + dur * 60 * 1000,
      totalDash: 0, totalTickets: 0, participantCount: 0, createdAt: now,
    };

    upsertLottery(lottery);
    console.log('[create] Lottery created:', lottery.id, lottery.address);

    // ── Publish to Dash Drive (fire-and-forget, graceful degradation) ──────────
    publishLottery(lottery).catch(e => console.error('[platform] publishLottery:', e));

    // ── Sweep accumulated 5% next-lottery funds into this new lottery ──────────
    // Non-blocking: lottery is already active, sweep runs async in background
    const maxIdx = getReserveStats().nextLotteryFundAddressIndex || 0;
    if (maxIdx > 0) {
      sweepNextLotteryFundsToLottery(address, maxIdx).then(result => {
        if (result.totalSwept > 0) {
          console.log(`[create] ✅ Seeded ${result.totalSwept.toFixed(4)} DASH into new lottery from next-lottery funds. TXs: ${result.txIds.join(', ')}`);
          // Update lottery totalDash with seeded amount
          const { getLottery, upsertLottery: ul } = require('@/lib/store');
          const fresh = getLottery(id);
          if (fresh) { fresh.seededDash = result.totalSwept; ul(fresh); }
        }
        if (result.errors.length) console.warn('[create] Seed sweep errors:', result.errors);
      }).catch(e => console.error('[create] Seed sweep failed:', e));
    }

    return NextResponse.json({ lottery, seedingStarted: maxIdx > 0 });
  } catch (err: unknown) {
    console.error('[create] Unexpected error:', err);
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
