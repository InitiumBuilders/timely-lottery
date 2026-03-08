export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getReserveStats, setReserveAddress, getSplitHistory } from '@/lib/store';
import { deriveReserveAddress, getAddressInfo } from '@/lib/dash';

export async function GET() {
  try {
    // Ensure reserve address is initialised in store
    const { address: reserveAddr } = deriveReserveAddress();
    setReserveAddress(reserveAddr);

    // Fetch live confirmed on-chain balance from Insight API
    let liveBalance = 0;
    let txCount = 0;
    try {
      const info = await getAddressInfo(reserveAddr);
      if (info) {
        liveBalance = (info.balanceSat || 0) / 1e8;
        txCount     = info.txApperances || info.txApearances || info.transactions?.length || 0;
      }
    } catch { /* network error — return 0 */ }

    const stats       = getReserveStats();
    const splitHistory = getSplitHistory();

    return NextResponse.json({
      reserveAddress:        reserveAddr,
      // On-chain confirmed balance — this is the ONLY balance shown (no pending)
      liveBalance,
      txCount,
      // Cumulative store stats (includes all immediate splits + any lottery-end allocations)
      reserveTotalAllocated: stats.reserveTotalAllocated,
      nextLotteryFundHeld:   stats.nextLotteryFundHeld,
      totalDashProcessed:    stats.totalDashProcessed,
      // Historical records
      allocationHistory:     stats.allocationHistory,  // per-lottery (at payout)
      splitHistory,                                     // per-TX immediate splits
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
