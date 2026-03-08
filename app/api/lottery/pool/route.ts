export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getActiveLottery, getEntriesForLottery, upsertLottery } from '@/lib/store';
import { getContributions } from '@/lib/dash';

export async function GET() {
  try {
    const lottery = getActiveLottery();
    if (!lottery) {
      return NextResponse.json({ error: 'No active lottery', pool: 0, contributions: [], entries: [] });
    }

    const entries = getEntriesForLottery(lottery.id);
    // initiumSlug is stored directly on each entry (set at submission time).
    // No runtime DB lookup needed — just read (e as any).initiumSlug.

    // NOTE: Per-entry blockchain refresh is intentionally removed here.
    // The /api/lottery/scan route handles all entry updates with correct split TX filtering.
    // Refreshing here would overwrite dashContributed with incorrect totals (includes split change TXs).

    // Get all contributions for the shared lottery address (legacy / extra deposits)
    const sharedContribs = await getContributions(lottery.address).catch(() => []);

    // Recompute lottery totals
    const allEntries = getEntriesForLottery(lottery.id);
    const poolTotal  = allEntries.reduce((s, e) => s + e.dashContributed, 0);
    if (Math.abs(poolTotal - lottery.totalDash) > 0.0001) {
      lottery.totalDash    = poolTotal;
      lottery.totalTickets = allEntries.reduce((s, e) => s + e.totalTickets, 0);
      lottery.participantCount = allEntries.length;
      upsertLottery(lottery);
    }

    return NextResponse.json({
      lotteryId:    lottery.id,
      address:      lottery.address,
      pool:         poolTotal,
      poolDash:     poolTotal,
      totalTickets: lottery.totalTickets,
      contributions: sharedContribs.map(c => ({
        txId:          c.txId,
        from:          c.fromAddress,
        amount:        c.amount,
        tickets:       Math.floor(c.amount / 0.1),
        confirmations: c.confirmations,
        timestamp:     c.timestamp,
      })),
      entries: allEntries.map(e => ({
        // Keep ALL fields from the Entry interface so the frontend doesn't crash
        id:              e.id,
        lotteryId:       e.lotteryId,
        dashAddress:     e.dashAddress,
        dashUsername:    e.dashUsername,
        displayName:        e.displayName || e.dashUsername || `${e.dashAddress?.slice(0, 8) ?? '?'}...`,
        dashEvolutionUsername: e.dashEvolutionUsername,
        initium:            e.initium,
        initiumTitle:       e.initiumTitle,
        initiumDescription: e.initiumDescription,
        initiumUrl:         e.initiumUrl,
        initiumSlug:        (e as any).initiumSlug || undefined,
        isAnonymous:        e.isAnonymous,
        entryAddress:    e.entryAddress,
        entryAddressIndex: e.entryAddressIndex,
        dashContributed: e.dashContributed,
        baseTickets:     e.baseTickets,
        upvoteTickets:   e.upvoteTickets,
        totalTickets:    e.totalTickets,
        verifiedTxIds:   e.verifiedTxIds || [],
        upvoters:        e.upvoters || [],
        upvotedEntries:  e.upvotedEntries || [],
        votusCredits:    e.votusCredits || 0,
        votusSpent:      e.votusSpent || 0,
        votusAvailable:  (e.votusCredits || 0) - (e.votusSpent || 0),
        mediaUrl:        e.mediaUrl,
        mediaType:       e.mediaType,
        createdAt:       e.createdAt,
        winChance:       lottery.totalTickets > 0
          ? ((e.totalTickets / lottery.totalTickets) * 100).toFixed(2) + '%'
          : '0%',
      })),
    });
  } catch (err: unknown) {
    console.error('[pool] Error:', err);
    return NextResponse.json(
      { error: String(err), pool: 0, contributions: [], entries: [] },
      { status: 500 }
    );
  }
}
