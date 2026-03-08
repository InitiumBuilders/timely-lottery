'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';

interface SplitRecord {
  lotteryId: string;
  entryId: string;
  depositTxId: string;
  splitTxId: string;
  totalDeposit: number;
  reserveAmount: number;
  nextLotteryAmount: number;
  winnerAmount: number;
  timestamp: number;
}

interface ReserveStats {
  reserveAddress: string;
  liveBalance: number;           // confirmed on-chain DASH at reserve address
  txCount: number;
  reserveTotalAllocated: number; // cumulative DASH allocated to reserve all-time
  nextLotteryFundHeld: number;   // cumulative 5% rolled to next lotteries
  totalDashProcessed: number;    // all-time volume
  allocationHistory: Array<{
    lotteryId: string;
    lotteryTitle: string;
    totalDash: number;
    winnerDash: number;
    reserveDash: number;
    nextLotteryDash: number;
    winnerName?: string;
    txId?: string;
    timestamp: number;
  }>;
  splitHistory: SplitRecord[];  // per-TX immediate splits
}

// ── Animated number ───────────────────────────────────────────────────────────
function AnimNum({ val, dec = 4, prefix = '' }: { val: number; dec?: number; prefix?: string }) {
  const [disp, setDisp] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current; prev.current = val;
    if (from === val) return;
    const start = performance.now(); const dur = 1400;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisp(from + (val - from) * ease);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [val]);
  return <>{prefix}{disp.toFixed(dec)}</>;
}

// ── Pulse ring ────────────────────────────────────────────────────────────────
function PulseRings({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {[220, 360, 500, 640].map((s, i) => (
        <div key={i} className="absolute rounded-full" style={{
          width: s, height: s,
          border: `1px solid ${color}`,
          opacity: 0.04 - i * 0.007,
          animation: `pulse ${4 + i}s ease-in-out infinite`,
          animationDelay: `${i * 0.5}s`,
        }} />
      ))}
    </div>
  );
}

// ── Floating particles ────────────────────────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 25 }, (_, i) => ({
    left: (i * 4.1) % 100,
    delay: (i * 0.35) % 9,
    dur: 7 + (i % 5),
    size: 1.5 + (i % 3),
    color: i % 3 === 0 ? '#00D4AA' : i % 3 === 1 ? '#008DE4' : '#7C3AED',
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div key={i} className="absolute rounded-full" style={{
          width: p.size, height: p.size,
          left: `${p.left}%`, bottom: '-4px',
          background: p.color, opacity: 0.25,
          animation: `rise ${p.dur}s ${p.delay}s linear infinite`,
        }} />
      ))}
      <style>{`
        @keyframes rise {
          0%   { transform: translateY(0) scale(1);   opacity: 0; }
          10%  { opacity: 0.3; }
          90%  { opacity: 0.1; }
          100% { transform: translateY(-95vh) scale(0.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: { label: string; value: React.ReactNode; sub?: string; color: string; icon: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 flex flex-col gap-1"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22` }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs font-mono tracking-widest uppercase" style={{ color: `${color}99` }}>{label}</div>
      <div className="text-2xl md:text-3xl font-black font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{sub}</div>}
    </div>
  );
}

// ── Principle card ────────────────────────────────────────────────────────────
function Principle({ icon, title, body, color }: { icon: string; title: string; body: string; color: string }) {
  return (
    <div className="relative rounded-2xl p-6 md:p-8 overflow-hidden group transition-all duration-300 hover:-translate-y-1"
      style={{ background: `linear-gradient(135deg, ${color}08, ${color}03)`, border: `1px solid ${color}20` }}>
      <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-2xl" style={{ background: `linear-gradient(180deg, ${color}, ${color}30)` }} />
      <div className="text-3xl mb-3">{icon}</div>
      <div className="font-bold text-lg mb-2" style={{ color }}>{title}</div>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{body}</p>
    </div>
  );
}

