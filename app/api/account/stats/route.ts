export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';
import { getAllLotteries, getAllEntries } from '@/lib/store';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Pull all entries linked to this user (by userId or dashUsername)
  const allEntries = getAllEntries();
  const myEntries = allEntries.filter(e =>
    (e as any).userId === user.id ||
    (user.dashUsername && e.dashUsername?.toLowerCase() === user.dashUsername.toLowerCase())
  );

  const totalDashContributed  = myEntries.reduce((s, e) => s + (e.dashContributed || 0), 0);
  const totalTicketsEarned    = myEntries.reduce((s, e) => s + (e.baseTickets || 0), 0);
  const totalVotusEarned      = myEntries.reduce((s, e) => s + (e.votusCredits || 0), 0);
  // Lifetime Votus SENT to initiums (allocated/voted) — not available balance
  const totalVotusAllocated   = myEntries.reduce((s, e) => s + (e.votusSpent || 0), 0);

  // Current Votus available = only if entry is in the ACTIVE lottery
  const activeLottery_ = getAllLotteries().find(l => l.status === 'active');
  const totalVotusAvailable = activeLottery_
    ? myEntries
        .filter(e => e.lotteryId === activeLottery_.id)
        .reduce((s, e) => s + Math.max(0, (e.votusCredits || 0) - (e.votusSpent || 0)), 0)
    : 0;

  // Lotteries entered (unique)
  const lotteriesEntered = new Set(myEntries.map(e => e.lotteryId)).size;

  // Check if won any lotteries
  const allLotteries = getAllLotteries();
  const wonLotteries = allLotteries.filter(l =>
    myEntries.some(e => e.id === l.winnerId || e.lotteryId === l.id && l.winnerId && myEntries.find(me => me.id === l.winnerId))
  );
  const totalDashWon = wonLotteries.reduce((s, l) => s + (l.winnerDash || 0), 0);

  // Initiums created
  const initiumCount = await prisma.initium.count({ where: { userId: user.id } });

  return NextResponse.json({
    stats: {
      totalDashContributed: Math.round(totalDashContributed * 10000) / 10000,
      totalDashWon: Math.round(totalDashWon * 10000) / 10000,
      totalTicketsEarned,
      totalVotusEarned,
      totalVotusAllocated,   // lifetime Votus SENT to initiums
      totalVotusAvailable,   // current lottery only; 0 if no active lottery
      lotteriesEntered,
      initiumCount,
      entriesThisLottery: myEntries.filter(e => {
        const lotteries = allLotteries.filter(l => l.status === 'active');
        return lotteries.some(l => l.id === e.lotteryId);
      }).length,
    },
    entries: myEntries.map(e => ({
      id: e.id, lotteryId: e.lotteryId, dashContributed: e.dashContributed,
      totalTickets: e.totalTickets, votusCredits: e.votusCredits,
      votusAvailable: (e.votusCredits || 0) - (e.votusSpent || 0),
      displayName: e.displayName, initiumTitle: e.initiumTitle, createdAt: e.createdAt,
    })),
  });
}
