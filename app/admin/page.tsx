'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

interface Lottery {
  id: string; title: string; description: string; address: string;
  status: string; endTime: number; startTime: number; totalDash: number;
  totalTickets: number; participantCount: number; winnerName?: string;
  winnerInitium?: string; winnerDash?: number; durationMinutes: number;
}
interface PoolEntry {
  id: string; displayName: string; dashAddress: string; entryAddress: string;
  dashContributed: number; baseTickets: number; upvoteTickets: number;
  totalTickets: number; initium?: string; winChance?: string;
  verifiedTxIds?: string[];
}
interface Contribution {
  txId: string; from: string; amount: number; tickets: number;
  confirmations: number; timestamp: number;
}
interface EndResult {
  winner?: {
    displayName?: string; dashUsername?: string; dashAddress?: string; initium?: string;
  };
  lottery?: { totalDash?: number };
  payoutResult?: { txIds?: string[]; errors?: string[] };
}

// ─── Timely Insight types ─────────────────────────────────────────────────────

interface DayPoint {
  date: string; views: number; sessions: number; timeMs: number; isToday: boolean;
}
interface PagePoint  { page: string; views: number; sessions: number; timeMs: number; }
interface CountryRow { country: string; views: number; }
interface Contributor {
  name: string; totalTickets: number; totalDash: number; lotteries: number; initiumsSubmitted: number;
}
interface WordFreqItem { word: string; count: number; }
interface LotteryRow {
  id: string; title: string; status: string; totalDash: number; totalTickets: number;
  participantCount: number; durationMinutes: number; startTime: number; endTime: number;
  winnerName?: string; winnerDash: number; createdAt: number;
}
interface InsightData {
  totalViews: number; totalUniqueSessions: number; totalTimeMs: number;
  dailyData: DayPoint[]; topPages: PagePoint[]; topCountries: CountryRow[];
  todayViews: number; todaySessions: number; todayTimeMs: number;
  yesterdayViews: number; yesterdaySessions: number;
  totalUsers: number; usersWithDash: number; usersWithVerifiedEmail: number;
  dashUsernamePercent: number;
  newestUsers: Array<{ displayName: string | null; dashUsername: string | null; createdAt: string }>;
  topContributors: Contributor[]; totalEntries: number; totalWinners: number;
  wordFreq: WordFreqItem[]; totalWordDrops: number;
  lotteries: LotteryRow[]; totalLotteries: number; completedLotteries: number;
  activeLotteryId: string | null; activeLotteryPool: number;
  totalDashProcessed: number; reserveTotalAllocated: number; nextLotteryFundHeld: number;
  allocationHistory: Array<{lotteryTitle:string;totalDash:number;winnerDash:number;reserveDash:number;nextLotteryDash:number;winnerName?:string;txId?:string;timestamp:number}>;
  avgParticipantsPerLottery: number; avgDashPerLottery: number; totalDashToWinners: number;
  lastUpdated: number;
}

// ─── Timely Insight helper components ─────────────────────────────────────────

// Flag emoji from ISO-3166 country code
function flag(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  const A = 0x1F1E6;
  return String.fromCodePoint(A + code.charCodeAt(0) - 65, A + code.charCodeAt(1) - 65);
}

// Format milliseconds → "4h 32m" or "47m" or "<1m"
function fmtMs(ms: number): string {
  if (!ms || ms < 60000) return '<1m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Format large numbers
function fmtNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// Animated counter
function InsightCount({ to, duration = 1200, suffix = '' }: { to: number; duration?: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!to) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);
  return <>{fmtNum(val)}{suffix}</>;
}

// Stat card for Insight
function IStat({ icon, label, value, sub, color = '#00FFFF', trend }: {
  icon: string; label: string; value: React.ReactNode; sub?: string; color?: string; trend?: number;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1.5 relative overflow-hidden"
      style={{ background: `${color}09`, border: `1px solid ${color}20` }}>
      <div className="absolute -top-4 -right-4 text-5xl opacity-[0.07] select-none">{icon}</div>
      <div className="text-lg">{icon}</div>
      <div className="text-[10px] font-mono tracking-widest uppercase" style={{ color: `${color}70` }}>{label}</div>
      <div className="text-xl md:text-2xl font-black font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-white/35 font-mono">{sub}</div>}
      {trend !== undefined && (
        <div className="text-[10px] font-mono mt-0.5" style={{ color: trend >= 0 ? '#00ff88' : '#ff6b6b' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs yesterday
        </div>
      )}
    </div>
  );
}

// SVG area chart — daily data
function InsightAreaChart({ data, color = '#00FFFF' }: { data: DayPoint[]; color?: string }) {
  if (!data.length) return <div className="h-24 flex items-center justify-center text-white/20 text-sm">No data yet</div>;
  const W = 600, H = 90, PAD = 8;
  const vals = data.map(d => d.views);
  const max  = Math.max(...vals, 1);
  const pts: [number, number][] = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2;
    const y = H - PAD - ((d.views / max) * (H - PAD * 2));
    return [x, y];
  });
  // Smooth cubic bezier path
  let linePath = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], curr = pts[i];
    const cpx = (prev[0] + curr[0]) / 2;
    linePath += ` C${cpx},${prev[1]} ${cpx},${curr[1]} ${curr[0]},${curr[1]}`;
  }
  const areaPath = linePath + ` L${W},${H} L0,${H} Z`;
  const gradId = `areaGrad_${color.replace('#', '')}`;
  // Today marker
  const todayIdx = data.findIndex(d => d.isToday);
  const todayPt  = todayIdx >= 0 ? pts[todayIdx] : null;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Today marker */}
        {todayPt && (
          <>
            <circle cx={todayPt[0]} cy={todayPt[1]} r="5" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
            <circle cx={todayPt[0]} cy={todayPt[1]} r="8" fill={color} fillOpacity="0.2" />
          </>
        )}
      </svg>
      {/* Date labels */}
      <div className="flex justify-between mt-1 px-1">
        <span className="text-[9px] text-white/25 font-mono">{data[0]?.date?.slice(5)}</span>
        <span className="text-[9px] font-mono" style={{ color: `${color}80` }}>Today</span>
      </div>
    </div>
  );
}

// Horizontal bar chart row
function HBarRow({ label, value, max, color = '#00FFFF', suffix = '', index = 0 }: {
  label: string; value: number; max: number; color?: string; suffix?: string; index?: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="text-[10px] font-mono text-white/50 w-5 flex-shrink-0 text-right">{index + 1}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/75 truncate font-medium mb-1">{label}</div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: index < 3 ? color : `${color}80`, boxShadow: index === 0 ? `0 0 8px ${color}60` : 'none' }} />
        </div>
      </div>
      <div className="text-xs font-mono font-bold flex-shrink-0" style={{ color: index === 0 ? color : 'rgba(255,255,255,0.5)' }}>
        {fmtNum(value)}{suffix}
      </div>
    </div>
  );
}

