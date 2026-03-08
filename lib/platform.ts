// ─── Dash Platform (Drive) Integration ───────────────────────────────────────
// Wraps the Dash SDK for all Dash Drive document operations.
//
// DESIGN PRINCIPLES:
// - Singleton client, initialized lazily on first use
// - All operations degrade gracefully when TIMELY_CONTRACT_ID is not set
// - Zero PII in Drive documents (no email, no IP, no private keys)
// - Fire-and-forget: never throw — always log and swallow errors
// - CommonJS require() for the `dash` package (CJS module, no named ES exports)
//
// env vars consumed:
//   TIMELY_CONTRACT_ID   — Dash Platform data contract ID (from register.mjs)
//   DASH_IDENTITY_ID     — Operator identity ID on Dash Platform
//   DASH_MNEMONIC        — HD wallet mnemonic (controls identity + signing)
//   DASH_NETWORK         — "mainnet" (default) | "testnet"

/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlatformLottery {
  lotteryId: string;
  title: string;
  description: string;
  status: 'active' | 'ended';
  startTime: number;      // epoch ms
  endTime: number;        // epoch ms
  durationMinutes: number;
  totalDash: number;
  totalTickets: number;
  participantCount: number;
  dashAddress: string;
  autoStarted: boolean;
}

export interface PlatformResult {
  lotteryId: string;
  winnerId: string;        // anonymized — DPNS name or masked ID
  winnerName: string;
  winnerDash: number;
  winnerTxId: string;
  reserveDash: number;
  totalDash: number;
  endTime: number;
  initiumTitle: string;
}

export interface PlatformEntry {
  lotteryId: string;
  entryId: string;
  dpnsName: string;        // public .dash username, if any; else ""
  dashContributed: number;
  totalTickets: number;
  initiumTitle: string;
  timestamp: number;
}

export interface PlatformWord {
  lotteryId: string;
  word: string;
  submittedBy: string;   // DPNS name or ""
}

export interface VerificationResult {
  onChain: boolean;
  contractId: string | null;
  docs: {
    lottery: any | null;
    result: any | null;
    entries: any[];
  };
  verifiedAt: number;
}

// ─── Singleton Client ─────────────────────────────────────────────────────────

let _client: any = null;
let _clientInitializing = false;
let _clientError: string | null = null;

function isPlatformConfigured(): boolean {
  return !!process.env.TIMELY_CONTRACT_ID;
}

