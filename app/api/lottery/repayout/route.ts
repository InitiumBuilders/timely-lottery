export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  getLottery, upsertLottery, getEntriesForLottery, addWinner,
  getReserveStats, setReserveAddress, addAllocationRecord, getNextLotteryFundAddressIndex,
} from '@/lib/store';
import {
  directSweepAllToWinner, splitPayout, isValidDashAddress,
  deriveReserveAddress, deriveNextLotteryFundAddress, getTxSenderAddress,
} from '@/lib/dash';
import { pickWeightedWinner } from '@/lib/lottery';

/**
 * POST /api/lottery/repayout
 * Retry payout for an ended lottery that has no winnerTxId yet.
 *
 * PAYOUT STRATEGY:
 * ─ If ANY entry has splitTxIds (immediate 10/5/85 splits already ran on deposit),
 *   we do a DIRECT SWEEP of remaining UTXOs → winner. No second split.
 * ─ If no immediate splits occurred (legacy), we do the full 85/10/5 splitPayout.
 *
 * WINNER ADDRESS RESOLUTION (priority order):
 *   1. entry.dashReceiveAddress (if valid Dash address)
 *   2. entry.dashAddress        (if valid Dash address)
 *   3. Sender address from first verifiedTxId (looked up on Insight — ALWAYS the wallet that sent DASH)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, lotteryId } = body;

    const adminPass = process.env.ADMIN_PASSWORD || '';
    if (password !== adminPass) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lottery = getLottery(lotteryId);
    if (!lottery) return NextResponse.json({ error: 'Lottery not found' }, { status: 404 });
    if (lottery.status !== 'ended') return NextResponse.json({ error: 'Lottery not ended yet' }, { status: 400 });
    if (lottery.winnerTxId) return NextResponse.json({ error: 'Payout already completed', txId: lottery.winnerTxId });

    const entries = getEntriesForLottery(lotteryId);
    if (!entries.length) return NextResponse.json({ error: 'No entries' });

    // Pick winner if not already picked
    let winnerId = lottery.winnerId;
    let winner = winnerId ? entries.find(e => e.id === winnerId) : null;
    if (!winner) {
      winner = pickWeightedWinner(lotteryId) as any;
      if (!winner) return NextResponse.json({ error: 'No eligible winner' });
      winnerId = (winner as any).id;
    }

    // ── Winner DASH address resolution ─────────────────────────────────────────
    const w = winner as any;
    let payoutDest: string = w.dashReceiveAddress || w.dashAddress || '';

    // Fallback: look up sender from the deposit TX on Insight
    if (!isValidDashAddress(payoutDest)) {
      const txIds: string[] = w.verifiedTxIds || [];
      for (const txId of txIds) {
        const senderAddr = await getTxSenderAddress(txId);
        if (senderAddr && isValidDashAddress(senderAddr)) {
          payoutDest = senderAddr;
          console.log(`[repayout] ✅ Resolved winner address from TX ${txId}: ${payoutDest}`);

          // Persist it so future retries don't need to re-fetch
          w.dashReceiveAddress = senderAddr;
          w.dashAddress = senderAddr;
          const { upsertEntry } = await import('@/lib/store');
          upsertEntry(w);
          break;
        }
      }
    }

    if (!isValidDashAddress(payoutDest)) {
      return NextResponse.json({
        error: `Winner ${w.id} has no valid DASH receive address and no resolvable TX sender. Manual payout required.`,
        entryId: w.id,
        verifiedTxIds: w.verifiedTxIds,
      });
    }

    // ── Determine payout strategy ──────────────────────────────────────────────
    // If any entries have already been immediately split (10/5/85 on deposit),
    // just sweep the remaining ~85% directly to winner. No second split.
    const anyImmediateSplitsDone = entries.some(e => (e as any).splitTxIds?.length > 0)
      || ((lottery as any).splitTxIds?.length > 0);

    const entryIndices = entries
      .filter(e => (e as any).entryAddressIndex !== undefined && (e as any).entryAddressIndex >= 0)
      .map(e => (e as any).entryAddressIndex as number);

    console.log(`[repayout] Winner: ${payoutDest} | strategy: ${anyImmediateSplitsDone ? 'DIRECT_SWEEP' : 'SPLIT_PAYOUT'} | entryIndices: ${entryIndices}`);

    let txId: string | undefined;
    let winnerSent = 0;
    let reserveSent = 0;
    let nextLotterySent = 0;
    const errors: string[] = [];

    if (anyImmediateSplitsDone) {
      // ── DIRECT SWEEP: 15% already taken, sweep all remaining to winner ────────
      const result = await directSweepAllToWinner(lottery.addressIndex, payoutDest, entryIndices);
      txId = result.txId;
      winnerSent = result.totalSent;
      errors.push(...result.errors);
    } else {
      // ── SPLIT PAYOUT: 85/10/5 (legacy — no immediate splits on deposit) ───────
      const { address: reserveAddr } = deriveReserveAddress();
      setReserveAddress(reserveAddr);
      const nextFundIdx = getNextLotteryFundAddressIndex();
      const { address: nextLotteryAddr } = deriveNextLotteryFundAddress(nextFundIdx);

      const splitResult = await splitPayout(lottery.addressIndex, payoutDest, reserveAddr, nextLotteryAddr, entryIndices);
      txId = splitResult.txId;
      winnerSent = splitResult.winnerSent;
      reserveSent = splitResult.reserveSent;
      nextLotterySent = splitResult.nextLotterySent;
      errors.push(...splitResult.errors);

      if (!txId && errors.length) {
        console.error('[repayout] Split errors:', errors);
        return NextResponse.json({ error: errors.join('; '), errors });
      }

      if (splitResult.txId) {
        addAllocationRecord({
          lotteryId:       lottery.id,
          lotteryTitle:    lottery.title,
          totalDash:       lottery.totalDash,
          winnerDash:      winnerSent,
          reserveDash:     reserveSent,
          nextLotteryDash: nextLotterySent,
          winnerName:      lottery.winnerName,
          txId:            splitResult.txId,
          timestamp:       Date.now(),
        });
      }
    }

    if (!txId && errors.length) {
      console.error('[repayout] Errors:', errors);
      return NextResponse.json({ error: errors.join('; '), errors });
    }

    // Update lottery record
    lottery.winnerId     = winnerId!;
    lottery.winnerName   = w.displayName || w.dashUsername || w.dashAddress;
    lottery.winnerTxId   = txId;
    lottery.winnerDash   = winnerSent;
    upsertLottery(lottery);

    // Record in winners log
    const totalTickets = entries.reduce((s, e) => s + ((e as any).totalTickets || 0), 0);
    const winnerEntry = entries.find(e => e.id === winnerId);
    addWinner({
      lotteryId:    lottery.id,
      lotteryTitle: lottery.title,
      entryId:      winnerId!,
      displayName:  w.displayName || w.dashUsername || w.dashAddress,
      dashAddress:  payoutDest,
      dashWon:      winnerSent,
      totalParticipants: entries.length,
      totalDash:    lottery.totalDash,
      winningTickets: winnerEntry ? (winnerEntry as any).totalTickets : 0,
      totalTickets,
      payoutTxId:   txId,
      timestamp:    Date.now(),
    } as any);

    return NextResponse.json({
      ok: true,
      winner: w,
      payoutDest,
      txId,
      winnerSent,
      reserveSent,
      nextLotterySent,
      strategy: anyImmediateSplitsDone ? 'direct_sweep' : 'split_payout',
      errors,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[repayout] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
