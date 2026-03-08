export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAllWinners } from '@/lib/store';

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const initium = await prisma.initium.findUnique({
    where: { slug: params.slug },
    include: { user: { select: { displayName: true, avatarUrl: true, dashUsername: true } } },
  });
  if (!initium || !initium.isPublic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Increment view count
  await prisma.initium.update({ where: { id: initium.id }, data: { viewCount: { increment: 1 } } });

  // Compute actual lottery winnings for this initium (from winners store)
  let lotteryDashWon = 0;
  let lotteryWins = 0;
  try {
    const winners = getAllWinners();
    const initiumWins = winners.filter(w =>
      (w.initium && w.initium === initium.slug) ||
      (w.initiumTitle && w.initiumTitle === initium.title) ||
      // Also match by dashAddress if the winner received to this initium's address
      (initium.dashAddress && w.dashAddress === initium.dashAddress)
    );
    lotteryDashWon = initiumWins.reduce((sum, w) => sum + (w.dashWon || 0), 0);
    lotteryWins    = initiumWins.length;
  } catch {}

  return NextResponse.json({
    initium: {
      ...initium,
      viewCount: initium.viewCount + 1,
      lotteryDashWon,   // actual DASH won in lotteries
      lotteryWins,      // number of lottery wins
    },
  });
}
