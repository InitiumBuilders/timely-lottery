export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getEntry, upsertEntry, getLottery } from '@/lib/store';
import { getContributions } from '@/lib/dash';
import { ticketsForDash } from '@/lib/ticket-utils';

/**
 * GET /api/entry/status?entryId=xxx
 *
 * Live status check for a specific entry's deposit address.
 * - Calls Dash Insight API directly for this entry's unique address
 * - Updates the entry in the store if new DASH found
 * - Returns current contribution + ticket count
 * Used by the "You're In!" success screen to poll every 5s
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get('entryId');
  if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 });

  const entry = getEntry(entryId);
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

  // Helper: return stored state without scanning
  const storedState = () => NextResponse.json({
    entryId:          entry.id,
    depositAddress:   entry.entryAddress,
    dashContributed:  entry.dashContributed,
    baseTickets:      entry.baseTickets,
    totalTickets:     entry.totalTickets,
    votusAvailable:   entry.votusAvailable,
    verifiedTxIds:    entry.verifiedTxIds || [],
    lastUpdated:      Date.now(),
    scanned:          false,
  });

  // If entry has no unique deposit address, return current state without scanning
  if (!entry.entryAddress || entry.entryAddress === entry.dashAddress) return storedState();

  // CRITICAL: Anonymous entries all share the lottery pool address.
  // Scanning the lottery address for one anon entry would count ALL other users' TXs as "new".
  // Never scan anon entries — their dashContributed is set once at creation by the scan route.
  if ((entry as any).isAnonymous) return storedState();

  // Also guard: if entryAddress equals the lottery pool address, don't scan (same issue)
  const lotteryForEntry = getLottery(entry.lotteryId);
  if (lotteryForEntry && entry.entryAddress === lotteryForEntry.address) return storedState();

  try {
    // Hit blockchain directly for this specific entry's address
    const contribs = await getContributions(entry.entryAddress);
    const confirmedContribs = contribs.filter(c => c.confirmations >= 1);
    const pendingContribs   = contribs.filter(c => c.confirmations === 0);

    // CRITICAL: exclude our own split transactions from contribution total.
    // Split change TXs go back to the entry address — must not be double-counted.
    const splitTxIds = (entry as any).splitTxIds || [];

    // Only count TXs that are verified user deposits OR genuinely new (not split TXs)
    const verifiedContribs = confirmedContribs.filter(c =>
      (entry.verifiedTxIds || []).includes(c.txId) && !splitTxIds.includes(c.txId)
    );
    const newTxIds = confirmedContribs
      .filter(c => !splitTxIds.includes(c.txId) && !(entry.verifiedTxIds || []).includes(c.txId))
      .map(c => c.txId);
    const newContribs = confirmedContribs.filter(c => newTxIds.includes(c.txId));

    const confirmedTotal = verifiedContribs.reduce((s, c) => s + c.amount, 0)
                         + newContribs.reduce((s, c) => s + c.amount, 0);
    const pendingTotal   = pendingContribs
      .filter(c => !splitTxIds.includes(c.txId))
      .reduce((s, c) => s + c.amount, 0);

    const hasNewDash = newTxIds.length > 0;

    if (hasNewDash) {
      // Update entry with new contributions ONLY (never re-sum from blockchain totals)
      entry.dashContributed = confirmedTotal;
      entry.baseTickets     = ticketsForDash(confirmedTotal);
      entry.totalTickets    = entry.baseTickets + (entry.upvoteTickets || 0);
      entry.verifiedTxIds   = Array.from(new Set([...(entry.verifiedTxIds || []), ...newTxIds]));
      entry.votusCredits    = entry.baseTickets;
      entry.votusSpent      = entry.votusSpent || 0;
      entry.votusAvailable  = entry.votusCredits - entry.votusSpent;
      upsertEntry(entry);

      // Update lottery totals
      const lottery = getLottery(entry.lotteryId);
      if (lottery) {
        const { getEntriesForLottery, upsertLottery } = await import('@/lib/store');
        const allEntries = getEntriesForLottery(lottery.id);
        lottery.totalDash    = allEntries.reduce((s, e) => s + (e.dashContributed || 0), 0);
        lottery.totalTickets = allEntries.reduce((s, e) => s + (e.totalTickets || 0), 0);
        upsertLottery(lottery);
      }
    }

    return NextResponse.json({
      entryId:          entry.id,
      depositAddress:   entry.entryAddress,
      dashContributed:  entry.dashContributed,
      baseTickets:      entry.baseTickets,
      totalTickets:     entry.totalTickets,
      votusAvailable:   entry.votusAvailable,
      verifiedTxIds:    entry.verifiedTxIds || [],
      pendingDash:      pendingTotal,
      pendingTxs:       pendingContribs.length,
      newDashDetected:  hasNewDash,
      lastUpdated:      Date.now(),
      scanned:          true,
    });
  } catch (err) {
    // On scan error, still return current stored state
    return NextResponse.json({
      entryId:         entry.id,
      depositAddress:  entry.entryAddress,
      dashContributed: entry.dashContributed,
      baseTickets:     entry.baseTickets,
      totalTickets:    entry.totalTickets,
      votusAvailable:  entry.votusAvailable,
      verifiedTxIds:   entry.verifiedTxIds || [],
      lastUpdated:     Date.now(),
      scanned:         false,
      scanError:       err instanceof Error ? err.message : String(err),
    });
  }
}
