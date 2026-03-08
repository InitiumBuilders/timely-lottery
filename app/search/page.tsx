'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AccountStats {
  username: string;
  totalTickets: number;
  totalDash: number;
  lotteryCount: number;
  wins: number;
  entries: Array<{
    lotteryId: string;
    lotteryTitle: string;
    initiumTitle?: string;
    tickets: number;
    dash: number;
    createdAt: number;
  }>;
  winHistory: Array<{
    lotteryId: string;
    lotteryTitle: string;
    dashWon: number;
    payoutTxId?: string;
    timestamp: number;
  }>;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const search = async (q: string) => {
    if (!q.trim()) return;
    const username = q.trim().replace(/^@/, '');
    setQuery(username);
    setLoading(true);
    setSearched(true);
    setError('');
    setStats(null);
    try {
      const r = await fetch(`/api/account?username=${encodeURIComponent(username)}`);
      const d = await r.json();
      if (!d.found) { setError(`No entries found for @${username}`); }
      else { setStats({ ...d, username, winHistory: d.winHistory || [] }); }
    } catch { setError('Failed to fetch. Try again.'); }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(input);
  };

  return (
    <div className="min-h-screen px-4 md:px-6 py-10 md:py-14" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.12) 0%, #050510 55%)' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between border-b border-white/5 mb-8 -mx-4 md:-mx-6"
           style={{ background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(20px)' }}>
        <Link href="/" className="text-white/70 hover:text-white transition-colors text-sm">← timely.works</Link>
        <div className="flex items-center gap-2">
          <Link href="/initiums" className="text-xs text-white/40 hover:text-white/70 px-3 py-1.5 rounded-full border border-white/5 hover:border-white/10 transition-all">Initiums</Link>
          <Link href="/history" className="text-xs text-white/40 hover:text-white/70 px-3 py-1.5 rounded-full border border-white/5 hover:border-white/10 transition-all">History</Link>
          <Link href="/lottery" className="text-xs text-cyan-400/70 hover:text-cyan-400 px-3 py-1.5 rounded-full border border-cyan-400/20 hover:border-cyan-400/40 transition-all">Enter →</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-medium"
               style={{ background: 'rgba(0,141,228,0.08)', border: '1px solid rgba(0,141,228,0.2)', color: 'rgba(0,141,228,0.9)' }}>
            🔍 Payout Search
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Search by Username</h1>
          <p className="text-white/40 text-sm max-w-md mx-auto">
            Look up any Dash Evolution username to see their lottery entries, tickets, and payout history.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl"
                 style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-white/30">@</span>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="dashusername"
                autoCapitalize="none"
                autoCorrect="off"
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <button type="submit" disabled={loading || !input.trim()}
                    className="px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: 'rgba(0,141,228,0.15)', border: '1px solid rgba(0,141,228,0.3)', color: '#30BFFF' }}>
              {loading ? '…' : 'Search'}
            </button>
          </div>
        </form>

        {/* Results */}
        {loading && (
          <div className="text-center py-12 text-white/25 text-sm">Looking up @{query}…</div>
        )}

        {searched && !loading && error && (
          <div className="text-center py-12 text-white/40 text-sm">{error}</div>
        )}

        {searched && !loading && !error && !stats && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-white/30 text-sm">No entries found for @{query}</div>
          </div>
        )}

        {stats && (
          <div className="space-y-4">
            {/* Profile card */}
            <div className="rounded-2xl p-6 border border-white/8"
                 style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                     style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.1), rgba(0,141,228,0.1))', border: '1px solid rgba(0,255,255,0.2)' }}>
                  🆔
                </div>
                <div>
                  <div className="text-xl font-bold text-white">@{stats.username}</div>
                  <div className="text-white/35 text-xs">Dash Evolution Identity</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'TOTAL TICKETS', value: stats.totalTickets },
                  { label: 'DASH SPENT', value: stats.totalDash.toFixed(3) },
                  { label: 'LOTTERIES', value: stats.lotteryCount },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl text-center"
                       style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.06)' }}>
                    <div className="text-xl font-bold font-mono text-white">{s.value}</div>
                    <div className="text-[9px] uppercase tracking-widest text-white/25">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wins */}
            {stats.winHistory.length > 0 && (
              <div className="rounded-2xl p-5 border"
                   style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.03), rgba(0,255,255,0.03))', borderColor: 'rgba(0,255,136,0.15)' }}>
                <div className="text-[10px] uppercase tracking-widest text-green-400/60 mb-3">🏆 Win History</div>
                {stats.winHistory.map((w, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <div className="text-sm text-white font-medium">{w.lotteryTitle}</div>
                      <div className="text-[10px] text-white/30">
                        {new Date(w.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold font-mono text-sm">{w.dashWon.toFixed(4)} DASH</div>
                      {w.payoutTxId && (
                        <a href={`https://insight.dash.org/insight/tx/${w.payoutTxId}`}
                           target="_blank" rel="noopener noreferrer"
                           className="text-[10px] text-cyan-400/50 hover:text-cyan-400 transition-colors">
                          View TX ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Entry history */}
            {stats.entries.length > 0 && (
              <div className="rounded-2xl p-5 border border-white/6"
                   style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-[10px] uppercase tracking-widest text-white/25 mb-3">🎟 Entry History</div>
                <div className="space-y-2">
                  {stats.entries.map((e, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <div className="text-sm text-white/70">{e.lotteryTitle}</div>
                        {e.initiumTitle && <div className="text-[11px] text-white/30 mt-0.5">💡 {e.initiumTitle}</div>}
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-cyan-400/80 font-mono">{e.tickets} 🎟</div>
                        <div className="text-white/25">{e.dash.toFixed(3)} DASH</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Helper text */}
        {!searched && (
          <div className="text-center text-white/15 text-xs mt-8 space-y-1">
            <p>Enter a Dash Evolution username to look up their lottery history.</p>
            <p>Example: try <button onClick={() => { setInput('August'); search('August'); }} className="text-cyan-400/40 hover:text-cyan-400/70 transition-colors">August</button></p>
          </div>
        )}
      </div>
    </div>
  );
}
