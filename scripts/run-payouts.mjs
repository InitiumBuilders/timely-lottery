/**
 * TIMELY LOTTERY — MANUAL PAYOUT SCRIPT
 * Sweeps ALL funded entry deposit addresses from all ended lotteries
 * to a specified DASH address. Updates the store with TX IDs.
 *
 * Usage: node scripts/run-payouts.mjs <DASH_RECEIVE_ADDRESS>
 */

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dashcore = require('@dashevo/dashcore-lib');
const { Mnemonic, HDPrivateKey, Networks, PrivateKey, Transaction, Script } = dashcore;

// ── Config ────────────────────────────────────────────────────────────────────

const MNEMONIC = process.env.DASH_MNEMONIC;
if (!MNEMONIC) {
  // Try loading from .env.local — strip surrounding quotes
  try {
    const env = readFileSync('/root/.openclaw/workspace/timely-lottery/.env.local', 'utf-8');
    for (const line of env.split('\n')) {
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const k = line.slice(0, eqIdx).trim();
      if (k === 'DASH_MNEMONIC') {
        let v = line.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        process.env.DASH_MNEMONIC = v;
      }
    }
  } catch { }
}
const mnemonic = process.env.DASH_MNEMONIC;
if (!mnemonic) { console.error('❌ DASH_MNEMONIC not set'); process.exit(1); }

const TO_ADDRESS = process.argv[2];
if (!TO_ADDRESS || !/^X[1-9A-HJ-NP-Za-km-z]{33}$/.test(TO_ADDRESS)) {
  console.error(`❌ Usage: node scripts/run-payouts.mjs <DASH_ADDRESS>`);
  console.error(`   Address must start with X and be 34 chars (mainnet)`);
  process.exit(1);
}

const INSIGHT = 'https://insight.dash.org/insight-api';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; TimelyLottery/1.0)', 'Accept': 'application/json' };
const DATA_FILE = '/root/.openclaw/workspace/timely-lottery-data/store.json';
const NETWORK = Networks.mainnet;
const COIN_TYPE = 5;

// ── Key derivation ────────────────────────────────────────────────────────────

function deriveKey(path) {
  const seed = new Mnemonic(mnemonic).toSeed();
  const hdKey = HDPrivateKey.fromSeed(seed, NETWORK);
  return hdKey.derive(path).privateKey;
}

function deriveEntryKey(index) {
  return deriveKey(`m/44'/${COIN_TYPE}'/2'/0/${index}`);
}

function deriveLotteryKey(index) {
  return deriveKey(`m/44'/${COIN_TYPE}'/1'/0/${index}`);
}

// ── Blockchain helpers ─────────────────────────────────────────────────────────

async function getUTXOs(address) {
  const res = await fetch(`${INSIGHT}/addr/${address}/utxo`, { headers: HEADERS });
  if (!res.ok) return [];
  return await res.json();
}

async function broadcastTx(rawtx) {
  const res = await fetch(`${INSIGHT}/tx/send`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawtx }),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Insight returned a plain-text error
    throw new Error(`Broadcast API error: ${text}`);
  }
}

