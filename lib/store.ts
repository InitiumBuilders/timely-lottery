/**
 * ─── lib/store.ts ─ Lottery & Entry Persistence ──────────────────────────────
 *
 * File-based JSON store for all lottery, entry, winner, and TX data.
 * Runs on VPS where data is persistent. On Vercel (no filesystem),
 * API routes are proxied to VPS so this module never runs on Vercel.
 *
 * DATA FILE: $LOTTERY_DATA_DIR/store.json (default: /root/.openclaw/workspace/timely-lottery-data/store.json)
 *
 * ⚠️  CONCURRENCY WARNING:
 * Uses synchronous fs.readFileSync / fs.writeFileSync. Node.js event loop
 * serializes most ops on a single-process PM2 setup, but under high concurrent
 * load (50+ simultaneous writes) there is a last-write-wins race condition.
 * For scale >500 concurrent users, migrate to SQLite with WAL mode or PostgreSQL.
 * See docs/SCALING.md for migration path.
 *
 * All mutation functions use the pattern: read → modify → write.
 * Never modify store data objects directly — always call upsert* functions.
 */
import fs from 'fs';
import path from 'path';

export interface Lottery {
  id: string;
  title: string;
  description: string;
  address: string;
  addressIndex: number;
  status: 'pending' | 'active' | 'ended';
  durationMinutes: number;
  startTime: number;
  endTime: number;
  totalDash: number;
  totalTickets: number;
  participantCount: number;
  winnerId?: string;
  winnerName?: string;
  winnerInitium?: string;
  winnerDash?: number;
  winnerTxId?: string;
  createdAt: number;
}

export interface Entry {
  id: string;
  lotteryId: string;
  // User's own wallet (for identity / display)
  dashAddress: string;
  dashReceiveAddress?: string;      // Real DASH address to RECEIVE winnings (validated X... format)
  dashEvolutionUsername?: string;   // Dash Platform username e.g. "August" (DashPay)
  dashUsername?: string;
  displayName?: string;
  initium?: string;           // legacy single-field initium
  initiumTitle?: string;      // Initium title
  initiumDescription?: string;// Initium full description
  initiumUrl?: string;        // Link to project / idea
  isAnonymous?: boolean;      // true = sent DASH directly with no form
  userId?: string;            // linked Timely account (if claimed)
  initiumId?: string;         // linked Prisma Initium card ID (if used from saved initiums)
  // Unique per-entry deposit address (HD-derived, assigned on submit)
  entryAddress: string;
  entryAddressIndex: number;
  // Contributions
  dashContributed: number;
  baseTickets: number;
  upvoteTickets: number;
  totalTickets: number;
  verifiedTxIds: string[];
  upvoters: string[];
  upvotedEntries: string[];
  // Votus credits: 1 per 0.1 DASH sent; spend to upvote initiums
  votusCredits: number;       // total Votus earned
  votusSpent: number;         // Votus spent on upvotes
  votusAvailable: number;     // votusCredits - votusSpent
  // Media attachment
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt: number;
  // Immediate split tracking — TXIDs of our own split transactions sent FROM this address
  // These are filtered OUT when calculating dashContributed (to avoid double-counting change)
  splitTxIds?: string[];
}

export interface TxRecord {
  txId: string;
  lotteryId: string;
  entryId: string;
  amount: number;
  confirmations: number;
  timestamp: number;
}

// ─── Reserve & Allocation ─────────────────────────────────────────────────────

// Per-transaction immediate split record (logged when DASH hits entry address)
export interface SplitRecord {
  lotteryId: string;
  entryId: string;
  depositTxId: string;      // the user's original deposit TX
  splitTxId: string;        // our split TX (broadcasts immediately)
  totalDeposit: number;     // DASH received from user
  reserveAmount: number;    // 10% → reserve (on-chain, confirmed)
  nextLotteryAmount: number;// 5%  → next lottery (on-chain, confirmed)
  winnerAmount: number;     // ~85% remaining in entry address for winner
  timestamp: number;
}

export interface AllocationRecord {
  lotteryId: string;
  lotteryTitle: string;
  totalDash: number;       // total pool
  winnerDash: number;      // 85% → winner
  reserveDash: number;     // 10% → The Timely Reserve
  nextLotteryDash: number; // 5%  → next lottery pot
  winnerName?: string;
  txId?: string;
  timestamp: number;
}

