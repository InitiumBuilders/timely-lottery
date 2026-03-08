'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';

interface LiveStats {
  totalLotteries: number;
  totalDash: number;
  totalParticipants: number;
  active: boolean;
  currentPool?: number;
  currentEndTime?: number;
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, decimals = 0, suffix = '' }: { target: number; decimals?: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 2000);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(ease * target);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target]);
  return <>{decimals > 0 ? val.toFixed(decimals) : Math.floor(val)}{suffix}</>;
}

// ── Live countdown ────────────────────────────────────────────────────────────
function LiveCountdown({ endTime }: { endTime: number }) {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      if (diff === 0) { setDisplay('ENDING SOON'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [endTime]);
  return <span>{display}</span>;
}

// ── Particle field ────────────────────────────────────────────────────────────
function Particles({ count = 30, colors = ['#00FFFF', '#008DE4', '#a78bfa', '#00FF88'] }: { count?: number; colors?: string[] }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    size:  1 + (i % 3) * 0.8,
    left:  (i * 3.37) % 100,
    delay: (i * 0.31) % 10,
    dur:   7 + (i % 7),
    color: colors[i % colors.length],
    drift: (i % 2 === 0 ? '' : '-') + (20 + (i % 40)) + 'px',
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div key={i} className="absolute rounded-full"
          style={{ width: p.size, height: p.size, left: `${p.left}%`, bottom: '-6px', background: p.color, opacity: 0.25, animation: `rise ${p.dur}s ${p.delay}s linear infinite` }} />
      ))}
      <style>{`@keyframes rise { 0%{transform:translateY(0) translateX(0) scale(1);opacity:0} 8%{opacity:.35} 92%{opacity:.1} 100%{transform:translateY(-100vh) translateX(var(--drift,30px)) scale(.2);opacity:0} }`}</style>
    </div>
  );
}

// ── Concentric rings ──────────────────────────────────────────────────────────
function Rings({ color = 'rgba(0,255,255,', count = 5 }: { color?: string; count?: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="absolute rounded-full"
          style={{ width: 260 + i * 160, height: 260 + i * 160, border: `1px solid ${color}${Math.max(0.01, 0.06 - i * 0.01)})`, animation: `pulse ${4 + i}s ease-in-out infinite`, animationDelay: `${i * 0.5}s` }} />
      ))}
    </div>
  );
}