// Rank badge
function RankBadge({ rank }: { rank: number }) {
  const cfg = [
    { bg: 'rgba(255,215,0,0.15)',   border: 'rgba(255,215,0,0.5)',   color: '#FFD700', label: '🥇' },
    { bg: 'rgba(192,192,192,0.12)', border: 'rgba(192,192,192,0.4)', color: '#C0C0C0', label: '🥈' },
    { bg: 'rgba(205,127,50,0.12)',  border: 'rgba(205,127,50,0.4)',  color: '#CD7F32', label: '🥉' },
  ][rank - 1] || { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', label: `#${rank}` };
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-black"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {rank <= 3 ? cfg.label : rank}
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed]           = useState(false);
  const [password, setPassword]       = useState('');
  const [authErr, setAuthErr]         = useState('');
  const [lottery, setLottery]         = useState<Lottery | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [entries, setEntries]         = useState<PoolEntry[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState('');
  const [msgErr, setMsgErr]           = useState(false);
  const [ending, setEnding]           = useState(false);
  const [scanning, setScanning]       = useState(false);
  const [tab, setTab]                 = useState<'entries' | 'ledger' | 'reserve' | 'words'>('entries');
  const [wordFreq, setWordFreq]       = useState<{ word: string; count: number }[]>([]);
  const [wordData, setWordData]       = useState<{ currentWords: { word: string; username: string; timestamp: number }[]; nextWords: { word: string; username: string; timestamp: number }[] } | null>(null);
  const [reserveStats, setReserveStats] = useState<{
    reserveAddress: string; liveBalance: number; txCount: number;
    reserveTotalAllocated: number; nextLotteryFundHeld: number; totalDashProcessed: number;
    allocationHistory: Array<{ lotteryId: string; lotteryTitle: string; totalDash: number; winnerDash: number; reserveDash: number; nextLotteryDash: number; winnerName?: string; txId?: string; timestamp: number }>;
  } | null>(null);
  const [now, setNow]                 = useState<number | null>(null);  // SSR-safe clock
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [payoutAddr, setPayoutAddr]     = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutResult, setPayoutResult] = useState<{ txIds: string[]; totalSent: number; errors: string[] } | null>(null);

  // ── Timely Insight ────────────────────────────────────────────────────────
  const [insightData,    setInsightData]    = useState<InsightData | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [showInsight,    setShowInsight]    = useState(false);

  // Create form
  const [title, setTitle]     = useState('');
  const [desc, setDesc]       = useState('');
  const [duration, setDuration] = useState(60);
  const [doPayout, setDoPayout] = useState(true);
  const [endResult, setEndResult] = useState<EndResult | null>(null);

  // SSR-safe clock — only runs on client
  useEffect(() => {
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(iv);
  }, []);

  const timeLeft = lottery && now ? Math.max(0, lottery.endTime - now) : 0;
  const expired  = lottery && now ? now > lottery.endTime : false;

  // ── Load Timely Insight ───────────────────────────────────────────────────
  const loadInsight = useCallback(async () => {
    setInsightLoading(true);
    try {
      const r = await fetch('/api/analytics/stats', { cache: 'no-store' });
      if (r.ok) setInsightData(await r.json());
    } catch (e) {
      console.error('loadInsight error', e);
    } finally {
      setInsightLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed && showInsight && !insightData) loadInsight();
  }, [authed, showInsight, insightData, loadInsight]);

  // ── Load current lottery ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/lottery/current');
      const d = await r.json();
      setLottery(d.lottery ?? null);
      if (d.entries) {
        setEntries(d.entries);
      }
    } catch (e) {
      console.error('load error', e);
    } finally {
      setPageLoading(false);
    }
  }, []);

  // ── Load reserve stats ────────────────────────────────────────────────────
  const loadReserve = useCallback(async () => {
    try {
      const r = await fetch('/api/reserve/balance', { cache: 'no-store' });
      if (r.ok) setReserveStats(await r.json());
    } catch { /* silent */ }
  }, []);

  // Load reserve when Reserve tab is selected
  useEffect(() => { if (tab === 'reserve') loadReserve(); }, [tab, loadReserve]);
  useEffect(() => {
    if (tab === 'words') {
      fetch('/api/words?target=all').then(r => r.json()).then(d => {
        setWordFreq(d.allFreq || []);
        setWordData({ currentWords: d.currentWords || [], nextWords: d.nextWords || [] });
      }).catch(() => {});
    }
  }, [tab]);

  // ── Load pool (blockchain refresh + ticket counts) ────────────────────────
  const loadPool = useCallback(async () => {
    try {
      const r = await fetch('/api/lottery/pool');
      const d = await r.json();
      if (d.entries) setEntries(d.entries);
      if (d.contributions) setContributions(d.contributions);
      if (d.pool != null) {
        setLottery(prev => prev
          ? { ...prev, totalDash: d.pool, totalTickets: d.totalTickets ?? prev.totalTickets }
          : prev
        );
      }
    } catch (e) {
      console.error('loadPool error', e);
    }
  }, []);

  // ── Auto-scan all entry addresses for new DASH ────────────────────────────
  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      await fetch('/api/lottery/scan', { method: 'POST' });
      await loadPool();
    } catch (e) {
      console.error('scan error', e);
    } finally {
      setScanning(false);
    }
  }, [loadPool]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  useEffect(() => {
    if (!authed || !lottery) return;
    loadPool();
    const iv = setInterval(loadPool, 30000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, lottery?.id]);

  // ── Auth — server-side verify (password never in client bundle) ──────────
  const handleLogin = async () => {
    setAuthErr('');
    try {
      const r = await fetch('/api/admin/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.ok) { setAuthed(true); }
      else setAuthErr('Wrong password — try again');
    } catch { setAuthErr('Connection error — try again'); }
  };

  // ── Create lottery ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) { setMsg('Please enter a title'); setMsgErr(true); return; }
    setLoading(true); setMsg(''); setMsgErr(false);
    try {
      const r = await fetch('/api/lottery/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password, title: title.trim(), description: desc.trim(), durationMinutes: duration }),
      });
      const d = await r.json();
      if (d.lottery) {
        setLottery(d.lottery);
        setMsg('✅ Lottery launched!');
        setMsgErr(false);
        setTitle(''); setDesc('');
        load();
      } else {
        setMsg('❌ ' + (d.error || 'Unknown error'));
        setMsgErr(true);
      }
    } catch (e: unknown) {
      setMsg('❌ Network error: ' + (e instanceof Error ? e.message : String(e)));
      setMsgErr(true);
    } finally {
      setLoading(false);
    }
  };

  // ── End lottery ───────────────────────────────────────────────────────────
  const handleEnd = async () => {
    if (!lottery) return;
    if (!confirm('End this lottery and pick a winner? This cannot be undone.')) return;
    setEnding(true); setMsg(''); setMsgErr(false);
    try {
      const r = await fetch('/api/lottery/end', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password, lotteryId: lottery.id, forcePayout: doPayout }),
      });
      const d = await r.json();
      if (d.error) {
        setMsg('❌ ' + d.error); setMsgErr(true);
      } else {
        setEndResult(d);
        setMsg(d.winner
          ? `🏆 Winner: ${d.winner.displayName || d.winner.dashUsername || String(d.winner.dashAddress).slice(0, 16)}...`
          : '⚠️ Lottery ended — no participants with tickets');
        setMsgErr(false);
      }
    } catch (e: unknown) {
      setMsg('❌ Network error: ' + (e instanceof Error ? e.message : String(e)));
      setMsgErr(true);
    } finally {
      setEnding(false);
      await load();
    }
  };

  // ── Manual payout ─────────────────────────────────────────────────────────
  const handleManualPayout = async () => {
    if (!lottery) return;
    if (!payoutAddr.trim()) { setMsg('Enter a DASH address to send winnings to'); setMsgErr(true); return; }
    if (!payoutAddr.trim().match(/^X[1-9A-HJ-NP-Za-km-z]{33}$/)) {
      setMsg('❌ Invalid DASH address — must start with X and be 34 characters'); setMsgErr(true); return;
    }
    if (!confirm(`Send all collected DASH to ${payoutAddr}? This cannot be undone.`)) return;

    setPayoutLoading(true); setMsg(''); setMsgErr(false);
    try {
      const r = await fetch('/api/lottery/payout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password, lotteryId: lottery.id, toAddress: payoutAddr.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        setPayoutResult(d);
        setMsg(`✅ ${d.totalSent?.toFixed(4)} DASH sent! ${d.txIds?.length} TX(s) broadcast.`);
        setMsgErr(false);
        await load();
      } else {
        setMsg('❌ Payout failed: ' + (d.error || 'Unknown error'));
        setMsgErr(true);
      }
    } catch (e: unknown) {
      setMsg('❌ Network error: ' + (e instanceof Error ? e.message : String(e)));
      setMsgErr(true);
    } finally {
      setPayoutLoading(false);
    }
  };

  // ── Delete entry ──────────────────────────────────────────────────────────
  const handleDelete = async (entryId: string, name: string) => {
    if (!confirm(`Delete entry for "${name}"? This will remove them from the lottery.`)) return;
    setDeletingId(entryId);
    try {
      const r = await fetch('/api/entry/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password, entryId }),
      });
      const d = await r.json();
      if (d.ok) {
        setEntries(prev => prev.filter(e => e.id !== entryId));
        setMsg(`🗑 Entry deleted: ${name}`);
        setMsgErr(false);
        await load();
      } else {
        setMsg('❌ Delete failed: ' + (d.error || 'Unknown'));
        setMsgErr(true);
      }
    } catch (e: unknown) {
      setMsg('❌ Delete error: ' + (e instanceof Error ? e.message : String(e)));
      setMsgErr(true);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-strong p-10 w-full max-w-sm text-center">
        <div className="text-4xl mb-6">🔐</div>
        <h1 className="text-2xl font-black text-white mb-2">Admin Access</h1>
        <p className="text-white/30 text-sm mb-8">Enter the admin password to continue</p>
        <input
          type="password"
          className="input-glass mb-4"
          placeholder="Admin password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          autoFocus
        />
        {authErr && <p className="text-red-400 text-sm mb-4 font-mono">{authErr}</p>}
        <button onClick={handleLogin} className="btn-neon w-full py-3">
          Unlock Dashboard →
        </button>
      </div>
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (authed && pageLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">⚡</div>
        <p className="text-white/40 font-mono text-sm tracking-widest">LOADING ADMIN PANEL...</p>
      </div>
    </div>
  );

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="text-xs font-mono text-cyan-400/60 tracking-widest mb-2">// ADMIN PANEL</div>
            <h1 className="text-3xl font-black text-white">Lottery Control</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={runScan} disabled={scanning}
              className="text-xs font-mono px-4 py-2 rounded-full border transition-all"
              style={{ color: scanning ? 'rgba(0,255,136,0.4)' : '#00ff88', borderColor: scanning ? 'rgba(0,255,136,0.15)' : 'rgba(0,255,136,0.3)', background: 'rgba(0,255,136,0.05)' }}>
              {scanning ? '⏳ Scanning...' : '⚡ Auto-Scan DASH'}
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}>
              <div className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: '0 0 8px #4ade80' }} />
              <span className="text-xs font-mono text-green-400 tracking-widest">ADMIN</span>
            </div>
          </div>
        </div>

        {/* URL Banner */}
        <div className="mb-6 px-5 py-3 rounded-xl flex items-center justify-between flex-wrap gap-3"
          style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.2)' }}>
          <span className="text-xs font-mono text-green-400/70">🟢 LIVE: <span className="text-green-400">timely-lottery.vercel.app</span></span>
          <div className="flex gap-3">
            <a href="/lottery" className="text-xs text-cyan-400 font-mono hover:text-cyan-300 transition-colors">Lottery Page →</a>
            <a href="/winners" className="text-xs text-white/30 font-mono hover:text-white/60 transition-colors">Winners →</a>
          </div>
        </div>

        {/* Alert message */}
        {msg && (
          <div className="mb-6 px-5 py-4 rounded-xl font-mono text-sm"
            style={{
              background: msgErr ? 'rgba(255,50,50,0.05)' : 'rgba(0,255,255,0.05)',
              border: `1px solid ${msgErr ? 'rgba(255,80,80,0.3)' : 'rgba(0,255,255,0.2)'}`,
              color: msgErr ? '#ff6b6b' : '#00FFFF',
            }}>
            {msg}
          </div>
        )}

        {/* ── CURRENT LOTTERY ── */}
        <div className="glass-strong p-6 mb-8">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-lg font-bold text-white">Current Lottery</h2>
            {lottery && (
              <div className="flex items-center gap-3">
                <button onClick={loadPool} className="text-xs text-cyan-400/60 hover:text-cyan-400 font-mono transition-colors">↻ Refresh</button>
                <span className={`text-xs font-mono px-3 py-1 rounded-full border ${lottery.status === 'active' ? 'text-green-400 border-green-400/30 bg-green-400/10' : 'text-white/30 border-white/10'}`}>
                  {lottery.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {!lottery ? (
            <p className="text-white/30 text-sm">No active lottery. Create one below ↓</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xl font-bold text-white">{lottery.title}</div>
                {lottery.description && <p className="text-white/40 text-sm mt-1">{lottery.description}</p>}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: 'PRIZE POOL', v: `${lottery.totalDash.toFixed(4)} DASH` },
                  { l: 'TOTAL TICKETS', v: lottery.totalTickets.toString() },
                  { l: 'PARTICIPANTS', v: lottery.participantCount.toString() },
                  { l: 'TIME LEFT', v: now == null ? '...' : (expired ? 'EXPIRED' : `${Math.floor(timeLeft / 60000)}m`) },
                ].map((s, i) => (
                  <div key={i} className="stat-card">
                    <div className="text-xl font-bold font-mono text-cyan-400">{s.v}</div>
                    <div className="text-xs text-white/25 font-mono mt-1">{s.l}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-xs text-white/30 font-mono mb-2">LOTTERY DEPOSIT ADDRESS</div>
                <div className="font-mono text-xs text-cyan-400/80 bg-black/30 px-4 py-3 rounded-lg border border-cyan-400/15 break-all select-all">{lottery.address}</div>
              </div>

              {/* End controls */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,50,50,0.04)', border: '1px solid rgba(255,80,80,0.15)' }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-white/80 font-semibold text-sm">End &amp; Draw Winner</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={doPayout} onChange={e => setDoPayout(e.target.checked)} className="accent-cyan-400" />
                    <span className="text-xs text-white/40">Auto-payout winner</span>
                  </label>
                </div>
                <button onClick={handleEnd} disabled={ending}
                  className="w-full py-3 rounded-xl font-bold text-sm font-mono transition-all"
                  style={{ background: ending ? 'rgba(255,50,50,0.1)' : 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,80,80,0.3)', color: ending ? 'rgba(255,100,100,0.5)' : '#ff6b6b' }}>
                  {ending ? '🎲 Drawing winner...' : '🏁 End Lottery & Pick Winner'}
                </button>
              </div>

              {/* Winner display */}
              {endResult?.winner && (
                <div className="p-5 rounded-xl" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <div className="text-xs font-mono text-yellow-400/60 mb-3 tracking-widest">🏆 WINNER SELECTED</div>
                  <div className="text-white font-bold text-xl">
                    {endResult.winner.displayName || endResult.winner.dashUsername || String(endResult.winner.dashAddress).slice(0, 20)}
                  </div>
                  {endResult.winner.initium && (
                    <p className="text-white/50 text-sm mt-1 italic">"{endResult.winner.initium}"</p>
                  )}
                  <div className="mt-3 text-base font-mono text-yellow-400">
                    {endResult.lottery?.totalDash?.toFixed(4)} DASH won
                  </div>
                  {(endResult.payoutResult?.txIds?.length ?? 0) > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-xs text-white/30 font-mono mb-1">PAYOUT TRANSACTIONS</div>
                      {endResult.payoutResult!.txIds!.map((txid, i) => (
                        <a key={i} href={`https://insight.dash.org/insight/tx/${txid}`} target="_blank" rel="noreferrer"
                          className="text-xs text-cyan-400 block hover:underline font-mono">
                          TX {i + 1}: {txid.slice(0, 24)}... ↗
                        </a>
                      ))}
                    </div>
                  )}
                  {(endResult.payoutResult?.errors?.length ?? 0) > 0 && (
                    <p className="mt-2 text-xs text-red-400/70 font-mono">⚠️ Some payouts failed — check server logs</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── MANUAL PAYOUT (shows when lottery ended + no payout yet) ── */}
        {lottery && lottery.status === 'ended' && (
          <div className="glass p-6 mb-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="text-2xl">💸</div>
              <div>
                <h2 className="text-lg font-bold text-white">Send Winnings to Winner</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  {lottery.winnerName
                    ? `Winner: ${lottery.winnerName} · ${lottery.totalDash.toFixed(4)} DASH to send`
                    : 'Enter the winner\'s DASH address to sweep all collected funds'}
                </p>
              </div>
            </div>

            {/* Show winner's stored receive address if available */}
            {entries.find(e => e.id === (lottery as unknown as Record<string,string>).winnerId)?.entryAddress && (
              <div className="mb-4 px-4 py-3 rounded-lg text-xs font-mono"
                style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <span className="text-yellow-400/60">Winner deposit address: </span>
                <span className="text-yellow-400 break-all">
                  {entries.find(e => e.id === (lottery as unknown as Record<string,string>).winnerId)?.entryAddress}
                </span>
              </div>
            )}

            {payoutResult ? (
              <div className="space-y-3">
                <div className="px-5 py-4 rounded-xl" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)' }}>
                  <div className="text-green-400 font-mono font-bold mb-3">
                    ✅ {payoutResult.totalSent?.toFixed(4)} DASH sent successfully!
                  </div>
                  <div className="space-y-2">
                    {payoutResult.txIds?.map((txid, i) => (
                      <div key={txid}>
                        <div className="text-xs text-white/30 font-mono">PAYOUT TX {i + 1} — VIEW ON EXPLORER</div>
                        <a
                          href={`https://insight.dash.org/insight/tx/${txid}`}
                          target="_blank" rel="noreferrer"
                          className="text-cyan-400 font-mono text-xs hover:underline break-all block mt-1"
                        >
                          {txid} ↗
                        </a>
                      </div>
                    ))}
                  </div>
                  {(payoutResult.errors?.length ?? 0) > 0 && (
                    <div className="mt-3 text-xs text-red-400/70 font-mono">
                      ⚠️ {payoutResult.errors.join(' | ')}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono mb-1 block" style={{ color: '#30BFFF' }}>
                    WINNER&apos;S DASH ADDRESS <span className="text-white/30">(starts with X)</span>
                  </label>
                  <input
                    className="input-glass font-mono"
                    placeholder="XdVg... — paste the winner's Dash wallet address"
                    value={payoutAddr}
                    onChange={e => setPayoutAddr(e.target.value)}
                  />
                  <p className="text-xs text-white/25 mt-1 font-mono">
                    This will sweep all {lottery.totalDash.toFixed(4)} DASH from {entries.filter(e => e.dashContributed > 0).length} funded address(es) to this wallet.
                  </p>
                </div>
                <button
                  onClick={handleManualPayout}
                  disabled={payoutLoading || !payoutAddr.trim()}
                  className="w-full py-4 rounded-xl font-bold font-mono text-sm transition-all"
                  style={{
                    background: payoutLoading ? 'rgba(0,255,136,0.05)' : 'rgba(0,255,136,0.1)',
                    border: '1px solid rgba(0,255,136,0.3)',
                    color: payoutLoading ? 'rgba(0,255,136,0.4)' : '#00ff88',
                  }}>
                  {payoutLoading ? '⏳ Broadcasting payout transaction...' : `⚡ Send ${lottery.totalDash.toFixed(4)} DASH to Winner →`}
                </button>
              </div>
            )}

            {/* Start new lottery button */}
            <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-white/30 mb-3 font-mono">Ready to start the next round?</p>
              <button
                onClick={() => { setLottery(null); setPayoutResult(null); setPayoutAddr(''); }}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors">
                🚀 Create New Lottery →
              </button>
            </div>
          </div>
        )}

        {/* ── CREATE NEW LOTTERY ── */}
        {!lottery && (
          <div className="glass p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-6">🚀 Launch New Lottery</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 font-mono mb-1 block">TITLE *</label>
                <input className="input-glass" placeholder="e.g. Founder's Initium #1" value={title}
                  onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-white/40 font-mono mb-1 block">DESCRIPTION</label>
                <textarea className="input-glass" placeholder="Describe this lottery round..." value={desc}
                  onChange={e => setDesc(e.target.value)} rows={2} />
              </div>
              <div>
                <label className="text-xs text-white/40 font-mono mb-1 block">DURATION</label>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[30, 60, 120, 1440].map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`py-3 rounded-xl text-sm font-mono font-bold transition-all border ${duration === d ? 'text-cyan-400 border-cyan-400/40 bg-cyan-400/10' : 'text-white/30 border-white/10'}`}>
                      {d === 30 ? '30m' : d === 60 ? '1h' : d === 120 ? '2h' : '24h'}
                    </button>
                  ))}
                </div>
                <input type="number" className="input-glass" placeholder="Custom minutes"
                  value={duration} onChange={e => setDuration(Number(e.target.value))} min={5} />
                <p className="text-xs text-white/25 mt-1 font-mono">Duration: {duration} minutes</p>
              </div>
              <button onClick={handleCreate} disabled={loading || !title.trim()}
                className="btn-dash w-full py-4 text-base">
                {loading ? '⏳ Launching...' : '⚡ Launch Lottery NOW'}
              </button>
            </div>
          </div>
        )}

        {/* ── ENTRIES + LEDGER TABS ── */}
        {lottery && (
          <div className="glass p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap">
                {(['entries', 'ledger', 'reserve', 'words'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-widest transition-all border ${
                      tab === t
                        ? t === 'reserve' ? 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10'
                          : t === 'words' ? 'text-purple-400 border-purple-400/40 bg-purple-400/10'
                          : 'text-cyan-400 border-cyan-400/40 bg-cyan-400/10'
                        : 'text-white/30 border-white/10'
                    }`}>
                    {t === 'entries' ? `👥 Entries (${entries.length})` : t === 'ledger' ? `📋 TX Ledger` : t === 'reserve' ? `🏦 Reserve` : `💬 Words (${wordFreq.length})`}
                  </button>
                ))}
              </div>
              <button onClick={runScan} disabled={scanning}
                className="text-xs font-mono transition-colors"
                style={{ color: scanning ? 'rgba(0,255,136,0.4)' : 'rgba(0,255,136,0.7)' }}>
                {scanning ? '⏳ Scanning...' : '⚡ Scan All Addresses'}
              </button>
            </div>

            {/* ── ENTRIES TABLE ── */}
            {tab === 'entries' && (
              entries.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">No entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/25 font-mono text-xs tracking-widest border-b" style={{ borderColor: 'rgba(0,255,255,0.08)' }}>
                        <th className="text-left pb-3 pr-3">#</th>
                        <th className="text-left pb-3 pr-3">NAME / ADDRESS</th>
                        <th className="text-left pb-3 pr-3">INITIUM</th>
                        <th className="text-right pb-3 pr-3">DASH SENT</th>
                        <th className="text-right pb-3 pr-3">TICKETS</th>
                        <th className="text-right pb-3 pr-3">WIN %</th>
                        <th className="text-right pb-3">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e, i) => (
                        <tr key={e.id} className="border-b group" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <td className="py-3 pr-3 text-white/20 font-mono text-xs">{i + 1}</td>
                          <td className="py-3 pr-3">
                            <div className="text-white/80 font-medium text-xs">{e.displayName || 'Anonymous'}</div>
                            <div className="text-white/25 text-xs font-mono mt-0.5">
                              deposit: {e.entryAddress ? e.entryAddress.slice(0, 14) + '...' : '—'}
                            </div>
                            {(e.verifiedTxIds?.length ?? 0) > 1 && (
                              <div className="text-cyan-400/50 text-xs font-mono mt-0.5">
                                {e.verifiedTxIds!.length} transactions
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-3 max-w-[180px]">
                            {e.initium
                              ? <span className="text-white/40 text-xs truncate block">💡 {e.initium}</span>
                              : <span className="text-white/15 text-xs italic">—</span>
                            }
                          </td>
                          <td className="py-3 pr-3 text-right font-mono text-cyan-400 text-xs font-bold">
                            {e.dashContributed.toFixed(4)} Ð
                          </td>
                          <td className="py-3 pr-3 text-right">
                            <span className="font-mono text-white font-bold text-sm">{e.totalTickets} 🎟</span>
                            {e.baseTickets !== e.totalTickets && (
                              <div className="text-xs text-white/30 font-mono">
                                {e.baseTickets} base + {e.upvoteTickets} vote
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right font-mono text-[#30BFFF] text-xs font-bold">
                            {e.winChance ?? (lottery.totalTickets > 0 ? ((e.totalTickets / lottery.totalTickets) * 100).toFixed(1) + '%' : '—')}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleDelete(e.id, e.displayName || 'Entry')}
                              disabled={deletingId === e.id}
                              className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all opacity-40 group-hover:opacity-100"
                              style={{ background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,80,80,0.2)', color: '#ff6b6b' }}>
                              {deletingId === e.id ? '...' : '🗑 Delete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '1px solid rgba(0,255,255,0.1)' }}>
                        <td colSpan={3} className="pt-3 text-xs text-white/20 font-mono">TOTALS</td>
                        <td className="pt-3 text-right font-mono text-cyan-400 text-xs font-bold">
                          {entries.reduce((s, e) => s + e.dashContributed, 0).toFixed(4)} Ð
                        </td>
                        <td className="pt-3 text-right font-mono text-white font-bold">
                          {entries.reduce((s, e) => s + e.totalTickets, 0)} 🎟
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            )}

            {/* ── TX LEDGER TAB ── */}
            {tab === 'ledger' && (
              contributions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/30 text-sm mb-3">No TX ledger data yet.</p>
                  <button onClick={runScan} className="text-xs text-cyan-400 font-mono hover:text-cyan-300">
                    ⚡ Run scan to load transactions →
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/25 font-mono text-xs tracking-widest border-b" style={{ borderColor: 'rgba(0,255,255,0.08)' }}>
                        <th className="text-left pb-3 pr-3">TX ID</th>
                        <th className="text-left pb-3 pr-3">FROM</th>
                        <th className="text-right pb-3 pr-3">AMOUNT</th>
                        <th className="text-right pb-3 pr-3">TICKETS</th>
                        <th className="text-right pb-3">CONFIRMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contributions.map((c) => (
                        <tr key={c.txId} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <td className="py-3 pr-3">
                            <a href={`https://insight.dash.org/insight/tx/${c.txId}`} target="_blank" rel="noreferrer"
                              className="font-mono text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                              {c.txId.slice(0, 14)}... ↗
                            </a>
                          </td>
                          <td className="py-3 pr-3 font-mono text-white/40 text-xs">{c.from.slice(0, 14)}...</td>
                          <td className="py-3 pr-3 text-right font-mono text-cyan-400 text-xs font-bold">{c.amount.toFixed(4)} Ð</td>
                          <td className="py-3 pr-3 text-right font-mono text-white/60 text-xs">{c.tickets} 🎫</td>
                          <td className="py-3 text-right font-mono text-green-400 text-xs">{c.confirmations} ✓</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ── RESERVE TAB ────────────────────────────────────────── */}
            {tab === 'reserve' && (
              <div className="space-y-6">
                {/* Live balance */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Live Balance', val: `${(reserveStats?.liveBalance ?? 0).toFixed(4)} DASH`, color: '#00D4AA', icon: '🏦' },
                    { label: 'Total Allocated', val: `${(reserveStats?.reserveTotalAllocated ?? 0).toFixed(4)} DASH`, color: '#00D4AA', icon: '📊' },
                    { label: 'Next Lottery Fund', val: `${(reserveStats?.nextLotteryFundHeld ?? 0).toFixed(4)} DASH`, color: '#008DE4', icon: '🌱' },
                    { label: 'Total Processed', val: `${(reserveStats?.totalDashProcessed ?? 0).toFixed(4)} DASH`, color: '#7C3AED', icon: '⚡' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-4" style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                      <div className="text-lg mb-1">{s.icon}</div>
                      <div className="text-xs font-mono tracking-widest mb-1" style={{ color: `${s.color}80` }}>{s.label}</div>
                      <div className="text-sm font-black font-mono" style={{ color: s.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Reserve address */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(0,212,170,0.04)', border: '1px solid rgba(0,212,170,0.15)' }}>
                  <div className="text-xs font-mono tracking-widest mb-2" style={{ color: 'rgba(0,212,170,0.6)' }}>RESERVE ADDRESS (PERMANENT)</div>
                  <div className="font-mono text-xs break-all text-white/70">{reserveStats?.reserveAddress || 'Loading…'}</div>
                  {reserveStats?.reserveAddress && (
                    <a href={`https://insight.dash.org/insight/address/${reserveStats.reserveAddress}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-mono mt-2 inline-block" style={{ color: 'rgba(0,212,170,0.5)' }}>
                      View on Dash Explorer →
                    </a>
                  )}
                </div>

                {/* Allocation history */}
                <div>
                  <div className="text-xs font-mono tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>ALLOCATION HISTORY ({reserveStats?.allocationHistory?.length ?? 0} records)</div>
                  {(reserveStats?.allocationHistory?.length ?? 0) === 0 ? (
                    <div className="text-center py-8 text-white/30 text-sm">No allocations yet — complete a lottery to see splits here</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                            <th className="text-left py-3 px-4 text-white/30 tracking-widest">LOTTERY</th>
                            <th className="text-right py-3 px-4 text-white/30">TOTAL</th>
                            <th className="text-right py-3 px-4" style={{ color: '#F59E0B' }}>WINNER 85%</th>
                            <th className="text-right py-3 px-4" style={{ color: '#00D4AA' }}>RESERVE 10%</th>
                            <th className="text-right py-3 px-4" style={{ color: '#008DE4' }}>NEXT 5%</th>
                            <th className="text-right py-3 px-4 text-white/30">TX</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reserveStats?.allocationHistory?.map((rec, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td className="py-3 px-4">
                                <div className="text-white/70">{rec.lotteryTitle}</div>
                                {rec.winnerName && <div className="text-white/30 text-xs">🏆 {rec.winnerName}</div>}
                              </td>
                              <td className="py-3 px-4 text-right text-white/50">{rec.totalDash.toFixed(4)}</td>
                              <td className="py-3 px-4 text-right" style={{ color: '#F59E0B' }}>{rec.winnerDash.toFixed(4)}</td>
                              <td className="py-3 px-4 text-right" style={{ color: '#00D4AA' }}>{rec.reserveDash.toFixed(4)}
                              </td>
                              <td className="py-3 px-4 text-right" style={{ color: '#008DE4' }}>{rec.nextLotteryDash.toFixed(4)}</td>
                              <td className="py-3 px-4 text-right">
                                {rec.txId ? (
                                  <a href={`https://insight.dash.org/insight/tx/${rec.txId}`} target="_blank" rel="noopener noreferrer"
                                    style={{ color: 'rgba(0,212,170,0.5)' }}>{rec.txId.slice(0,8)}…</a>
                                ) : <span className="text-white/20">pending</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="flex justify-center">
                  <button onClick={loadReserve} className="text-xs font-mono px-4 py-2 rounded-lg transition-all"
                    style={{ color: 'rgba(0,212,170,0.7)', border: '1px solid rgba(0,212,170,0.2)' }}>
                    ↻ Refresh Reserve Data
                  </button>
                </div>
              </div>
            )}

            {/* ── WORDS TAB ──────────────────────────────────────────── */}
            {tab === 'words' && (
              <div className="space-y-6">
                {/* Frequency table */}
                <div>
                  <div className="text-xs font-mono tracking-widest mb-3 text-purple-400/60">WORD FREQUENCY — ALL TIME ({wordFreq.length} unique words)</div>
                  {wordFreq.length === 0 ? (
                    <div className="text-center py-8 text-white/30 text-sm">No words submitted yet</div>
                  ) : (
                    <div className="space-y-2">
                      {wordFreq.map((item, i) => (
                        <div key={item.word} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                          style={{ background: i < 3 ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-xs font-mono text-white/20 w-6 flex-shrink-0">#{i+1}</span>
                          <span className="font-bold text-sm flex-1" style={{ color: i === 0 ? '#FFD700' : i === 1 ? '#a78bfa' : i === 2 ? '#00FFC8' : 'rgba(255,255,255,0.7)' }}>{item.word}</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${(item.count / (wordFreq[0]?.count || 1)) * 100}%`, background: i === 0 ? '#FFD700' : 'rgba(167,139,250,0.6)' }} />
                          </div>
                          <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: '#a78bfa' }}>{item.count}×</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current + Next streams */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Current Lottery Words', data: wordData?.currentWords || [], color: '#FFD700' },
                    { label: 'Next Lottery Words', data: wordData?.nextWords || [], color: '#a78bfa' },
                  ].map((section, si) => (
                    <div key={si} className="rounded-xl p-4" style={{ background: `${section.color}05`, border: `1px solid ${section.color}18` }}>
                      <div className="text-[10px] font-mono font-bold tracking-widest mb-3" style={{ color: `${section.color}70` }}>{section.label} ({section.data.length})</div>
                      {!section.data.length ? (
                        <div className="text-center py-6 text-white/20 text-xs">No words yet</div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {section.data.map((w: { word: string; username: string; timestamp: number }, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                              <span className="font-bold" style={{ color: section.color }}>{w.word}</span>
                              <span className="text-white/30 truncate">{w.username}</span>
                              <span className="text-white/15 font-mono flex-shrink-0">{new Date(w.timestamp).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-center">
                  <button onClick={() => {
                    fetch('/api/words?target=all').then(r => r.json()).then(d => {
                      setWordFreq(d.allFreq || []);
                      setWordData({ currentWords: d.currentWords || [], nextWords: d.nextWords || [] });
                    });
                  }} className="text-xs font-mono px-4 py-2 rounded-lg transition-all"
                    style={{ color: 'rgba(167,139,250,0.7)', border: '1px solid rgba(167,139,250,0.2)' }}>
                    ↻ Refresh Words
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ████████████████ TIMELY INSIGHT DASHBOARD ████████████████████████
            ═══════════════════════════════════════════════════════════════ */}
        <div className="mt-10">
          {/* Toggle bar */}
          <button
            onClick={() => { setShowInsight(o => !o); if (!insightData) loadInsight(); }}
            className="w-full px-6 py-5 rounded-2xl text-left flex items-center justify-between transition-all duration-300 group"
            style={{
              background: showInsight
                ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08))'
                : 'rgba(59,130,246,0.06)',
              border: `1px solid ${showInsight ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.2)'}`,
            }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                📊
              </div>
              <div>
                <div className="text-[10px] font-mono text-blue-400/60 tracking-widest mb-0.5">// ANALYTICS ENGINE</div>
                <div className="text-xl font-black text-white">TIMELY INSIGHT</div>
                <div className="text-xs text-white/40 mt-0.5">
                  Real-time platform analytics · views · users · funding · trends · geography
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {insightData && (
                <span className="text-[10px] font-mono text-white/25 hidden sm:block">
                  {new Date(insightData.lastUpdated).toLocaleTimeString()}
                </span>
              )}
              <div className="px-4 py-2 rounded-xl font-mono font-bold text-sm transition-all"
                style={{
                  background: showInsight ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  color: '#60a5fa',
                }}>
                {showInsight ? '▲ Hide' : '▼ Open Insight'}
              </div>
            </div>
          </button>

          {/* ── Insight Dashboard ── */}
          {showInsight && (
            <div className="mt-3 rounded-2xl overflow-hidden"
              style={{ background: 'rgba(5,5,20,0.97)', border: '1px solid rgba(59,130,246,0.22)' }}>

              {/* Header */}
              <div className="px-6 sm:px-8 pt-8 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.09), rgba(139,92,246,0.05))', borderBottom: '1px solid rgba(59,130,246,0.14)' }}>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl">📊</span>
                    <div>
                      <div className="text-[10px] font-mono tracking-[0.3em] mb-0.5" style={{ color: 'rgba(96,165,250,0.6)' }}>
                        TIMELY.WORKS ANALYTICS
                      </div>
                      <h2 className="text-2xl font-black text-white">Timely Insight</h2>
                    </div>
                  </div>
                  <p className="text-white/40 text-sm font-mono">
                    Complete platform intelligence · Live data from timely.works
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {insightData?.lastUpdated && (
                    <div className="text-[10px] font-mono text-right hidden sm:block">
                      <div className="text-white/25">Last refresh</div>
                      <div className="text-white/45">{new Date(insightData.lastUpdated).toLocaleString()}</div>
                    </div>
                  )}
                  <button onClick={loadInsight} disabled={insightLoading}
                    className="px-5 py-2.5 rounded-xl font-mono font-bold text-sm transition-all"
                    style={{
                      background: 'rgba(59,130,246,0.12)',
                      border: '1px solid rgba(59,130,246,0.35)',
                      color: insightLoading ? 'rgba(96,165,250,0.4)' : '#60a5fa',
                    }}>
                    {insightLoading ? '⏳ Loading…' : '↻ Refresh'}
                  </button>
                </div>
              </div>

              {/* Loading */}
              {insightLoading && !insightData && (
                <div className="p-16 text-center">
                  <div className="text-5xl mb-5 animate-pulse">⚡</div>
                  <p className="text-white/40 font-mono text-sm tracking-widest">LOADING TIMELY INSIGHT…</p>
                </div>
              )}

              {insightData && (
                <div className="p-5 sm:p-8 space-y-8">

                  {/* ── 8 HERO STAT CARDS ── */}
                  <div>
                    <div className="text-[10px] font-mono tracking-widest mb-4" style={{ color: 'rgba(96,165,250,0.5)' }}>
                      ◈ PLATFORM OVERVIEW
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <IStat icon="👁" label="Lifetime Views"
                        value={<InsightCount to={insightData.totalViews} />}
                        sub={`${insightData.todayViews} today`} color="#00FFFF"
                        trend={insightData.yesterdayViews > 0 ? Math.round(((insightData.todayViews - insightData.yesterdayViews) / insightData.yesterdayViews) * 100) : undefined} />
                      <IStat icon="🌐" label="Unique Visitors"
                        value={<InsightCount to={insightData.totalUniqueSessions} />}
                        sub={`${insightData.todaySessions} today`} color="#60a5fa"
                        trend={insightData.yesterdaySessions > 0 ? Math.round(((insightData.todaySessions - insightData.yesterdaySessions) / insightData.yesterdaySessions) * 100) : undefined} />
                      <IStat icon="👤" label="Accounts Created"
                        value={<InsightCount to={insightData.totalUsers} />}
                        sub={`${insightData.usersWithVerifiedEmail} verified`} color="#a78bfa" />
                      <IStat icon="⏱" label="Total Time on Site"
                        value={fmtMs(insightData.totalTimeMs)}
                        sub={`avg ${fmtMs(insightData.totalTimeMs / Math.max(insightData.totalUniqueSessions, 1))} per visitor`}
                        color="#00ff88" />
                      <IStat icon="💠" label="Total DASH Raised"
                        value={`${(insightData.totalDashProcessed || 0).toFixed(4)}`}
                        sub="Ð all-time processed" color="#008DE4" />
                      <IStat icon="🎰" label="Lotteries Run"
                        value={<InsightCount to={insightData.totalLotteries} />}
                        sub={`${insightData.completedLotteries} completed`} color="#f59e0b" />
                      <IStat icon="🏆" label="Winners Crowned"
                        value={<InsightCount to={insightData.totalWinners} />}
                        sub={`${(insightData.totalDashToWinners || 0).toFixed(3)} Ð paid out`} color="#FFD700" />
                      <IStat icon="💬" label="Words Dropped"
                        value={<InsightCount to={insightData.totalWordDrops} />}
                        sub={`${insightData.wordFreq?.length || 0} unique words`} color="#f472b6" />
                    </div>
                  </div>

                  {/* ── TODAY vs YESTERDAY ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: "Today's Views",    today: insightData.todayViews,    yest: insightData.yesterdayViews,    color: '#00FFFF', icon: '👁',  isMsF: false },
                      { label: "Today's Sessions", today: insightData.todaySessions, yest: insightData.yesterdaySessions, color: '#60a5fa', icon: '🌐',  isMsF: false },
                      { label: "Time on Site Today",today: insightData.todayTimeMs,  yest: 0,                             color: '#00ff88', icon: '⏱',  isMsF: true  },
                    ].map((s, i) => {
                      const pct = s.yest > 0 ? ((s.today - s.yest) / s.yest * 100) : null;
                      const up  = pct !== null ? pct >= 0 : null;
                      return (
                        <div key={i} className="rounded-xl p-4"
                          style={{ background: `${s.color}07`, border: `1px solid ${s.color}18` }}>
                          <div className="text-[10px] font-mono tracking-widest mb-2" style={{ color: `${s.color}60` }}>
                            {s.icon} {s.label.toUpperCase()}
                          </div>
                          <div className="text-2xl font-black font-mono mb-1" style={{ color: s.color }}>
                            {s.isMsF ? fmtMs(s.today) : fmtNum(s.today)}
                          </div>
                          {pct !== null && (
                            <div className="text-[10px] font-mono" style={{ color: up ? '#00ff88' : '#ff6b6b' }}>
                              {up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}% vs yesterday
                              <span className="text-white/25 ml-1">({s.isMsF ? fmtMs(s.yest) : fmtNum(s.yest)})</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── DAILY VIEWS CHART ── */}
                  <div className="rounded-2xl p-5 sm:p-6"
                    style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.12)' }}>
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                      <div>
                        <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(0,255,255,0.5)' }}>
                          ◈ TRAFFIC OVER TIME
                        </div>
                        <div className="text-base font-bold text-white">Daily Page Views — Last 30 Days</div>
                      </div>
                      <div className="flex gap-4 text-[10px] font-mono flex-wrap">
                        <span style={{ color: 'rgba(0,255,255,0.6)' }}>
                          Peak: {Math.max(...insightData.dailyData.map(d => d.views), 0)} views
                        </span>
                        <span style={{ color: 'rgba(0,255,255,0.4)' }}>
                          Total: {insightData.dailyData.reduce((s, d) => s + d.views, 0).toLocaleString()} views
                        </span>
                      </div>
                    </div>
                    <InsightAreaChart data={insightData.dailyData} color="#00FFFF" />
                    {/* Mini bars row */}
                    <div className="mt-4 flex items-end gap-0.5 overflow-x-hidden pb-1" style={{ height: 40 }}>
                      {insightData.dailyData.map((d, i) => {
                        const maxV = Math.max(...insightData.dailyData.map(x => x.views), 1);
                        const pct  = (d.views / maxV) * 100;
                        return (
                          <div key={i} className="flex-1 min-w-[3px] flex flex-col justify-end"
                            style={{ height: 40 }} title={`${d.date}: ${d.views} views`}>
                            <div className="w-full rounded-sm"
                              style={{
                                height: `${Math.max(pct, 4)}%`,
                                background: d.isToday ? '#00ff88' : 'rgba(0,255,255,0.35)',
                                boxShadow: d.isToday ? '0 0 6px rgba(0,255,136,0.6)' : 'none',
                                minHeight: 2,
                              }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-white/25 font-mono">{insightData.dailyData[0]?.date}</span>
                      <span className="text-[9px] font-mono" style={{ color: 'rgba(0,255,136,0.6)' }}>▲ Today</span>
                    </div>
                  </div>

                  {/* ── TOP PAGES + GEOGRAPHIC ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Top Pages */}
                    <div className="rounded-2xl p-5"
                      style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
                      <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(96,165,250,0.5)' }}>◈ PAGE ANALYTICS</div>
                      <div className="text-base font-bold text-white mb-4">Top Pages by Views</div>
                      {insightData.topPages.length === 0 ? (
                        <div className="text-center py-8 text-white/25 text-sm">No data yet — tracking has started</div>
                      ) : (
                        <div className="space-y-0.5">
                          {insightData.topPages.slice(0, 8).map((p, i) => (
                            <div key={p.page}>
                              <HBarRow
                                label={p.page === '/' ? '🏠 Home' : p.page}
                                value={p.views}
                                max={insightData.topPages[0]?.views || 1}
                                color="#60a5fa"
                                index={i}
                              />
                              <div className="text-[9px] font-mono text-white/20 pl-8 -mt-0.5 mb-1.5">
                                {p.sessions} sessions · {fmtMs(p.timeMs)} time spent
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Geographic */}
                    <div className="rounded-2xl p-5"
                      style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)' }}>
                      <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(167,139,250,0.5)' }}>◈ GEOGRAPHIC REACH</div>
                      <div className="text-base font-bold text-white mb-4">Visitors by Country</div>
                      {insightData.topCountries.length === 0 ? (
                        <div className="text-center py-8 text-white/25 text-sm">No country data yet — building as visitors arrive</div>
                      ) : (
                        <div className="space-y-1">
                          {insightData.topCountries.slice(0, 10).map((c, i) => (
                            <div key={c.country} className="flex items-center gap-3 py-1">
                              <div className="text-[10px] font-mono text-white/25 w-4 flex-shrink-0 text-right">{i + 1}</div>
                              <span className="text-base flex-shrink-0">{flag(c.country)}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-mono text-white/70">{c.country}</span>
                                  <span className="text-xs font-mono font-bold"
                                    style={{ color: i === 0 ? '#a78bfa' : 'rgba(255,255,255,0.45)' }}>
                                    {fmtNum(c.views)}
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                  <div className="h-full rounded-full"
                                    style={{
                                      width: `${(c.views / (insightData.topCountries[0]?.views || 1)) * 100}%`,
                                      background: i < 3 ? '#a78bfa' : 'rgba(167,139,250,0.5)',
                                      boxShadow: i === 0 ? '0 0 8px rgba(167,139,250,0.5)' : 'none',
                                    }} />
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="mt-3 pt-3 text-[10px] font-mono text-white/25"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            {insightData.topCountries.length} countries visited timely.works
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── USER ANALYTICS ── */}
                  <div className="rounded-2xl p-5 sm:p-6"
                    style={{ background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.14)' }}>
                    <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(0,255,136,0.5)' }}>◈ COMMUNITY STATS</div>
                    <div className="text-base font-bold text-white mb-5">User & Account Analytics</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                      {[
                        { label: 'Accounts Created',       val: insightData.totalUsers,            icon: '👤', color: '#00ff88' },
                        { label: 'Dash Usernames Linked',  val: insightData.usersWithDash,         icon: '💠', color: '#008DE4' },
                        { label: 'Email Verified',         val: insightData.usersWithVerifiedEmail,icon: '✅', color: '#f59e0b' },
                        { label: 'Dash Username %',        val: insightData.dashUsernamePercent,   icon: '📈', color: '#a78bfa', suffix: '%' },
                      ].map((s, i) => (
                        <div key={i} className="rounded-xl p-4 text-center"
                          style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}>
                          <div className="text-xl mb-1">{s.icon}</div>
                          <div className="text-2xl font-black font-mono" style={{ color: s.color }}>
                            {s.val}{s.suffix || ''}
                          </div>
                          <div className="text-[10px] text-white/40 mt-1 font-mono">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Adoption bar */}
                    <div className="rounded-xl p-4 mb-4"
                      style={{ background: 'rgba(0,141,228,0.06)', border: '1px solid rgba(0,141,228,0.15)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-white/50">Dash Username Adoption</span>
                        <span className="text-xs font-mono font-bold text-[#008DE4]">
                          {insightData.usersWithDash}/{insightData.totalUsers} linked
                        </span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${insightData.dashUsernamePercent}%`,
                            background: 'linear-gradient(90deg, #008DE4, #00FFFF)',
                            boxShadow: '0 0 12px rgba(0,141,228,0.5)',
                          }} />
                      </div>
                      <div className="text-[10px] font-mono text-white/25 mt-2">
                        {insightData.dashUsernamePercent}% of users have connected their Dash Platform username
                      </div>
                    </div>
                    {/* Newest members */}
                    {insightData.newestUsers?.length > 0 && (
                      <div>
                        <div className="text-[10px] font-mono text-white/30 mb-2 tracking-widest">NEWEST MEMBERS</div>
                        <div className="flex flex-wrap gap-2">
                          {insightData.newestUsers.map((u, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88' }}>
                                {(u.displayName || u.dashUsername || '?')[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div className="text-white/80 font-medium">{u.displayName || u.dashUsername || 'Anonymous'}</div>
                                {u.dashUsername && <div className="text-[9px] text-[#008DE4] font-mono">@{u.dashUsername}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── TOP CONTRIBUTORS LEADERBOARD ── */}
                  <div className="rounded-2xl p-5 sm:p-6"
                    style={{ background: 'rgba(255,215,0,0.03)', border: '1px solid rgba(255,215,0,0.15)' }}>
                    <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(255,215,0,0.5)' }}>◈ LEADERBOARD</div>
                    <div className="text-base font-bold text-white mb-5">Top Contributors — Most Tickets Purchased</div>
                    {insightData.topContributors.length === 0 ? (
                      <div className="text-center py-8 text-white/25 text-sm">No contributors yet</div>
                    ) : (
                      <div className="space-y-3">
                        {insightData.topContributors.slice(0, 5).map((c, i) => (
                          <div key={i}
                            className="flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-[1.01]"
                            style={{
                              background: i === 0
                                ? 'linear-gradient(135deg, rgba(255,215,0,0.09), rgba(255,215,0,0.03))'
                                : 'rgba(255,255,255,0.03)',
                              border: i === 0
                                ? '1px solid rgba(255,215,0,0.3)'
                                : '1px solid rgba(255,255,255,0.07)',
                            }}>
                            <RankBadge rank={i + 1} />
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-black flex-shrink-0"
                              style={{
                                background: i === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)',
                                border: `1px solid ${i === 0 ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.12)'}`,
                                color: i === 0 ? '#FFD700' : 'rgba(255,255,255,0.6)',
                              }}>
                              {(c.name[0] || '?').toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm truncate"
                                style={{ color: i === 0 ? '#FFD700' : 'rgba(255,255,255,0.85)' }}>
                                {c.name}
                              </div>
                              <div className="text-[10px] text-white/35 font-mono mt-0.5">
                                {c.lotteries} {c.lotteries === 1 ? 'lottery' : 'lotteries'}
                                {c.initiumsSubmitted > 0 && ` · ${c.initiumsSubmitted} initium${c.initiumsSubmitted !== 1 ? 's' : ''}`}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-base font-black font-mono"
                                style={{ color: i === 0 ? '#FFD700' : 'rgba(255,255,255,0.7)' }}>
                                {c.totalTickets} 🎟
                              </div>
                              <div className="text-[10px] font-mono mt-0.5" style={{ color: '#008DE4' }}>
                                {c.totalDash.toFixed(4)} Ð
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {[
                        { label: 'Total Entries',         val: insightData.totalEntries.toLocaleString(),             color: '#FFD700' },
                        { label: 'Avg Participants',      val: insightData.avgParticipantsPerLottery.toFixed(1) + '/lottery', color: '#008DE4' },
                        { label: 'Avg DASH per Lottery',  val: (insightData.avgDashPerLottery || 0).toFixed(4) + ' Ð', color: '#00D4AA' },
                      ].map((s, i) => (
                        <div key={i} className="rounded-xl p-3 text-center"
                          style={{ background: `${s.color}07`, border: `1px solid ${s.color}16` }}>
                          <div className="text-base font-black font-mono" style={{ color: s.color }}>{s.val}</div>
                          <div className="text-[10px] text-white/35 font-mono mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── TRENDING WORDS ── */}
                  <div className="rounded-2xl p-5 sm:p-6"
                    style={{ background: 'rgba(244,114,182,0.03)', border: '1px solid rgba(244,114,182,0.15)' }}>
                    <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(244,114,182,0.5)' }}>◈ COMMUNITY VOICE</div>
                    <div className="text-base font-bold text-white mb-2">Trending Words on Timely.Works</div>
                    <div className="text-xs text-white/35 mb-5 font-mono">
                      {insightData.totalWordDrops} total drops · {insightData.wordFreq?.length || 0} unique words
                    </div>
                    {(!insightData.wordFreq || insightData.wordFreq.length === 0) ? (
                      <div className="text-center py-8 text-white/25 text-sm">No words submitted yet</div>
                    ) : (
                      <>
                        {/* Visual word cloud */}
                        <div className="flex flex-wrap gap-2 mb-6 p-4 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {insightData.wordFreq.slice(0, 30).map((w, i) => {
                            const maxW = insightData.wordFreq[0]?.count || 1;
                            const pct  = w.count / maxW;
                            const sz   = 11 + Math.round(pct * 18);
                            const PALETTE = ['#FFD700', '#f472b6', '#a78bfa', '#00FFC8', '#60a5fa', '#fb923c', '#34d399', '#f87171'];
                            const col = PALETTE[i % PALETTE.length];
                            return (
                              <span key={w.word}
                                className="px-3 py-1.5 rounded-full font-bold cursor-default select-none transition-transform hover:scale-110"
                                style={{
                                  fontSize: sz,
                                  background: `${col}10`,
                                  border: `1px solid ${col}${i < 3 ? '55' : '22'}`,
                                  color: i < 5 ? col : `${col}bb`,
                                  boxShadow: i < 3 ? `0 0 14px ${col}25` : 'none',
                                }}
                                title={`${w.count} ${w.count === 1 ? 'drop' : 'drops'}`}>
                                {w.word}
                                {i < 5 && <sup className="ml-1 text-[8px] opacity-50">{w.count}</sup>}
                              </span>
                            );
                          })}
                        </div>
                        {/* Top 10 frequency bars */}
                        <div className="rounded-xl p-4"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="text-[10px] font-mono text-white/30 mb-3 tracking-widest">TOP 10 BY FREQUENCY</div>
                          <div className="space-y-0.5">
                            {insightData.wordFreq.slice(0, 10).map((w, i) => (
                              <HBarRow
                                key={w.word}
                                label={w.word}
                                value={w.count}
                                max={insightData.wordFreq[0]?.count || 1}
                                color="#f472b6"
                                suffix="×"
                                index={i}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── DASH FUNDING OVERVIEW ── */}
                  <div className="rounded-2xl p-5 sm:p-6"
                    style={{ background: 'rgba(0,141,228,0.04)', border: '1px solid rgba(0,141,228,0.18)' }}>
                    <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(0,141,228,0.5)' }}>◈ FINANCIAL INTELLIGENCE</div>
                    <div className="text-base font-bold text-white mb-5">Dash Funding Overview</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                      {[
                        { label: 'Total Processed', val: insightData.totalDashProcessed,   color: '#008DE4', icon: '⚡' },
                        { label: 'Winners Paid Out', val: insightData.totalDashToWinners,  color: '#FFD700', icon: '🏆' },
                        { label: 'Reserve Fund',     val: insightData.reserveTotalAllocated,color: '#00D4AA', icon: '🏦' },
                        { label: 'Next Lottery Seed',val: insightData.nextLotteryFundHeld, color: '#60a5fa', icon: '🌱' },
                      ].map((s, i) => (
                        <div key={i} className="rounded-xl p-4 text-center"
                          style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                          <div className="text-xl mb-1">{s.icon}</div>
                          <div className="text-xl font-black font-mono mb-0.5" style={{ color: s.color }}>
                            {(s.val || 0).toFixed(4)}
                          </div>
                          <div className="text-[9px] font-mono mb-1" style={{ color: `${s.color}80` }}>DASH</div>
                          <div className="text-[10px] text-white/35 font-mono">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Split bar */}
                    {(insightData.totalDashProcessed || 0) > 0 && (
                      <div className="rounded-xl p-4 mb-4"
                        style={{ background: 'rgba(0,141,228,0.05)', border: '1px solid rgba(0,141,228,0.12)' }}>
                        <div className="text-[10px] font-mono text-white/30 mb-3 tracking-widest">DISTRIBUTION BREAKDOWN</div>
                        <div className="h-4 rounded-full overflow-hidden flex mb-3"
                          style={{ background: 'rgba(255,255,255,0.06)' }}>
                          {[
                            { pct: ((insightData.totalDashToWinners   || 0) / insightData.totalDashProcessed) * 100, color: '#FFD700', label: 'Winner 85%' },
                            { pct: ((insightData.reserveTotalAllocated|| 0) / insightData.totalDashProcessed) * 100, color: '#00D4AA', label: 'Reserve 10%' },
                            { pct: ((insightData.nextLotteryFundHeld  || 0) / insightData.totalDashProcessed) * 100, color: '#60a5fa', label: 'Next 5%' },
                          ].map((seg, si) => (
                            <div key={si} className="h-full" title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
                              style={{ width: `${seg.pct}%`, background: seg.color, opacity: 0.85,
                                borderRadius: si === 0 ? '9999px 0 0 9999px' : si === 2 ? '0 9999px 9999px 0' : 0 }} />
                          ))}
                        </div>
                        <div className="flex gap-5 flex-wrap">
                          {[
                            { label: 'Winners',   color: '#FFD700', val: insightData.totalDashToWinners },
                            { label: 'Reserve',   color: '#00D4AA', val: insightData.reserveTotalAllocated },
                            { label: 'Next Pool', color: '#60a5fa', val: insightData.nextLotteryFundHeld },
                          ].map((s, si) => (
                            <div key={si} className="flex items-center gap-1.5 text-[10px] font-mono">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                              <span className="text-white/40">{s.label}:</span>
                              <span style={{ color: s.color }}>{(s.val || 0).toFixed(4)} Ð</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Avg stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl p-3" style={{ background: 'rgba(0,141,228,0.06)', border: '1px solid rgba(0,141,228,0.15)' }}>
                        <div className="text-[10px] text-white/35 font-mono mb-1">AVG DASH PER LOTTERY</div>
                        <div className="text-lg font-black font-mono text-[#008DE4]">
                          {(insightData.avgDashPerLottery || 0).toFixed(4)} Ð
                        </div>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)' }}>
                        <div className="text-[10px] text-white/35 font-mono mb-1">
                          {insightData.activeLotteryId ? 'ACTIVE POOL' : 'LAST POOL RAISED'}
                        </div>
                        <div className="text-lg font-black font-mono text-[#00D4AA]">
                          {insightData.activeLotteryId
                            ? `${(insightData.activeLotteryPool || 0).toFixed(4)} Ð`
                            : insightData.allocationHistory?.[0]
                              ? `${(insightData.allocationHistory[0].totalDash || 0).toFixed(4)} Ð`
                              : '—'
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── LOTTERY PERFORMANCE TABLE ── */}
                  <div className="rounded-2xl p-5 sm:p-6"
                    style={{ background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(245,158,11,0.5)' }}>◈ LOTTERY HISTORY</div>
                    <div className="text-base font-bold text-white mb-5">Lottery Performance · All Time</div>
                    {insightData.lotteries.length === 0 ? (
                      <div className="text-center py-8 text-white/25 text-sm">No lotteries run yet</div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                              {['LOTTERY', 'STATUS', 'POOL', 'TICKETS', 'ENTRANTS', 'DURATION', 'WINNER'].map(h => (
                                <th key={h} className="text-left py-3 px-3 text-white/25 tracking-widest font-normal whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {insightData.lotteries.map((l) => {
                              const dur = l.endTime && l.startTime
                                ? Math.round((l.endTime - l.startTime) / 60000)
                                : l.durationMinutes;
                              return (
                                <tr key={l.id} className="hover:bg-white/[0.02] transition-colors"
                                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <td className="py-3 px-3">
                                    <div className="text-white/80 font-semibold truncate max-w-[130px]">{l.title}</div>
                                    <div className="text-white/25 text-[9px]">{new Date(l.createdAt).toLocaleDateString()}</div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest"
                                      style={{
                                        background: l.status === 'active' ? 'rgba(0,255,136,0.1)' : l.status === 'ended' ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${l.status === 'active' ? 'rgba(0,255,136,0.3)' : l.status === 'ended' ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                        color: l.status === 'active' ? '#00ff88' : l.status === 'ended' ? '#FFD700' : 'rgba(255,255,255,0.4)',
                                      }}>
                                      {l.status.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-[#008DE4] font-bold">{(l.totalDash || 0).toFixed(4)} Ð</td>
                                  <td className="py-3 px-3 text-white/60">{l.totalTickets} 🎟</td>
                                  <td className="py-3 px-3 text-white/60">{l.participantCount}</td>
                                  <td className="py-3 px-3 text-white/45">
                                    {dur >= 1440 ? `${Math.round(dur / 1440)}d`
                                      : dur >= 60 ? `${Math.round(dur / 60)}h`
                                      : `${dur}m`}
                                  </td>
                                  <td className="py-3 px-3">
                                    {l.winnerName
                                      ? <>
                                          <div className="text-yellow-400 font-semibold truncate max-w-[90px]">{l.winnerName}</div>
                                          <div className="text-[9px] text-yellow-400/50">{(l.winnerDash || 0).toFixed(4)} Ð</div>
                                        </>
                                      : <span className="text-white/20">—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {/* Allocation history */}
                    {insightData.allocationHistory?.length > 0 && (
                      <div className="mt-5">
                        <div className="text-[10px] font-mono text-white/30 mb-3 tracking-widest">PAYOUT ALLOCATION HISTORY</div>
                        <div className="space-y-2">
                          {insightData.allocationHistory.slice(0, 5).map((rec, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl flex-wrap"
                              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white/70 truncate">{rec.lotteryTitle}</div>
                                {rec.winnerName && <div className="text-[10px] text-yellow-400/60 font-mono">🏆 {rec.winnerName}</div>}
                              </div>
                              <div className="flex gap-4 text-[10px] font-mono flex-wrap">
                                <span style={{ color: '#FFD700' }}>W: {rec.winnerDash.toFixed(4)} Ð</span>
                                <span style={{ color: '#00D4AA' }}>R: {rec.reserveDash.toFixed(4)} Ð</span>
                                <span style={{ color: '#60a5fa' }}>N: {rec.nextLotteryDash.toFixed(4)} Ð</span>
                                {rec.txId && (
                                  <a href={`https://insight.dash.org/insight/tx/${rec.txId}`}
                                    target="_blank" rel="noreferrer"
                                    className="hover:underline" style={{ color: 'rgba(0,212,170,0.5)' }}>
                                    TX ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── TIME ANALYTICS ── */}
                  <div className="rounded-2xl p-5 sm:p-6"
                    style={{ background: 'rgba(96,165,250,0.03)', border: '1px solid rgba(96,165,250,0.12)' }}>
                    <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(96,165,250,0.5)' }}>◈ TIME INTELLIGENCE</div>
                    <div className="text-base font-bold text-white mb-5">Time Spent Across the Platform</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                      {[
                        { label: 'Total Time on Site',  val: fmtMs(insightData.totalTimeMs),                                                                     color: '#60a5fa', icon: '⏱' },
                        { label: 'Avg Per Visitor',     val: fmtMs(insightData.totalTimeMs / Math.max(insightData.totalUniqueSessions, 1)),                       color: '#a78bfa', icon: '👤' },
                        { label: "Today's Time",        val: fmtMs(insightData.todayTimeMs),                                                                      color: '#00ff88', icon: '📅' },
                        { label: 'Total Site Sessions', val: insightData.totalUniqueSessions.toLocaleString(),                                                    color: '#00FFFF', icon: '🌐' },
                      ].map((s, i) => (
                        <div key={i} className="rounded-xl p-4 text-center"
                          style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}>
                          <div className="text-xl mb-1">{s.icon}</div>
                          <div className="text-xl font-black font-mono" style={{ color: s.color }}>{s.val}</div>
                          <div className="text-[10px] text-white/35 mt-1 font-mono">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Time per page chart */}
                    {insightData.topPages.filter(p => p.timeMs > 0).length > 0 && (
                      <div className="rounded-xl p-4"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="text-[10px] font-mono text-white/30 mb-3 tracking-widest">TIME SPENT BY PAGE</div>
                        <div className="space-y-0.5">
                          {insightData.topPages
                            .filter(p => p.timeMs > 0)
                            .sort((a, b) => b.timeMs - a.timeMs)
                            .slice(0, 7)
                            .map((p, i) => (
                              <HBarRow
                                key={p.page}
                                label={p.page === '/' ? '🏠 Home' : p.page}
                                value={Math.round(p.timeMs / 60000)}
                                max={Math.max(...insightData.topPages.filter(x => x.timeMs > 0).map(x => x.timeMs)) / 60000 || 1}
                                color="#60a5fa"
                                suffix="m"
                                index={i}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── INSIGHT FOOTER ── */}
                  <div className="text-center py-3 border-t" style={{ borderColor: 'rgba(59,130,246,0.12)' }}>
                    <div className="text-[10px] font-mono text-white/15 tracking-[0.2em]">
                      ◈ TIMELY INSIGHT ◈ POWERED BY TIMELY.WORKS ◈ DATA LIVE
                      {insightData.lastUpdated && ` · UPDATED ${new Date(insightData.lastUpdated).toLocaleTimeString()}`}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