export interface Winner {
  lotteryId: string;
  lotteryTitle: string;
  entryId: string;
  displayName?: string;
  dashAddress?: string;
  dashUsername?: string;
  initium?: string;
  initiumTitle?: string;
  initiumDescription?: string;
  initiumUrl?: string;
  dashWon: number;
  totalParticipants: number;
  totalDash: number;
  winningTickets: number;
  totalTickets: number;
  payoutTxId?: string;
  timestamp: number;
}

interface StoreData {
  lotteries: Record<string, Lottery>;
  entries: Record<string, Entry>;
  txRecords: Record<string, TxRecord>;
  winners: Winner[];
  lotteryAddressIndex: number;
  entryAddressIndex: number;          // for unique per-entry deposit addresses
  // ── The Timely Reserve ──────────────────────────────────────────────────────
  reserveAddress: string;             // HD-derived fixed address (set on first use)
  reserveTotalAllocated: number;      // cumulative DASH allocated to reserve (all time)
  nextLotteryFundHeld: number;        // cumulative 5% rolled into next lotteries
  nextLotteryFundAddressIndex: number;// HD index for next lottery fund addresses
  totalDashProcessed: number;         // all-time DASH processed through the system
  allocationHistory: AllocationRecord[];
  splitHistory: SplitRecord[];          // per-TX immediate splits (on-chain, real-time)
  wordSubmissions?: WordSubmission[];   // one-word drops from founders
}

// ─── File path ────────────────────────────────────────────────────────────────
const DATA_DIR  = process.env.LOTTERY_DATA_DIR || '/root/.openclaw/workspace/timely-lottery-data';
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* already exists */ }
}

function loadStore(): StoreData {
  ensureDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[store] Failed to load store:', e);
  }
  return {
    lotteries: {}, entries: {}, txRecords: {}, winners: [],
    lotteryAddressIndex: 100, entryAddressIndex: 0,
    reserveAddress: '', reserveTotalAllocated: 0,
    nextLotteryFundHeld: 0, nextLotteryFundAddressIndex: 0,
    totalDashProcessed: 0, allocationHistory: [], splitHistory: [],
  };
}

function saveStore(data: StoreData) {
  ensureDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[store] Failed to save store:', e);
  }
}

// ─── Store API ────────────────────────────────────────────────────────────────

export function getAllLotteries(): Lottery[] {
  const data = loadStore();
  return Object.values(data.lotteries).sort((a, b) => b.createdAt - a.createdAt);
}

export function getAllEntries(): Entry[] {
  const data = loadStore();
  return Object.values(data.entries).sort((a, b) => b.createdAt - a.createdAt);
}

export function getLottery(id: string): Lottery | undefined {
  return loadStore().lotteries[id];
}

export function getActiveLottery(): Lottery | undefined {
  const data = loadStore();
  return Object.values(data.lotteries).find(l => l.status === 'active');
}

export function upsertLottery(lottery: Lottery): void {
  const data = loadStore();
  data.lotteries[lottery.id] = lottery;
  saveStore(data);
}

export function getNextAddressIndex(): number {
  const data = loadStore();
  const idx = data.lotteryAddressIndex;
  data.lotteryAddressIndex++;
  saveStore(data);
  return idx;
}

export function getNextEntryAddressIndex(): number {
  const data = loadStore();
  const idx = data.entryAddressIndex ?? 0;
  data.entryAddressIndex = idx + 1;
  saveStore(data);
  return idx;
}

export function getEntryByDepositAddress(entryAddress: string): Entry | undefined {
  const data = loadStore();
  return Object.values(data.entries).find(
    e => e.entryAddress?.toLowerCase() === entryAddress.toLowerCase()
  );
}

export function getEntriesForLottery(lotteryId: string): Entry[] {
  const data = loadStore();
  return Object.values(data.entries)
    .filter(e => e.lotteryId === lotteryId)
    .sort((a, b) => b.totalTickets - a.totalTickets);
}

export function getEntry(id: string): Entry | undefined {
  return loadStore().entries[id];
}

export function getEntryByAddress(lotteryId: string, dashAddress: string): Entry | undefined {
  const data = loadStore();
  return Object.values(data.entries).find(
    e => e.lotteryId === lotteryId && e.dashAddress.toLowerCase() === dashAddress.toLowerCase()
  );
}

