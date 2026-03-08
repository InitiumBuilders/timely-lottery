export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getActiveLottery, getEntriesForLottery, getEntry, upsertEntry, upsertLottery, getLottery, getReserveStats, setReserveAddress, addSplitRecord, getNextLotteryFundAddressIndex } from '@/lib/store';
import { getContributions, immediatelySplit, immediatelySplitFromWIF, deriveReserveAddress, deriveNextLotteryFundAddress, deriveLotteryAddress } from '@/lib/dash';
import { ticketsForDash, votusForTickets, totalTickets } from '@/lib/ticket-utils';
import { nanoid } from 'nanoid';
import prisma from '@/lib/db';

const INSIGHT_BASE = 'https://insight.dash.org/insight-api';
const INSIGHT_H = { 'User-Agent': 'Mozilla/5.0 (compatible; TimelyLottery/1.0)', 'Accept': 'application/json' };

async function insightFetch(url: string) {
  const r = await fetch(url, { headers: INSIGHT_H, cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (r.status === 404) return null; // no transactions yet — not an error
  if (!r.ok) throw new Error(`Insight HTTP ${r.status}`);
  return r.json();
}

// Auto-scan all entry addresses + the lottery address itself for anonymous direct sends
export async function POST() {
  try {
    const lottery = getActiveLottery();
    if (!lottery) {
      return NextResponse.json({ ok: true, message: 'No active lottery', updated: 0 });
    }

    const entries = getEntriesForLottery(lottery.id);
    let updated = 0;
    let anonAdded = 0;
    const results: Array<{ entryId: string; tickets: number; dash: number }> = [];

    // Pre-compute reserve + next lottery addresses (used for immediate splits)
    let reserveAddr = '';
    let nextLotteryAddr = '';
    try {
      const { address: ra } = deriveReserveAddress();
      reserveAddr = ra;
      setReserveAddress(ra);
      const nfIdx = getReserveStats().nextLotteryFundAddressIndex;
      const { address: na } = deriveNextLotteryFundAddress(nfIdx);
      nextLotteryAddr = na;
    } catch (e) {
      console.error('[scan] Could not derive reserve/next addresses:', e);
    }

    // ── 1) Scan all existing entry deposit addresses ───────────────────────────
    await Promise.allSettled(entries.map(async (entry) => {
      if (!entry.entryAddress || entry.entryAddress === lottery.address) return; // skip anon entries
      try {
        const contribs = await getContributions(entry.entryAddress);
        if (!contribs.length) return;

        const confirmed = contribs.filter(c => c.confirmations >= 1);
        if (!confirmed.length) return;

        // CRITICAL: compute amount from VERIFIED USER DEPOSITS only.
        // Re-read the entry from disk here to get the LATEST splitTxIds — this prevents a
        // race condition where a concurrent scan hasn't yet saved its split TX IDs, causing
        // the 85% change output to be double-counted as a new deposit.
        const freshEntry = getEntry(entry.id);
        const splitTxIds = freshEntry?.splitTxIds || entry.splitTxIds || [];

        // Genuinely new TXs: confirmed, not a split TX, not already verified
        const newTxIds = confirmed
          .filter(c => !splitTxIds.includes(c.txId) && !entry.verifiedTxIds.includes(c.txId))
          .map(c => c.txId);

        // Total = sum of (verified deposits) + sum of (new deposits)
        // Split change TXs: NOT in verifiedTxIds, IN splitTxIds → excluded from both sets ✅
        const verifiedAmount = confirmed
          .filter(c => entry.verifiedTxIds.includes(c.txId) && !splitTxIds.includes(c.txId))
          .reduce((s, c) => s + c.amount, 0);
        const newAmount = confirmed
          .filter(c => newTxIds.includes(c.txId))
          .reduce((s, c) => s + c.amount, 0);
        const total = verifiedAmount + newAmount;

        const correctTickets = ticketsForDash(total);
        if (newTxIds.length === 0 && Math.abs(entry.dashContributed - total) < 0.00001 && entry.baseTickets === correctTickets) return;

        // ── Capture sender DASH address from TX (auto-payout fallback) ────────
        // If the entry doesn't have a valid receive address yet, grab it from the
        // first deposit TX's sender input. This is always the wallet that paid in —
        // the safest address to return winnings to.
        const { isValidDashAddress } = await import('@/lib/dash');
        if (!isValidDashAddress(entry.dashReceiveAddress || '') && newTxIds.length > 0) {
          const senderContrib = confirmed.find(c => newTxIds.includes(c.txId) && c.fromAddress && isValidDashAddress(c.fromAddress));
          if (senderContrib?.fromAddress) {
            entry.dashReceiveAddress = senderContrib.fromAddress;
            // Also fix dashAddress if it's not a valid DASH address (e.g. stored as userId)
            if (!isValidDashAddress(entry.dashAddress || '')) {
              entry.dashAddress = senderContrib.fromAddress;
            }
            console.log(`[scan] 📍 Captured sender address for entry ${entry.id}: ${senderContrib.fromAddress}`);
          }
        }

        // ── Immediate 10/5/85 split for new deposits ─────────────────────────
        if (newTxIds.length > 0 && reserveAddr && nextLotteryAddr && entry.entryAddressIndex >= 0) {
          try {
            // Pass lottery.address as winnerHoldingAddr so the 85% goes to the lottery
            // main address — NOT back to the entry address. This prevents the split change
            // from appearing as a new deposit on the next scan (infinite-loop double-count bug).
            const splitResult = await immediatelySplit(entry.entryAddressIndex, reserveAddr, nextLotteryAddr, lottery.address);
            if (splitResult) {
              // Record split TXID on the ENTRY so it's never re-counted as a deposit
              entry.splitTxIds = [...(entry.splitTxIds || []), splitResult.splitTxId];

              // ALSO register on the LOTTERY so the anonymous-TX scanner skips it.
              // Without this, the 85% going TO lottery.address gets detected as a new
              // anonymous deposit FROM the entry's private deposit address — exposing it.
              const freshLotteryForSplit = getLottery(lottery.id);
              if (freshLotteryForSplit) {
                (freshLotteryForSplit as any).splitTxIds = [
                  ...((freshLotteryForSplit as any).splitTxIds || []),
                  splitResult.splitTxId,
                ];
                upsertLottery(freshLotteryForSplit);
              }

              // Log to split history (on-chain confirmed allocation)
              addSplitRecord({
                lotteryId:         lottery.id,
                entryId:           entry.id,
                depositTxId:       newTxIds[0],
                splitTxId:         splitResult.splitTxId,
                totalDeposit:      splitResult.totalDeposit,
                reserveAmount:     splitResult.reserveAmount,
                nextLotteryAmount: splitResult.nextLotteryAmount,
                winnerAmount:      splitResult.winnerAmount,
                timestamp:         Date.now(),
              });
              console.log(`[scan] ✅ Immediate split done for entry ${entry.id}: ${splitResult.reserveAmount} DASH → reserve, ${splitResult.nextLotteryAmount} DASH → next lottery`);
            }
          } catch (splitErr) {
            console.error(`[scan] Immediate split failed for entry ${entry.id}:`, splitErr);
          }
        }

        entry.dashContributed = total;
        entry.baseTickets = ticketsForDash(total);
        entry.votusCredits = votusForTickets(entry.baseTickets);
        entry.votusSpent = entry.votusSpent || 0;
        if (entry.votusSpent > entry.votusCredits) entry.votusSpent = entry.votusCredits;
        entry.votusAvailable = entry.votusCredits - entry.votusSpent;
        entry.totalTickets = totalTickets(entry.baseTickets, entry.upvoteTickets || 0);
        entry.verifiedTxIds = Array.from(new Set([...entry.verifiedTxIds, ...newTxIds]));
        upsertEntry(entry);
        updated++;
        results.push({ entryId: entry.id, tickets: entry.totalTickets, dash: total });

        // Update initium card lifetime DASH stats
        if ((entry as any).initiumId) {
          prisma.initium.update({
            where: { id: (entry as any).initiumId },
            data: { totalDashEarned: total },
          }).catch(() => {});
        }
      } catch (entryErr) {
        console.error(`[scan] Entry ${entry.id} error:`, entryErr);
      }
    }));

    // ── 2) Scan the lottery address for direct anonymous sends ─────────────────
    let newAnonDepositsFound = false;
    try {
      const addrInfo = await insightFetch(`${INSIGHT_BASE}/addr/${lottery.address}`);
      const txids: string[] = addrInfo?.transactions?.slice(0, 50) || [];
      const txResults = await Promise.allSettled(
        txids.map(txid =>
          fetch(`${INSIGHT_BASE}/tx/${txid}`, { headers: INSIGHT_H, cache: 'no-store', signal: AbortSignal.timeout(10000) })
            .then(r => r.ok ? r.json() : null).catch(() => null)
        )
      );
      const txs: any[] = txResults.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);

      // Re-read lottery so we pick up any split TX IDs that were just registered
      // by the entry-scan section above (85% winner-holding funds land here).
      const refreshedLottery = getLottery(lottery.id) || lottery;

      // Split TXIDs generated by us from the lottery address — must be filtered out
      // so the 85% winner-holding TX doesn't create a fake anon entry exposing a private address
      const lotterySplitTxIds: string[] = (refreshedLottery as any).splitTxIds || [];

      // All known entry deposit addresses — sending FROM one of these = it's our own split TX
      const knownEntryAddresses = new Set<string>(
        entries.map(e => e.entryAddress).filter(Boolean) as string[]
      );

      for (const tx of txs) {
        const txid: string = tx.txid;

        // Skip our own split transactions (change outputs)
        if (lotterySplitTxIds.includes(txid)) continue;

        // Skip if already recorded in any entry
        const alreadyRecorded = entries.some(e => (e.verifiedTxIds || []).includes(txid));
        if (alreadyRecorded) continue;

        // Calculate amount sent to lottery address in this TX
        let amountDash = 0;
        for (const out of (tx.vout || [])) {
          const addrs: string[] = out.scriptPubKey?.addresses || [];
          if (addrs.includes(lottery.address)) {
            amountDash += parseFloat(out.value) || 0;
          }
        }
        if (amountDash < 0.0999) continue; // minimum 0.1 DASH

        // Confirmations
        const confirmations: number = tx.confirmations || 0;
        if (confirmations < 1) continue;

        // Sender address
        const senderAddr: string | undefined = tx.vin?.[0]?.addr || undefined;

        // SECURITY: if the sender is one of our own entry deposit addresses, this TX
        // is a split payment (not a real anonymous deposit). Skip it — do NOT create
        // an entry exposing that private address.
        if (senderAddr && knownEntryAddresses.has(senderAddr)) {
          console.log(`[scan] Skipping split TX ${txid} — sender ${senderAddr.slice(0, 8)}... is an entry deposit address`);
          // Register it on the lottery splitTxIds if not already there
          if (!lotterySplitTxIds.includes(txid)) {
            const lotteryToUpdate = getLottery(lottery.id) || lottery;
            (lotteryToUpdate as any).splitTxIds = [...((lotteryToUpdate as any).splitTxIds || []), txid];
            upsertLottery(lotteryToUpdate);
          }
          continue;
        }

        const baseT = ticketsForDash(amountDash);
        const votusC = votusForTickets(baseT);
        const entryId = `anon-${txid.slice(0, 10)}`;
        const displayName = senderAddr
          ? `${senderAddr.slice(0, 6)}...${senderAddr.slice(-4)}`
          : 'Anonymous';

        const newEntry = {
          id:              entryId,
          lotteryId:       lottery.id,
          dashAddress:     senderAddr || `anon-${nanoid(6)}`,
          dashReceiveAddress: senderAddr || undefined,
          displayName,
          isAnonymous:     true,
          entryAddress:    lottery.address,
          entryAddressIndex: -1,
          dashContributed: amountDash,
          baseTickets:     baseT,
          upvoteTickets:   0,
          totalTickets:    totalTickets(baseT, 0), // no Votus bonus on own entry
          verifiedTxIds:   [txid],
          upvoters:        [],
          upvotedEntries:  [],
          votusCredits:    votusC,
          votusSpent:      0,
          votusAvailable:  votusC,
          createdAt:       tx.time ? tx.time * 1000 : Date.now(),
        };

        upsertEntry(newEntry);
        entries.push(newEntry as any); // keep local list fresh
        anonAdded++;
        newAnonDepositsFound = true;
        results.push({ entryId, tickets: totalTickets(baseT, 0), dash: amountDash });
      }

      // If new anonymous deposits found, immediately split from the lottery address
      // (10% → reserve, 5% → next lottery, ~85% change stays for winner payout)
      if (newAnonDepositsFound && reserveAddr && nextLotteryAddr && (lottery as any).addressIndex >= 0) {
        try {
          const { wif: lotteryWif } = deriveLotteryAddress((lottery as any).addressIndex);
          const splitResult = await immediatelySplitFromWIF(lottery.address, lotteryWif, reserveAddr, nextLotteryAddr);
          if (splitResult) {
            // Store split TXID on lottery record to filter next scan
            const freshLottery = getLottery(lottery.id);
            if (freshLottery) {
              (freshLottery as any).splitTxIds = [...((freshLottery as any).splitTxIds || []), splitResult.splitTxId];
              upsertLottery(freshLottery);
            }
            addSplitRecord({
              lotteryId:         lottery.id,
              entryId:           'lottery-pool',
              depositTxId:       'anon-batch',
              splitTxId:         splitResult.splitTxId,
              totalDeposit:      splitResult.totalDeposit,
              reserveAmount:     splitResult.reserveAmount,
              nextLotteryAmount: splitResult.nextLotteryAmount,
              winnerAmount:      splitResult.winnerAmount,
              timestamp:         Date.now(),
            });
            console.log(`[scan] ✅ Lottery address split: ${splitResult.reserveAmount} DASH → reserve, ${splitResult.nextLotteryAmount} DASH → next lottery`);
          }
        } catch (splitErr) {
          console.error('[scan] Lottery address split failed:', splitErr);
        }
      }
    } catch (e) {
      console.error('[scan] Lottery address scan error:', e);
    }

    // ── 3) Refresh lottery totals ─────────────────────────────────────────────
    if (updated > 0 || anonAdded > 0) {
      const fresh = getLottery(lottery.id);
      if (fresh) {
        const allEntries = getEntriesForLottery(lottery.id);
        fresh.totalDash = allEntries.reduce((s, e) => s + e.dashContributed, 0);
        fresh.totalTickets = allEntries.reduce((s, e) => s + e.totalTickets, 0);
        fresh.participantCount = allEntries.length;
        upsertLottery(fresh);
      }
    }

    return NextResponse.json({ ok: true, updated, anonAdded, results });
  } catch (err: unknown) {
    console.error('[scan] Error:', err);
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
