'use client';
import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Winner {
  lotteryId: string; lotteryTitle: string; entryId: string;
  displayName?: string; dashAddress?: string; dashUsername?: string;
  initium?: string; initiumTitle?: string;
  dashWon: number; totalParticipants: number; totalDash: number;
  winningTickets: number; totalTickets: number;
  payoutTxId?: string; payoutTxIds?: string[]; payoutTo?: string; timestamp: number;
}

interface LotteryHistory {
  id: string; title: string; description?: string; status: string;
  createdAt: number; endTime: number; totalDash: number; totalTickets: number;
  participantCount: number; address: string;
  winner: { displayName?: string; dashUsername?: string; dashWon: number; initiumTitle?: string; payoutTxId?: string; timestamp: number } | null;
  entries: Array<{ id: string; displayName?: string; dashUsername?: string; initiumTitle?: string; totalTickets: number; dashContributed: number; isAnonymous?: boolean; verifiedTxIds?: string[]; splitTxIds?: string[] }>;
}

interface SearchStats {
  username: string; totalTickets: number; totalDash: number; lotteryCount: number; wins: number;
  entries: Array<{ lotteryId: string; lotteryTitle: string; initiumTitle?: string; tickets: number; dash: number; createdAt: number }>;
  winHistory: Array<{ lotteryId: string; lotteryTitle: string; dashWon: number; payoutTxId?: string; timestamp: number }>;
}