export function upsertEntry(entry: Entry): void {
  const data = loadStore();
  data.entries[entry.id] = entry;
  // Update lottery stats
  const lottery = data.lotteries[entry.lotteryId];
  if (lottery) {
    const entries = Object.values(data.entries).filter(e => e.lotteryId === entry.lotteryId);
    lottery.totalDash    = entries.reduce((s, e) => s + e.dashContributed, 0);
    lottery.totalTickets = entries.reduce((s, e) => s + e.totalTickets, 0);
    lottery.participantCount = entries.length;
    data.lotteries[lottery.id] = lottery;
  }
  saveStore(data);
}

export function addTxRecord(tx: TxRecord): void {
  const data = loadStore();
  data.txRecords[tx.txId] = tx;
  saveStore(data);
}

export function getTxRecord(txId: string): TxRecord | undefined {
  return loadStore().txRecords[txId];
}

export function getAllWinners(): Winner[] {
  return loadStore().winners.sort((a, b) => b.timestamp - a.timestamp);
}

export function addWinner(w: Winner): void {
  const data = loadStore();
  data.winners.unshift(w);
  saveStore(data);
}

// ── Username-based account aggregation ────────────────────────────────────────

export function getEntriesByUsername(username: string): Entry[] {
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  const data  = loadStore();
  return Object.values(data.entries).filter(e =>
    (e.dashEvolutionUsername?.toLowerCase() === clean) ||
    (e.dashUsername?.toLowerCase() === clean) ||
    (e.displayName?.toLowerCase() === clean)
  ).sort((a, b) => b.createdAt - a.createdAt);
}

export function getAccountStats(username: string): {
  entries: Entry[];
  totalTickets: number;
  totalDash: number;
  currentLotteryTickets: number;
  lotteryCount: number;
} {
  const entries = getEntriesByUsername(username);
  const totalTickets = entries.reduce((s, e) => s + e.totalTickets, 0);
  const totalDash    = entries.reduce((s, e) => s + e.dashContributed, 0);
  const active       = getActiveLottery();
  const currentLotteryTickets = active
    ? entries.filter(e => e.lotteryId === active.id).reduce((s, e) => s + e.totalTickets, 0)
    : 0;
  return {
    entries,
    totalTickets,
    totalDash,
    currentLotteryTickets,
    lotteryCount: new Set(entries.map(e => e.lotteryId)).size,
  };
}

export function getTotalStats() {
  const allLotteries = getAllLotteries();
  const completed    = allLotteries.filter(l => l.status === 'ended');
  const totalDash    = completed.reduce((s, l) => s + l.totalDash, 0);
  const totalParticipants = completed.reduce((s, l) => s + l.participantCount, 0);
  const totalTickets = completed.reduce((s, l) => s + l.totalTickets, 0);
  const active       = getActiveLottery();
  return { totalLotteries: completed.length, totalDash, totalParticipants, totalTickets, active };
}

// ── The Timely Reserve helpers ─────────────────────────────────────────────────

export function getReserveStats() {
  const data = loadStore();
  return {
    reserveAddress:          data.reserveAddress || '',
    reserveTotalAllocated:   data.reserveTotalAllocated   || 0,
    nextLotteryFundHeld:     data.nextLotteryFundHeld     || 0,
    totalDashProcessed:      data.totalDashProcessed      || 0,
    allocationHistory:       data.allocationHistory       || [],
    nextLotteryFundAddressIndex: data.nextLotteryFundAddressIndex || 0,
  };
}

export function setReserveAddress(address: string): void {
  const data = loadStore();
  if (!data.reserveAddress) {
    data.reserveAddress = address;
    saveStore(data);
  }
}

export function getNextLotteryFundAddressIndex(): number {
  const data = loadStore();
  const idx = data.nextLotteryFundAddressIndex || 0;
  data.nextLotteryFundAddressIndex = idx + 1;
  saveStore(data);
  return idx;
}

/**
 * Real-time pending allocations from the CURRENT active lottery.
 * The DASH hasn't moved yet (moves at payout), but this shows what's allocated.
 */
export function getLiveAllocations(): {
  currentPoolDash: number;
  pendingReserveAllocation: number;   // 10% of pool → The Timely Reserve
  pendingNextLotteryAllocation: number; // 5% of pool → next lottery
  pendingWinnerAmount: number;         // 85% of pool → winner
} {
  const lottery = getActiveLottery();
  const pool = lottery?.totalDash ?? 0;
  return {
    currentPoolDash:               pool,
    pendingReserveAllocation:      parseFloat((pool * 0.10).toFixed(8)),
    pendingNextLotteryAllocation:  parseFloat((pool * 0.05).toFixed(8)),
    pendingWinnerAmount:           parseFloat((pool * 0.85).toFixed(8)),
  };
}