async function sweepAddress(privKey, fromAddr, toAddr, label) {
  const utxos = await getUTXOs(fromAddr);
  if (!utxos.length) {
    console.log(`  ⏭ ${label} (${fromAddr.slice(0,16)}...) — no UTXOs, skipping`);
    return null;
  }

  const totalSat = utxos.reduce((s, u) => s + u.satoshis, 0);

  if (totalSat < 20000) {
    console.log(`  ⏭ ${label} — balance too low (${totalSat} sats)`);
    return null;
  }

  console.log(`  💸 ${label}: ${(totalSat/1e8).toFixed(4)} DASH → ${toAddr.slice(0,16)}...`);

  const utxoObjs = utxos.map(u => ({
    txId:        u.txid,
    outputIndex: u.vout,
    satoshis:    u.satoshis,
    script:      Script.fromAddress(fromAddr).toString(),
  }));

  // Dash fee: 1000 sats (~5 sats/byte for typical 192-byte tx)
  // Insight node has maxfeerate ~10 sats/byte — MUST stay under that
  const feeSat = 1000;
  const sendSat = totalSat - feeSat;

  if (sendSat <= 0) {
    console.log(`  ⏭ ${label} — after fee (${feeSat} sats), nothing left`);
    return null;
  }

  console.log(`     Fee: ${feeSat} sats | Sending: ${(sendSat/1e8).toFixed(6)} DASH`);

  const tx = new Transaction()
    .from(utxoObjs)
    .to(toAddr, sendSat)
    .sign(privKey);
  const raw = tx.serialize();
  const result = await broadcastTx(raw);

  if (!result.txid) {
    console.error(`  ❌ Broadcast failed:`, result);
    return null;
  }

  const sent = sendSat / 1e8;
  console.log(`  ✅ TX: ${result.txid}`);
  console.log(`     Sent: ${sent.toFixed(4)} DASH`);
  console.log(`     View: https://insight.dash.org/insight/tx/${result.txid}`);
  return { txid: result.txid, sent };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏆 TIMELY LOTTERY PAYOUT SCRIPT`);
  console.log(`   Sending all pending payouts → ${TO_ADDRESS}\n`);

  const store = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  const allTxIds = [];

  // Find all ended lotteries with unpaid winners
  const endedLotteries = Object.values(store.lotteries)
    .filter(l => l.status === 'ended');

  console.log(`Found ${endedLotteries.length} ended lottery(s)\n`);

  for (const lottery of endedLotteries) {
    console.log(`━━━ Lottery: ${lottery.title} (${lottery.id}) ━━━`);
    console.log(`    Prize pool: ${lottery.totalDash} DASH | Winner: ${lottery.winnerName || 'unknown'}`);

    // Get all funded entries for this lottery
    const entries = Object.values(store.entries)
      .filter(e => e.lotteryId === lottery.id && e.dashContributed > 0);

    console.log(`    Funded entries: ${entries.length}`);

    const lotteryTxIds = [];

    // Sweep each entry deposit address
    for (const entry of entries) {
      if (entry.entryAddressIndex === undefined || entry.entryAddressIndex === null) continue;
      const privKey = deriveEntryKey(entry.entryAddressIndex);
      const addr = privKey.toAddress(NETWORK).toString();
      const result = await sweepAddress(privKey, addr, TO_ADDRESS, `Entry ${entry.id.slice(0,8)} (idx=${entry.entryAddressIndex})`);
      if (result) {
        lotteryTxIds.push(result.txid);
        allTxIds.push(result.txid);
      }
    }

    // Also sweep the shared lottery address if it has balance
    if (lottery.addressIndex !== undefined) {
      const lPrivKey = deriveLotteryKey(lottery.addressIndex);
      const lAddr = lPrivKey.toAddress(NETWORK).toString();
      const result = await sweepAddress(lPrivKey, lAddr, TO_ADDRESS, `Lottery shared address (idx=${lottery.addressIndex})`);
      if (result) {
        lotteryTxIds.push(result.txid);
        allTxIds.push(result.txid);
      }
    }

    // Update store with payout info
    if (lotteryTxIds.length > 0) {
      lottery.winnerTxId = lotteryTxIds[0];
      store.lotteries[lottery.id] = lottery;

      // Update winner record
      const winnerIdx = store.winners.findIndex(w => w.lotteryId === lottery.id);
      if (winnerIdx >= 0) {
        store.winners[winnerIdx].payoutTxId  = lotteryTxIds[0];
        store.winners[winnerIdx].payoutTxIds = lotteryTxIds;
        store.winners[winnerIdx].payoutTo    = TO_ADDRESS;
      }

      console.log(`    ✅ ${lotteryTxIds.length} TX(s) recorded for ${lottery.title}`);
    } else {
      console.log(`    ⚠️  No UTXOs swept for ${lottery.title} (may already be paid out)`);
    }
    console.log('');
  }

  // Save updated store
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  console.log('💾 Store updated with payout TX IDs\n');

  if (allTxIds.length === 0) {
    console.log('⚠️  No transactions were sent. Addresses may be empty already.');
  } else {
    console.log(`\n🏆 PAYOUT COMPLETE — ${allTxIds.length} transaction(s) sent!`);
    console.log('TX Links:');
    for (const txid of allTxIds) {
      console.log(`  → https://insight.dash.org/insight/tx/${txid}`);
    }
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
