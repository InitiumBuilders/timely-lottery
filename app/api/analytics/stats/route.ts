export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/stats
 * Aggregates data from the analytics store, lottery store, and user DB.
 * Powers the Timely Insight admin dashboard.
 * Admin-only — no public auth check needed (admin panel handles auth client-side).
 */
import { NextResponse } from 'next/server';
import { getStats }       from '@/lib/analytics';
import {
  getAllLotteries,
  getAllEntries,
  getAllWinners,
  getWordSubmissions,
  getWordFrequency,
  getReserveStats,
} from '@/lib/store';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // ── Parallel data fetch ────────────────────────────────────────────────
    const [analytics, allEntries, allLotteries, allWinners, reserveStats] = await Promise.all([
      Promise.resolve(getStats()),
      Promise.resolve(getAllEntries()),
      Promise.resolve(getAllLotteries()),
      Promise.resolve(getAllWinners()),
      Promise.resolve(getReserveStats()),
    ]);

    // ── User DB stats ──────────────────────────────────────────────────────
    let totalUsers = 0, usersWithDash = 0, usersWithVerifiedEmail = 0, newestUsers: Array<{ displayName: string | null; dashUsername: string | null; createdAt: Date }> = [];
    try {
      [totalUsers, usersWithDash, usersWithVerifiedEmail] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { dashUsername: { not: null } } }),
        prisma.user.count({ where: { emailVerified: true } }),
      ]);
      newestUsers = await prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { displayName: true, dashUsername: true, createdAt: true },
      });
    } catch { /* DB may not be running in dev */ }

    // ── Top contributors (aggregate across all entries by identity) ─────────
    const contributorMap = new Map<string, {
      name: string;
      totalTickets: number;
      totalDash: number;
      lotteries: Set<string>;
      initiumsSubmitted: number;
    }>();

    for (const entry of allEntries) {
      const key = (
        entry.dashEvolutionUsername ||
        entry.dashUsername ||
        entry.displayName ||
        entry.dashAddress
      ).toLowerCase().trim();

      if (!contributorMap.has(key)) {
        contributorMap.set(key, {
          name: (
            entry.displayName ||
            entry.dashUsername ||
            entry.dashEvolutionUsername ||
            entry.dashAddress.slice(0, 12) + '…'
          ),
          totalTickets: 0,
          totalDash: 0,
          lotteries: new Set<string>(),
          initiumsSubmitted: 0,
        });
      }
      const c = contributorMap.get(key)!;
      c.totalTickets += entry.totalTickets;
      c.totalDash    += entry.dashContributed;
      c.lotteries.add(entry.lotteryId);
      if (entry.initium || entry.initiumTitle) c.initiumsSubmitted += 1;
    }

    const topContributors = Array.from(contributorMap.values())
      .sort((a, b) => b.totalTickets - a.totalTickets)
      .slice(0, 10)
      .map(c => ({ ...c, lotteries: c.lotteries.size }));

    // ── Word frequency ─────────────────────────────────────────────────────
    const allWords    = getWordSubmissions();
    const wordFreqAll = getWordFrequency(allWords).slice(0, 40);

    // ── Daily data (last 30 days) ──────────────────────────────────────────
    const today     = new Date().toISOString().slice(0, 10);
    const dailyData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key  = d.toISOString().slice(0, 10);
      const stat = analytics.byDay[key] || { views: 0, sessions: 0, timeMs: 0 };
      dailyData.push({
        date:     key,
        views:    stat.views    || 0,
        sessions: stat.sessions || 0,
        timeMs:   stat.timeMs   || 0,
        isToday:  key === today,
      });
    }

    // ── Top pages ──────────────────────────────────────────────────────────
    const topPages = Object.entries(analytics.byPage)
      .map(([page, stats]) => ({
        page,
        views:   stats.views   || 0,
        sessions:stats.sessions || 0,
        timeMs:  stats.timeMs  || 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 12);

    // ── Top countries ──────────────────────────────────────────────────────
    const topCountries = Object.entries(analytics.byCountry)
      .map(([country, views]) => ({ country, views: views || 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    // ── Lottery performance stats ──────────────────────────────────────────
    const completedLotteries = allLotteries.filter(l => l.status === 'ended');
    const activeLottery      = allLotteries.find(l => l.status === 'active');

    const lotteryStats = allLotteries.map(l => ({
      id:              l.id,
      title:           l.title,
      status:          l.status,
      totalDash:       l.totalDash       || 0,
      totalTickets:    l.totalTickets    || 0,
      participantCount:l.participantCount|| 0,
      durationMinutes: l.durationMinutes || 0,
      startTime:       l.startTime,
      endTime:         l.endTime,
      winnerName:      l.winnerName,
      winnerDash:      l.winnerDash      || 0,
      createdAt:       l.createdAt,
    }));

    const avgParticipantsPerLottery = completedLotteries.length
      ? completedLotteries.reduce((s, l) => s + l.participantCount, 0) / completedLotteries.length
      : 0;

    const avgDashPerLottery = completedLotteries.length
      ? completedLotteries.reduce((s, l) => s + l.totalDash, 0) / completedLotteries.length
      : 0;

    // ── Today's stats ──────────────────────────────────────────────────────
    const todayStat = analytics.byDay[today] || { views: 0, sessions: 0, timeMs: 0 };
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStat = analytics.byDay[yesterday.toISOString().slice(0, 10)] || { views: 0, sessions: 0, timeMs: 0 };

    return NextResponse.json({
      // ── Analytics ─────────────────────────────────────────────────────────
      totalViews:           analytics.totalViews         || 0,
      totalUniqueSessions:  analytics.totalUniqueSessions|| 0,
      totalTimeMs:          analytics.totalTimeMs        || 0,
      dailyData,
      topPages,
      topCountries,
      todayViews:           todayStat.views    || 0,
      todaySessions:        todayStat.sessions || 0,
      todayTimeMs:          todayStat.timeMs   || 0,
      yesterdayViews:       yesterdayStat.views || 0,
      yesterdaySessions:    yesterdayStat.sessions || 0,
      lastUpdated:          analytics.lastUpdated,

      // ── Users ─────────────────────────────────────────────────────────────
      totalUsers,
      usersWithDash,
      usersWithVerifiedEmail,
      newestUsers,
      dashUsernamePercent: totalUsers > 0 ? Math.round((usersWithDash / totalUsers) * 100) : 0,

      // ── Contributors ──────────────────────────────────────────────────────
      topContributors,
      totalEntries: allEntries.length,
      totalWinners: allWinners.length,

      // ── Words ─────────────────────────────────────────────────────────────
      wordFreq:      wordFreqAll,
      totalWordDrops:allWords.length,

      // ── Lotteries & Finance ────────────────────────────────────────────────
      lotteries:              lotteryStats,
      totalLotteries:         allLotteries.length,
      completedLotteries:     completedLotteries.length,
      activeLotteryId:        activeLottery?.id || null,
      activeLotteryPool:      activeLottery?.totalDash || 0,
      totalDashProcessed:     reserveStats.totalDashProcessed     || 0,
      reserveTotalAllocated:  reserveStats.reserveTotalAllocated  || 0,
      nextLotteryFundHeld:    reserveStats.nextLotteryFundHeld    || 0,
      allocationHistory:      reserveStats.allocationHistory      || [],
      avgParticipantsPerLottery,
      avgDashPerLottery,
      totalDashToWinners: (reserveStats.allocationHistory || []).reduce((s: number, r: { winnerDash: number }) => s + r.winnerDash, 0),
    });
  } catch (e) {
    console.error('[analytics/stats] error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