export function addAllocationRecord(record: AllocationRecord): void {
  const data = loadStore();
  if (!data.allocationHistory) data.allocationHistory = [];
  data.allocationHistory.unshift(record); // newest first
  data.reserveTotalAllocated = (data.reserveTotalAllocated || 0) + record.reserveDash;
  data.nextLotteryFundHeld   = (data.nextLotteryFundHeld   || 0) + record.nextLotteryDash;
  data.totalDashProcessed    = (data.totalDashProcessed    || 0) + record.totalDash;
  saveStore(data);
}

export function addSplitRecord(record: SplitRecord): void {
  const data = loadStore();
  if (!data.splitHistory) data.splitHistory = [];
  data.splitHistory.unshift(record); // newest first — cap at 500 records
  if (data.splitHistory.length > 500) data.splitHistory = data.splitHistory.slice(0, 500);
  // Update cumulative reserve totals from immediate splits
  data.reserveTotalAllocated = (data.reserveTotalAllocated || 0) + record.reserveAmount;
  data.nextLotteryFundHeld   = (data.nextLotteryFundHeld   || 0) + record.nextLotteryAmount;
  data.totalDashProcessed    = (data.totalDashProcessed    || 0) + record.totalDeposit;
  saveStore(data);
}

export function getSplitHistory(): SplitRecord[] {
  const data = loadStore();
  return data.splitHistory || [];
}

// ─── ONE WORD SUBMISSIONS ─────────────────────────────────────────────────────

export interface WordSubmission {
  id: string;
  word: string;
  target: 'current' | 'next'; // which lottery this is for
  lotteryId?: string;          // set for 'current', undefined for 'next'
  userId: string;
  username: string;
  timestamp: number;
}

export function addWordSubmission(sub: WordSubmission): void {
  const data = loadStore();
  if (!data.wordSubmissions) data.wordSubmissions = [];
  // Enforce: 1 word per user per target per lottery cycle
  const existing = data.wordSubmissions.find(
    (w: WordSubmission) => w.userId === sub.userId && w.target === sub.target &&
      (sub.target === 'next' ? true : w.lotteryId === sub.lotteryId)
  );
  if (existing) {
    // Update in-place
    existing.word = sub.word;
    existing.timestamp = sub.timestamp;
  } else {
    data.wordSubmissions.unshift(sub);
    if (data.wordSubmissions.length > 5000) data.wordSubmissions = data.wordSubmissions.slice(0, 5000);
  }
  saveStore(data);
}

export function getWordSubmissions(opts?: { target?: 'current' | 'next'; lotteryId?: string }): WordSubmission[] {
  const data = loadStore();
  let words: WordSubmission[] = data.wordSubmissions || [];
  if (opts?.target) words = words.filter((w: WordSubmission) => w.target === opts.target);
  if (opts?.lotteryId) words = words.filter((w: WordSubmission) => w.lotteryId === opts.lotteryId);
  return words.sort((a: WordSubmission, b: WordSubmission) => b.timestamp - a.timestamp);
}

export function getWordFrequency(words: WordSubmission[]): Array<{ word: string; count: number }> {
  const freq: Record<string, number> = {};
  for (const w of words) {
    const k = w.word.toLowerCase().trim();
    freq[k] = (freq[k] || 0) + 1;
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Admin Settings (Auto Admin / Autonomous Mode) ─────────────────────────────
export interface AdminSettings {
  autoAdmin: boolean;
  autoAdminDurationDays: number;
  autoAdminLastStarted?: number;
}

export function getAdminSettings(): AdminSettings {
  const data = loadStore();
  return {
    autoAdmin: (data as any).adminSettings?.autoAdmin ?? true,
    autoAdminDurationDays: (data as any).adminSettings?.autoAdminDurationDays ?? 7,
    autoAdminLastStarted: (data as any).adminSettings?.autoAdminLastStarted,
  };
}

export function saveAdminSettings(settings: AdminSettings): void {
  const data = loadStore();
  (data as any).adminSettings = settings;
  saveStore(data);
}
