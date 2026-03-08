// ─── DASH utilities: address generation + transaction verification ────────────
// Using require for dashcore-lib (CJS module, no named ES exports in TS)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dashcore = require('@dashevo/dashcore-lib');
const { Mnemonic, HDPrivateKey, Networks, PrivateKey, Transaction, Script } = dashcore;

const NETWORK  = process.env.DASH_NETWORK || 'mainnet';
const DASH_NET = NETWORK === 'mainnet' ? Networks.mainnet : Networks.testnet;

// Insight API blocks Node.js fetch without a UA header — always include it
const INSIGHT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TimelyLottery/1.0)',
  'Accept': 'application/json',
};

const INSIGHT_BASE = NETWORK === 'mainnet'
  ? 'https://insight.dash.org/insight-api'
  : 'https://testnet-insight.dashevo.org/insight-api';

// ─── Address generation ───────────────────────────────────────────────────────

export function deriveLotteryAddress(index: number): { address: string; wif: string } {
  const mnemonic = process.env.DASH_MNEMONIC;
  if (!mnemonic) throw new Error('DASH_MNEMONIC not set');

  const seed      = new Mnemonic(mnemonic).toSeed();
  const coinType  = NETWORK === 'mainnet' ? 5 : 1;
  const hdKey     = HDPrivateKey.fromSeed(seed, DASH_NET);
  const derived   = hdKey.derive(`m/44'/${coinType}'/1'/0/${index}`);
  const privKey   = derived.privateKey;
  const address   = privKey.toAddress(DASH_NET).toString();
  const wif       = privKey.toWIF();
  return { address, wif };
}

// Unique deposit address for each entry — uses account=2' to avoid collisions
// Path: m/44'/5'/2'/0/{index}
export function deriveEntryAddress(index: number): { address: string; wif: string } {
  const mnemonic = process.env.DASH_MNEMONIC;
  if (!mnemonic) throw new Error('DASH_MNEMONIC not set');
  const seed      = new Mnemonic(mnemonic).toSeed();
  const coinType  = NETWORK === 'mainnet' ? 5 : 1;
  const hdKey     = HDPrivateKey.fromSeed(seed, DASH_NET);
  const derived   = hdKey.derive(`m/44'/${coinType}'/2'/0/${index}`);
  const privKey   = derived.privateKey;
  return { address: privKey.toAddress(DASH_NET).toString(), wif: privKey.toWIF() };
}

export function getLotteryQRData(address: string): string {
  return `dash:${address}`;
}

// ─── The Timely Reserve — fixed HD address (m/44'/5'/5'/0/0) ─────────────────
// This address is permanent and holds the 10% community reserve allocation.
export function deriveReserveAddress(): { address: string; wif: string } {
  const mnemonic = process.env.DASH_MNEMONIC;
  if (!mnemonic) throw new Error('DASH_MNEMONIC not set');
  const seed     = new Mnemonic(mnemonic).toSeed();
  const coinType = NETWORK === 'mainnet' ? 5 : 1;
  const hdKey    = HDPrivateKey.fromSeed(seed, DASH_NET);
  const derived  = hdKey.derive(`m/44'/${coinType}'/5'/0/0`);
  return { address: derived.privateKey.toAddress(DASH_NET).toString(), wif: derived.privateKey.toWIF() };
}

// Next Lottery Fund address — per-lottery rolling pot (m/44'/5'/6'/0/{index})
export function deriveNextLotteryFundAddress(index: number): { address: string; wif: string } {
  const mnemonic = process.env.DASH_MNEMONIC;
  if (!mnemonic) throw new Error('DASH_MNEMONIC not set');
  const seed     = new Mnemonic(mnemonic).toSeed();
  const coinType = NETWORK === 'mainnet' ? 5 : 1;
  const hdKey    = HDPrivateKey.fromSeed(seed, DASH_NET);
  const derived  = hdKey.derive(`m/44'/${coinType}'/6'/0/${index}`);
  return { address: derived.privateKey.toAddress(DASH_NET).toString(), wif: derived.privateKey.toWIF() };
}

