export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  getLottery, upsertLottery, upsertEntry, getEntriesForLottery, addWinner,
  getReserveStats, setReserveAddress, addAllocationRecord, getNextLotteryFundAddressIndex,
} from '@/lib/store';
import { publishLottery as publishLotteryDrive, publishResult } from '@/lib/platform';
import {
  directSweepAllToWinner, splitPayout, isValidDashAddress,
  deriveReserveAddress, deriveNextLotteryFundAddress, getTxSenderAddress,
} from '@/lib/dash';
import { pickWeightedWinner } from '@/lib/lottery';
import prisma from '@/lib/db';

/**
 * POST /api/lottery/end
 * End a lottery and pay out the winner.
 *
 * PAYOUT STRATEGY:
 * ─ If ANY entry has splitTxIds (immediate 10/5/85 splits already ran on deposit),
 *   we do a DIRECT SWEEP of remaining UTXOs → winner. No second split.
 * ─ If no immediate splits occurred (legacy), we do the full 85/10/5 splitPayout.
 *
 * WINNER ADDRESS RESOLUTION (priority order):
 *   1. entry.dashReceiveAddress (if valid Dash address)
 *   2. entry.dashAddress        (if valid Dash address)
 *   3. Sender address from first verifiedTxId (looked up on Insight)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, lotteryId, forcePayout } = body;

    const adminPass = process.env.ADMIN_PASSWORD || '';
    if (password !== adminPass) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lottery = getLottery(lotteryId);
    if (!lottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 });
    }
    if (lottery.status === 'ended') {
      return NextResponse.json({ error: 'Lottery already ended' }, { status: 400 });
    }

    const entries = getEntriesForLottery(lotteryId);

    // End the lottery
    lottery.status = 'ended';
    upsertLottery(lottery);

    // ── Expire all unspent Votus for this lottery ──────────────────────────────
    // Votus only valid during the active lottery — burn any unspent credits on end
    for (const entry of entries) {
      if ((entry.votusCredits || 0) > (entry.votusSpent || 0)) {
        // Track how much was allocated vs earned for lifetime stats
        const spent = entry.votusSpent || 0;
        // Set votusSpent = votusCredits so votusAvailable = 0
        entry.votusSpent = entry.votusCredits || 0;
        entry.votusAvailable = 0;
        upsertEntry(entry);
      }
    }

    if (entries.length === 0) {
      return NextResponse.json({
        lottery,
        winner: null,
        message: 'No participants — lottery ended with no winner.',
      });
    }

    // Pick weighted random winner
    const winner = pickWeightedWinner(lotteryId);
    if (!winner) {
      return NextResponse.json({ lottery, winner: null, message: 'No eligible winner.' });
    }

    // ── Winner DASH address resolution ─────────────────────────────────────────
    const winnerTyped = winner as unknown as Record<string, any>;
    let payoutDest: string = winnerTyped.dashReceiveAddress || '';

    // Try dashAddress next
    if (!isValidDashAddress(payoutDest)) {
      payoutDest = winnerTyped.dashAddress || '';
    }

    // Fallback: look up sender from the deposit TX on Insight
    if (!isValidDashAddress(payoutDest)) {
      const txIds: string[] = winnerTyped.verifiedTxIds || [];
      for (const txId of txIds) {
        const senderAddr = await getTxSenderAddress(txId);
        if (senderAddr && isValidDashAddress(senderAddr)) {
          payoutDest = senderAddr;
          console.log(`[end] ✅ Resolved winner address from TX ${txId}: ${payoutDest}`);

          // Persist for future use
          winnerTyped.dashReceiveAddress = senderAddr;
          winnerTyped.dashAddress = senderAddr;
          upsertEntry(winnerTyped as any);
          break;
        }
      }
    }

    const canAutoPayout = forcePayout && isValidDashAddress(payoutDest);

    // ── Determine payout strategy ──────────────────────────────────────────────
    const anyImmediateSplitsDone = entries.some(e => (e as any).splitTxIds?.length > 0)
      || ((lottery as any).splitTxIds?.length > 0);

    const entryIndices = entries
      .filter(e => (e as any).entryAddressIndex >= 0)
      .map(e => (e as any).entryAddressIndex as number);

    let payoutTxId: string | undefined;
    let payoutNote = '';
    let winnerSent = 0;
    let reserveSent = 0;
    let nextLotterySent = 0;
    let splitErrors: string[] = [];

    if (canAutoPayout) {
      try {
        if (anyImmediateSplitsDone) {
          // ── DIRECT SWEEP: fees already taken on deposit, sweep all remaining ──
          console.log(`[end] DIRECT_SWEEP → winner=${payoutDest} | entryIndices=${entryIndices}`);
          const result = await directSweepAllToWinner(lottery.addressIndex, payoutDest, entryIndices);
          payoutTxId = result.txId;
          winnerSent = result.totalSent;
          splitErrors = result.errors;
          if (result.errors.length) console.warn('[end] Direct sweep warnings:', result.errors);
        } else {
          // ── SPLIT PAYOUT: 85/10/5 (no prior immediate splits) ─────────────────
          const { address: reserveAddr } = deriveReserveAddress();
          setReserveAddress(reserveAddr);
          const nextFundIdx = getNextLotteryFundAddressIndex();
          const { address: nextLotteryAddr } = deriveNextLotteryFundAddress(nextFundIdx);

          console.log(`[end] SPLIT_PAYOUT → winner=${payoutDest} reserve=${reserveAddr} nextLottery=${nextLotteryAddr}`);
          const splitResult = await splitPayout(lottery.addressIndex, payoutDest, reserveAddr, nextLotteryAddr, entryIndices);
          payoutTxId = splitResult.txId;
          winnerSent = splitResult.winnerSent;
          reserveSent = splitResult.reserveSent;
          nextLotterySent = splitResult.nextLotterySent;
          splitErrors = splitResult.errors;
          if (splitResult.errors.length) console.warn('[end] Split payout errors:', splitResult.errors);

          if (splitResult.txId) {
            addAllocationRecord({
              lotteryId:       lottery.id,
              lotteryTitle:    lottery.title,
              totalDash:       lottery.totalDash,
              winnerDash:      winnerSent,
              reserveDash:     reserveSent,
              nextLotteryDash: nextLotterySent,
              winnerName:      winner.displayName || winner.dashUsername,
              txId:            splitResult.txId,
              timestamp:       Date.now(),
            });
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[end] Payout failed:', msg);
        payoutNote = `Auto-payout failed: ${msg}`;
      }
    } else if (forcePayout) {
      payoutNote = `Winner "${winner.displayName || winner.dashAddress}" has no valid DASH receive address. Use Manual Payout in admin.`;
      console.warn('[end]', payoutNote);
    }

    // Update lottery with winner info
    lottery.winnerId      = winner.id;
    lottery.winnerName    = winner.displayName || winner.dashUsername || winner.dashAddress;
    lottery.winnerInitium = winner.initium;
    lottery.winnerDash    = winnerSent || lottery.totalDash;
    lottery.winnerTxId    = payoutTxId;
    upsertLottery(lottery);

    // ── Publish ended lottery + result to Dash Drive (fire-and-forget) ─────────
    publishLotteryDrive(lottery).catch(e => console.error('[platform] publishLottery(ended):', e));
    if (payoutTxId) {
      publishResult({
        lotteryId:    lottery.id,
        winnerId:     winner.id,
        winnerName:   lottery.winnerName || '',
        winnerDash:   winnerSent,
        winnerTxId:   payoutTxId,
        reserveDash:  reserveSent,
        totalDash:    lottery.totalDash,
        endTime:      Date.now(),
        initiumTitle: (winner as any).initiumTitle || '',
      }).catch(e => console.error('[platform] publishResult:', e));
    }

    // Record in winners log
    const totalTickets = entries.reduce((s, e) => s + e.totalTickets, 0);
    addWinner({
      lotteryId:         lottery.id,
      lotteryTitle:      lottery.title,
      entryId:           winner.id,
      displayName:        winner.displayName,
      dashAddress:        payoutDest || winner.dashAddress,
      dashUsername:       winner.dashUsername,
      initium:            winner.initium,
      initiumTitle:       winner.initiumTitle,
      initiumDescription: winner.initiumDescription,
      initiumUrl:         winner.initiumUrl,
      dashWon:            winnerSent || lottery.totalDash,
      totalParticipants: entries.length,
      totalDash:         lottery.totalDash,
      winningTickets:    winner.totalTickets,
      totalTickets,
      payoutTxId,
      timestamp:         Date.now(),
    });

    // Update initium stats for all entries
    try {
      const lotteryEntries = getEntriesForLottery(lotteryId);
      for (const ent of lotteryEntries) {
        const initId = (ent as any).initiumId;
        if (!initId) continue;
        const isWinner = ent.id === winner.id;
        await prisma.initium.update({
          where: { id: initId },
          data: {
            totalLotteries: { increment: 1 },
            ...(isWinner ? { totalWins: { increment: 1 } } : {}),
          },
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }

    const hasPayout = !!payoutTxId;
    const strategy = anyImmediateSplitsDone ? 'direct_sweep' : 'split_payout';

    return NextResponse.json({
      lottery,
      winner,
      payoutTxId,
      payoutNote,
      strategy,
      winnerSent,
      reserveSent,
      nextLotterySent,
      splitErrors,
      needsManualPayout: !canAutoPayout,
      message: hasPayout
        ? `🏆 Winner: ${lottery.winnerName} | ${winnerSent.toFixed(4)} DASH sent on-chain (${strategy})!`
        : payoutNote
          ? `🏆 Winner: ${lottery.winnerName} — ${payoutNote}`
          : `🏆 Winner: ${lottery.winnerName} — use Manual Payout in admin.`,
    });
  } catch (err: unknown) {
    console.error('[end] Unexpected error:', err);
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
