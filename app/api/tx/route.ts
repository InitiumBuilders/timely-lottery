export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveLottery, getEntryByAddress, getEntryByDepositAddress,
  upsertEntry, getLottery, getEntriesForLottery, upsertLottery
} from '@/lib/store';
import { getContributions, verifyTxById } from '@/lib/dash';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dashAddress, txId } = body;

    const lottery = getActiveLottery();
    if (!lottery) {
      return NextResponse.json({ error: 'No active lottery', message: 'No active lottery found.' });
    }

    // ── Find entry ────────────────────────────────────────────────────────────
    const entry = dashAddress
      ? (getEntryByAddress(lottery.id, dashAddress) ?? getEntryByDepositAddress(dashAddress))
      : null;

    if (!entry) {
      return NextResponse.json({ message: 'No entry found for that address. Register first.' });
    }

    const refreshPool = () => {
      try {
        const l = getLottery(lottery.id);
        if (!l) return;
        const entries = getEntriesForLottery(lottery.id);
        l.totalDash      = entries.reduce((s, e) => s + e.dashContributed, 0);
        l.totalTickets   = entries.reduce((s, e) => s + e.totalTickets, 0);
        l.participantCount = entries.length;
        upsertLottery(l);
      } catch { /* non-fatal */ }
    };

    // ── Mode 1: TX ID paste ───────────────────────────────────────────────────
    if (txId) {
      const result = await verifyTxById(txId, entry.entryAddress);

      if (!result.valid) {
        return NextResponse.json({
          entry,
          message: `❌ TX not found or doesn't send DASH to your unique deposit address. Make sure you sent to: ${entry.entryAddress.slice(0, 12)}...`,
        });
      }
      if (result.confirmations < 1) {
        return NextResponse.json({
          entry,
          message: `⏳ TX found but 0 confirmations yet — Dash confirms in ~1 min. Try again shortly.`,
        });
      }

      if (!entry.verifiedTxIds.includes(result.txId)) {
        entry.verifiedTxIds = Array.from(new Set(entry.verifiedTxIds.concat([result.txId])));
        // Recompute from VERIFIED user deposits only (exclude our own split change TXs)
        const splitTxIds: string[] = (entry as any).splitTxIds || [];
        try {
          const allContribs = await getContributions(entry.entryAddress);
          const userContribs = allContribs.filter(c =>
            entry.verifiedTxIds.includes(c.txId) && !splitTxIds.includes(c.txId)
          );
          const total = userContribs.reduce((s, c) => s + c.amount, 0);
          entry.dashContributed = total;
          entry.baseTickets     = Math.floor(Math.round(total * 1e8) / 1e7);
        } catch {
          entry.dashContributed += result.amount;
          entry.baseTickets      = Math.floor(Math.round(entry.dashContributed * 1e8) / 1e7);
        }
        entry.totalTickets = entry.baseTickets + entry.upvoteTickets;
        upsertEntry(entry);
        refreshPool();
      }

      return NextResponse.json({
        entry,
        verified: true,
        amount:        result.amount,
        confirmations: result.confirmations,
        message: `✅ ${result.amount.toFixed(4)} DASH confirmed (${result.confirmations} block${result.confirmations === 1 ? '' : 's'})! You now have ${entry.baseTickets} ticket${entry.baseTickets === 1 ? '' : 's'}.`,
      });
    }

    // ── Mode 2: Auto-scan the entry's unique deposit address ─────────────────
    const contribs = await getContributions(entry.entryAddress);
    if (contribs.length === 0) {
      return NextResponse.json({
        entry,
        message: `⏳ No transactions at your deposit address yet. Send DASH and wait ~1 minute.`,
      });
    }

    // Exclude our own split change TXs from the contribution total
    const splitTxIds: string[] = (entry as any).splitTxIds || [];
    const userContribs = contribs.filter(c => !splitTxIds.includes(c.txId));
    const total    = userContribs.reduce((s, c) => s + c.amount, 0);
    const newTxIds = userContribs
      .filter(c => !entry.verifiedTxIds.includes(c.txId))
      .map(c => c.txId);

    entry.dashContributed = total;
    entry.baseTickets     = Math.floor(Math.round(total * 1e8) / 1e7);
    entry.totalTickets    = entry.baseTickets + entry.upvoteTickets;
    entry.verifiedTxIds   = Array.from(new Set(entry.verifiedTxIds.concat(newTxIds)));
    upsertEntry(entry);
    refreshPool();

    return NextResponse.json({
      entry,
      newTxCount: newTxIds.length,
      message: `✅ ${entry.baseTickets} ticket${entry.baseTickets === 1 ? '' : 's'} confirmed from ${total.toFixed(4)} DASH!`,
    });
  } catch (err: unknown) {
    console.error('[tx] Error:', err);
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