type Tab = 'winners' | 'lotteries' | 'search';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const insightTx = (txid: string) => `https://insight.dash.org/insight/tx/${txid}`;
const shortTx   = (txid: string) => `${txid.slice(0,10)}…${txid.slice(-6)}`;

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
      style={{
        background: active ? 'rgba(0,255,200,0.1)' : 'transparent',
        color: active ? '#00FFC8' : 'rgba(255,255,255,0.4)',
        border: active ? '1px solid rgba(0,255,200,0.25)' : '1px solid transparent',
      }}>
      {label}
      {count !== undefined && (
        <span className="text-xs px-1.5 py-0.5 rounded-full font-mono"
          style={{ background: active ? 'rgba(0,255,200,0.15)' : 'rgba(255,255,255,0.06)', color: active ? '#00FFC8' : 'rgba(255,255,255,0.3)' }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Winners Tab ───────────────────────────────────────────────────────────────
function WinnersTab({ winners, loading }: { winners: Winner[]; loading: boolean }) {
  const unique = winners.filter((w, i, arr) => arr.findIndex(x => x.payoutTxId && x.payoutTxId === w.payoutTxId) === i || !w.payoutTxId);
  if (loading) return <div className="py-20 text-center text-white/25 text-sm">Loading winners…</div>;
  if (!unique.length) return (
    <div className="py-20 text-center">
      <div className="text-4xl mb-3">⏳</div>
      <div className="text-white/30 text-sm">No winners yet — the launch lottery is live. Be the first! 🚀</div>
    </div>
  );
  return (
    <div className="space-y-4">
      {unique.map((w, i) => (
        <div key={`${w.lotteryId}-${i}`} className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.03), rgba(0,255,136,0.02))', border: '1px solid rgba(255,215,0,0.12)' }}>
          {/* Winner header */}
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-xl"
                style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,140,0,0.1))', border: '1px solid rgba(255,215,0,0.3)' }}>
                👑
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="font-bold text-white text-base">
                    {w.displayName || w.dashUsername || (w.dashAddress ? `${w.dashAddress.slice(0,8)}…` : 'Anonymous')}
                  </span>
                  {w.dashUsername && (
                    <span className="text-xs px-2 py-0.5 rounded font-mono flex-shrink-0"
                      style={{ background: 'rgba(0,141,228,0.1)', border: '1px solid rgba(0,141,228,0.2)', color: '#30BFFF' }}>
                      {w.dashUsername}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/35 font-mono">{w.lotteryTitle}</div>
                <div className="text-xs text-white/20 mt-0.5">{formatDistanceToNow(new Date(w.timestamp), { addSuffix: true })}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xl sm:text-2xl font-black font-mono" style={{ color: '#FFD700' }}>{w.dashWon.toFixed(4)}</div>
                <div className="text-xs text-white/30 font-mono">DASH WON</div>
              </div>
            </div>
          </div>

          {/* Initium */}
          {(w.initium || w.initiumTitle) && (
            <div className="mx-4 sm:mx-5 mb-3 p-3 rounded-xl"
              style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.1)' }}>
              <div className="text-[9px] font-mono text-cyan-400/60 mb-1 tracking-widest">INITIUM</div>
              <p className="text-white/65 text-sm leading-relaxed italic">&ldquo;{w.initiumTitle || w.initium}&rdquo;</p>
            </div>
          )}

          {/* Winning Initium card */}
          {(w as any).initiumTitle && (
            <div className="mx-4 sm:mx-5 mb-3 rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(0,255,200,0.15)', background: 'rgba(0,255,200,0.04)' }}>
              {(w as any).mediaUrl && (
                <div style={{ height: 80, background: 'rgba(0,0,0,0.5)' }}>
                  <img src={(w as any).mediaUrl} alt="" className="w-full h-full" style={{ objectFit: 'contain' }} />
                </div>
              )}
              <div className="p-3">
                <div className="text-xs font-bold text-white/80 mb-1">⬡ {(w as any).initiumTitle}</div>
                {(w as any).initiumDescription && (
                  <div className="text-[10px] text-white/40 line-clamp-2">{(w as any).initiumDescription}</div>
                )}
                <div className="flex gap-3 mt-2 text-[9px] font-mono">
                  {(w as any).upvoteTickets > 0 && (
                    <span style={{ color: 'rgba(0,200,255,0.6)' }}>⬡ {(w as any).upvoteTickets} Votus</span>
                  )}
                  {w.winningTickets > 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>🎟 {w.winningTickets} tickets</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 border-t" style={{ borderColor: 'rgba(255,215,0,0.08)' }}>
            {[
              { l: 'TICKETS', v: w.winningTickets, c: '#FFD700' },
              { l: 'WIN %', v: `${w.totalTickets > 0 ? ((w.winningTickets/w.totalTickets)*100).toFixed(1) : 100}%`, c: '#00FFFF' },
              { l: 'PLAYERS', v: w.totalParticipants, c: '#a78bfa' },
              { l: 'POOL Ð', v: w.totalDash.toFixed(2), c: '#30BFFF' },
            ].map((s, j) => (
              <div key={j} className="py-3 text-center border-r last:border-r-0" style={{ borderColor: 'rgba(255,215,0,0.08)' }}>
                <div className="text-sm sm:text-base font-bold font-mono" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[9px] text-white/20 font-mono tracking-wide mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Payout TX */}
          {(w.payoutTxId || (w.payoutTxIds?.length ?? 0) > 0) && (
            <div className="mx-4 sm:mx-5 mb-4 mt-2 p-3 rounded-xl"
              style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)' }}>
              <div className="text-[9px] font-mono text-green-400/70 tracking-widest mb-2">✅ PAYOUT VERIFIED ON-CHAIN</div>
              {(w.payoutTxIds?.length ? w.payoutTxIds : w.payoutTxId ? [w.payoutTxId] : []).map((txid, idx) => (
                <a key={txid} href={insightTx(txid)} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-xs font-mono py-0.5 break-all"
                  style={{ color: '#30BFFF' }}>
                  <span className="text-white/20 flex-shrink-0">TX:</span>
                  <span className="underline underline-offset-2 truncate">{shortTx(txid)}</span>
                  <span className="flex-shrink-0 text-white/30">↗</span>
                </a>
              ))}
            </div>
          )}

          {!w.payoutTxId && !(w.payoutTxIds?.length) && (
            <div className="px-4 sm:px-5 pb-4 text-xs text-yellow-400/50 font-mono">⏳ Payout pending</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Lotteries Tab ─────────────────────────────────────────────────────────────
function LotteriesTab({ history, loading }: { history: LotteryHistory[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (loading) return <div className="py-20 text-center text-white/25 text-sm">Loading lotteries…</div>;
  if (!history.length) return (
    <div className="py-20 text-center">
      <div className="text-4xl mb-3">🚀</div>
      <div className="text-white/50 text-sm font-semibold mb-1">Launch Day — History Begins Now</div>
      <div className="text-white/25 text-xs">0 lotteries run · 0 DASH awarded · The first chapter starts with you.</div>
    </div>
  );
  return (
    <div className="space-y-3">
      {history.map(lottery => (
        <div key={lottery.id} className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setExpanded(expanded === lottery.id ? null : lottery.id)}
            className="w-full text-left p-4 sm:p-5 hover:bg-white/[0.02] transition-all">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full"
                    style={{ background: lottery.status === 'active' ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.05)', color: lottery.status === 'active' ? '#00FF88' : 'rgba(255,255,255,0.3)', border: `1px solid ${lottery.status === 'active' ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
                    {lottery.status === 'active' ? '🟢 LIVE' : '⚫ ENDED'}
                  </span>
                  <span className="text-white/20 text-[10px] font-mono">{fmtDate(lottery.createdAt)}</span>
                </div>
                <div className="font-bold text-white text-sm sm:text-base leading-snug">{lottery.title}</div>
                {lottery.description && <div className="text-white/30 text-xs mt-0.5 line-clamp-1">{lottery.description}</div>}
                <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-white/30">
                  <span>🎟 {lottery.totalTickets} tickets</span>
                  <span>👥 {lottery.participantCount}</span>
                  {lottery.winner && <span>🏆 {lottery.winner.dashUsername ? `@${lottery.winner.dashUsername}` : lottery.winner.displayName}</span>}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-lg sm:text-xl font-black font-mono text-cyan-400">{lottery.totalDash.toFixed(3)}</div>
                <div className="text-[9px] text-white/25 font-mono">DASH</div>
                <div className="text-white/20 text-base mt-1">{expanded === lottery.id ? '▲' : '▼'}</div>
              </div>
            </div>
          </button>

          {expanded === lottery.id && (
            <div className="border-t space-y-4 p-4 sm:p-5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              {/* Winner card */}
              {lottery.winner && (
                <div className="p-3 sm:p-4 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.04), rgba(0,255,255,0.04))', border: '1px solid rgba(0,255,136,0.15)' }}>
                  <div className="text-[9px] uppercase tracking-widest text-green-400/60 mb-2">🏆 Winner</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-white text-sm">
                      {lottery.winner.dashUsername ? `@${lottery.winner.dashUsername}` : lottery.winner.displayName || 'Anonymous'}
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold font-mono text-sm">{lottery.winner.dashWon.toFixed(4)} DASH</div>
                      {lottery.winner.payoutTxId && (
                        <a href={insightTx(lottery.winner.payoutTxId)} target="_blank" rel="noreferrer"
                          className="text-[9px] text-cyan-400/50 hover:text-cyan-400 font-mono">View TX ↗</a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Participants + TX log */}
              {lottery.entries.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Participants &amp; Transactions</div>
                  <div className="space-y-2">
                    {lottery.entries.map(entry => (
                      <div key={entry.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="text-sm text-white/70 truncate">
                            {entry.isAnonymous ? '🥷 Anonymous' : (entry.dashUsername ? `@${entry.dashUsername}` : (entry.displayName || 'Unknown'))}
                            {entry.initiumTitle && <span className="text-white/25 text-xs ml-1.5">· {entry.initiumTitle}</span>}
                          </div>
                          <div className="text-xs font-mono text-cyan-400/70 flex-shrink-0">{entry.totalTickets}🎟 · {entry.dashContributed.toFixed(3)}Ð</div>
                        </div>
                        {/* Deposit TXs */}
                        {(entry.verifiedTxIds || []).length > 0 && (
                          <div className="space-y-1">
                            {(entry.verifiedTxIds || []).map(txid => (
                              <a key={txid} href={insightTx(txid)} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 text-[10px] font-mono"
                                style={{ color: 'rgba(0,255,200,0.6)' }}>
                                <span className="text-white/20 flex-shrink-0">💰 deposit:</span>
                                <span className="truncate hover:text-cyan-400 transition-colors">{shortTx(txid)}</span>
                                <span className="text-white/20 flex-shrink-0">↗</span>
                              </a>
                            ))}
                          </div>
                        )}
                        {/* Split TXs */}
                        {(entry.splitTxIds || []).length > 0 && (
                          <div className="space-y-1 mt-1">
                            {(entry.splitTxIds || []).map(txid => (
                              <a key={txid} href={insightTx(txid)} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 text-[10px] font-mono"
                                style={{ color: 'rgba(0,212,170,0.5)' }}>
                                <span className="text-white/15 flex-shrink-0">⚡ split:</span>
                                <span className="truncate hover:text-cyan-300 transition-colors">{shortTx(txid)}</span>
                                <span className="text-white/15 flex-shrink-0">↗</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lottery address */}
              <div className="text-[9px] text-white/15 font-mono break-all pt-1">
                Lottery address: {lottery.address}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Search Tab ────────────────────────────────────────────────────────────────
function SearchTab() {
  const [input, setInput]       = useState('');
  const [query, setQuery]       = useState('');
  const [stats, setStats]       = useState<SearchStats | null>(null);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]       = useState('');

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    const username = q.trim().replace(/^@/, '');
    setQuery(username); setLoading(true); setSearched(true); setError(''); setStats(null);
    try {
      const r = await fetch(`/api/account?username=${encodeURIComponent(username)}`);
      const d = await r.json();
      if (!d.found) setError(`No entries found for @${username}`);
      else setStats({ ...d, username, winHistory: d.winHistory || [] });
    } catch { setError('Failed to fetch. Try again.'); }
    setLoading(false);
  }, []);

  return (
    <div>
      {/* Search form */}
      <form onSubmit={e => { e.preventDefault(); search(input); }} className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-white/30">@</span>
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder="dashusername" autoCapitalize="none" autoCorrect="off"
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
              style={{ fontFamily: 'monospace' }} />
          </div>
          <button type="submit" disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(0,141,228,0.15)', border: '1px solid rgba(0,141,228,0.3)', color: '#30BFFF' }}>
            {loading ? '…' : 'Search'}
          </button>
        </div>
      </form>

      {loading && <div className="py-12 text-center text-white/25 text-sm">Looking up @{query}…</div>}
      {searched && !loading && error && <div className="py-12 text-center text-white/40 text-sm">{error}</div>}

      {stats && (
        <div className="space-y-4">
          {/* Profile */}
          <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.1), rgba(0,141,228,0.1))', border: '1px solid rgba(0,255,255,0.2)' }}>
                🆔
              </div>
              <div>
                <div className="text-lg font-bold text-white">@{stats.username}</div>
                <div className="text-white/35 text-xs">Dash Evolution Identity</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { l: 'TICKETS', v: stats.totalTickets },
                { l: 'DASH', v: stats.totalDash.toFixed(3) },
                { l: 'LOTTERIES', v: stats.lotteryCount },
              ].map(s => (
                <div key={s.l} className="p-3 rounded-xl text-center"
                  style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.06)' }}>
                  <div className="text-xl font-bold font-mono text-white">{s.v}</div>
                  <div className="text-[9px] uppercase tracking-widest text-white/25 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {stats.winHistory.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.03), rgba(0,255,255,0.03))', border: '1px solid rgba(0,255,136,0.15)' }}>
              <div className="text-[9px] uppercase tracking-widest text-green-400/60 mb-3">🏆 Win History</div>
              {stats.winHistory.map((w, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 gap-2">
                  <div>
                    <div className="text-sm text-white font-medium">{w.lotteryTitle}</div>
                    <div className="text-[10px] text-white/30">{fmtDate(w.timestamp)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-green-400 font-bold font-mono text-sm">{w.dashWon.toFixed(4)} DASH</div>
                    {w.payoutTxId && (
                      <a href={insightTx(w.payoutTxId)} target="_blank" rel="noreferrer"
                        className="text-[9px] text-cyan-400/50 hover:text-cyan-400 font-mono">View TX ↗</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {stats.entries.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[9px] uppercase tracking-widest text-white/25 mb-3">🎟 Entry History</div>
              <div className="space-y-2">
                {stats.entries.map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white/70 truncate">{e.lotteryTitle}</div>
                      {e.initiumTitle && <div className="text-[10px] text-white/30 mt-0.5 truncate">💡 {e.initiumTitle}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-cyan-400/80 font-mono text-xs">{e.tickets}🎟</div>
                      <div className="text-white/25 text-xs">{e.dash.toFixed(3)} Ð</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="text-center text-white/15 text-xs mt-6 space-y-1">
          <p>Enter a Dash Evolution username to look up their lottery history.</p>
          <button onClick={() => { setInput('August'); search('August'); }}
            className="text-cyan-400/40 hover:text-cyan-400/70 transition-colors mt-1">
            Try: August →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [tab, setTab]           = useState<Tab>('winners');
  const [winners, setWinners]   = useState<Winner[]>([]);
  const [history, setHistory]   = useState<LotteryHistory[]>([]);
  const [winStats, setWinStats] = useState<{ totalLotteries: number; totalDash: number; totalParticipants: number } | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/winners').then(r => r.json()),
      fetch('/api/history').then(r => r.json()),
    ]).then(([wRes, hRes]) => {
      if (wRes.status === 'fulfilled') { setWinners((wRes.value as { winners?: Winner[]; stats?: { totalLotteries: number; totalDash: number; totalParticipants: number } }).winners || []); setWinStats((wRes.value as { winners?: Winner[]; stats?: { totalLotteries: number; totalDash: number; totalParticipants: number } }).stats || null); }
      if (hRes.status === 'fulfilled') setHistory((hRes.value as { history?: LotteryHistory[] }).history || []);
    }).finally(() => setLoading(false));
  }, []);

  // Deduplicate winners by payoutTxId
  const uniqueWinners = winners.filter((w, i, arr) =>
    !w.payoutTxId || arr.findIndex(x => x.payoutTxId === w.payoutTxId) === i
  );

  return (
    <div className="min-h-screen px-4 pb-16" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,60,160,0.1) 0%, #050510 60%)' }}>

      {/* Header */}
      <div className="pt-8 pb-6 text-center">
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-medium"
          style={{ background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.15)', color: 'rgba(255,200,0,0.7)' }}>
          📜 History &amp; Records
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">The Timely Archive</h1>
        <p className="text-white/35 text-sm max-w-sm mx-auto">
          Every winner, every lottery, every payout — on the record forever.
        </p>
      </div>

      {/* Stats strip */}
      {winStats && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto mb-6">
          {[
            { l: 'LOTTERIES', v: winStats.totalLotteries, c: '#FFD700' },
            { l: 'DASH AWARDED', v: `${winStats.totalDash.toFixed(2)}Ð`, c: '#30BFFF' },
            { l: 'FOUNDERS', v: winStats.totalParticipants, c: '#a78bfa' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-lg sm:text-xl font-black font-mono" style={{ color: s.c }}>{s.v}</div>
              <div className="text-[9px] text-white/25 font-mono tracking-wide mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sticky tab bar */}
      <div className="sticky top-16 z-30 -mx-4 px-4 py-2 mb-6"
        style={{ background: 'rgba(5,5,16,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex gap-2 max-w-lg mx-auto overflow-x-auto no-scrollbar">
          <TabBtn label="🏆 Winners" active={tab === 'winners'} onClick={() => setTab('winners')} count={uniqueWinners.length} />
          <TabBtn label="📜 Lotteries" active={tab === 'lotteries'} onClick={() => setTab('lotteries')} count={history.length} />
          <TabBtn label="🔍 Search" active={tab === 'search'} onClick={() => setTab('search')} />
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-2xl mx-auto">
        {tab === 'winners'   && <WinnersTab   winners={uniqueWinners} loading={loading} />}
        {tab === 'lotteries' && <LotteriesTab history={history}       loading={loading} />}
        {tab === 'search'    && <SearchTab />}
      </div>
    </div>
  );
}
