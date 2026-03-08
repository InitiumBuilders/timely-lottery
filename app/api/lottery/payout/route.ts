export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getLottery, upsertLottery, getEntriesForLottery, setReserveAddress, addAllocationRecord, getNextLotteryFundAddressIndex } from '@/lib/store';
import { splitPayout, deriveReserveAddress, deriveNextLotteryFundAddress, isValidDashAddress } from '@/lib/dash';
import fs from 'fs';
import path from 'path';

const DATA_DIR  = process.env.LOTTERY_DATA_DIR || '/root/.openclaw/workspace/timely-lottery-data';
const DATA_FILE = path.join(DATA_DIR, 'store.json');

export async function POST(req: NextRequest) {
  try {
    const { password, lotteryId, toAddress } = await req.json();

    const adminPass = process.env.ADMIN_PASSWORD || '';
    if (password !== adminPass) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!lotteryId) {
      return NextResponse.json({ error: 'lotteryId required' }, { status: 400 });
    }
    if (!isValidDashAddress(toAddress)) {
      return NextResponse.json({
        error: `Invalid DASH address: "${toAddress}". Must start with X and be 34 characters.`,
      }, { status: 400 });
    }

    const lottery = getLottery(lotteryId);
    if (!lottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 });
    }

    // Collect all entry address indices with DASH
    const entries = getEntriesForLottery(lotteryId);
    const entryIndices = entries
      .filter(e => e.dashContributed > 0 && e.entryAddressIndex !== undefined)
      .map(e => e.entryAddressIndex);

    if (entryIndices.length === 0) {
      return NextResponse.json({ error: 'No funded entries to sweep — no DASH to send.' }, { status: 400 });
    }

    // Derive reserve + next lottery fund addresses
    const { address: reserveAddr } = deriveReserveAddress();
    setReserveAddress(reserveAddr);
    const nextFundIdx = getNextLotteryFundAddressIndex();
    const { address: nextLotteryAddr } = deriveNextLotteryFundAddress(nextFundIdx);

    console.log(`[payout] 85/10/5 split → winner=${toAddress} reserve=${reserveAddr} nextLottery=${nextLotteryAddr}`);

    // Execute the 85/10/5 split payout
    const splitResult = await splitPayout(lottery.addressIndex, toAddress, reserveAddr, nextLotteryAddr, entryIndices);

    console.log('[payout] Split result:', splitResult);

    if (!splitResult.txId && splitResult.errors.length > 0) {
      return NextResponse.json({ error: 'Payout failed: ' + splitResult.errors.join('; '), splitResult }, { status: 500 });
    }

    // Update lottery record
    lottery.winnerTxId = splitResult.txId;
    upsertLottery(lottery);

    // Record allocation in store
    addAllocationRecord({
      lotteryId:       lotteryId,
      lotteryTitle:    lottery.title,
      totalDash:       lottery.totalDash,
      winnerDash:      splitResult.winnerSent,
      reserveDash:     splitResult.reserveSent,
      nextLotteryDash: splitResult.nextLotterySent,
      txId:            splitResult.txId,
      timestamp:       Date.now(),
    });

    // Patch winners log
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const storeData = JSON.parse(raw);
    const winnerIdx = storeData.winners.findIndex((w: { lotteryId: string }) => w.lotteryId === lotteryId);
    if (winnerIdx >= 0) {
      storeData.winners[winnerIdx].payoutTxId  = splitResult.txId;
      storeData.winners[winnerIdx].payoutTo    = toAddress;
      storeData.winners[winnerIdx].totalSent   = splitResult.winnerSent;
      fs.writeFileSync(DATA_FILE, JSON.stringify(storeData, null, 2), 'utf-8');
    }

    return NextResponse.json({
      ok: true,
      toAddress,
      winnerSent:      splitResult.winnerSent,
      reserveSent:     splitResult.reserveSent,
      nextLotterySent: splitResult.nextLotterySent,
      txId:            splitResult.txId,
      txLink:          splitResult.txId ? `https://insight.dash.org/insight/tx/${splitResult.txId}` : undefined,
      errors:          splitResult.errors,
      message: splitResult.txId
        ? `✅ Split TX sent — ${splitResult.winnerSent.toFixed(4)} DASH (85%) to winner · ${splitResult.reserveSent.toFixed(4)} DASH (10%) to Reserve · ${splitResult.nextLotterySent.toFixed(4)} DASH (5%) to next lottery`
        : `⚠️ Partial: ${splitResult.errors.join(', ')}`,
    });
  } catch (err: unknown) {
    console.error('[payout] Unexpected error:', err);
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
