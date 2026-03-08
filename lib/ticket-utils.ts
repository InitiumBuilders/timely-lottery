/**
 * Ticket calculation utilities.
 * Uses integer arithmetic (duffs) to avoid floating point errors.
 *
 * Problem: Math.floor(0.3 / 0.1) = Math.floor(2.9999...) = 2  ← WRONG
 * Fix:     Math.floor(Math.round(0.3 * 1e8) / 1e7)         = 3  ← CORRECT
 *
 * 1 DASH = 1e8 duffs (satoshis)
 * 0.1 DASH = 1e7 duffs = 1 base ticket
 *
 * TICKET FORMULA:
 *   baseTickets  = floor(DASH / 0.1)   — 1 per 0.1 DASH
 *   votusCredits = baseTickets          — 1 Votus per 0.1 DASH (spent on OTHER entries)
 *   totalTickets = baseTickets + upvoteTickets
 *
 * Your own Votus are a currency to BOOST others — they do NOT add to your own tickets.
 * When someone else spends a Votus on your entry → your upvoteTickets += 1.
 *
 * Example: 0.3 DASH, no upvotes received → 3 tickets
 *          0.3 DASH, 2 Votus received from others → 5 tickets
 */
export function ticketsForDash(dashAmount: number): number {
  const duffs = Math.round(dashAmount * 1e8);
  return Math.floor(duffs / 1e7); // 1 base ticket per 0.1 DASH
}

/**
 * Votus credits earned = same as base tickets (1 per 0.1 DASH).
 * These are spent on OTHER people's entries, not your own.
 */
export function votusForTickets(baseTickets: number): number {
  return baseTickets;
}

/**
 * Total lottery tickets for an entry.
 * = base tickets + upvote tickets from others spending Votus on you.
 * Your own unspent Votus do NOT count toward your ticket total.
 */
export function totalTickets(baseTickets: number, upvoteTickets: number): number {
  return baseTickets + (upvoteTickets || 0);
}
