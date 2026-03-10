export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getReserveStats, setReserveAddress, getSplitHistory } from '@/lib/store';
import { deriveReserveAddress, getAddressInfo } from '@/lib/dash';

// Known reserve address — used as fallback when DASH_MNEMONIC is unavailable.
// Balance lookups only need the public address, not the private key.
const KNOWN_RESERVE_ADDRESS = 'XpkRk1Sx2Kq4vMFt9KurpHbj6Yh78sw8uZ';

export async function GET() {
  try {
    // Derive reserve address from mnemonic if available; fall back to known address
    // or RESERVE_ADDRESS env var for balance-only queries (no signing needed).
    let reserveAddr: string;
    try {
      const derived = deriveReserveAddress();
      reserveAddr = derived.address;
    } catch {
      reserveAddr = process.env.RESERVE_ADDRESS || KNOWN_RESERVE_ADDRESS;
    }
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
