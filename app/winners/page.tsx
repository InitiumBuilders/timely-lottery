'use client';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface Winner {
  lotteryId: string; lotteryTitle: string; entryId: string;
  displayName?: string; dashAddress?: string; dashUsername?: string;
  initium?: string; dashWon: number; totalParticipants: number;
  totalDash: number; winningTickets: number; totalTickets: number;
  payoutTxId?: string; payoutTxIds?: string[]; payoutTo?: string; timestamp: number;
}

export default function WinnersPage() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [stats, setStats]     = useState<{ totalLotteries: number; totalDash: number; totalParticipants: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/winners').then(r => r.json()).then(d => {
      setWinners(d.winners || []);
      setStats(d.stats || null);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen px-4 md:px-6 py-10 md:py-12">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="text-6xl mb-6 animate-float">🏆</div>
          <h1 className="text-5xl font-black text-white mb-4">
            Hall of <span className="grad-gold">Winners</span>
          </h1>
          <p className="text-white/40 text-lg">Founders who believed. Submitted their Initium. And won.</p>
        </div>

        {/* Summary stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-14">
            {[
              { label: 'LOTTERIES COMPLETED', value: stats.totalLotteries, color: '#FFD700' },
              { label: 'TOTAL DASH AWARDED', value: `${stats.totalDash.toFixed(4)} Ð`, color: '#30BFFF' },
              { label: 'TOTAL FOUNDERS', value: stats.totalParticipants, color: '#a78bfa' },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className="text-2xl font-black font-mono mb-1" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-white/30 font-mono tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Winners list */}
        {loading ? (
          <div className="text-center py-20 text-white/30 font-mono">Loading winners...</div>
        ) : winners.length === 0 ? (
          <div className="text-center py-20 glass">
            <div className="text-5xl mb-4">⏳</div>
            <p className="text-white/40 text-lg font-semibold">No winners yet</p>
            <p className="text-white/20 text-sm mt-2">The first lottery is waiting to be launched.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {winners.map((w, i) => (
              <div key={`${w.lotteryId}-${i}`} className="winner-card p-6 relative">
                {/* Rank */}
                <div className="absolute top-4 right-5 text-4xl font-black text-white/5 font-mono">#{i + 1}</div>

                {/* Header row */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl"
                    style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,140,0,0.1))', border: '1px solid rgba(255,215,0,0.3)' }}>
                    👑
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-white">
                        {w.displayName || w.dashUsername || (w.dashAddress ? `${w.dashAddress.slice(0, 10)}...` : 'Anonymous')}
                      </h3>
                      {w.dashUsername && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(0,141,228,0.1)', border: '1px solid rgba(0,141,228,0.2)', color: '#30BFFF' }}>
                          {w.dashUsername}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/30 font-mono">{w.lotteryTitle}</div>
                  </div>
                  {/* Prize */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black grad-gold font-mono">{w.dashWon.toFixed(4)}</div>
                    <div className="text-xs text-white/30 font-mono">DASH WON</div>
                  </div>
                </div>

                {/* Initium */}
                {w.initium && (
                  <div className="mb-4 p-4 rounded-xl relative" style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.1)' }}>
                    <div className="text-xs font-mono text-cyan-400/60 mb-2 tracking-widest">INITIUM</div>
                    <p className="text-white/70 text-sm leading-relaxed italic">"{w.initium}"</p>
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'WINNING TICKETS', value: w.winningTickets, color: '#FFD700' },
                    { label: 'WIN CHANCE', value: `${w.totalTickets > 0 ? ((w.winningTickets / w.totalTickets) * 100).toFixed(1) : '100'}%`, color: '#00FFFF' },
                    { label: 'PARTICIPANTS', value: w.totalParticipants, color: '#a78bfa' },
                    { label: 'POOL SIZE', value: `${w.totalDash.toFixed(3)} Ð`, color: '#30BFFF' },
                  ].map((s, j) => (
                    <div key={j} className="text-center py-2">
                      <div className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs text-white/20 font-mono tracking-widest mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Payout TX block — full transparency */}
                {(w.payoutTxId || (w.payoutTxIds?.length ?? 0) > 0) && (
                  <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.2)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-400 text-xs font-mono font-bold tracking-widest">✅ PAYOUT VERIFIED ON-CHAIN</span>
                    </div>
                    {w.payoutTo && (
                      <div className="text-xs text-white/30 font-mono mb-2">
                        To: <span className="text-white/60">{w.payoutTo}</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      {(w.payoutTxIds?.length ? w.payoutTxIds : w.payoutTxId ? [w.payoutTxId] : []).map((txid, i) => (
                        <a key={txid}
                          href={`https://insight.dash.org/insight/tx/${txid}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 font-mono transition-colors break-all">
                          <span className="text-white/20 flex-shrink-0">TX {i + 1}:</span>
                          <span className="underline underline-offset-2">{txid}</span>
                          <span className="flex-shrink-0">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,215,0,0.1)' }}>
                  <span className="text-xs text-white/25 font-mono">
                    {formatDistanceToNow(new Date(w.timestamp), { addSuffix: true })}
                  </span>
                  {!w.payoutTxId && !w.payoutTxIds?.length && (
                    <span className="text-xs text-yellow-400/50 font-mono">⏳ Payout pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
