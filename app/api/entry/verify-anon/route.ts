export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import {
  getActiveLottery, getLottery, getEntriesForLottery,
  getEntry, upsertEntry, upsertLottery
} from '@/lib/store';
import { verifyTxById } from '@/lib/dash';
import { ticketsForDash, votusForTickets, totalTickets } from '@/lib/ticket-utils';

/**
 * POST /api/entry/verify-anon
 * Verify a TX hash and credit the matching entry.
 *
 * Works for THREE cases:
 *  1. TX sent to the main lottery address → creates anonymous entry
 *  2. TX sent to an entry's unique deposit address → updates that existing entry
 *  3. Caller passes entryId → verify against that entry's deposit address
 *
 * Body: {
 *   txId: string             // TX hash or full explorer URL
 *   entryId?: string         // Optional: scope to a specific entry
 *   displayName?: string     // For new anonymous entries
 *   dashAddress?: string     // Receive address (for payout)
 *   dashUsername?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { txId, entryId, displayName, dashAddress, dashUsername } = body;

    if (!txId || typeof txId !== 'string') {
      return NextResponse.json({ error: 'txId is required' }, { status: 400 });
    }

    const lottery = getActiveLottery();
    if (!lottery) {
      return NextResponse.json({ error: 'No active lottery' }, { status: 404 });
    }

    const allEntries = getEntriesForLottery(lottery.id);

    // ── 0) Check if this TX is already recorded anywhere ──────────────────────
    const alreadyEntry = allEntries.find(e => (e.verifiedTxIds || []).includes(
      txId.trim().replace(/^.*\/tx\//, '').replace(/[^a-fA-F0-9]/g, '')
    ));
    if (alreadyEntry) {
      return NextResponse.json({
        entry: alreadyEntry, existing: true,
        message: `✅ TX already verified! Your entry has ${alreadyEntry.totalTickets} tickets 🎟`,
      });
    }

    // ── 1) Determine which address(es) to check against ──────────────────────
    const targetEntry = entryId ? getEntry(entryId) : null;
    const addressesToCheck: string[] = [];

    if (targetEntry && targetEntry.lotteryId === lottery.id) {
      // Check the entry's unique deposit address
      if (targetEntry.entryAddress && targetEntry.entryAddress !== lottery.address) {
        addressesToCheck.push(targetEntry.entryAddress);
      }
    }
    // Always also accept the main lottery address
    addressesToCheck.push(lottery.address);
    // Also check all existing entry deposit addresses (in case TX was to one of them)
    for (const e of allEntries) {
      if (e.entryAddress && e.entryAddress !== lottery.address && !addressesToCheck.includes(e.entryAddress)) {
        addressesToCheck.push(e.entryAddress);
      }
    }

    // ── 2) Try each address until we get a match ──────────────────────────────
    let result: Awaited<ReturnType<typeof verifyTxById>> | null = null;
    let matchedAddress = '';
    for (const addr of addressesToCheck) {
      const r = await verifyTxById(txId, addr);
      if (r.valid) { result = r; matchedAddress = addr; break; }
    }

    if (!result || !result.valid) {
      const addressHints = addressesToCheck.slice(0, 2).map(a => `${a.slice(0, 10)}...`).join(', ');
      return NextResponse.json({
        error: 'TX not valid',
        message: `❌ That transaction doesn't send DASH to any known lottery address. Make sure you sent to: ${addressHints}`,
      }, { status: 400 });
    }

    if (result.confirmations < 1) {
      return NextResponse.json({
        error: 'Unconfirmed',
        message: `⏳ TX found but not confirmed yet (${result.confirmations} confirmations). Dash confirms in ~1–2 minutes. Try again shortly.`,
      }, { status: 400 });
    }

    if (result.amount < 0.0999) {
      return NextResponse.json({
        error: 'Amount too low',
        message: `❌ Minimum is 0.1 DASH per ticket. This TX only sent ${result.amount.toFixed(4)} DASH.`,
      }, { status: 400 });
    }

    const tickets = ticketsForDash(result.amount);

    // ── 3) If TX was to an existing entry's deposit address → update that entry ─
    const matchedEntry = allEntries.find(
      e => e.entryAddress === matchedAddress && matchedAddress !== lottery.address
    ) || (targetEntry?.entryAddress === matchedAddress ? targetEntry : null);

    if (matchedEntry && matchedAddress !== lottery.address) {
      // Add tickets to existing entry
      matchedEntry.dashContributed = (matchedEntry.dashContributed || 0) + result.amount;
      matchedEntry.baseTickets = ticketsForDash(matchedEntry.dashContributed);
      matchedEntry.votusCredits = votusForTickets(matchedEntry.baseTickets);
      if ((matchedEntry.votusSpent || 0) > matchedEntry.votusCredits) matchedEntry.votusSpent = matchedEntry.votusCredits;
      matchedEntry.votusAvailable = matchedEntry.votusCredits - (matchedEntry.votusSpent || 0);
      matchedEntry.totalTickets = totalTickets(matchedEntry.baseTickets, matchedEntry.upvoteTickets || 0);
      matchedEntry.verifiedTxIds = [...(matchedEntry.verifiedTxIds || []), result.txId];
      upsertEntry(matchedEntry);

      // Refresh totals
      const fresh = getLottery(lottery.id);
      if (fresh) {
        const all = getEntriesForLottery(lottery.id);
        fresh.totalDash = all.reduce((s, e) => s + (e.dashContributed || 0), 0);
        fresh.totalTickets = all.reduce((s, e) => s + (e.totalTickets || 0), 0);
        fresh.participantCount = all.length;
        upsertLottery(fresh);
      }

      return NextResponse.json({
        entry: matchedEntry, existing: false,
        amount: result.amount, tickets: matchedEntry.totalTickets,
        confirmations: result.confirmations,
        message: `✅ ${result.amount.toFixed(4)} DASH confirmed! Entry updated — ${matchedEntry.totalTickets} tickets 🎟`,
      });
    }

    // ── 4) TX was to lottery address → create / top-up anonymous entry ────────
    const senderAddr = result.fromAddress !== 'unknown' ? result.fromAddress : undefined;
    const existingAnon = allEntries.find(
      e => e.isAnonymous && senderAddr && e.dashAddress === senderAddr
    );

    if (existingAnon) {
      // Top up the existing anon entry
      existingAnon.dashContributed = (existingAnon.dashContributed || 0) + result.amount;
      existingAnon.baseTickets = ticketsForDash(existingAnon.dashContributed);
      existingAnon.votusCredits = votusForTickets(existingAnon.baseTickets);
      if ((existingAnon.votusSpent || 0) > existingAnon.votusCredits) existingAnon.votusSpent = existingAnon.votusCredits;
      existingAnon.votusAvailable = existingAnon.votusCredits - (existingAnon.votusSpent || 0);
      existingAnon.totalTickets = totalTickets(existingAnon.baseTickets, existingAnon.upvoteTickets || 0);
      existingAnon.verifiedTxIds = [...(existingAnon.verifiedTxIds || []), result.txId];
      upsertEntry(existingAnon);
      return NextResponse.json({
        entry: existingAnon, existing: false,
        amount: result.amount, tickets: existingAnon.totalTickets,
        confirmations: result.confirmations,
        message: `✅ ${result.amount.toFixed(4)} DASH confirmed! ${existingAnon.totalTickets} total tickets 🎟`,
      });
    }

    // Create new anonymous entry
    const now = Date.now();
    const entryIdNew = `anon-${result.txId.slice(0, 10)}`;
    const nameLabel = displayName?.trim()
      || (dashUsername?.trim() ? `@${dashUsername.trim()}` : undefined)
      || (senderAddr ? `${senderAddr.slice(0, 6)}...${senderAddr.slice(-4)}` : 'Anonymous');

    const anonVotus = votusForTickets(tickets);
    const newEntry = {
      id:               entryIdNew,
      lotteryId:        lottery.id,
      dashAddress:      senderAddr || `anon-${nanoid(6)}`,
      dashReceiveAddress: dashAddress?.trim() || senderAddr || undefined,
      dashUsername:     dashUsername?.trim() || undefined,
      displayName:      nameLabel,
      isAnonymous:      !displayName?.trim() && !dashUsername?.trim(),
      entryAddress:     lottery.address,
      entryAddressIndex: -1,
      dashContributed:  result.amount,
      baseTickets:      tickets,
      upvoteTickets:    0,
      totalTickets:     totalTickets(tickets, 0), // no Votus bonus on own entry
      verifiedTxIds:    [result.txId],
      upvoters:         [],
      upvotedEntries:   [],
      votusCredits:     anonVotus,
      votusSpent:       0,
      votusAvailable:   anonVotus,
      createdAt:        now,
    };

    upsertEntry(newEntry);

    const fresh = getLottery(lottery.id);
    if (fresh) {
      const all = getEntriesForLottery(lottery.id);
      fresh.totalDash       = all.reduce((s, e) => s + (e.dashContributed || 0), 0);
      fresh.totalTickets    = all.reduce((s, e) => s + (e.totalTickets || 0), 0);
      fresh.participantCount = all.length;
      upsertLottery(fresh);
    }

    return NextResponse.json({
      entry: newEntry, amount: result.amount, tickets,
      confirmations: result.confirmations,
      message: `✅ ${result.amount.toFixed(4)} DASH confirmed! You earned ${tickets} ticket${tickets === 1 ? '' : 's'} 🎟`,
    });

  } catch (err: unknown) {
    console.error('[verify-anon] Error:', err);
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