// ── Use case card ─────────────────────────────────────────────────────────────
function UseCase({ icon, title, desc, tag }: { icon: string; title: string; desc: string; tag: string }) {
  return (
    <div className="rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-0.5">{icon}</div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-white">{title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(0,212,170,0.1)', color: '#00D4AA', border: '1px solid rgba(0,212,170,0.2)' }}>{tag}</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{desc}</p>
        </div>
      </div>
    </div>
  );
}

export default function ReservePage() {
  const [stats, setStats]     = useState<ReserveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);
  const [tick, setTick]       = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/reserve/balance', { cache: 'no-store' });
      if (r.ok) setStats(await r.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live ticker — refresh every 30s
  useEffect(() => {
    const iv = setInterval(() => { setTick(t => t + 1); load(); }, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const copy = () => {
    if (stats?.reserveAddress) {
      navigator.clipboard.writeText(stats.reserveAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const RESERVE_COLOR = '#00D4AA';
  const BLUE_COLOR    = '#008DE4';
  const PURPLE_COLOR  = '#7C3AED';

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #010810 0%, #01100D 50%, #010810 100%)' }}>
      <Particles />

      {/* ── Nav ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'rgba(0,212,170,0.1)' }}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D4AA, #008DE4)' }}>
            <span className="text-black font-black text-xs">T</span>
          </div>
          <span className="font-bold text-white text-sm tracking-wide">Timely<span style={{ color: RESERVE_COLOR }}>.works</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/lottery" className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>Lottery</Link>
          <Link href="/reserve" className="text-xs font-mono font-bold" style={{ color: RESERVE_COLOR }}>The Reserve</Link>
          <Link href="/initiums" className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>Initiums</Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 pt-20 pb-16 px-6 text-center">
        <PulseRings color={RESERVE_COLOR} />

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-bold tracking-widest mb-8"
          style={{ background: `${RESERVE_COLOR}12`, border: `1px solid ${RESERVE_COLOR}30`, color: RESERVE_COLOR }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: RESERVE_COLOR }} />
          COMMUNITY RESERVE — LIVE
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-4 leading-none tracking-tight">
          <span className="text-white">The Timely</span>
          <br />
          <span style={{ background: `linear-gradient(135deg, ${RESERVE_COLOR}, ${BLUE_COLOR})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Reserve
          </span>
        </h1>

        <p className="text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          A permanent, transparent, community-owned fund. 10% of every lottery automatically flows here — building a universal resource for the projects and emergencies that matter most.
        </p>

        {/* ── Live confirmed balance ticker ── */}
        <div className="relative inline-block mb-10 w-full max-w-xl">
          <div className="absolute inset-0 blur-2xl rounded-3xl" style={{ background: `${RESERVE_COLOR}18` }} />
          <div className="relative rounded-3xl px-10 py-10 text-center"
            style={{ background: 'rgba(0,212,170,0.04)', border: `1px solid ${RESERVE_COLOR}30`, backdropFilter: 'blur(20px)' }}>
            <div className="text-xs font-mono tracking-widest mb-1" style={{ color: `${RESERVE_COLOR}80` }}>
              CONFIRMED RESERVE BALANCE
            </div>
            <div className="text-5xl md:text-7xl font-black font-mono mb-2" style={{ color: RESERVE_COLOR }}>
              {loading ? '—' : <><AnimNum val={stats?.liveBalance ?? 0} dec={4} /></>}
              <span className="text-2xl ml-2" style={{ color: `${RESERVE_COLOR}60` }}>DASH</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: RESERVE_COLOR }} />
              Live on-chain · {stats?.txCount ?? 0} transactions confirmed · refreshes every 30s
            </div>
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4" style={{ borderColor: `${RESERVE_COLOR}15` }}>
              <div>
                <div className="text-xs font-mono tracking-widest mb-1" style={{ color: 'rgba(0,212,170,0.5)' }}>TOTAL ALLOCATED ALL-TIME</div>
                <div className="text-lg font-black font-mono" style={{ color: RESERVE_COLOR }}>
                  <AnimNum val={stats?.reserveTotalAllocated ?? 0} dec={4} /> <span className="text-sm">DASH</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-mono tracking-widest mb-1" style={{ color: 'rgba(0,141,228,0.5)' }}>NEXT LOTTERY SEEDED</div>
                <div className="text-lg font-black font-mono" style={{ color: BLUE_COLOR }}>
                  <AnimNum val={stats?.nextLotteryFundHeld ?? 0} dec={4} /> <span className="text-sm">DASH</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Reserve address + QR ── */}
        {stats?.reserveAddress && (
          <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-6 text-left">

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center rounded-2xl p-8"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${RESERVE_COLOR}20` }}>
              <div className="text-xs font-mono tracking-widest mb-4 text-center" style={{ color: `${RESERVE_COLOR}80` }}>SCAN TO CONTRIBUTE</div>
              <div className="p-4 rounded-xl" style={{ background: 'white' }}>
                <QRCodeSVG value={`dash:${stats.reserveAddress}`} size={160} level="M" />
              </div>
              <div className="mt-3 text-xs font-mono text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Direct DASH contributions welcome
              </div>
            </div>

            {/* Address info */}
            <div className="flex flex-col justify-center gap-4 rounded-2xl p-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${RESERVE_COLOR}20` }}>
              <div>
                <div className="text-xs font-mono tracking-widest mb-2" style={{ color: `${RESERVE_COLOR}80` }}>RESERVE ADDRESS</div>
                <div className="font-mono text-xs break-all p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {stats.reserveAddress}
                </div>
              </div>
              <button onClick={copy}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 hover:opacity-90 active:scale-95"
                style={{ background: copied ? `${RESERVE_COLOR}20` : `linear-gradient(135deg, ${RESERVE_COLOR}, ${BLUE_COLOR})`, color: copied ? RESERVE_COLOR : '#000', border: copied ? `1px solid ${RESERVE_COLOR}` : 'none' }}>
                {copied ? '✓ Address Copied!' : '⊕ Copy Address'}
              </button>
              <a href={`https://insight.dash.org/insight/address/${stats.reserveAddress}`} target="_blank" rel="noopener noreferrer"
                className="text-center text-xs font-mono underline" style={{ color: `${RESERVE_COLOR}60` }}>
                View on Dash Explorer →
              </a>
            </div>
          </div>
        )}
      </section>

      {/* ── Stats Grid ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Reserve Balance" icon="🏦"
            value={<><AnimNum val={stats?.liveBalance ?? 0} dec={4} /> <span className="text-sm">DASH</span></>}
            sub="confirmed on-chain now" color={RESERVE_COLOR}
          />
          <StatCard
            label="Next Lottery Seeded" icon="🌱"
            value={<><AnimNum val={stats?.nextLotteryFundHeld ?? 0} dec={4} /> <span className="text-sm">DASH</span></>}
            sub="5% confirmed to next pool" color={BLUE_COLOR}
          />
          <StatCard
            label="Total DASH Processed" icon="⚡"
            value={<><AnimNum val={stats?.totalDashProcessed ?? 0} dec={4} /> <span className="text-sm">DASH</span></>}
            sub="all-time volume through system" color={PURPLE_COLOR}
          />
          <StatCard
            label="Splits Executed" icon="⛓"
            value={stats?.splitHistory?.length ?? 0}
            sub="on-chain split transactions" color="#F59E0B"
          />
        </div>
      </section>

      {/* ── Distribution Banner ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-8 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-xs font-mono tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>AUTOMATED FUND DISTRIBUTION</div>
            <div className="text-lg font-bold text-white mt-1">Every $DASH transaction is split transparently</div>
          </div>
          <div className="grid md:grid-cols-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { pct: '85%', label: 'Winner', desc: 'The lottery winner receives the lion\'s share of every pool — instantly and automatically.', color: '#F59E0B', icon: '🏆' },
              { pct: '10%', label: 'The Reserve', desc: 'A permanent community fund. Transparent, democratic, and built to last for the projects that matter.', color: RESERVE_COLOR, icon: '🏦' },
              { pct: '5%',  label: 'Next Lottery', desc: 'Rolled into the next lottery\'s starting pot. The pool is always growing — every game better than the last.', color: BLUE_COLOR, icon: '🌱' },
            ].map((item, idx) => (
              <div key={item.pct} className="p-6 md:p-8 text-center" style={{ background: `${item.color}04`, borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
                <div className="text-5xl font-black font-mono mb-2" style={{ color: item.color }}>{item.pct}</div>
                <div className="font-bold text-white mb-3">{item.icon} {item.label}</div>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24 text-center">
        <div className="inline-block px-3 py-1 rounded-full text-xs font-mono tracking-widest mb-6"
          style={{ background: `${RESERVE_COLOR}10`, color: `${RESERVE_COLOR}90`, border: `1px solid ${RESERVE_COLOR}20` }}>
          THE MISSION
        </div>
        <blockquote className="text-2xl md:text-3xl lg:text-4xl font-bold leading-snug mb-8 text-white">
          "Hold fast to the goal of goodness.{' '}
          <span style={{ color: RESERVE_COLOR }}>Keep standards absolute.</span>"
        </blockquote>
        <p className="text-base leading-relaxed max-w-2xl mx-auto mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
          The Timely Reserve is not a company treasury. It is a community commons — a shared resource that belongs to everyone who has ever played, contributed, or believed in what we&apos;re building. It exists to fund what matters when it matters most.
        </p>
        <p className="text-sm leading-relaxed max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
          — Inspired by Donella Meadows, <em>Dancing With Systems</em>
        </p>
      </section>

      {/* ── Principles ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-mono tracking-widest mb-4"
            style={{ background: `${BLUE_COLOR}10`, color: `${BLUE_COLOR}90`, border: `1px solid ${BLUE_COLOR}20` }}>
            THREE PILLARS
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white">Truth. Trust. Transparency.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Principle icon="🔍" color={RESERVE_COLOR} title="Truth"
            body="Every allocation is recorded on-chain and in our open ledger. We publish every transaction, every decision, every dollar — before and after. There are no hidden fees, no shadow wallets, no ambiguity. The truth is always on the blockchain." />
          <Principle icon="🤝" color={BLUE_COLOR} title="Trust"
            body="Trust is earned in real-time. The Reserve operates with clear, pre-committed rules. Funds are governed by community consensus — not by a single person, not by a corporation. Move at the speed of trust, and trust grows from transparency." />
          <Principle icon="📖" color={PURPLE_COLOR} title="Transparency"
            body="This page is the Reserve's living dashboard. Every allocation, every decision, every withdrawal is visible here and verifiable on the Dash blockchain. Our governance is open — anyone can propose, anyone can audit, anyone can participate." />
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-mono tracking-widest mb-4"
            style={{ background: `${PURPLE_COLOR}10`, color: `${PURPLE_COLOR}90`, border: `1px solid ${PURPLE_COLOR}20` }}>
            FUND PURPOSES
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">A Multipurpose Fund<br /><span style={{ color: RESERVE_COLOR }}>for a Complex World</span></h2>
          <p className="text-sm max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            The Timely Reserve can be deployed for any project deemed <em>timely</em> — urgent, relevant, and aligned with our core values.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <UseCase icon="🔥" tag="EMERGENCY" title="Digital Firefighting"
            desc="When critical open-source infrastructure is under attack, threatened by vulnerabilities, or at risk of going dark — The Reserve can mobilize emergency security funding. Digital emergencies are real. We will respond." />
          <UseCase icon="🛡" tag="SECURITY" title="Smart Contract Audits"
            desc="Fund independent security audits of smart contracts used by the community. Not every team can afford a $50K audit. The Reserve can bridge that gap — keeping protocols safe and users protected." />
          <UseCase icon="🌱" tag="IMPACT" title="Altruistic Projects"
            desc="Community-nominated, impact-driven projects that create real good in the world. From open-source tools to community education — if it helps people, it's eligible." />
          <UseCase icon="🚀" tag="STARTUP" title="Timely Startups"
            desc="Seed funding for early-stage founders building tools aligned with our values — decentralized, transparent, community-first technology. The Reserve is a launchpad, not just a holding account." />
          <UseCase icon="🏛" tag="GOVERNANCE" title="Democratic Infrastructure"
            desc="Fund tools, research, and experiments that strengthen participatory democracy — from on-chain voting systems to community coordination tools. Votus. DAOs. People's infrastructure." />
          <UseCase icon="⚡" tag="CYBER" title="Universal Security Fund"
            desc="A standing resource for the broader web3 security ecosystem. Bug bounties, security researchers, incident response. When the system is under threat, The Reserve stands ready." />
          <UseCase icon="🕊️" tag="PEACE KEEPING" title="Community Peace Keeping"
            desc="We are community peacekeepers. Using Non-Violent Communication (NVC) combined with digital infrastructure, The Reserve funds conflict resolution, dialogue facilitation, and bridge-building across communities. In a world full of noise, we fund the technology and people who find compromise. Peace is not passive — it is an active, funded commitment." />
          <UseCase icon="🔂" tag="SYSTEMS EDUCATION" title="Systems Thinking Education · Semble"
            desc="In partnership with Semble — the Emergent State — we fund systems thinking education for communities everywhere. Semble is a global learning movement that teaches people to See, Map, Move, and Make together. Systems Blindness is the root of most societal failures. We fund the antidote: teaching people to see the whole, find leverage points, and act with collective wisdom. 🔂 = Emergence in motion." />
        </div>
      </section>

      {/* ── Peace Keeping Feature Card ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16">
        <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(99,220,180,0.05), rgba(0,180,120,0.03))', border: '1px solid rgba(99,220,180,0.2)' }}>
          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                  style={{ background: 'linear-gradient(135deg, rgba(99,220,180,0.15), rgba(0,180,120,0.1))', border: '1px solid rgba(99,220,180,0.3)' }}>
                  🕊️
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className="text-xs font-mono px-3 py-1 rounded-full font-bold tracking-widest"
                    style={{ background: 'rgba(99,220,180,0.1)', border: '1px solid rgba(99,220,180,0.25)', color: '#63DCB4' }}>
                    PEACE KEEPING
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white mb-4">Community Peace Keeping</h3>
                <p className="text-base leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  The Timely Reserve is a community peacekeeper. We believe that most conflict — in communities, in organizations, in societies — is not born from malice, but from miscommunication, unmet needs, and a lack of shared language.
                </p>
                <p className="text-base leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  We fund <strong style={{ color: '#63DCB4' }}>Non-Violent Communication (NVC)</strong> practice combined with digital infrastructure — tools for dialogue, conflict resolution platforms, bridge-building communities, and mediation technology. We invest in the people and systems that transform conflict into connection.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { icon: '💬', title: 'NVC Facilitation', desc: 'Fund trained NVC facilitators in communities facing social friction.' },
                    { icon: '🌉', title: 'Bridge-Building Tech', desc: 'Platforms designed to connect people across divides — not deepen them.' },
                    { icon: '⚖️', title: 'Conflict Resolution', desc: 'Digital tools for mediation, restorative justice, and compromise-finding.' },
                    { icon: '🤝', title: 'Dialogue Infrastructure', desc: 'Open spaces, both digital and physical, for communities to hear each other.' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(99,220,180,0.04)', border: '1px solid rgba(99,220,180,0.1)' }}>
                      <span className="text-xl flex-shrink-0">{item.icon}</span>
                      <div>
                        <div className="font-bold text-sm mb-1" style={{ color: '#63DCB4' }}>{item.title}</div>
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <blockquote className="mt-6 p-4 rounded-xl italic text-sm" style={{ background: 'rgba(99,220,180,0.05)', borderLeft: '3px solid rgba(99,220,180,0.4)', color: 'rgba(255,255,255,0.6)' }}>
                  &ldquo;Peace is not the absence of conflict. It is the presence of creative, inclusive, and empathetic approaches to difference.&rdquo;
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Semble / Systems Thinking Feature Card ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16">
        <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.07), rgba(0,141,228,0.04))', border: '1px solid rgba(124,58,237,0.25)' }}>
          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(0,141,228,0.1))', border: '1px solid rgba(124,58,237,0.35)' }}>
                  🔂
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className="text-xs font-mono px-3 py-1 rounded-full font-bold tracking-widest"
                    style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}>
                    SYSTEMS EDUCATION
                  </span>
                  <span className="text-xs font-mono px-3 py-1 rounded-full font-bold tracking-widest"
                    style={{ background: 'rgba(0,141,228,0.1)', border: '1px solid rgba(0,141,228,0.2)', color: '#30BFFF' }}>
                    SEMBLE PARTNERSHIP
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white mb-2">Systems Thinking Education</h3>
                <h4 className="text-lg font-bold mb-4" style={{ color: '#a78bfa' }}>In partnership with Semble — The Emergent State</h4>
                <p className="text-base leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <strong style={{ color: '#a78bfa' }}>Semble</strong> is a global learning movement and emergent community built on one core belief: that <em>Systems Blindness</em> — our collective inability to see the full picture — is the root cause of most societal failure. Semble teaches people to see systems, find leverage, and act with coordinated collective wisdom.
                </p>
                <p className="text-base leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Through the Semble Method — <strong style={{ color: '#30BFFF' }}>See → Map → Move → Make</strong> — communities learn to observe patterns, visualize connections, identify leverage points, and create real change. The Timely Reserve funds the expansion of this education into underserved communities, schools, and civic organizations worldwide.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  {[
                    { icon: '👁️', title: 'See', desc: "Collective observation — learning to notice what's actually happening in the system." },
                    { icon: '🗺️', title: 'Map', desc: 'Visualizing connections, feedback loops, and interdependencies.' },
                    { icon: '⚡', title: 'Move', desc: 'Identifying leverage points — where small effort creates systemic change.' },
                    { icon: '🎨', title: 'Make', desc: 'Creating culture, art, and solutions that embody the new understanding.' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
                      <span className="text-xl flex-shrink-0">{item.icon}</span>
                      <div>
                        <div className="font-bold text-sm mb-1" style={{ color: '#a78bfa' }}>{item.title}</div>
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <div className="text-[10px] font-mono tracking-widest mb-2" style={{ color: 'rgba(167,139,250,0.7)' }}>WHY THIS MATTERS</div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Donella Meadows wrote that &ldquo;the greatest leverage in any system is the ability to change the paradigm from which the system arises.&rdquo; Semble teaches exactly this — and The Timely Reserve is proud to fund it. 🔂 is emergence in motion: patterns building on patterns, communities finding their collective intelligence together.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How We Govern ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <div className="rounded-3xl p-8 md:p-12"
          style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.05), rgba(0,141,228,0.03))', border: `1px solid ${RESERVE_COLOR}20` }}>
          <div className="text-xs font-mono tracking-widest mb-4" style={{ color: `${RESERVE_COLOR}80` }}>HOW WE GOVERN</div>
          <h3 className="text-2xl md:text-3xl font-black text-white mb-6">Democratic. Community-Led.<br /><span style={{ color: RESERVE_COLOR }}>Always Growing.</span></h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <div>
              <p className="mb-4">The Reserve is governed as a community commons. Allocation proposals are open to anyone — any community member can submit a project for consideration.</p>
              <p>Votus — our on-chain voting system — will power governance decisions. Token holders and lottery participants vote on how funds are deployed.</p>
            </div>
            <div>
              <p className="mb-4">No single wallet controls The Reserve. Multi-signature security means no single actor can move funds unilaterally.</p>
              <p>All spending decisions are posted publicly before execution. The community has a review window. Transparency is not optional — it is the architecture.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Split History (per-TX immediate splits) ── */}
      {stats && (stats.splitHistory?.length ?? 0) > 0 && (
        <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white">Live Split Log</h2>
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Every DASH contribution split instantly and automatically on-chain
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="grid grid-cols-5 px-6 py-3 text-xs font-mono tracking-widest" style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.02)' }}>
              <span>SPLIT TX</span>
              <span className="text-right">DEPOSIT</span>
              <span className="text-right" style={{ color: RESERVE_COLOR }}>RESERVE 10%</span>
              <span className="text-right" style={{ color: BLUE_COLOR }}>NEXT POOL 5%</span>
              <span className="text-right" style={{ color: '#F59E0B' }}>WINNER ~85%</span>
            </div>
            {(stats.splitHistory || []).slice(0, 20).map((rec, i) => (
              <div key={i} className="grid grid-cols-5 px-6 py-3 border-t text-xs hover:bg-white/[0.02] transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div>
                  <a href={`https://insight.dash.org/insight/tx/${rec.splitTxId}`} target="_blank" rel="noopener noreferrer"
                    className="font-mono" style={{ color: `${RESERVE_COLOR}80` }}>
                    {rec.splitTxId.slice(0,10)}…
                  </a>
                  <div className="text-white/20 mt-0.5">{new Date(rec.timestamp).toLocaleDateString()}</div>
                </div>
                <div className="text-right font-mono text-white/60 self-center">{rec.totalDeposit.toFixed(4)}</div>
                <div className="text-right font-mono self-center" style={{ color: RESERVE_COLOR }}>{rec.reserveAmount.toFixed(4)}</div>
                <div className="text-right font-mono self-center" style={{ color: BLUE_COLOR }}>{rec.nextLotteryAmount.toFixed(4)}</div>
                <div className="text-right font-mono self-center" style={{ color: '#F59E0B' }}>{rec.winnerAmount.toFixed(4)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Allocation History (per-lottery at payout) ── */}
      {stats && stats.allocationHistory.length > 0 && (
        <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white">Allocation History</h2>
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Every distribution, every lottery, on the record forever</p>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="grid grid-cols-5 px-6 py-3 text-xs font-mono tracking-widest" style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.02)' }}>
              <span>LOTTERY</span><span className="text-right">TOTAL</span><span className="text-right" style={{ color: '#F59E0B' }}>WINNER 85%</span>
              <span className="text-right" style={{ color: RESERVE_COLOR }}>RESERVE 10%</span><span className="text-right" style={{ color: BLUE_COLOR }}>NEXT 5%</span>
            </div>
            {stats.allocationHistory.map((rec, i) => (
              <div key={i} className="grid grid-cols-5 px-6 py-4 border-t text-sm hover:bg-white/[0.02] transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div>
                  <div className="font-medium text-white text-xs truncate">{rec.lotteryTitle}</div>
                  {rec.winnerName && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>🏆 {rec.winnerName}</div>}
                  {rec.txId && (
                    <a href={`https://insight.dash.org/insight/tx/${rec.txId}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-mono" style={{ color: `${RESERVE_COLOR}60` }}>
                      {rec.txId.slice(0,10)}…
                    </a>
                  )}
                </div>
                <div className="text-right font-mono text-white text-xs self-center">{rec.totalDash.toFixed(4)}</div>
                <div className="text-right font-mono text-xs self-center" style={{ color: '#F59E0B' }}>{rec.winnerDash.toFixed(4)}</div>
                <div className="text-right font-mono text-xs self-center" style={{ color: RESERVE_COLOR }}>{rec.reserveDash.toFixed(4)}</div>
                <div className="text-right font-mono text-xs self-center" style={{ color: BLUE_COLOR }}>{rec.nextLotteryDash.toFixed(4)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state for history ── */}
      {stats && stats.allocationHistory.length === 0 && (
        <section className="relative z-10 max-w-2xl mx-auto px-6 pb-24 text-center">
          <div className="rounded-2xl p-10" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-4xl mb-3">🌱</div>
            <div className="font-bold text-white mb-2">The Reserve is Growing</div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Allocation history will appear here after the first lottery completes. Every allocation is recorded forever on the Dash blockchain.
            </p>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t px-6 py-10 text-center" style={{ borderColor: `${RESERVE_COLOR}15` }}>
        <div className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
          The Timely Reserve — Governed by the community, for the community.
        </div>
        <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Built by August · <a href="https://X.com/BuiltByAugust" target="_blank" rel="noopener noreferrer" className="hover:underline">X.com/BuiltByAugust</a>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}
