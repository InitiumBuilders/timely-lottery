/**
 * Timely.Works VPS Background Worker
 * ─────────────────────────────────────────────────────────────
 * Runs continuously as a PM2 process alongside the Next.js app.
 * Tasks:
 *   • Every 2 min  → Scan all entry deposit addresses for DASH
 *   • Every 1 min  → Check for expired lotteries → auto-end + payout
 *
 * Usage:  pm2 start scripts/worker.mjs --name timely-worker
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const BASE_URL   = process.env.WORKER_URL      || 'http://localhost:3000';
const ADMIN_PW   = process.env.ADMIN_PASSWORD || '';
const LOG_FILE   = process.env.WORKER_LOG      || '/root/.openclaw/workspace/timely-lottery-data/worker.log';
const STORE_FILE = process.env.STORE_FILE      || '/root/.openclaw/workspace/timely-lottery-data/store.json';
const TG_TOKEN   = process.env.TG_BOT_TOKEN    || '';
const TG_CHAT    = process.env.TG_CHAT_ID      || '';
const TG_TOPIC   = process.env.TG_TOPIC_ID     || '';

// ── Telegram notify ──────────────────────────────────────────
async function tgNotify(text) {
  try {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    const body = {
      chat_id: TG_CHAT,
      message_thread_id: parseInt(TG_TOPIC),
      text,
      parse_mode: 'HTML',
    };
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const d = await r.json();
    if (!d.ok) log(`[TG] ❌ Notify failed: ${JSON.stringify(d)}`);
    else log(`[TG] ✅ Notification sent`);
  } catch (e) {
    log(`[TG] ❌ Error: ${e.message}`);
  }
}

const log = (msg) => {
  const ts = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const line = `[${ts} CST] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
};

const readStore = () => {
  try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')); } catch { return null; }
};

// ── Scan entries ─────────────────────────────────────────────
async function runScan() {
  try {
    const r = await fetch(`${BASE_URL}/api/lottery/scan`, { method: 'POST', signal: AbortSignal.timeout(25000) });
    const d = await r.json();
    if (d.updated > 0) {
      log(`[SCAN] ✅ Updated ${d.updated} entries: ${JSON.stringify(d.results)}`);
    } else {
      log(`[SCAN] No changes detected`);
    }
    return d;
  } catch (e) {
    log(`[SCAN] ❌ Error: ${e.message}`);
    return null;
  }
}

// ── Auto-end expired lotteries ───────────────────────────────
async function checkAutoEnd() {
  const store = readStore();
  if (!store) { log('[AUTO-END] Could not read store'); return; }

  const now = Date.now();
  const lotteries = Object.values(store.lotteries || {});
  const expired = lotteries.filter(l => l.status === 'active' && l.endTime <= now);

  if (expired.length === 0) return;

  for (const lottery of expired) {
    log(`[AUTO-END] 🏁 Lottery ${lottery.id} expired — starting auto-end sequence`);

    // 1. Scan first to make sure all balances are current
    log(`[AUTO-END] Running pre-end scan...`);
    await runScan();

    // 2. Call end endpoint with forcePayout=true
    try {
      const r = await fetch(`${BASE_URL}/api/lottery/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PW, lotteryId: lottery.id, forcePayout: true }),
        signal: AbortSignal.timeout(60000), // payout can take up to 60s
      });
      const d = await r.json();

      if (d.error) {
        log(`[AUTO-END] ❌ End failed: ${d.error}`);
        await tgNotify(`⚠️ <b>Timely.Works</b> — Auto-end failed for lottery <code>${lottery.id}</code>\n\nError: ${d.error}`);
      } else {
        const winner = d.winner;
        const wName  = winner?.displayName || (winner?.dashEvolutionUsername ? `@${winner.dashEvolutionUsername}` : null) || winner?.dashAddress || 'Unknown';
        const dashWon = lottery.totalDash?.toFixed(4) || '?';
        const hasPayout = d.payoutResult?.txIds?.length > 0;
        const txIds = d.payoutResult?.txIds || [];

        log(`[AUTO-END] 🏆 Winner: ${wName} | DASH: ${dashWon} | TXs: ${txIds.join(', ') || 'none'}`);
        log(`[AUTO-END] Message: ${d.message || '(no message)'}`);

        // Build Telegram notification
        let msg = '';
        if (hasPayout) {
          // Auto-payout succeeded
          msg = [
            `🏆 <b>TIMELY.WORKS — Lottery Complete!</b>`,
            ``,
            `🎉 Winner: <b>${wName}</b>`,
            `💰 Prize: <b>${dashWon} DASH</b> auto-sent on-chain`,
            ``,
            `TXs: ${txIds.map(t => `<code>${t.slice(0,12)}...</code>`).join(', ')}`,
            ``,
            `🔗 timely.works/winners`,
          ].join('\n');
        } else {
          // Winner picked but payout needs manual action
          const evUser = winner?.dashEvolutionUsername ? `@${winner.dashEvolutionUsername}` : null;
          const reason = d.needsManualPayout
            ? `Winner needs to provide a DASH receive address`
            : (d.payoutNote || 'No valid DASH address on file');
          msg = [
            `🏆 <b>TIMELY.WORKS — Lottery Ended!</b>`,
            ``,
            `🎉 Winner: <b>${wName}</b>${evUser ? ` (${evUser})` : ''}`,
            `💰 Prize Pool: <b>${dashWon} DASH</b>`,
            ``,
            `⚠️ <b>Manual Payout Required</b>`,
            `${reason}`,
            ``,
            `👉 ${wName} — reply with your DASH wallet address to claim your prize!`,
            `Or use: timely.works/admin → Manual Payout`,
          ].join('\n');
        }

        await tgNotify(msg);
      }
    } catch (e) {
      log(`[AUTO-END] ❌ End request failed: ${e.message}`);
    }
  }
}

// ── Scan lottery main address for anonymous entries ──────────
const INSIGHT_BASE = 'https://insight.dash.org/insight-api';
const INSIGHT_H    = { 'User-Agent': 'Mozilla/5.0 TimelyWorks/1.0', 'Accept': 'application/json' };

async function insightGet(path, opts = {}) {
  const r = await fetch(INSIGHT_BASE + path, { headers: INSIGHT_H, signal: AbortSignal.timeout(10000) });
  // 404 = address exists but no transactions — return empty gracefully
  if (r.status === 404) return opts.emptyVal ?? null;
  if (!r.ok) throw new Error(`Insight HTTP ${r.status}`);
  return r.json();
}

async function scanLotteryAddress() {
  const store = readStore();
  if (!store) return;

  const lottery = Object.values(store.lotteries || {}).find(l => l.status === 'active');
  if (!lottery) return;

  try {
    // Use /addr/{address} to get txids, then fetch each tx individually
    // (the /txs?from=0&to=50 endpoint returns 404 on Dash Insight)
    const addrInfo = await insightGet(`/addr/${lottery.address}`, { emptyVal: null });
    const txids = addrInfo?.transactions || [];
    if (!txids.length) {
      log(`[ANON] No TXs found for lottery address yet — waiting`);
      return;
    }

    // Fetch all txs concurrently
    const txResults = await Promise.allSettled(
      txids.slice(0, 50).map(txid =>
        fetch(INSIGHT_BASE + `/tx/${txid}`, { headers: INSIGHT_H, signal: AbortSignal.timeout(10000) })
          .then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );
    const txs = txResults.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);

    if (!txs.length) {
      log(`[ANON] Could not fetch TX details for lottery address`);
      return;
    }

    // TXIDs of our own split transactions — these create change outputs back to
    // the lottery address that must NOT be treated as new user deposits
    const lotterySplitTxIds = lottery.splitTxIds || [];

    let newEntries = 0;
    for (const tx of txs) {
      const txid = tx.txid;

      // Skip our own split TXs (change output goes back to lottery address)
      if (lotterySplitTxIds.includes(txid)) continue;

      // Skip unconfirmed transactions
      if ((tx.confirmations || 0) < 1) continue;

      // Skip if we've already processed this TX for an anonymous entry
      const alreadyRecorded = Object.values(store.entries || {}).some(
        e => e.lotteryId === lottery.id && e.verifiedTxIds?.includes(txid)
      );
      if (alreadyRecorded) continue;

      // Check how much was sent to the lottery address in this specific TX
      let amountDash = 0;
      for (const out of (tx.vout || [])) {
        const addrs = out.scriptPubKey?.addresses || [];
        if (addrs.includes(lottery.address)) {
          amountDash += parseFloat(out.value) || 0;
        }
      }
      if (amountDash < 0.099) continue; // minimum 0.1 DASH

      // Try to get sender address from first input
      let senderAddr = null;
      const firstIn = tx.vin?.[0];
      if (firstIn?.addr) senderAddr = firstIn.addr;

      // Correct formula: avoids floating-point errors (e.g. 0.3/0.1 = 2 in JS)
      const tickets = Math.floor(Math.round(amountDash * 1e8) / 1e7);
      log(`[ANON] New anonymous entry: ${amountDash.toFixed(4)} DASH = ${tickets} ticket(s) from ${senderAddr || 'unknown'}`);

      // Build anonymous entry directly in store
      const entryId = `anon-${txid.slice(0,10)}`;
      if (store.entries[entryId]) continue;

      // Get next entry address index for a deposit address
      store.entryAddressIndex = (store.entryAddressIndex || 0);
      const entryAddr = lottery.address; // anonymous entries use lottery address as deposit addr

      const newEntry = {
        id:             entryId,
        lotteryId:      lottery.id,
        dashAddress:    senderAddr || `anon-${txid.slice(0,8)}`,
        dashReceiveAddress: senderAddr || undefined,
        displayName:    senderAddr ? `${senderAddr.slice(0,6)}...${senderAddr.slice(-4)}` : 'Anonymous',
        isAnonymous:    true,
        entryAddress:   lottery.address,
        entryAddressIndex: -1,
        dashContributed: amountDash,
        baseTickets:    tickets,
        upvoteTickets:  0,
        totalTickets:   tickets,
        verifiedTxIds:  [txid],
        upvoters:       [],
        upvotedEntries: [],
        votusCredits:   tickets,
        votusSpent:     0,
        votusAvailable: tickets,
        createdAt:      tx.time ? tx.time * 1000 : Date.now(),
      };
      store.entries[entryId] = newEntry;

      // Update lottery totals
      const allEntries = Object.values(store.entries).filter(e => e.lotteryId === lottery.id);
      lottery.totalDash       = allEntries.reduce((s, e) => s + (e.dashContributed || 0), 0);
      lottery.totalTickets    = allEntries.reduce((s, e) => s + (e.totalTickets || 0), 0);
      lottery.participantCount = allEntries.length;
      store.lotteries[lottery.id] = lottery;

      newEntries++;
    }

    if (newEntries > 0) {
      fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
      log(`[ANON] ✅ Created ${newEntries} anonymous entries from lottery address`);
    }
  } catch (e) {
    log(`[ANON] Error scanning lottery address: ${e.message}`);
  }
}

// ── Ticker ───────────────────────────────────────────────────
log('============================================================');
log(`Timely.Works Worker starting — BASE_URL=${BASE_URL}`);
log('============================================================');

let tickCount = 0;

// ── Stuck payout retry ─────────────────────────────────────────────────────
async function checkStuckPayouts() {
  const store = readStore();
  if (!store) return;
  const lotteries = Object.values(store.lotteries || {});
  const stuck = lotteries.filter(l =>
    l.status === 'ended' && l.winnerId && !l.winnerTxId
  );
  for (const lottery of stuck) {
    log(`[REPAYOUT] 🔄 Retrying payout for lottery ${lottery.id} (winner: ${lottery.winnerName || lottery.winnerId})`);
    try {
      const r = await fetch(`${BASE_URL}/api/lottery/repayout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PW, lotteryId: lottery.id }),
        signal: AbortSignal.timeout(60000),
      });
      const d = await r.json();
      if (d.error) {
        log(`[REPAYOUT] ❌ Failed: ${d.error}`);
      } else if (d.txId) {
        log(`[REPAYOUT] ✅ Payout sent! TX: ${d.txId} | winner: ${d.winnerSent} DASH`);
        await tgNotify(
          `🏆 <b>TIMELY.WORKS — Payout Complete!</b>\n\n` +
          `🎉 Winner: <b>${lottery.winnerName || lottery.winnerId}</b>\n` +
          `💰 Prize: <b>${d.winnerSent?.toFixed(4)} DASH</b>\n` +
          `🔗 TX: <code>${d.txId}</code>\n\ntimely.works/winners`
        );
      } else {
        log(`[REPAYOUT] ⚠️ No TX returned: ${JSON.stringify(d)}`);
      }
    } catch (e) {
      log(`[REPAYOUT] ❌ Error: ${e.message}`);
    }
  }
}

// ── Auto Admin: start new lottery when none active ──────────────────────────
async function checkAutoStart() {
  try {
    const store = readStore();
    if (!store) return;

    // Check settings — autoAdmin must be enabled
    const settings = store.adminSettings || {};
    if (!settings.autoAdmin) {
      log('[AUTO-START] Auto Admin disabled — skipping');
      return;
    }

    // Check if there's already an active lottery
    const lotteries = Object.values(store.lotteries || {});
    const active = lotteries.find(l => l.status === 'active');
    if (active) {
      // Already running — nothing to do
      return;
    }

    // ✅ FIX: Auto-start whenever NO active lottery exists + Auto Admin is ON
    // No longer requires a previous ended lottery (cold start supported)
    log('[AUTO-START] 🤖 No active lottery — triggering autonomous start...');
    const r = await fetch(`${BASE_URL}/api/admin/auto-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PW, force: true }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json();
    if (d.ok) {
      log(`[AUTO-START] ✅ "${d.lottery?.title}" | ${d.durationDays} days | ${d.lottery?.id}`);
    } else if (d.reason === 'Lottery already active') {
      log('[AUTO-START] Already active — OK');
    } else {
      log(`[AUTO-START] ⚠️ Response: ${JSON.stringify(d)}`);
    }
  } catch (e) {
    log(`[AUTO-START] ❌ Error: ${e.message}`);
  }
}

// Immediate boot scans
checkAutoEnd().then(() => {
  log('[BOOT] Initial auto-end check done');
  return checkStuckPayouts();
}).then(() => {
  log('[BOOT] Stuck payout check done');
  return checkAutoStart();  // ← always check on boot
}).then(() => log('[BOOT] Auto-start check done'));
runScan().then(() => log('[BOOT] Initial scan complete'));

// Scan blockchain every 5 seconds — faster live updates
setInterval(async () => {
  tickCount++;
  await runScan();
  // Every 60s (every 12 ticks at 5s) check for expired + stuck payouts + auto-start
  if (tickCount % 12 === 0) {
    await checkAutoEnd();
    await checkStuckPayouts();
    await checkAutoStart();   // ← autonomous mode: always check for gap
  }
}, 5 * 1000);
