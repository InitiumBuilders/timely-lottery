'use client';
import { useEffect, useState } from 'react';

export default function StatsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="min-h-screen flex items-center justify-center text-white/30 font-mono">Loading...</div>;

  const { stats, lotteries, winners } = data;
  const monthlyData = lotteries.reduce((acc: Record<string, number>, l: any) => {
    const month = new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    acc[month] = (acc[month] || 0) + l.totalDash;
    return acc;
  }, {});

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="text-xs font-mono text-cyan-400/60 tracking-widest mb-4">// NETWORK STATS</div>
          <h1 className="text-5xl font-black text-white mb-4">
            Platform <span className="grad-cyan">Statistics</span>
          </h1>
          <p className="text-white/30">Real-time data from the Timely Works lottery protocol.</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'LOTTERIES RUN', value: stats.totalLotteries, color: '#00FFFF', icon: '🎲' },
            { label: 'DASH AWARDED', value: `${stats.totalDash.toFixed(4)}`, sub: 'DASH', color: '#30BFFF', icon: '⚡' },
            { label: 'TOTAL FOUNDERS', value: stats.totalParticipants, color: '#a78bfa', icon: '🚀' },
            { label: 'ACTIVE NOW', value: stats.active ? 'YES' : 'NO', color: stats.active ? '#4ade80' : '#ffffff30', icon: stats.active ? '🔴' : '⏸️' },
          ].map((s, i) => (
            <div key={i} className="glass-strong p-5 text-center">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-3xl font-black font-mono mb-0.5" style={{ color: s.color }}>{s.value}</div>
              {s.sub && <div className="text-sm text-white/30 font-mono">{s.sub}</div>}
              <div className="text-xs text-white/25 font-mono tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* All lotteries table */}
        <div className="glass p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">All Lotteries</h2>
            <span className="text-xs text-white/30 font-mono">{lotteries.length} total</span>
          </div>
          {lotteries.length === 0 ? (
            <div className="text-center py-8 text-white/25 text-sm">No lotteries yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/25 font-mono text-xs tracking-widest border-b" style={{ borderColor: 'rgba(0,255,255,0.08)' }}>
                    <th className="text-left pb-3 pr-4">TITLE</th>
                    <th className="text-right pb-3 pr-4">STATUS</th>
                    <th className="text-right pb-3 pr-4">DASH</th>
                    <th className="text-right pb-3 pr-4">TICKETS</th>
                    <th className="text-right pb-3">FOUNDERS</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {lotteries.map((l: any) => (
                    <tr key={l.id} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      <td className="py-3 pr-4 text-white/70 font-medium">{l.title}</td>
                      <td className="py-3 pr-4 text-right">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${l.status === 'active' ? 'text-green-400 border-green-400/30' : 'text-white/30 border-white/10'} border`}>
                          {l.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-cyan-400">{l.totalDash.toFixed(4)}</td>
                      <td className="py-3 pr-4 text-right font-mono text-white/50">{l.totalTickets}</td>
                      <td className="py-3 text-right font-mono text-white/50">{l.participantCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Winners summary */}
        <div className="glass p-6">
          <h2 className="text-lg font-bold text-white mb-5">Winner Summary</h2>
          {winners.length === 0 ? (
            <div className="text-center py-8 text-white/25 text-sm">No winners yet</div>
          ) : (
            <div className="space-y-3">
              {winners.map((w: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)' }}>
                  <div>
                    <span className="text-white/70 font-medium text-sm">
                      {w.displayName || w.dashUsername || (w.dashAddress ? w.dashAddress.slice(0, 14) + '...' : 'Anonymous')}
                    </span>
                    {w.initium && <p className="text-xs text-white/30 mt-0.5 truncate max-w-xs">{w.initium}</p>}
                  </div>
                  <span className="font-mono font-bold text-yellow-400">{w.dashWon.toFixed(4)} Ð</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
