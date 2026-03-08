export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';
import { getActiveLottery, getEntriesForLottery } from '@/lib/store';

/**
 * GET /api/entry/my
 * Returns the logged-in user's entry (or entries) in the active lottery.
 * Used by the lottery page to enable the Votus voting button for logged-in users.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await getSessionUser(token) : null;

  if (!user) {
    return NextResponse.json({ entry: null, votusAvailable: 0 });
  }

  const lottery = getActiveLottery();
  if (!lottery) {
    return NextResponse.json({ entry: null, votusAvailable: 0 });
  }

  const entries = getEntriesForLottery(lottery.id);

  // Find user's entry: match by userId, email (display name), or dashUsername
  const myEntry = entries.find(e =>
    (e as any).userId === user.id ||
    (user.dashUsername && e.dashUsername?.toLowerCase() === user.dashUsername.toLowerCase()) ||
    (user.displayName && e.displayName?.toLowerCase() === user.displayName.toLowerCase())
  );

  if (!myEntry) {
    return NextResponse.json({ entry: null, votusAvailable: 0 });
  }

  // Votus only valid for the CURRENT active lottery — never rolls over
  const votusAvailable = myEntry.lotteryId === lottery.id
    ? Math.max(0, (myEntry.votusCredits || 0) - (myEntry.votusSpent || 0))
    : 0;

  return NextResponse.json({
    entry: {
      id: myEntry.id,
      displayName: myEntry.displayName,
      entryAddress: myEntry.entryAddress,
      dashContributed: myEntry.dashContributed,
      totalTickets: myEntry.totalTickets,
      votusCredits: myEntry.votusCredits,
      votusSpent: myEntry.votusSpent,
      votusAvailable,
      verifiedTxIds: myEntry.verifiedTxIds || [],
    },
    votusAvailable,
  });
}