// ── Glowing center orb ────────────────────────────────────────────────────────
function CenterGlow({ color = '#00FFFF', size = 500, opacity = 0.06 }: { color?: string; size?: number; opacity?: number }) {
  const hex = color;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div style={{ width: size, height: size, background: `radial-gradient(circle, ${hex}${Math.round(opacity * 255).toString(16).padStart(2,'0')} 0%, transparent 70%)`, borderRadius: '50%', animation: 'pulse 5s ease-in-out infinite' }} />
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({ n, icon, title, desc, color }: { n: string; icon: string; title: string; desc: string; color: string }) {
  return (
    <div className="relative group rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1.5"
      style={{ background: `linear-gradient(135deg, ${color}08, ${color}03)`, border: `1px solid ${color}18` }}>
      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${color}70, transparent)` }} />
      <div className="absolute -top-3 -right-1 text-6xl font-black font-mono select-none" style={{ color: `${color}08`, lineHeight: 1 }}>{n}</div>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4 flex-shrink-0"
        style={{ background: `${color}14`, border: `1px solid ${color}30` }}>{icon}</div>
      <div className="text-[10px] font-mono font-bold tracking-widest mb-1.5" style={{ color: `${color}99` }}>STEP {n}</div>
      <h3 className="text-white font-bold text-sm sm:text-base mb-2 leading-snug">{title}</h3>
      <p className="text-white/60 text-xs sm:text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

// ── Trust pill ────────────────────────────────────────────────────────────────
function TrustPill({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-200 hover:bg-white/[0.04]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
      <span className="text-base">{icon}</span> {text}
    </div>
  );
}

// ── Reserve snapshot card ─────────────────────────────────────────────────────
function ReserveSnapshot() {
  const [balance, setBalance] = useState<number | null>(null);
  const [total, setTotal]     = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/reserve/balance').then(r => r.json()).then(d => {
      setBalance(d.liveBalance ?? null);
      setTotal(d.reserveTotalAllocated ?? null);
    }).catch(() => {});
  }, []);

  return (
    <section className="py-16 md:py-24 px-4 md:px-6 relative overflow-hidden">
      {/* BG accent */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,212,170,0.04) 0%, transparent 65%)' }} />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="rounded-3xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.05), rgba(0,141,228,0.04))', border: '1px solid rgba(0,212,170,0.2)' }}>

          {/* Header bar */}
          <div className="px-6 sm:px-10 pt-8 sm:pt-10 pb-6 border-b" style={{ borderColor: 'rgba(0,212,170,0.12)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest"
                  style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.25)', color: '#00D4AA' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                  THE TIMELY RESERVE
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Every Lottery Builds<br />
                  <span style={{ color: '#00D4AA' }}>Something Permanent</span>
                </h2>
              </div>
              {balance !== null && (
                <div className="sm:text-right flex-shrink-0">
                  <div className="text-3xl sm:text-4xl font-black font-mono" style={{ color: '#00D4AA' }}>
                    {balance.toFixed(4)}
                    <span className="text-lg ml-1 opacity-60">DASH</span>
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: 'rgba(0,212,170,0.6)' }}>LIVE RESERVE BALANCE</div>
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 sm:px-10 py-8">
            <p className="text-white/60 leading-relaxed mb-8 text-sm sm:text-base max-w-2xl">
              10% of every lottery automatically flows to The Timely Reserve — a permanent, on-chain community fund. It exists to fund what matters: digital security, altruistic projects, democratic infrastructure, community peace keeping, and systems thinking education. Transparent. Governed by the community. Built to last.
            </p>

            {/* 3 pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon: '🔍', title: 'Radical Transparency', desc: 'Every allocation verified on the Dash blockchain. Open ledger, always.', color: '#00D4AA' },
                { icon: '🤝', title: 'Community Governed', desc: 'Funds deployed by community vote. No single wallet controls the reserve.', color: '#008DE4' },
                { icon: '🌱', title: 'Permanent & Growing', desc: '10% compounds every lottery. The reserve gets stronger with every round.', color: '#a78bfa' },
              ].map((p, i) => (
                <div key={i} className="rounded-xl p-4 sm:p-5"
                  style={{ background: `${p.color}06`, border: `1px solid ${p.color}18` }}>
                  <div className="text-xl mb-2">{p.icon}</div>
                  <div className="font-bold text-sm mb-1" style={{ color: p.color }}>{p.title}</div>
                  <p className="text-xs leading-relaxed text-white/45">{p.desc}</p>
                </div>
              ))}
            </div>

            {/* What it funds */}
            <div className="flex flex-wrap gap-2 mb-8">
              {['🕊️ Peace Keeping', '🛡 Smart Contract Audits', '🌱 Altruistic Projects', '🏛 Democratic Infrastructure', '🔂 Systems Education · Semble', '🚀 Timely Startups', '⚡ Universal Security'].map((tag, i) => (
                <span key={i} className="text-xs px-3 py-1.5 rounded-full font-mono"
                  style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', color: 'rgba(0,212,170,0.8)' }}>
                  {tag}
                </span>
              ))}
            </div>

            <Link href="/reserve">
              <button className="group flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-105"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.15), rgba(0,141,228,0.1))', border: '1px solid rgba(0,212,170,0.35)', color: '#00D4AA' }}>
                🏦 Explore The Timely Reserve
                <span className="opacity-60 group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [stats,     setStats]     = useState<LiveStats | null>(null);
  const [mounted,   setMounted]   = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/stats').then(r => r.json()).then(d => setStats(d.stats)).catch(() => {});
  }, []);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: 'TIMELY.WORKS — The Founder\'s Lottery',
      text: 'Submit your startup idea, buy tickets with $DASH, and compete for the prize pool. 85% to winner!',
      url: 'https://www.timely.works',
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* user cancelled */ }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText('https://www.timely.works');
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch { /* blocked */ }
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ════════════════════════════════════ HERO ══════════════════════════ */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center px-4 pb-10 pt-6 overflow-hidden">
        <Rings count={6} />
        <CenterGlow size={600} opacity={0.05} />
        <Particles count={35} />

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center">

          {/* Live badge */}
          {mounted && stats?.active && (
            <div className="inline-flex items-center gap-2 mb-5 sm:mb-6 px-4 py-2 rounded-full"
              style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)' }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <span className="text-xs font-mono font-bold text-green-400 tracking-widest">LOTTERY LIVE</span>
              {stats.currentEndTime && (
                <span className="text-xs text-white/60 font-mono ml-1">
                  · <LiveCountdown endTime={stats.currentEndTime} />
                </span>
              )}
            </div>
          )}

          {/* Question headline — BIG, WHITE, UNMISSABLE */}
          <div className="mb-4 sm:mb-5 px-2">
            <p className="font-bold text-white leading-snug"
              style={{ fontSize: 'clamp(1.25rem, 4.5vw, 2.25rem)', textShadow: '0 0 40px rgba(255,255,255,0.1)' }}>
              How soon do you need funding
              <br className="hidden sm:block" /> for your startup?
            </p>
          </div>

          {/* Brand — TIMELY.WORKS */}
          <div className="mb-5 sm:mb-7">
            <h1 className="font-black tracking-tight leading-none">
              <span className="block grad-full glow-text"
                style={{ fontSize: 'clamp(3.5rem, 15vw, 9rem)', lineHeight: 1.0 }}>
                TIMELY
              </span>
              <span className="block text-white font-black"
                style={{ fontSize: 'clamp(1.6rem, 6vw, 3.8rem)', letterSpacing: '0.25em', lineHeight: 1.1, opacity: 0.95 }}>
                .WORKS
              </span>
            </h1>
          </div>

          {/* Subhead */}
          <div className="max-w-2xl mx-auto mb-5 sm:mb-6 space-y-2.5 px-3">
            <p className="text-white font-bold leading-snug" style={{ fontSize: 'clamp(1.05rem, 3vw, 1.3rem)' }}>
              The Founder&apos;s Lottery.
            </p>
            <p className="text-white/70 leading-relaxed" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.05rem)' }}>
              Submit your idea as a new{' '}
              <span className="text-cyan-400 font-bold">&ldquo;INITIUM&rdquo;</span>.
              Buy tickets with{' '}
              <span className="font-bold" style={{ color: '#30BFFF' }}>$DASH</span>.
              {' '}0.1 $DASH = 1 lottery ticket in the current Timely pool.
            </p>
          </div>

          {/* Ticket + Votus pill */}
          <div className="flex items-center justify-center mb-3 sm:mb-4 px-2">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 rounded-2xl font-mono font-bold"
              style={{ background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.25)', fontSize: 'clamp(0.7rem, 2vw, 0.85rem)' }}>
              <span>🎟</span>
              <span style={{ color: '#FFD700' }}>0.1 $DASH = 1 Ticket</span>
              <span className="text-white/20">+</span>
              <span>⬡</span>
              <span style={{ color: '#00FFC8' }}>1 Votus Credit</span>
            </div>
          </div>

          {/* Split pill */}
          <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 px-4 sm:px-5 py-2.5 rounded-2xl mb-8 sm:mb-10 font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 'clamp(0.7rem, 2vw, 0.8rem)' }}>
            <span className="font-bold" style={{ color: '#F59E0B' }}>🏆 85% Winner</span>
            <span className="text-white/20">·</span>
            <span className="font-semibold" style={{ color: '#00D4AA' }}>🏦 10% Reserve</span>
            <span className="text-white/20">·</span>
            <span className="font-semibold" style={{ color: '#30BFFF' }}>🌱 5% Next Pool</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10 sm:mb-14 px-2">
            <Link href="/lottery" className="w-full sm:w-auto">
              <button className="btn-dash w-full sm:w-auto px-8 sm:px-10 py-4 text-base font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg">
                ⚡ Enter the Lottery
              </button>
            </Link>
            <Link href="/history" className="w-full sm:w-auto">
              <button className="btn-neon w-full sm:w-auto px-8 py-4 text-base rounded-2xl">
                🏆 View Winners
              </button>
            </Link>
            <button
              onClick={handleShare}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl text-base font-bold transition-all duration-200 flex items-center justify-center gap-2 hover:scale-105"
              style={{
                background: shareCopied ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${shareCopied ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.15)'}`,
                color: shareCopied ? '#00ff88' : 'rgba(255,255,255,0.75)',
              }}>
              {shareCopied ? '✅ Link Copied!' : '🔗 Share'}
            </button>
          </div>

          {/* Live stats */}
          {mounted && stats && (
            <div className="grid grid-cols-3 gap-3 sm:gap-8 max-w-md mx-auto pt-8 sm:pt-10 border-t px-2"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {[
                { label: 'ROUNDS', value: stats.totalLotteries,      dec: 0 },
                { label: 'DASH OUT', value: stats.totalDash,         dec: 2, suffix: 'Ð' },
                { label: 'FOUNDERS', value: stats.totalParticipants, dec: 0 },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-black grad-cyan font-mono">
                    <Counter target={s.value} decimals={s.dec} suffix={s.suffix} />
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-white/40 font-mono tracking-widest mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-5 left-0 right-0 flex justify-center pointer-events-none opacity-25" style={{ animation: 'float 3s ease-in-out infinite' }}>
          <div className="flex flex-col items-center gap-1.5">
            <div className="text-[9px] font-mono text-white/50 tracking-[0.2em]">SCROLL</div>
            <div className="w-px h-6 bg-gradient-to-b from-white/50 to-transparent" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ LIVE POOL BANNER ═══════════════════ */}
      {mounted && stats?.active && (
        <section className="px-4 md:px-6 -mt-2 mb-2">
          <div className="max-w-4xl mx-auto">
            <Link href="/lottery">
              <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 cursor-pointer group"
                style={{ background: 'linear-gradient(135deg, rgba(0,141,228,0.1), rgba(0,255,255,0.06))', border: '1px solid rgba(0,141,228,0.3)' }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(0,141,228,0.1), transparent)', animation: 'shimmer 2.5s linear infinite' }} />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                    <div>
                      <div className="text-[10px] font-mono text-[#30BFFF] tracking-widest">ACTIVE POOL · GROWING NOW</div>
                      <div className="text-white font-bold text-base sm:text-lg">Buy your ticket before it ends</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto">
                    {stats.currentPool !== undefined && (
                      <div className="text-center">
                        <div className="text-xl sm:text-2xl font-black text-[#30BFFF] font-mono">{stats.currentPool.toFixed(3)} Ð</div>
                        <div className="text-[9px] text-white/30 font-mono">IN POOL</div>
                      </div>
                    )}
                    <div className="btn-neon px-4 sm:px-5 py-2.5 text-sm flex-shrink-0">Enter →</div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════ HOW IT WORKS ═══════════════════════ */}
      <section className="py-16 sm:py-24 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[10px] font-mono text-cyan-400/50 tracking-[0.2em] mb-3">// THE PROTOCOL</div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">
              How It <span className="grad-cyan">Works</span>
            </h2>
            <p className="text-white/55 mt-2 text-sm sm:text-base max-w-sm mx-auto">
              Four steps. Zero middlemen. Pure founder energy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: '01', icon: '💡', title: 'Drop Your Initium', desc: 'Your idea — your stake. Submit your Initium: the seed of something the world hasn\'t seen yet.', color: '#00FFFF' },
              { n: '02', icon: '⚡', title: 'Buy Tickets with $DASH', desc: '0.1 DASH = 1 lottery ticket. Stack as many as you believe in. More tickets, more chances.', color: '#008DE4' },
              { n: '03', icon: '⬡', title: 'Earn Votus — Vote for Others', desc: '0.1 DASH = 1 Votus credit. Use Votus to vote for the Initiums you believe in. Each vote = 1 bonus ticket for that project.', color: '#a78bfa' },
              { n: '04', icon: '🏆', title: '85% to the Winner', desc: 'Timer hits zero. Weighted random winner selected. DASH auto-sent on-chain. Instant. Permanent.', color: '#4ade80' },
            ].map(s => <StepCard key={s.n} {...s} />)}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════ SPLIT BREAKDOWN ══════════════════════ */}
      <section className="py-8 sm:py-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-block px-3 py-1 rounded-full text-[10px] font-mono tracking-widest mb-3"
              style={{ background: 'rgba(255,200,0,0.06)', color: 'rgba(255,200,0,0.75)', border: '1px solid rgba(255,200,0,0.15)' }}>
              TRANSPARENT DISTRIBUTION
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Every $DASH, Accounted For</h2>
            <p className="text-white/60 text-sm mt-2 max-w-md mx-auto">
              Every transaction is split on-chain the moment it confirms. No hidden fees. No surprises. Forever on the blockchain.
            </p>
          </div>

          {/* Big 3-column split */}
          <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-3">
              {[
                { pct: '85%', label: 'Winner', sub: 'The Lottery Winner', desc: '85% of the Timely Lottery pool goes directly to the winner — automatically and instantly on-chain the moment the lottery ends.', color: '#F59E0B', icon: '🏆', border: true },
                { pct: '10%', label: 'The Reserve', sub: 'The Timely Reserve', desc: 'Flows into the permanent Timely Reserve — a community-owned fund for peace keeping, systems education, security, and altruistic projects.', color: '#00D4AA', icon: '🏦', border: true },
                { pct: '5%',  label: 'Next Lottery', sub: 'Seeds the Next Pool', desc: 'Allocated to the next Timely Lottery. The pot grows with every round — each game better-seeded than the last.', color: '#008DE4', icon: '🌱', border: false },
              ].map((item, i) => (
                <div key={item.pct} className="relative p-6 sm:p-8 text-center group"
                  style={{ background: `${item.color}05`, borderRight: item.border ? `1px solid rgba(255,255,255,0.06)` : undefined }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-px" style={{ background: `linear-gradient(90deg, transparent, ${item.color}60, transparent)` }} />
                  <div className="text-5xl sm:text-6xl font-black font-mono mb-1 leading-none" style={{ color: item.color }}>{item.pct}</div>
                  <div className="font-black text-white text-base sm:text-lg mb-0.5">{item.icon} {item.label}</div>
                  <div className="text-[10px] font-mono tracking-widest mb-3" style={{ color: `${item.color}70` }}>{item.sub}</div>
                  <p className="text-xs leading-relaxed text-white/60">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="px-6 sm:px-8 py-4 text-center text-xs font-mono text-white/20 tracking-widest border-t" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
              SPLIT AUTOMATICALLY ON-CHAIN · EVERY TRANSACTION · ALWAYS
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════ INITIUM + DASH CARDS ══════════════════ */}
      <section className="py-8 sm:py-12 px-4 md:px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

          {/* Initium */}
          <div className="group relative rounded-2xl p-6 sm:p-8 overflow-hidden hover:-translate-y-1 transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.04), rgba(0,141,228,0.03))', border: '1px solid rgba(0,255,255,0.12)' }}>
            <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,255,0.5), transparent)' }} />
            <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full text-[10px] font-mono text-cyan-400 tracking-widest font-bold"
              style={{ background: 'rgba(0,255,255,0.07)', border: '1px solid rgba(0,255,255,0.18)' }}>
              ✦ INITIUM PROTOCOL
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white mb-3 leading-snug">
              Ideas Worth<br /><span className="grad-cyan">Betting On</span>
            </h3>
            <p className="text-white/65 text-sm leading-relaxed mb-5">
              An Initium is the beginning. The spark. Your seed idea for a better world. Submit it, let the community signal it, and let the odds reflect collective belief in your vision.
            </p>
            <div className="space-y-2">
              {['Optional — but earns upvotes + bonus tickets', 'Each upvote = 1 Votus credit', 'Lives on the blockchain permanently', 'Your vision, recorded, forever'].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs sm:text-sm text-white/65">
                  <span className="text-cyan-400 text-[10px] flex-shrink-0">◆</span>{f}
                </div>
              ))}
            </div>
          </div>

          {/* Dash */}
          <div className="group relative rounded-2xl p-6 sm:p-8 overflow-hidden hover:-translate-y-1 transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, rgba(0,141,228,0.05), rgba(0,141,228,0.02))', border: '1px solid rgba(0,141,228,0.2)' }}>
            <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(0,141,228,0.6), transparent)' }} />
            <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full text-[10px] font-mono tracking-widest font-bold"
              style={{ background: 'rgba(0,141,228,0.08)', border: '1px solid rgba(0,141,228,0.2)', color: '#30BFFF' }}>
              ◈ POWERED BY $DASH
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white mb-3 leading-snug">
              Instant. Peer-to-Peer.<br /><span style={{ color: '#30BFFF' }}>Decentralized.</span>
            </h3>
            <p className="text-white/65 text-sm leading-relaxed mb-5">
              Dash InstantSend confirms your ticket in under 2 seconds. No banks. No gatekeepers. No permission. Every entry gets a unique deposit address — your ticket is sovereign.
            </p>
            <div className="space-y-2 mb-6">
              {['Sub-2s confirmations via InstantSend', 'Send from any Dash wallet, anywhere', '@DashUsername support (Evo / DPNS)', '0.1 DASH = 1 ticket, every time'].map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs sm:text-sm text-white/65">
                  <span className="text-[10px] flex-shrink-0" style={{ color: '#008DE4' }}>◆</span>{f}
                </div>
              ))}
            </div>

            {/* Dash ecosystem links */}
            <div className="pt-5 border-t" style={{ borderColor: 'rgba(0,141,228,0.15)' }}>
              <div className="text-[9px] font-mono tracking-widest mb-3" style={{ color: 'rgba(0,141,228,0.45)' }}>
                ◈ EXPLORE THE DASH ECOSYSTEM
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <a href="https://dash.org" target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-105 group/btn"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,141,228,0.14), rgba(0,141,228,0.06))',
                    border: '1px solid rgba(0,141,228,0.4)',
                    color: '#30BFFF',
                    textDecoration: 'none',
                  }}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="currentColor">
                    <circle cx="12" cy="12" r="10" fillOpacity="0.15" />
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fillOpacity="0" />
                    <text x="7.5" y="16" fontSize="9" fontWeight="bold">Ð</text>
                  </svg>
                  <span>💠 Dash.org</span>
                  <span className="text-[10px] opacity-50 group-hover/btn:opacity-90 transition-opacity">↗</span>
                </a>
                <a href="https://dashcentral.org" target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-105 group/btn"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,141,228,0.09), rgba(139,92,246,0.07))',
                    border: '1px solid rgba(0,141,228,0.28)',
                    color: 'rgba(48,191,255,0.88)',
                    textDecoration: 'none',
                  }}>
                  <span>🏛</span>
                  <span>Dash DAO Governance</span>
                  <span className="text-[10px] opacity-50 group-hover/btn:opacity-90 transition-opacity">↗</span>
                </a>
              </div>
              <p className="text-white/25 text-[10px] font-mono mt-2.5 leading-relaxed">
                DashCentral.org — where DASH masternodes vote on proposals that fund the network
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ THE RESERVE ════════════════════════ */}
      <ReserveSnapshot />

      {/* ═══════════════════════════════ TRUST SIGNALS ══════════════════════ */}
      <section className="py-10 sm:py-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-[10px] font-mono text-white/40 tracking-[0.2em]">// WHY FOUNDERS CHOOSE TIMELY.WORKS</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {[
              { icon: '🔒', text: 'Non-custodial keys' },
              { icon: '⛓️', text: 'All payouts on-chain' },
              { icon: '🤖', text: 'Fully automated' },
              { icon: '⚡', text: 'Instant DASH sends' },
              { icon: '🌐', text: 'Runs 24 / 7' },
              { icon: '👤', text: 'Dash Evo usernames' },
            ].map((f, i) => <TrustPill key={i} icon={f.icon} text={f.text} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ FINAL CTA ══════════════════════════ */}
      <section className="py-12 sm:py-24 px-4 md:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12"
            style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.04), rgba(0,141,228,0.05), rgba(167,139,250,0.04))', border: '1px solid rgba(0,255,255,0.12)' }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,255,255,0.08) 0%, transparent 60%)' }} />
            <Rings count={3} />
            <div className="relative z-10">
              <div className="text-5xl mb-5">⚡</div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
                Ready to <span className="glow-text grad-cyan">Enter?</span>
              </h2>
              <p className="text-white/60 mb-3 text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
                The next winner is reading this right now. Submit your Initium. Buy your tickets. Make your move.
              </p>
              <p className="text-white/35 text-xs font-mono mb-8">
                0.1 DASH = 1 TICKET · AUTO-PAYOUT ON-CHAIN · NO SIGNUP REQUIRED
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <Link href="/lottery" className="w-full sm:w-auto">
                  <button className="btn-dash w-full px-10 py-4 text-base font-bold rounded-2xl">
                    ⚡ Enter the Lottery
                  </button>
                </Link>
                <Link href="/initiums" className="w-full sm:w-auto">
                  <button className="btn-neon w-full px-8 py-4 text-sm rounded-2xl">
                    💡 Browse Initiums
                  </button>
                </Link>
              </div>

              {/* Built by */}
              <div className="pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-white/20 text-xs font-mono mb-1 tracking-widest">BUILT BY</p>
                <a href="https://AugustJames.Live" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-cyan-400"
                  style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <span className="text-base">👤</span>
                  August James
                  <span className="text-[10px] font-mono text-cyan-400/60 hover:text-cyan-400">AugustJames.Live ↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
