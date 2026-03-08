// ─── Lottery engine: ticket calc, weighted winner selection ──────────────────
import { Entry, Winner, getEntriesForLottery, getLottery, getAllWinners } from './store';

export const DASH_PER_TICKET = 0.1;

// ─── Ticket calculation ───────────────────────────────────────────────────────

export function calcBaseTickets(dashAmount: number): number {
  return Math.floor(dashAmount / DASH_PER_TICKET);
}

// ─── Weighted random winner ───────────────────────────────────────────────────

export function pickWeightedWinner(lotteryId: string): Entry | null {
  const entries = getEntriesForLottery(lotteryId).filter(e => e.totalTickets > 0);
  if (!entries.length) return null;

  // Build ticket pool
  const pool: string[] = [];
  for (const entry of entries) {
    for (let i = 0; i < entry.totalTickets; i++) {
      pool.push(entry.id);
    }
  }

  if (!pool.length) return null;

  // Cryptographically random-ish index
  const idx = Math.floor(Math.random() * pool.length);
  const winnerId = pool[idx];
  return entries.find(e => e.id === winnerId) || null;
}

// ─── Build winner record ──────────────────────────────────────────────────────

export function buildWinnerRecord(
  lotteryId: string,
  winnerEntry: Entry,
  payoutTxId?: string
): Winner {
  const lottery  = getLottery(lotteryId)!;
  const entries  = getEntriesForLottery(lotteryId);
  const totalTix = entries.reduce((s, e) => s + e.totalTickets, 0);

  return {
    lotteryId,
    lotteryTitle:    lottery.title,
    entryId:         winnerEntry.id,
    displayName:     winnerEntry.displayName,
    dashAddress:     winnerEntry.dashAddress,
    dashUsername:    winnerEntry.dashUsername,
    initium:         winnerEntry.initium,
    dashWon:         lottery.totalDash,
    totalParticipants: entries.length,
    totalDash:       lottery.totalDash,
    winningTickets:  winnerEntry.totalTickets,
    totalTickets:    totalTix,
    payoutTxId,
    timestamp:       Date.now(),
  };
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

export function timeRemaining(endTime: number): {
  hours: number; minutes: number; seconds: number; total: number; expired: boolean;
} {
  const now   = Date.now();
  const total = Math.max(0, endTime - now);
  const hours   = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  return { hours, minutes, seconds, total, expired: total <= 0 };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function buildStats() {
  const winners = getAllWinners();
  const totalDashAwarded = winners.reduce((s, w) => s + w.dashWon, 0);
  const totalLotteries   = winners.length;
  const totalParticipants = winners.reduce((s, w) => s + w.totalParticipants, 0);
  return { totalLotteries, totalDashAwarded, totalParticipants, winners };
}
