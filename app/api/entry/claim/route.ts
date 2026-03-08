export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';
import { getActiveLottery, getEntriesForLottery, getEntry, upsertEntry, getLottery, upsertLottery } from '@/lib/store';
import { verifyTxById } from '@/lib/dash';

/**
 * POST /api/entry/claim
 * Signed-in user claims an anonymous TX to their account.
 * The entry is updated with their profile info.
 *
 * Body: { txId: string } OR { entryId: string }
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Sign in to claim a transaction' }, { status: 401 });

  const { txId, entryId } = await req.json();
  const lottery = getActiveLottery();
  if (!lottery) return NextResponse.json({ error: 'No active lottery' }, { status: 404 });

  const allEntries = getEntriesForLottery(lottery.id);

  // ── Find entry by entryId or txId ─────────────────────────────────────────
  let entry = entryId ? getEntry(entryId) : null;

  if (!entry && txId) {
    const cleanTx = txId.trim().replace(/^.*\/tx\//, '').replace(/[^a-fA-F0-9]/g, '');
    // Check if TX is already in an existing entry
    entry = allEntries.find(e => (e.verifiedTxIds || []).includes(cleanTx)) || null;

    // If not found, try to verify it
    if (!entry) {
      // Check against all known addresses
      const addresses = [lottery.address, ...allEntries.map(e => e.entryAddress).filter(Boolean)];
      for (const addr of addresses) {
        const r = await verifyTxById(txId, addr);
        if (r.valid && r.confirmations >= 1 && r.amount >= 0.0999) {
          // Create anonymous entry first, then claim it
          const tickets = Math.floor(r.amount / 0.1);
          const newEntry = {
            id:              `anon-${cleanTx.slice(0, 10)}`,
            lotteryId:       lottery.id,
            dashAddress:     r.fromAddress || `anon-${cleanTx.slice(0, 8)}`,
            dashReceiveAddress: r.fromAddress || undefined,
            displayName:     user.dashUsername ? `@${user.dashUsername}` : (user.displayName || user.email?.split('@')[0]?.replace(/[._-]+/g,' ').trim() || 'Builder'),
            isAnonymous:     false,
            entryAddress:    addr,
            entryAddressIndex: -1,
            dashContributed: r.amount,
            baseTickets:     tickets,
            upvoteTickets:   0,
            totalTickets:    tickets,
            verifiedTxIds:   [cleanTx],
            upvoters:        [],
            upvotedEntries:  [],
            votusCredits:    tickets,
            votusSpent:      0,
            votusAvailable:  tickets,
            userId:          user.id,
            createdAt:       Date.now(),
          };
          upsertEntry(newEntry as any);
          entry = newEntry as any;
          break;
        }
      }
      if (!entry) return NextResponse.json({ error: "TX not found or not confirmed. Make sure it's ≥0.1 DASH and has at least 1 confirmation." }, { status: 400 });
    }
  }

  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (entry.lotteryId !== lottery.id) return NextResponse.json({ error: 'Entry is from a different lottery' }, { status: 400 });

  // ── Claim: update entry with user's profile info ───────────────────────────
  const updated = {
    ...entry,
    userId:      user.id,
    isAnonymous: false,
    displayName: user.displayName || entry.displayName,
    dashUsername: user.dashUsername || entry.dashUsername,
  };
  upsertEntry(updated);

  // Refresh lottery totals
  const fresh = getLottery(lottery.id);
  if (fresh) {
    const all = getEntriesForLottery(lottery.id);
    fresh.totalDash         = all.reduce((s, e) => s + (e.dashContributed || 0), 0);
    fresh.totalTickets      = all.reduce((s, e) => s + (e.totalTickets || 0), 0);
    fresh.participantCount  = all.length;
    upsertLottery(fresh);
  }

  return NextResponse.json({
    ok: true, entry: updated,
    message: `✅ Entry claimed! ${updated.totalTickets} tickets + ${updated.votusCredits} Votus added to your account.`,
  });
}
