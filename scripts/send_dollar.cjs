const fs = require('fs');
const path = require('path');

// Load env
const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const mnemonic = env.match(/DASH_MNEMONIC="([^"]+)"/)?.[1];
if (!mnemonic) { console.error('No mnemonic'); process.exit(1); }

const dc = require('../node_modules/@dashevo/dashcore-lib');
const { Mnemonic, HDPrivateKey, Networks, Transaction } = dc;

const NETWORK = 'mainnet';
const DASH_NET = Networks.mainnet;
const INSIGHT_BASE = 'https://insight.dash.org/insight-api';
const INSIGHT_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; TimelyLottery/1.0)', 'Accept': 'application/json' };

// Derive dev wallet (m/44'/5'/0'/0/0)
const seed = new Mnemonic(mnemonic).toSeed();
const hdKey = HDPrivateKey.fromSeed(seed, DASH_NET);
const derived = hdKey.derive("m/44'/5'/0'/0/0");
const privKey = derived.privateKey;
const fromAddr = privKey.toAddress(DASH_NET).toString();

const TO_ADDR   = process.argv[2] || 'Xv8GAV5sVZF5dUMNwn9t8ZKtWAoBe8WSub';
const SEND_SATS = parseInt(process.argv[3] || '3000000'); // 0.03 DASH default
const FEE_SATS  = 1000;

console.log(`From: ${fromAddr}`);
console.log(`To:   ${TO_ADDR}`);
console.log(`Amt:  ${SEND_SATS/1e8} DASH`);

async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { ...INSIGHT_HEADERS, ...(opts.headers||{}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  const utxos = await fetchJSON(`${INSIGHT_BASE}/addr/${fromAddr}/utxo`);
  console.log(`UTXOs found: ${utxos.length}`);
  if (!utxos.length) throw new Error('No UTXOs available');

  const total = utxos.reduce((s, u) => s + u.satoshis, 0);
  console.log(`Total available: ${total/1e8} DASH`);

  const tx = new Transaction()
    .from(utxos)
    .to(TO_ADDR, SEND_SATS)
    .fee(FEE_SATS)
    .change(fromAddr)
    .sign(privKey);

  const raw = tx.serialize();
  console.log(`TX bytes: ${raw.length / 2}`);

  const result = await fetchJSON(`${INSIGHT_BASE}/tx/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawtx: raw }),
  });

  console.log(`\n✅ SENT! TxID: ${result.txid}`);
  console.log(`🔗 https://insight.dash.org/insight/#/tx/${result.txid}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
