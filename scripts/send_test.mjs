import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dc = require('@dashevo/dashcore-lib');
const fs = require('fs');

// Load mnemonic
const env = fs.readFileSync('/root/.openclaw/workspace/timely-lottery/.env.local', 'utf-8');
const mnemonic = env.match(/DASH_MNEMONIC="([^"]+)"/)?.[1];

const INSIGHT_HEADERS = {
  'User-Agent': 'TimelyWorks/1.0',
  'Accept': 'application/json',
};

// Derive dev wallet address (m/44'/5'/0'/0/0)
const hdKey = dc.HDPrivateKey.fromSeed(
  Buffer.from(require('bip39').mnemonicToSeedSync(mnemonic))
);
const childKey = hdKey.deriveChild("m/44'/5'/0'/0/0");
const address  = childKey.publicKey.toAddress('mainnet').toString();
const privKey  = childKey.privateKey;

const TO_ADDRESS = 'Xv8GAV5sVZF5dUMNwn9t8ZKtWAoBe8WSub';  // August's address
const SEND_DUFFS = 3000000;   // 0.03 DASH = ~$1.02
const FEE_DUFFS  = 1000;      // 1000 duffs fee

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, { ...opts, headers: INSIGHT_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function send() {
  console.log('From:', address);
  console.log('To:  ', TO_ADDRESS);
  console.log('Amt:  0.03 DASH (~$1.02)');
  
  // Get UTXOs
  const utxos = await fetchJSON(`https://insight.dash.org/insight-api/addr/${address}/utxo`);
  console.log(`UTXOs: ${utxos.length}`);
  if (!utxos.length) throw new Error('No UTXOs');

  // Build tx
  const tx = new dc.Transaction()
    .from(utxos)
    .to(TO_ADDRESS, SEND_DUFFS)
    .fee(FEE_DUFFS)
    .change(address)
    .sign(privKey);

  const raw = tx.serialize();
  console.log('TX size:', raw.length / 2, 'bytes');

  // Broadcast
  const result = await fetchJSON('https://insight.dash.org/insight-api/tx/send', {
    method: 'POST',
    headers: { ...INSIGHT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawtx: raw }),
  });
  
  console.log('✅ SENT! TxID:', result.txid);
  return result.txid;
}

send().catch(e => console.error('❌ Error:', e.message));
