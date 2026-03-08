export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveLottery, getEntry, upsertEntry } from '@/lib/store';
import { totalTickets } from '@/lib/ticket-utils';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // voterEntryId = the voter's entry ID, entryId = target to upvote
    const { entryId, voterEntryId } = body;
    if (!voterEntryId || !entryId) {
      return NextResponse.json({ error: 'voterEntryId and entryId required' }, { status: 400 });
    }

    const lottery = getActiveLottery();
    if (!lottery) return NextResponse.json({ error: 'No active lottery' }, { status: 404 });

    const voter = getEntry(voterEntryId);
    if (!voter || voter.lotteryId !== lottery.id) {
      return NextResponse.json({ error: 'Voter entry not found' }, { status: 404 });
    }

    // Check voter has Votus available
    const votusAvailable = (voter.votusCredits || 0) - (voter.votusSpent || 0);
    if (votusAvailable < 1) {
      return NextResponse.json({ error: 'Not enough Votus credits. Send more DASH to earn Votus (1 per 0.3 DASH).' }, { status: 403 });
    }

    if (voter.id === entryId) {
      return NextResponse.json({ error: "Can't upvote your own entry" }, { status: 400 });
    }

    // Check max 3 Votus per initium (per voter)
    const votesOnTarget = (voter.upvotedEntries || []).filter(id => id === entryId).length;
    if (votesOnTarget >= 3) {
      return NextResponse.json({ error: 'Max 3 Votus per initium' }, { status: 400 });
    }

    const target = getEntry(entryId);
    if (!target || target.lotteryId !== lottery.id) {
      return NextResponse.json({ error: 'Target entry not found' }, { status: 404 });
    }

    // Block Votus on anonymous entries
    if ((target as any).isAnonymous === true || !(target as any).initiumTitle) {
      return NextResponse.json({ error: 'Votus can only be sent to entries with a linked Initium. Anonymous contributions cannot receive Votus.' }, { status: 400 });
    }

    // Apply upvote: target gains +1 upvote ticket
    target.upvoteTickets = (target.upvoteTickets || 0) + 1;
    target.totalTickets  = totalTickets(target.baseTickets || 0, target.upvoteTickets);
    if (!target.upvoters) target.upvoters = [];
    target.upvoters.push(voter.id);
    upsertEntry(target);

    // Deduct Votus from voter (their ticket count is unaffected — Votus are not their own tickets)
    if (!voter.upvotedEntries) voter.upvotedEntries = [];
    voter.upvotedEntries.push(entryId);
    voter.votusSpent     = (voter.votusSpent || 0) + 1;
    voter.votusAvailable = (voter.votusCredits || 0) - voter.votusSpent;
    // voter.totalTickets stays as base + their own upvoteTickets — unchanged
    upsertEntry(voter);

    // Update initium card stats if this entry is linked to one
    if ((target as any).initiumId) {
      try {
        await prisma.initium.update({
          where: { id: (target as any).initiumId },
          data: { totalVotusEarned: { increment: 1 } },
        });
      } catch { /* non-fatal — initium may have been deleted */ }
    }

    return NextResponse.json({
      ok: true,
      message: `✅ Votus spent! +1 ticket added to ${target.initiumTitle || 'this entry'}.`,
      votusRemaining: voter.votusAvailable,
      target: { id: target.id, totalTickets: target.totalTickets, upvoteTickets: target.upvoteTickets },
    });
  } catch (err) {
    return NextResponse.json({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