async function getPlatformClient(): Promise<any | null> {
  if (!isPlatformConfigured()) return null;
  if (_client) return _client;
  if (_clientError) return null; // don't retry a permanent failure

  // Prevent concurrent initialization
  if (_clientInitializing) {
    // Wait up to 15s for init to complete
    for (let i = 0; i < 150; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (_client || _clientError) break;
    }
    return _client;
  }

  _clientInitializing = true;
  try {
    const Dash = require('dash');
    const client = new Dash.Client({
      network:  process.env.DASH_NETWORK || 'mainnet',
      wallet: {
        mnemonic: process.env.DASH_MNEMONIC || undefined,
        unsafeOptions: { skipSynchronizationBeforeHeight: 1000000 },
      },
      apps: {
        timelyLottery: {
          contractId: process.env.TIMELY_CONTRACT_ID!,
        },
      },
    });
    _client = client;
    console.log('[platform] ✅ Dash Platform client initialized');
    return _client;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[platform] ❌ Client init failed:', msg);
    _clientError = msg;
    return null;
  } finally {
    _clientInitializing = false;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getIdentity(client: any): Promise<any | null> {
  const identityId = process.env.DASH_IDENTITY_ID;
  if (!identityId) {
    console.warn('[platform] DASH_IDENTITY_ID not set — skipping identity fetch');
    return null;
  }
  try {
    return await client.platform.identities.get(identityId);
  } catch (e: unknown) {
    console.error('[platform] Identity fetch failed:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function submitDocument(
  client: any,
  docType: string,
  data: Record<string, any>,
): Promise<void> {
  const identity = await getIdentity(client);
  if (!identity) return;

  const doc = await client.platform.documents.create(
    `timelyLottery.${docType}`,
    identity,
    data,
  );

  const batch = {
    create: [doc],
    replace: [],
    delete: [],
  };

  await client.platform.documents.broadcast(batch, identity);
  console.log(`[platform] ✅ Published ${docType} document`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Publish a lottery to Dash Drive.
 * Called fire-and-forget after the SQLite write in /api/lottery/create.
 * Zero PII — no emails, no private keys.
 */
export async function publishLottery(lottery: {
  id: string;
  title: string;
  description: string;
  status: string;
  startTime: number;
  endTime: number;
  durationMinutes: number;
  totalDash: number;
  totalTickets: number;
  participantCount: number;
  address: string;
  autoStarted?: boolean;
}): Promise<void> {
  if (!isPlatformConfigured()) return;
  const client = await getPlatformClient();
  if (!client) return;

  try {
    const data: PlatformLottery = {
      lotteryId:        lottery.id.slice(0, 32),
      title:            lottery.title.slice(0, 100),
      description:      (lottery.description || '').slice(0, 500),
      status:           (lottery.status === 'ended' ? 'ended' : 'active'),
      startTime:        Math.floor(lottery.startTime / 1000),
      endTime:          Math.floor(lottery.endTime / 1000),
      durationMinutes:  lottery.durationMinutes || 60,
      totalDash:        lottery.totalDash || 0,
      totalTickets:     lottery.totalTickets || 0,
      participantCount: lottery.participantCount || 0,
      dashAddress:      lottery.address.slice(0, 64),
      autoStarted:      !!lottery.autoStarted,
    };

    await submitDocument(client, 'lottery', data);
  } catch (e: unknown) {
    console.error('[platform] publishLottery error:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Publish a lottery result to Dash Drive.
 * Called fire-and-forget after payout in /api/lottery/end.
 */
export async function publishResult(result: {
  lotteryId: string;
  winnerId: string;
  winnerName: string;
  winnerDash: number;
  winnerTxId: string;
  reserveDash: number;
  totalDash: number;
  endTime: number;
  initiumTitle?: string;
}): Promise<void> {
  if (!isPlatformConfigured()) return;
  const client = await getPlatformClient();
  if (!client) return;

  try {
    const data: PlatformResult = {
      lotteryId:    result.lotteryId.slice(0, 32),
      winnerId:     result.winnerId.slice(0, 128),
      winnerName:   (result.winnerName || '').slice(0, 64),
      winnerDash:   result.winnerDash || 0,
      winnerTxId:   (result.winnerTxId || '').slice(0, 128),
      reserveDash:  result.reserveDash || 0,
      totalDash:    result.totalDash || 0,
      endTime:      Math.floor(result.endTime / 1000),
      initiumTitle: (result.initiumTitle || '').slice(0, 200),
    };

    await submitDocument(client, 'result', data);
  } catch (e: unknown) {
    console.error('[platform] publishResult error:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Publish an anonymized entry to Dash Drive.
 * Called fire-and-forget after entry confirmation in /api/entry/submit.
 * ⚠️  NO PII: no email, no IP, no private keys, no receive addresses.
 */
export async function publishEntry(entry: {
  lotteryId: string;
  id: string;
  dashUsername?: string;
  dashContributed: number;
  totalTickets: number;
  initiumTitle?: string;
  createdAt: number;
}): Promise<void> {
  if (!isPlatformConfigured()) return;
  const client = await getPlatformClient();
  if (!client) return;

  try {
    const data: PlatformEntry = {
      lotteryId:       entry.lotteryId.slice(0, 32),
      entryId:         entry.id.slice(0, 32),
      dpnsName:        (entry.dashUsername || '').slice(0, 64), // public .dash username only
      dashContributed: entry.dashContributed || 0,
      totalTickets:    entry.totalTickets || 0,
      initiumTitle:    (entry.initiumTitle || '').slice(0, 200),
      timestamp:       Math.floor(entry.createdAt / 1000),
    };

    await submitDocument(client, 'entry', data);
  } catch (e: unknown) {
    console.error('[platform] publishEntry error:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Publish a One Word submission to Dash Drive.
 */
export async function publishWord(word: {
  lotteryId: string;
  word: string;
  submittedBy?: string;
}): Promise<void> {
  if (!isPlatformConfigured()) return;
  const client = await getPlatformClient();
  if (!client) return;

  try {
    const data: PlatformWord = {
      lotteryId:   word.lotteryId.slice(0, 32),
      word:        word.word.slice(0, 50),
      submittedBy: (word.submittedBy || '').slice(0, 64),
    };

    await submitDocument(client, 'word', data);
  } catch (e: unknown) {
    console.error('[platform] publishWord error:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Query all lottery documents from Dash Drive.
 * Returns empty array if Platform not configured or query fails.
 */
export async function getLotteriesFromChain(): Promise<any[]> {
  if (!isPlatformConfigured()) return [];
  const client = await getPlatformClient();
  if (!client) return [];

  try {
    const docs = await client.platform.documents.get('timelyLottery.lottery', {
      limit: 100,
      orderBy: [{ startTime: 'desc' }],
    });
    return docs || [];
  } catch (e: unknown) {
    console.error('[platform] getLotteriesFromChain error:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Query the result document for a specific lottery from Dash Drive.
 * Returns null if not found or Platform not configured.
 */
export async function getResultFromChain(lotteryId: string): Promise<any | null> {
  if (!isPlatformConfigured()) return null;
  const client = await getPlatformClient();
  if (!client) return null;

  try {
    const docs = await client.platform.documents.get('timelyLottery.result', {
      where: [['lotteryId', '==', lotteryId.slice(0, 32)]],
      limit: 1,
    });
    return docs?.[0] || null;
  } catch (e: unknown) {
    console.error('[platform] getResultFromChain error:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Verify a lottery is recorded on Dash Drive.
 * Returns a structured verification object.
 * Always returns { onChain: false } if Platform not configured.
 */
export async function verifyLotteryOnChain(lotteryId: string): Promise<VerificationResult> {
  const contractId = process.env.TIMELY_CONTRACT_ID || null;

  if (!contractId) {
    return {
      onChain: false,
      contractId: null,
      docs: { lottery: null, result: null, entries: [] },
      verifiedAt: Date.now(),
    };
  }

  const client = await getPlatformClient();
  if (!client) {
    return {
      onChain: false,
      contractId,
      docs: { lottery: null, result: null, entries: [] },
      verifiedAt: Date.now(),
    };
  }

  const safeId = lotteryId.slice(0, 32);

  try {
    const [lotteryDocs, resultDocs, entryDocs] = await Promise.allSettled([
      client.platform.documents.get('timelyLottery.lottery', {
        where: [['lotteryId', '==', safeId]],
        limit: 1,
      }),
      client.platform.documents.get('timelyLottery.result', {
        where: [['lotteryId', '==', safeId]],
        limit: 1,
      }),
      client.platform.documents.get('timelyLottery.entry', {
        where: [['lotteryId', '==', safeId]],
        limit: 100,
      }),
    ]);

    const lottery = lotteryDocs.status === 'fulfilled' ? (lotteryDocs.value?.[0] || null) : null;
    const result  = resultDocs.status  === 'fulfilled' ? (resultDocs.value?.[0]  || null) : null;
    const entries = entryDocs.status   === 'fulfilled' ? (entryDocs.value        || [])   : [];

    return {
      onChain:     !!lottery,
      contractId,
      docs: { lottery, result, entries },
      verifiedAt:  Date.now(),
    };
  } catch (e: unknown) {
    console.error('[platform] verifyLotteryOnChain error:', e instanceof Error ? e.message : String(e));
    return {
      onChain: false,
      contractId,
      docs: { lottery: null, result: null, entries: [] },
      verifiedAt: Date.now(),
    };
  }
}
