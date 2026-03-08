export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAllLotteries, getEntriesForLottery, getActiveLottery } from '@/lib/store';
import prisma from '@/lib/db';
import { resolveDisplayName } from '@/lib/username';

// GET /api/initiums?search=...&section=all|current|profile&sort=views|dash|votus|newest|wins
// Returns merged feed of:
//   - Profile initiums (Prisma DB, never submitted to lottery)
//   - Lottery entry initiums (store.json, currently in/completed lotteries)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search   = searchParams.get('search')?.toLowerCase() || '';
    const section  = searchParams.get('section') || 'all';   // all | current | profile
    const sort     = searchParams.get('sort') || 'views';    // views|dash|votus|newest|wins
    const username = searchParams.get('username')?.toLowerCase().replace(/^@/, '') || '';

    // ── 1. Lottery entry initiums (from store) ─────────────────────────────
    const lotteries = getAllLotteries();
    const activeLottery = getActiveLottery();
    const lotteryInitiums: any[] = [];
    const seenSlugs = new Set<string>();
    const seenTitles = new Set<string>(); // dedup by title when no slug

    for (const lottery of lotteries) {
      const entries = getEntriesForLottery(lottery.id);
      for (const entry of entries) {
        if (!entry.initiumTitle && !entry.initiumDescription && !entry.initium) continue;
        if (entry.dashContributed < 0.0999) continue; // must have funded

        lotteryInitiums.push({
          source:             'lottery',
          entryId:            entry.id,
          lotteryId:          lottery.id,
          lotteryTitle:       lottery.title,
          lotteryStatus:      lottery.status,
          isCurrentLottery:   activeLottery?.id === lottery.id,
          displayName:        entry.displayName,
          dashUsername:       entry.dashUsername,
          initiumTitle:       entry.initiumTitle || entry.initium || '(untitled)',
          initiumDescription: entry.initiumDescription,
          initiumUrl:         entry.initiumUrl,
          mediaUrl:           entry.mediaUrl,
          mediaType:          entry.mediaType,
          totalTickets:       entry.totalTickets,
          dashContributed:    entry.dashContributed,
          isAnonymous:        entry.isAnonymous,
          createdAt:          entry.createdAt,
          upvoteCount:        entry.upvoters?.length || 0,
          slug:               (entry as any).initiumId ? undefined : undefined,
          initiumId:          (entry as any).initiumId,
          viewCount:          0,
          totalDashEarned:    0,
          totalVotusEarned:   entry.upvoters?.length || 0,
          totalWins:          0,
          totalLotteries:     1,
        });
        seenTitles.add((entry.initiumTitle || '').toLowerCase());
      }
    }

    // ── 2. Profile initiums from Prisma DB ────────────────────────────────
    const dbInitiums = await prisma.initium.findMany({
      where: { isPublic: true },
      include: { user: { select: { displayName: true, dashUsername: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const profileInitiums: any[] = dbInitiums.map(init => ({
      source:             'profile',
      entryId:            `profile-${init.id}`,
      lotteryId:          null,
      lotteryTitle:       null,
      lotteryStatus:      null,
      isCurrentLottery:   false,
      displayName:        resolveDisplayName(init.user as any),
      dashUsername:       (init.user as any)?.dashUsername,
      initiumTitle:       init.title,
      initiumDescription: init.description,
      initiumUrl:         init.url,
      mediaUrl:           init.mediaUrl,
      mediaType:          init.mediaType,
      totalTickets:       0,
      dashContributed:    init.totalDashEarned,
      isAnonymous:        false,
      createdAt:          init.createdAt.getTime(),
      upvoteCount:        init.totalVotusEarned,
      slug:               init.slug,
      initiumId:          init.id,
      viewCount:          init.viewCount,
      totalDashEarned:    init.totalDashEarned,
      totalVotusEarned:   init.totalVotusEarned,
      totalWins:          (init as any).totalWins || 0,
      totalLotteries:     (init as any).totalLotteries || 0,
      dashAddress:        (init as any).dashAddress,
    }));

    // ── 3. Merge — prefer profile entry when same initiumId or title ──────
    // If a lottery entry has an initiumId that matches a profile initium, enrich it
    const profileById = new Map(dbInitiums.map(i => [i.id, i]));
    const enrichedLottery = lotteryInitiums.map(li => {
      if (li.initiumId && profileById.has(li.initiumId)) {
        const p = profileById.get(li.initiumId)!;
        return {
          ...li,
          viewCount:       p.viewCount,
          totalDashEarned: p.totalDashEarned,
          totalVotusEarned: p.totalVotusEarned,
          totalWins:       (p as any).totalWins || 0,
          totalLotteries:  (p as any).totalLotteries || 0,
          slug:            p.slug,
          dashAddress:     (p as any).dashAddress,
        };
      }
      return li;
    });

    // Profile initiums NOT already represented in lottery entries (by initiumId)
    const lotteryInitiumIds = new Set(lotteryInitiums.map(l => l.initiumId).filter(Boolean));
    const pureProfileInitiums = profileInitiums.filter(p => {
      // If this profile initium is already in lottery entries (via initiumId), skip
      if (p.initiumId && lotteryInitiumIds.has(p.initiumId)) return false;
      // Also skip if title appears in lottery initiums and there's no profile link
      return true;
    });

    // ── 4. Combine by section ─────────────────────────────────────────────
    let combined: any[];
    if (section === 'current') {
      combined = enrichedLottery.filter(i => i.isCurrentLottery);
    } else if (section === 'profile') {
      combined = pureProfileInitiums;
    } else {
      // 'all' — merge, dedup
      combined = [...enrichedLottery, ...pureProfileInitiums];
    }

    // ── 5. Search filter ──────────────────────────────────────────────────
    if (search) {
      combined = combined.filter(i =>
        i.initiumTitle?.toLowerCase().includes(search) ||
        i.initiumDescription?.toLowerCase().includes(search) ||
        i.displayName?.toLowerCase().includes(search) ||
        i.dashUsername?.toLowerCase().includes(search)
      );
    }
    if (username) {
      combined = combined.filter(i =>
        i.dashUsername?.toLowerCase().replace(/^@/, '') === username
      );
    }

    // ── 6. Sort ───────────────────────────────────────────────────────────
    combined.sort((a, b) => {
      if (sort === 'views')  return (b.viewCount || 0) - (a.viewCount || 0);
      if (sort === 'dash')   return (b.totalDashEarned || b.dashContributed || 0) - (a.totalDashEarned || a.dashContributed || 0);
      if (sort === 'votus')  return (b.totalVotusEarned || b.upvoteCount || 0) - (a.totalVotusEarned || a.upvoteCount || 0);
      if (sort === 'wins')   return (b.totalWins || 0) - (a.totalWins || 0);
      // default: newest
      return b.createdAt - a.createdAt;
    });

    // ── 7. Current lottery initiums (separate section data) ───────────────
    const currentLotteryInitiums = enrichedLottery.filter(i => i.isCurrentLottery);

    return NextResponse.json({
      initiums: combined,
      total:    combined.length,
      currentLotteryInitiums,
      currentLotteryCount: currentLotteryInitiums.length,
    });
  } catch (err: unknown) {
    console.error('[initiums]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
