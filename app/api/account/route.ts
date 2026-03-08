export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAccountStats, getActiveLottery, getAllLotteries, getAllWinners } from '@/lib/store';

async function handler(username: string) {
  if (!username?.trim()) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }

  const clean = username.trim().replace(/^@/, '');
  const stats  = getAccountStats(clean);
  const active = getActiveLottery();

  if (!stats.entries.length) {
    return NextResponse.json({
      username: clean, found: false,
      totalTickets: 0, totalDash: 0, lotteryCount: 0,
      entries: [], winHistory: [],
    });
  }

  // Get lottery titles for the entry summaries
  const allLotteries = getAllLotteries();
  const lotteryMap = Object.fromEntries(allLotteries.map(l => [l.id, l.title]));

  // Get win history for this username
  const allWinners = getAllWinners();
  const winHistory = allWinners
    .filter(w =>
      w.dashUsername?.toLowerCase().replace(/^@/, '') === clean.toLowerCase() ||
      w.displayName?.toLowerCase() === clean.toLowerCase()
    )
    .map(w => ({
      lotteryId: w.lotteryId,
      lotteryTitle: w.lotteryTitle,
      dashWon: w.dashWon,
      payoutTxId: w.payoutTxId,
      timestamp: w.timestamp,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);

  const entrySummary = stats.entries.map(e => ({
    lotteryId:       e.lotteryId,
    lotteryTitle:    lotteryMap[e.lotteryId] || 'Unknown Lottery',
    initiumTitle:    e.initiumTitle || e.initium,
    tickets:         e.totalTickets,
    dash:            e.dashContributed,
    createdAt:       e.createdAt,
    isCurrentLottery: active ? e.lotteryId === active.id : false,
  }));

  return NextResponse.json({
    username: clean,
    found: true,
    totalTickets:          stats.totalTickets,
    totalDash:             stats.totalDash,
    currentLotteryTickets: stats.currentLotteryTickets,
    lotteryCount:          stats.lotteryCount,
    wins:                  winHistory.length,
    entries:               entrySummary,
    winHistory,
  });
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username') || '';
  return handler(username);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return handler(body.username || '');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
