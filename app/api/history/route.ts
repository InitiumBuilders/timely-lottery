export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAllLotteries, getEntriesForLottery, getAllWinners } from '@/lib/store';

export async function GET() {
  try {
    const lotteries = getAllLotteries();
    const winners = getAllWinners();

    const history = lotteries.map(lottery => {
      const entries = getEntriesForLottery(lottery.id);
      const winner = winners.find(w => w.lotteryId === lottery.id);
      return {
        id: lottery.id,
        title: lottery.title,
        description: lottery.description,
        status: lottery.status,
        createdAt: lottery.createdAt,
        endTime: lottery.endTime,
        totalDash: lottery.totalDash,
        totalTickets: lottery.totalTickets,
        participantCount: lottery.participantCount || entries.length,
        address: lottery.address,
        winner: winner ? {
          displayName: winner.displayName,
          dashUsername: winner.dashUsername,
          dashWon: winner.dashWon,
          initiumTitle: winner.initiumTitle,
          payoutTxId: winner.payoutTxId,
          timestamp: winner.timestamp,
        } : null,
        entries: entries.map(e => ({
          id: e.id,
          displayName: e.displayName,
          dashUsername: e.dashUsername,
          initiumTitle: e.initiumTitle,
          initiumDescription: e.initiumDescription,
          initiumUrl: e.initiumUrl,
          totalTickets: e.totalTickets,
          dashContributed: e.dashContributed,
          isAnonymous: e.isAnonymous,
          createdAt: e.createdAt,
        })),
      };
    });

    return NextResponse.json({ history });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
