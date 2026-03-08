# Timely.Works — Payout System Documentation

> **Last updated:** 2026-02-23  
> **Status:** Production | Auto-payout live

---

## Overview

Timely.Works runs a two-phase fee model:

1. **Immediate on-deposit (15%)** — the moment a contribution confirms on-chain, 15% is swept out automatically
2. **End-of-lottery direct sweep (85%)** — when the lottery ends, the remaining funds go straight to the winner

---

## Phase 1: Immediate On-Deposit Split (10% + 5%)

### When it runs
Every 5 seconds, `worker.mjs` calls `/api/lottery/scan`. On each scan:
- All entry deposit addresses are checked for new confirmed TXs
- The lottery's shared address is also checked for anonymous direct sends

### What happens on a new confirmed deposit
1. **Capture sender address** — The TX's `vin[0].addr` (the sender's wallet) is stored as `entry.dashReceiveAddress` and `entry.dashAddress`. This is the fallback payout address if the user's profile has no valid DASH address.
2. **Immediate split TX** — A 3-output transaction is broadcast:
   - `10%` → The Timely Reserve (HD path: `m/44'/5'/5'/0/0`)
   - `5%` → Next Lottery Fund (HD path: `m/44'/5'/6'/0/{index}`)
   - `~85%` → back to the same entry deposit address (stays for winner payout)
3. **Split TX recorded** — `entry.splitTxIds` stores the split TX ID so future scans don't double-count the change output as a new deposit

### Code locations
- **Scan route:** `app/api/lottery/scan/route.ts`
- **Split function:** `lib/dash.ts → immediatelySplit()` / `immediatelySplitFromWIF()`
- **Ticket utils:** `lib/ticket-utils.ts`

---

## Phase 2: End-of-Lottery Winner Payout

### When it runs
The worker checks for expired lotteries every 60 seconds and calls `/api/lottery/end` with `forcePayout: true`.

### Winner address resolution (priority order)
1. `entry.dashReceiveAddress` — explicit receive address (set from TX sender on first deposit)
2. `entry.dashAddress` — user's stored wallet address  
3. **Fallback:** Look up `entry.verifiedTxIds[0]` on Insight API → get `vin[0].addr` (the wallet that sent DASH). **This is the canonical fallback — always pay back to who paid in.**

### Payout strategy
Two paths, auto-selected:

#### A. Direct Sweep (default — when immediate splits have run)
Used when `entry.splitTxIds.length > 0` OR `lottery.splitTxIds.length > 0`

- Collects all remaining UTXOs from:
  - All entry deposit addresses (`deriveEntryAddress(index)`)
  - The lottery's main address (`deriveLotteryAddress(index)`)
- Sweeps 100% of remaining funds to winner in a single TX
- **No further fee deduction** — 15% was already taken on deposit

#### B. Split Payout (legacy — no prior splits)
Used when no immediate splits occurred (e.g. admin manually ended before first scan)

- Collects same UTXOs
- Splits: **85% → winner, 10% → reserve, 5% → next lottery** in one TX
- Records allocation in `store.json`

### Code locations
- **End route:** `app/api/lottery/end/route.ts`
- **Repayout route:** `app/api/lottery/repayout/route.ts`
- **Direct sweep:** `lib/dash.ts → directSweepAllToWinner()`
- **Split payout:** `lib/dash.ts → splitPayout()`
- **TX sender lookup:** `lib/dash.ts → getTxSenderAddress()`

---

## Stuck Payout Retry

If the end-of-lottery payout fails (network error, no UTXO, bad address), the worker retries every 60 seconds via `/api/lottery/repayout`.

**Condition checked:** `lottery.status === 'ended' && lottery.winnerId && !lottery.winnerTxId`

The repayout route uses the same winner address resolution and payout strategy as above.

---

## HD Wallet Address Paths

| Purpose | HD Path | Notes |
|---|---|---|
| Lottery main address | `m/44'/5'/1'/0/{index}` | One per lottery, receives anonymous direct sends |
| Entry deposit address | `m/44'/5'/2'/0/{index}` | One per participant entry |
| The Timely Reserve | `m/44'/5'/5'/0/0` | Fixed address, permanent |
| Next Lottery Fund | `m/44'/5'/6'/0/{index}` | Rolling per-lottery, seeds next pot |

---

## Fee Summary

| When | Reserve (10%) | Next Lottery (5%) | Winner (~85%) |
|---|---|---|---|
| On deposit (immediate) | ✅ Swept to reserve | ✅ Swept to next lottery | ✅ Stays in entry address |
| At lottery end | ❌ (already done) | ❌ (already done) | ✅ Direct swept to winner |

Total winner cut: `~85% of (deposit − tx_fee)` — fee is a tiny flat amount (~1000 sats)

---

## Data Structures (store.json)

### Entry
```json
{
  "dashAddress": "XdVg...",           // Winner payout address (synced from TX sender on first deposit)
  "dashReceiveAddress": "XdVg...",    // Explicit receive address (same, canonical)
  "verifiedTxIds": ["abc123..."],     // Confirmed user deposit TXs
  "splitTxIds": ["def456..."],        // Our split TXs (filtered from deposit detection)
  "entryAddressIndex": 18,           // HD wallet index for this entry's deposit address
  "dashContributed": 0.3             // Total DASH contributed (excludes split change)
}
```

### Lottery
```json
{
  "addressIndex": 112,              // HD wallet index for the lottery's main address
  "splitTxIds": ["..."],            // Split TXs from anonymous lottery-address deposits
  "winnerId": "Pp7cy...",           // Entry ID of winner
  "winnerTxId": "023e97...",        // Final payout TX (set after success)
  "winnerDash": 0.2167              // DASH actually sent to winner
}
```

---

## Common Issues & Fixes

### "No valid DASH address" on repayout
**Cause:** User registered with account (userId stored as dashAddress) and never stored a real wallet address.  
**Fix (code):** The repayout route now automatically looks up the TX sender from Insight as fallback.  
**Fix (manual):** Edit `store.json`, set `entry.dashReceiveAddress = "XValid..."` and restart worker.

### "Payout pending" stuck forever
**Cause:** `winnerTxId` not set (payout failed silently).  
**Diagnosis:** Check `worker.log` for `[REPAYOUT] ❌` lines.  
**Fix:** Correct the entry's DASH address in store.json → worker will retry automatically within 60s.

### Double fee deduction (winner gets ~72% instead of ~85%)
**Cause:** Immediate split ran on deposit AND end-of-lottery also ran splitPayout.  
**Fix (code):** `directSweepAllToWinner()` is now used when `splitTxIds` exist.  
**Prevention:** Always ensure `immediatelySplit()` succeeds on deposit.

### UTXO not found at payout
**Cause:** Split TX change output hasn't confirmed yet.  
**Fix:** Worker retries every 60s. Wait for 1+ confirmation on the split TX, then it auto-pays.

---

## Scaling Notes

Current architecture uses a single JSON file (`store.json`) — great for <500 concurrent users. For scale:
- Migrate to SQLite with WAL mode (see `docs/SCALING.md`)
- Add a dedicated payout queue (Redis or DB table with `status: pending/sent`)
- Run the payout worker as a separate isolated process with its own retry logic

---

## Testing a Payout Manually

```bash
# Trigger repayout for a specific lottery
curl -X POST http://localhost:3000/api/lottery/repayout \
  -H "Content-Type: application/json" \
  -d '{"password":"YOUR_ADMIN_PASSWORD","lotteryId":"LOTTERY_ID_HERE"}'

# Check worker log
tail -f /root/.openclaw/workspace/timely-lottery-data/worker.log
```