// ─── Transaction queries ──────────────────────────────────────────────────────

interface InsightTx {
  txid: string;
  vin: Array<{ addr?: string }>;
  vout: Array<{ value: string; scriptPubKey: { addresses?: string[] } }>;
  confirmations: number;
  time: number;
}

export async function getAddressInfo(address: string) {
  try {
    const res = await fetch(`${INSIGHT_BASE}/addr/${address}`, {
      headers: INSIGHT_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export interface TxContribution {
  txId: string;
  fromAddress: string;
  amount: number;
  confirmations: number;
  timestamp: number;
}

export async function getContributions(lotteryAddress: string): Promise<TxContribution[]> {
  try {
    const info = await getAddressInfo(lotteryAddress);
    if (!info || !info.transactions?.length) return [];

    const txids: string[] = (info.transactions as string[]).slice(0, 50);
    const txResults = await Promise.allSettled(
      txids.map(txid =>
        fetch(`${INSIGHT_BASE}/tx/${txid}`, { headers: INSIGHT_HEADERS, cache: 'no-store' })
          .then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );

    const contributions: TxContribution[] = [];
    for (const result of txResults) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const tx = result.value as InsightTx;

      let received = 0;
      for (const vout of tx.vout) {
        if (vout.scriptPubKey?.addresses?.includes(lotteryAddress)) {
          received += parseFloat(vout.value);
        }
      }
      if (received <= 0) continue;

      contributions.push({
        txId:          tx.txid,
        fromAddress:   tx.vin[0]?.addr || 'unknown',
        amount:        received,
        confirmations: tx.confirmations,
        timestamp:     tx.time * 1000,
      });
    }
    return contributions;
  } catch { return []; }
}

export async function getConfirmedReceived(address: string): Promise<number> {
  const info = await getAddressInfo(address);
  return info ? (info.totalReceivedSat || 0) / 1e8 : 0;
}

// Verify a specific TX ID — returns amount received by `toAddress` in that TX
export async function verifyTxById(txId: string, toAddress: string): Promise<{
  valid: boolean; amount: number; confirmations: number; fromAddress: string; txId: string;
}> {
  // Accept full URLs like insight.dash.org/tx/TXID or just bare TXID
  const clean = txId.trim().replace(/^.*\/tx\//, '').replace(/[^a-fA-F0-9]/g, '');
  if (clean.length < 10) return { valid: false, amount: 0, confirmations: 0, fromAddress: '', txId: clean };

  try {
    const res = await fetch(`${INSIGHT_BASE}/tx/${clean}`, { headers: INSIGHT_HEADERS, cache: 'no-store' });
    if (!res.ok) return { valid: false, amount: 0, confirmations: 0, fromAddress: '', txId: clean };
    const tx: InsightTx = await res.json();

    let received = 0;
    for (const vout of tx.vout) {
      if (vout.scriptPubKey?.addresses?.includes(toAddress)) {
        received += parseFloat(vout.value);
      }
    }

    return {
      valid:         received > 0,
      amount:        received,
      confirmations: tx.confirmations,
      fromAddress:   tx.vin[0]?.addr || 'unknown',
      txId:          clean,
    };
  } catch {
    return { valid: false, amount: 0, confirmations: 0, fromAddress: '', txId: clean };
  }
}

// ─── Address validation ───────────────────────────────────────────────────────

export function isValidDashAddress(addr: string): boolean {
  return typeof addr === 'string' && /^X[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr.trim());
}

// ─── Sweep a single address to a target ──────────────────────────────────────

async function sweepAddress(fromAddr: string, wif: string, toAddress: string): Promise<{ txid: string; satsSent: number } | null> {
  if (!isValidDashAddress(toAddress)) {
    throw new Error(`Invalid DASH destination address: "${toAddress}"`);
  }

  const privKey  = PrivateKey.fromWIF(wif);
  const utxoRes  = await fetch(`${INSIGHT_BASE}/addr/${fromAddr}/utxo`, { headers: INSIGHT_HEADERS });
  if (!utxoRes.ok) {
    console.error(`[sweep] UTXO fetch failed for ${fromAddr}: HTTP ${utxoRes.status}`);
    return null;
  }
  const utxoData: Array<{ txid: string; vout: number; satoshis: number }> = await utxoRes.json();
  if (!utxoData.length) {
    console.log(`[sweep] No UTXOs at ${fromAddr} — nothing to sweep`);
    return null;
  }

  const utxos = utxoData.map((u) => ({
    txId:        u.txid,
    outputIndex: u.vout,
    satoshis:    u.satoshis,
    script:      Script.fromAddress(fromAddr).toString(),
  }));

  const totalSat = utxos.reduce((s: number, u: { satoshis: number }) => s + u.satoshis, 0);
  // Dash fee: 1000 sats (~5 sats/byte for 192-byte tx). Insight maxfeerate is ~10 sats/byte.
  // Do NOT use 10000 sats — that exceeds the node operator's maxfeerate and gets rejected.
  const feeSat   = 1000;
  const sendSat  = totalSat - feeSat;
  if (sendSat <= 0) {
    console.log(`[sweep] Not enough DASH to cover fee at ${fromAddr} (${totalSat} sats)`);
    return null;
  }

  console.log(`[sweep] Building TX: ${fromAddr} → ${toAddress} | ${sendSat} sats (${utxos.length} UTXOs)`);

  const signedTx = new Transaction().from(utxos).to(toAddress, sendSat).sign(privKey);
  const raw = signedTx.serialize();

  const broadcastRes = await fetch(`${INSIGHT_BASE}/tx/send`, {
    method: 'POST',
    headers: { ...INSIGHT_HEADERS, 'Content-Type': 'application/json' },
    body:   JSON.stringify({ rawtx: raw }),
  });
  const bd = await broadcastRes.json();

  if (!bd.txid) {
    console.error(`[sweep] Broadcast failed:`, bd);
    throw new Error(`Broadcast failed: ${JSON.stringify(bd)}`);
  }

  console.log(`[sweep] ✅ Broadcast: ${bd.txid} | ${sendSat} sats → ${toAddress}`);
  return { txid: bd.txid, satsSent: sendSat };
}

// ─── Immediate Per-Transaction Split ─────────────────────────────────────────
// Called the moment a new deposit is detected on an entry deposit address.
// Sends 10% to reserve, 5% to next lottery fund, ~85% change stays on entry address.
// Fee is subtracted from the change (winner amount) — reserve and next lottery get exact %.

export interface ImmediateSplitResult {
  splitTxId: string;
  totalDeposit: number;     // total UTXOs before split (DASH)
  reserveAmount: number;    // 10% sent to reserve (DASH)
  nextLotteryAmount: number;// 5% sent to next lottery (DASH)
  winnerAmount: number;     // ~85% remaining in entry address (DASH)
}

// Generic split from any address given its WIF — used for both entry and lottery addresses
// winnerHoldingAddr: where to collect the 85% winner portion.
//   ✅ Pass the lottery's main address — this PREVENTS the change going back to the
//   entry address and being counted as a new deposit on the next scan (infinite loop bug).
//   If omitted, change goes back to `address` (legacy — avoid in new calls).
export async function immediatelySplitFromWIF(
  address: string,
  wif: string,
  reserveAddr: string,
  nextLotteryAddr: string,
  winnerHoldingAddr?: string,   // ← NEW: where to hold the 85%
): Promise<ImmediateSplitResult | null> {
  if (!isValidDashAddress(reserveAddr) || !isValidDashAddress(nextLotteryAddr)) return null;

  const utxoRes = await fetch(`${INSIGHT_BASE}/addr/${address}/utxo`, { headers: INSIGHT_HEADERS });
  if (!utxoRes.ok) return null;
  const utxoData: Array<{ txid: string; vout: number; satoshis: number }> = await utxoRes.json();
  if (!utxoData.length) return null;

  const totalSat = utxoData.reduce((s, u) => s + u.satoshis, 0);
  if (totalSat < 5000) {
    console.log(`[immediatelySplit] Too small (${totalSat} sats) at ${address}`);
    return null;
  }

  const reserveSat     = Math.floor(totalSat * 0.10);
  const nextLotterySat = Math.floor(totalSat * 0.05);
  const feeSat         = Math.max(1000, (utxoData.length * 148 + 3 * 34 + 10) * 5);
  const changeSat      = totalSat - reserveSat - nextLotterySat - feeSat;

  if (changeSat <= 546) {
    console.log(`[immediatelySplit] Change too small (${changeSat} sats) at ${address}`);
    return null;
  }

  const utxos = utxoData.map(u => ({
    txId: u.txid, outputIndex: u.vout, satoshis: u.satoshis,
    script: Script.fromAddress(address).toString(),
  }));

  const privKey = PrivateKey.fromWIF(wif);
  // 85% goes to winnerHoldingAddr (lottery main address) if provided,
  // otherwise falls back to the entry address. Using the lottery address
  // prevents the change from triggering another deposit scan cycle.
  const holdAddr = (winnerHoldingAddr && isValidDashAddress(winnerHoldingAddr))
    ? winnerHoldingAddr
    : address;

  const tx = new Transaction()
    .from(utxos)
    .to(reserveAddr,     reserveSat)
    .to(nextLotteryAddr, nextLotterySat)
    .to(holdAddr,        changeSat)
    .sign(privKey);

  const raw = tx.serialize();
  const bd = await fetch(`${INSIGHT_BASE}/tx/send`, {
    method: 'POST',
    headers: { ...INSIGHT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawtx: raw }),
  }).then(r => r.json());

  if (!bd.txid) {
    console.error(`[immediatelySplit] Broadcast failed at ${address}:`, bd);
    return null;
  }

  const result: ImmediateSplitResult = {
    splitTxId:         bd.txid,
    totalDeposit:      totalSat / 1e8,
    reserveAmount:     reserveSat / 1e8,
    nextLotteryAmount: nextLotterySat / 1e8,
    winnerAmount:      changeSat / 1e8,
  };
  console.log(`[immediatelySplit] ✅ ${bd.txid} | total=${result.totalDeposit} reserve=${result.reserveAmount} next=${result.nextLotteryAmount} DASH`);
  return result;
}

// Convenience wrapper — splits an entry deposit address by index
// Pass winnerHoldingAddr (lottery main address) to prevent change going back to entry address
export async function immediatelySplit(
  entryAddressIndex: number,
  reserveAddr: string,
  nextLotteryAddr: string,
  winnerHoldingAddr?: string,   // ← pass lottery.address here!
): Promise<ImmediateSplitResult | null> {
  const { address, wif } = deriveEntryAddress(entryAddressIndex);
  return immediatelySplitFromWIF(address, wif, reserveAddr, nextLotteryAddr, winnerHoldingAddr);
}

// ─── 85/10/5 Split Payout ────────────────────────────────────────────────────
// Collects all UTXOs from entry addresses + lottery address,
// then builds ONE multi-input/multi-output TX:
//   • 85% → winner
//   • 10% → The Timely Reserve
//   •  5% → next lottery fund address
// Fee is subtracted from the total before splitting.

export interface SplitPayoutResult {
  txId?: string;
  winnerSent: number;     // DASH (85%)
  reserveSent: number;    // DASH (10%)
  nextLotterySent: number;// DASH (5%)
  errors: string[];
}

export async function splitPayout(
  lotteryAddressIndex: number,
  winnerAddr: string,
  reserveAddr: string,
  nextLotteryAddr: string,
  entryAddressIndices: number[],
): Promise<SplitPayoutResult> {
  if (!isValidDashAddress(winnerAddr))  return { errors: [`Invalid winner address: ${winnerAddr}`], winnerSent: 0, reserveSent: 0, nextLotterySent: 0 };
  if (!isValidDashAddress(reserveAddr)) return { errors: [`Invalid reserve address: ${reserveAddr}`], winnerSent: 0, reserveSent: 0, nextLotterySent: 0 };
  if (!isValidDashAddress(nextLotteryAddr)) return { errors: [`Invalid next lottery address: ${nextLotteryAddr}`], winnerSent: 0, reserveSent: 0, nextLotterySent: 0 };

  const errors: string[] = [];

  // Step 1: Collect all UTXOs + private keys from every funded address
  const utxoItems: Array<{
    txId: string; outputIndex: number; satoshis: number; script: string; wif: string;
  }> = [];

  const addUtxos = async (address: string, wif: string) => {
    try {
      const res = await fetch(`${INSIGHT_BASE}/addr/${address}/utxo`, { headers: INSIGHT_HEADERS });
      if (!res.ok) return;
      const data: Array<{ txid: string; vout: number; satoshis: number }> = await res.json();
      for (const u of data) {
        if (u.satoshis > 0) {
          utxoItems.push({
            txId: u.txid, outputIndex: u.vout, satoshis: u.satoshis,
            script: Script.fromAddress(address).toString(), wif,
          });
        }
      }
    } catch (e) { errors.push(`UTXO fetch ${address.slice(0,10)}: ${e instanceof Error ? e.message : String(e)}`); }
  };

  // Gather from all entry deposit addresses
  await Promise.allSettled(entryAddressIndices.map(idx => {
    const { address, wif } = deriveEntryAddress(idx);
    return addUtxos(address, wif);
  }));

  // Gather from main lottery address
  const { address: lAddr, wif: lWif } = deriveLotteryAddress(lotteryAddressIndex);
  await addUtxos(lAddr, lWif);

  if (!utxoItems.length) return { errors: [...errors, 'No UTXOs found'], winnerSent: 0, reserveSent: 0, nextLotterySent: 0 };

  // Step 2: Calculate fee + split
  const totalSat   = utxoItems.reduce((s, u) => s + u.satoshis, 0);
  const estFeeSat  = Math.max(1000, (utxoItems.length * 148 + 3 * 34 + 10) * 5);
  const netSat     = totalSat - estFeeSat;
  if (netSat <= 10000) return { errors: [...errors, 'Insufficient funds after fee'], winnerSent: 0, reserveSent: 0, nextLotterySent: 0 };

  const reserveSat     = Math.floor(netSat * 0.10);
  const nextLotterySat = Math.floor(netSat * 0.05);
  const winnerSat      = netSat - reserveSat - nextLotterySat; // remainder = ~85%, absorbs rounding

  // Step 3: Build multi-input multi-output transaction
  try {
    const tx = new Transaction()
      .from(utxoItems.map(u => ({ txId: u.txId, outputIndex: u.outputIndex, satoshis: u.satoshis, script: u.script })))
      .to(winnerAddr,      winnerSat)
      .to(reserveAddr,     reserveSat)
      .to(nextLotteryAddr, nextLotterySat);

    // Sign with each unique private key (handles multi-address inputs)
    const wifSeen: Record<string, boolean> = {};
    for (const u of utxoItems) {
      if (!wifSeen[u.wif]) { wifSeen[u.wif] = true; tx.sign(PrivateKey.fromWIF(u.wif)); }
    }

    const raw = tx.serialize();
    const bd  = await fetch(`${INSIGHT_BASE}/tx/send`, {
      method: 'POST',
      headers: { ...INSIGHT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawtx: raw }),
    }).then(r => r.json());

    if (!bd.txid) throw new Error(`Broadcast failed: ${JSON.stringify(bd)}`);

    console.log(`[splitPayout] ✅ ${bd.txid} | winner=${winnerSat} reserve=${reserveSat} nextLottery=${nextLotterySat} sats`);
    return { txId: bd.txid, winnerSent: winnerSat / 1e8, reserveSent: reserveSat / 1e8, nextLotterySent: nextLotterySat / 1e8, errors };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[splitPayout] TX failed:', msg);
    return { errors: [...errors, `TX: ${msg}`], winnerSent: 0, reserveSent: 0, nextLotterySent: 0 };
  }
}

// ─── Winner payout: sweep ALL entry addresses + shared lottery address ────────

export interface PayoutResult {
  txIds:     string[];
  totalSent: number;
  errors:    string[];
}

export async function payoutWinner(
  lotteryAddressIndex: number,
  toAddress: string,
  entryAddressIndices: number[] = [],
): Promise<PayoutResult> {
  if (!isValidDashAddress(toAddress)) {
    return {
      txIds: [],
      totalSent: 0,
      errors: [`Invalid DASH destination: "${toAddress}". Must be a mainnet address starting with X.`],
    };
  }

  const txIds: string[] = [];
  const errors: string[] = [];
  let totalSent = 0;

  // 1) Sweep all individual entry deposit addresses
  for (const idx of entryAddressIndices) {
    try {
      const { address, wif } = deriveEntryAddress(idx);
      // Check current UTXO balance (not totalReceived — might be already spent)
      const utxoRes = await fetch(`${INSIGHT_BASE}/addr/${address}/utxo`, { headers: INSIGHT_HEADERS });
      if (!utxoRes.ok) continue;
      const utxos: Array<{ satoshis: number }> = await utxoRes.json();
      if (!utxos.length) continue;
      const balSat = utxos.reduce((s, u) => s + u.satoshis, 0);
      if (balSat < 10001) continue; // less than fee, skip

      const result = await sweepAddress(address, wif, toAddress);
      if (result) {
        txIds.push(result.txid);
        totalSent += result.satsSent / 1e8;
        console.log(`[payout] ✅ Swept entry idx=${idx} addr=${address} → txid=${result.txid}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[payout] ❌ Entry idx=${idx} failed:`, msg);
      errors.push(`Entry ${idx}: ${msg}`);
    }
  }

  // 2) Sweep shared lottery address (catches any direct deposits to it)
  try {
    const { address: lAddr, wif: lWif } = deriveLotteryAddress(lotteryAddressIndex);
    const lutxoRes = await fetch(`${INSIGHT_BASE}/addr/${lAddr}/utxo`, { headers: INSIGHT_HEADERS });
    if (lutxoRes.ok) {
      const lutxos: Array<{ satoshis: number }> = await lutxoRes.json();
      if (lutxos.length > 0) {
        const result = await sweepAddress(lAddr, lWif, toAddress);
        if (result) {
          txIds.push(result.txid);
          totalSent += result.satsSent / 1e8;
          console.log(`[payout] ✅ Swept lottery addr=${lAddr} → txid=${result.txid}`);
        }
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[payout] ❌ Lottery addr sweep failed:`, msg);
    errors.push(`Lottery addr: ${msg}`);
  }

  return { txIds, totalSent, errors };
}

// ─── Direct Sweep (no split) — use when 15% already taken on deposit ─────────
// Sweeps all UTXOs from all entry deposit addresses + lottery main address
// directly to the winner. No 85/10/5 split — that already happened on deposit.

export interface DirectSweepResult {
  txId?: string;
  totalSent: number;   // DASH swept to winner
  errors: string[];
}

export async function directSweepAllToWinner(
  lotteryAddressIndex: number,
  winnerAddr: string,
  entryAddressIndices: number[],
): Promise<DirectSweepResult> {
  if (!isValidDashAddress(winnerAddr)) {
    return { errors: [`Invalid winner address: ${winnerAddr}`], totalSent: 0 };
  }

  const errors: string[] = [];
  const utxoItems: Array<{
    txId: string; outputIndex: number; satoshis: number; script: string; wif: string;
  }> = [];

  const addUtxos = async (address: string, wif: string) => {
    try {
      const res = await fetch(`${INSIGHT_BASE}/addr/${address}/utxo`, { headers: INSIGHT_HEADERS });
      if (!res.ok) return;
      const data: Array<{ txid: string; vout: number; satoshis: number }> = await res.json();
      for (const u of data) {
        if (u.satoshis > 0) {
          utxoItems.push({
            txId: u.txid, outputIndex: u.vout, satoshis: u.satoshis,
            script: Script.fromAddress(address).toString(), wif,
          });
        }
      }
    } catch (e) { errors.push(`UTXO fetch ${address.slice(0,10)}: ${e instanceof Error ? e.message : String(e)}`); }
  };

  // Gather UTXOs from all entry deposit addresses
  await Promise.allSettled(entryAddressIndices.map(idx => {
    const { address, wif } = deriveEntryAddress(idx);
    return addUtxos(address, wif);
  }));

  // Gather UTXOs from main lottery address (catches any unprocessed direct sends)
  const { address: lAddr, wif: lWif } = deriveLotteryAddress(lotteryAddressIndex);
  await addUtxos(lAddr, lWif);

  if (!utxoItems.length) return { errors: [...errors, 'No UTXOs found — funds may already be paid out'], totalSent: 0 };

  const totalSat  = utxoItems.reduce((s, u) => s + u.satoshis, 0);
  const feeSat    = Math.max(1000, (utxoItems.length * 148 + 34 + 10) * 5);
  const sendSat   = totalSat - feeSat;
  if (sendSat <= 546) return { errors: [...errors, `Insufficient funds after fee (${totalSat} sats)`], totalSent: 0 };

  try {
    const tx = new Transaction()
      .from(utxoItems.map(u => ({ txId: u.txId, outputIndex: u.outputIndex, satoshis: u.satoshis, script: u.script })))
      .to(winnerAddr, sendSat);

    const wifSeen: Record<string, boolean> = {};
    for (const u of utxoItems) {
      if (!wifSeen[u.wif]) { wifSeen[u.wif] = true; tx.sign(PrivateKey.fromWIF(u.wif)); }
    }

    const raw = tx.serialize();
    const bd  = await fetch(`${INSIGHT_BASE}/tx/send`, {
      method: 'POST',
      headers: { ...INSIGHT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawtx: raw }),
    }).then(r => r.json());

    if (!bd.txid) throw new Error(`Broadcast failed: ${JSON.stringify(bd)}`);
    console.log(`[directSweep] ✅ ${bd.txid} | ${sendSat / 1e8} DASH → ${winnerAddr}`);
    return { txId: bd.txid, totalSent: sendSat / 1e8, errors };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`TX: ${msg}`);
    return { errors, totalSent: 0 };
  }
}

// ─── Look up sender address from a TX on Insight ─────────────────────────────
// Used as fallback when winner's stored dashAddress is not a valid DASH address.
export async function getTxSenderAddress(txId: string): Promise<string | null> {
  try {
    const res = await fetch(`${INSIGHT_BASE}/tx/${txId}`, { headers: INSIGHT_HEADERS });
    if (!res.ok) return null;
    const tx = await res.json() as InsightTx;
    return tx.vin?.[0]?.addr || null;
  } catch { return null; }
}

// ─── Sweep all next lottery fund addresses into a new lottery ─────────────────
// Called when a new lottery is created — pulls accumulated 5% from all
// previous next-lottery-fund addresses into the new lottery's main address.
export async function sweepNextLotteryFundsToLottery(
  toLotteryAddress: string,
  maxIndex: number, // check indices 0..maxIndex-1
): Promise<{ txIds: string[]; totalSwept: number; errors: string[] }> {
  if (!isValidDashAddress(toLotteryAddress)) return { txIds: [], totalSwept: 0, errors: ['Invalid lottery address'] };
  const txIds: string[] = [];
  const errors: string[] = [];
  let totalSwept = 0;

  for (let idx = 0; idx < maxIndex; idx++) {
    try {
      const { address, wif } = deriveNextLotteryFundAddress(idx);
      if (address === toLotteryAddress) continue; // skip self
      const utxoRes = await fetch(`${INSIGHT_BASE}/addr/${address}/utxo`, { headers: INSIGHT_HEADERS });
      if (!utxoRes.ok) continue;
      const utxos: Array<{ satoshis: number }> = await utxoRes.json();
      if (!utxos.length) continue;
      const bal = utxos.reduce((s: number, u: { satoshis: number }) => s + u.satoshis, 0);
      if (bal < 5000) continue; // skip dust
      const result = await sweepAddress(address, wif, toLotteryAddress);
      if (result) { txIds.push(result.txid); totalSwept += result.satsSent / 1e8; }
    } catch (e) { errors.push(`idx ${idx}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return { txIds, totalSwept, errors };
}
