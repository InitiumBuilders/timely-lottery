export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTotalStats, getAllLotteries, getAllWinners, getActiveLottery } from '@/lib/store';
import { buildStats } from '@/lib/lottery';

export async function GET() {
  const stats    = getTotalStats();
  const lotteries = getAllLotteries();
  const winners  = getAllWinners();
  const detailed = buildStats();

  // Enrich with live active lottery data
  const active = getActiveLottery();
  if (active) {
    (stats as Record<string, unknown>).currentPool    = active.totalDash;
    (stats as Record<string, unknown>).currentEndTime = active.endTime;
    (stats as Record<string, unknown>).currentTickets = active.totalTickets;
  }

  return NextResponse.json({ stats, lotteries, winners, detailed });
}
