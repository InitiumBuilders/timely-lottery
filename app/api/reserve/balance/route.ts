export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

// The reserve address is fixed — derived from the lottery mnemonic at m/44'/5'/5'/0/0.
// We use it directly here so this route works on Vercel (no mnemonic/VPS needed).
const RESERVE_ADDRESS = process.env.RESERVE_ADDRESS || 'XpkRk1Sx2Kq4vMFt9KurpHbj6Yh78sw8uZ';

const INSIGHT_BASE = 'https://insight.dash.org/insight-api';
const INSIGHT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TimelyLottery/1.0)',
  'Accept': 'application/json',
};

async function fetchReserveBalance(): Promise<{ liveBalance: number; txCount: number }> {
  try {
    const res = await fetch(`${INSIGHT_BASE}/addr/${RESERVE_ADDRESS}`, {
      headers: INSIGHT_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) return { liveBalance: 0, txCount: 0 };
    const info = await res.json();
    return {
      liveBalance: (info.balanceSat || 0) / 1e8,
      txCount: info.txApperances || info.txApearances || info.transactions?.length || 0,
    };
  } catch {
    return { liveBalance: 0, txCount: 0 };
  }
}

// Try to load store stats — gracefully fails on Vercel (no persistent filesystem)
async function tryGetStoreStats() {
  try {
    const { getReserveStats, getSplitHistory, setReserveAddress } = await import('@/lib/store');
    setReserveAddress(RESERVE_ADDRESS);
    return {
      stats: getReserveStats(),
      splitHistory: getSplitHistory(),
    };
  } catch {
    // Running on Vercel or store unavailable — return empty stats
    return {
      stats: {
        reserveTotalAllocated: 0,
        nextLotteryFundHeld: 0,
        totalDashProcessed: 0,
        allocationHistory: [],
      },
      splitHistory: [],
    };
  }
}

export async function GET() {
  try {
    const [{ liveBalance, txCount }, { stats, splitHistory }] = await Promise.all([
      fetchReserveBalance(),
      tryGetStoreStats(),
    ]);

    return NextResponse.json({
      reserveAddress:        RESERVE_ADDRESS,
      liveBalance,
      txCount,
      reserveTotalAllocated: stats.reserveTotalAllocated,
      nextLotteryFundHeld:   stats.nextLotteryFundHeld,
      totalDashProcessed:    stats.totalDashProcessed,
      allocationHistory:     stats.allocationHistory,
      splitHistory,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
