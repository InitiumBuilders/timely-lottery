'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

const QRCodeSVG = dynamic(
  () => import('qrcode.react').then(m => m.QRCodeSVG),
  { ssr: false, loading: () => <div style={{ width: 160, height: 160, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }} /> }
);

const TIP_ADDRESS   = 'Xuwe72ZYJidruoqRyZhTpXe8YBFdBpqZkQ';
const RESERVE_ADDR  = 'XdVgwFryyG5QzgKpz1TPmN7FfkLR6Bo9Am';
const X_URL         = 'https://x.com/BuiltByAugust';
const SITE_URL      = 'https://AugustJames.Live';

// ── Types ─────────────────────────────────────────────────────────────────────
interface WordEntry { word: string; username: string; timestamp: number; target: string; }
interface FreqItem  { word: string; count: number; }
interface User      { id: string; displayName?: string; dashUsername?: string; email?: string; }
interface GitCommit { sha: string; shaFull: string; message: string; date: string; author: string; url: string; repo: string; }

// ── Copy block ────────────────────────────────────────────────────────────────
function CopyBlock({ value, label, color = '#30BFFF' }: { value: string; label: string; color?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      className="w-full text-left px-4 py-3 rounded-xl font-mono text-xs sm:text-sm break-all transition-all hover:opacity-90 active:scale-[0.99]"
      style={{ background: `${color}08`, border: `1px solid ${color}25`, color }}>
      <span className="text-white/25 text-[10px] block mb-1 tracking-widest">{label} — tap to copy</span>
      {value}{copied && <span className="text-green-400 ml-2 font-bold">✓ Copied!</span>}
    </button>
  );
}

// ── Word cloud ────────────────────────────────────────────────────────────────
function WordCloud({ freq, color = '#00FFC8' }: { freq: FreqItem[]; color?: string }) {
  if (!freq.length) return (
    <div className="py-10 text-center text-white/20 text-sm font-mono">No words yet. Be first.</div>
  );
  const max = freq[0]?.count || 1;
  const palette = ['#00FFC8', '#30BFFF', '#a78bfa', '#FFD700', '#00FF88', '#FF6B9D', '#FF9F43'];
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 justify-center p-4 sm:p-6">
      {freq.slice(0, 60).map((item, i) => {
        const ratio = item.count / max;
        const size  = 0.7 + ratio * 1.6; // 0.7rem → 2.3rem
        const c     = palette[i % palette.length];
        return (
          <span key={item.word} className="font-black transition-all duration-200 cursor-default select-none hover:scale-110"
            style={{ fontSize: `${size}rem`, color: c, opacity: 0.5 + ratio * 0.5, lineHeight: 1.2,
              textShadow: ratio > 0.5 ? `0 0 20px ${c}50` : undefined }}>
            {item.word}
            {item.count > 1 && <sup className="text-[0.45em] opacity-60 ml-0.5">{item.count}</sup>}
          </span>
        );
      })}
    </div>
  );
}

// ── Word stream ───────────────────────────────────────────────────────────────
function WordStream({ words, color = '#00FFC8', emptyText = 'No words yet' }: { words: WordEntry[]; color: string; emptyText?: string }) {
  if (!words.length) return <div className="py-8 text-center text-white/20 text-xs font-mono">{emptyText}</div>;
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scroll">
      {words.slice(0, 50).map((w, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
          style={{ background: i === 0 ? `${color}08` : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? color + '20' : 'rgba(255,255,255,0.04)'}` }}>
          <div className="flex items-center gap-2 min-w-0">
            {i === 0 && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${color}15`, color }}>NEW</span>}
            <span className="font-bold text-sm" style={{ color }}>{w.word}</span>
            <span className="text-white/30 text-xs truncate">— {w.username}</span>
          </div>
          <span className="text-white/15 text-[10px] font-mono flex-shrink-0">
            {new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Word submit form ──────────────────────────────────────────────────────────
function WordForm({ user, target, onSubmit, color, label }: {
  user: User | null; target: 'current' | 'next'; onSubmit: (w: string, t: 'current'|'next') => void; color: string; label: string;
}) {
  const [word,    setWord]    = useState('');
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState('');
  const [err,     setErr]     = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;
    setLoading(true); setMsg(''); setErr('');
    try {
      const r = await fetch('/api/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word: word.trim(), target }) });
      const d = await r.json();
      if (!r.ok || d.error) { setErr(d.error || 'Failed'); }
      else { setMsg(`✓ "${word.trim()}" submitted!`); setWord(''); onSubmit(word.trim(), target); }
    } catch { setErr('Network error. Try again.'); }
    setLoading(false);
  };

  if (!user) return (
    <div className="text-center py-5 text-xs text-white/30 font-mono">
      <a href="/account" className="underline hover:text-white transition-colors" style={{ color }}>Sign in</a> to submit your word
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <input type="text" value={word} onChange={e => setWord(e.target.value.replace(/\s+/g, '').toLowerCase())}
          placeholder={`one word for the ${label}…`} maxLength={32}
          className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}25` }}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button type="submit" disabled={loading || !word.trim()}
          className="px-4 sm:px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-30 flex-shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}>
          {loading ? '…' : 'Drop It'}
        </button>
      </div>
      {msg && <div className="text-xs font-mono px-3" style={{ color }}>{msg}</div>}
      {err && <div className="text-xs font-mono px-3 text-red-400">{err}</div>}
    </form>
  );
}

// ── Floating orb bg ───────────────────────────────────────────────────────────
function PageOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute rounded-full" style={{ width: 600, height: 600, top: '-200px', left: '-200px', background: 'radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 70%)' }} />
      <div className="absolute rounded-full" style={{ width: 500, height: 500, bottom: '10%', right: '-150px', background: 'radial-gradient(circle, rgba(0,212,170,0.04) 0%, transparent 70%)' }} />
      <div className="absolute rounded-full" style={{ width: 400, height: 400, top: '40%', left: '30%', background: 'radial-gradient(circle, rgba(0,141,228,0.03) 0%, transparent 70%)' }} />
    </div>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────
function Divider({ color = 'rgba(255,255,255,0.06)' }: { color?: string }) {
  return <div className="w-full h-px my-0" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ContributePage() {
  const [user,        setUser]        = useState<User | null>(null);
  const [wordData,    setWordData]    = useState<{
    currentWords: WordEntry[]; nextWords: WordEntry[];
    currentFreq: FreqItem[];  nextFreq: FreqItem[];
    currentLotteryTitle?: string;
  } | null>(null);
  const [wordTab,     setWordTab]     = useState<'current' | 'next' | 'cloud'>('cloud');
  const [reserveBal,  setReserveBal]  = useState<number | null>(null);
  const [mounted,     setMounted]     = useState(false);
  const [commit,      setCommit]      = useState<GitCommit | null>(null);

  const contractId = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_TIMELY_CONTRACT_ID || '')
    : '';

  const loadWords = useCallback(() => {
    fetch('/api/words?target=all').then(r => r.json()).then(setWordData).catch(() => {});
  }, []);

  useEffect(() => {
    setMounted(true);
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user || null)).catch(() => {});
    loadWords();
    fetch('/api/reserve/balance').then(r => r.json()).then(d => setReserveBal(d.liveBalance ?? null)).catch(() => {});
    fetch('/api/github-commit').then(r => r.json()).then(setCommit).catch(() => {});
  }, [loadWords]);

  const onWordSubmit = useCallback(() => {
    setTimeout(loadWords, 400);
  }, [loadWords]);

  const allFreq = wordData ? [
    ...wordData.currentFreq, ...wordData.nextFreq
  ].reduce((acc: FreqItem[], item) => {
    const ex = acc.find(a => a.word === item.word);
    if (ex) ex.count += item.count; else acc.push({ ...item });
    return acc;
  }, []).sort((a, b) => b.count - a.count) : [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(160deg, #020208 0%, #03020e 40%, #020810 100%)' }}>
      <PageOrbs />

      {/* ══════════════════════════════ HERO ═══════════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 pt-12 sm:pt-16 pb-14 sm:pb-20 text-center overflow-hidden">
        {/* Top shimmer line */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.6), transparent)' }} />

        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-[10px] font-mono font-bold tracking-[0.2em]"
            style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa' }}>
            ✦ THE FOUNDATION · THE MOVEMENT · THE MISSION
          </div>

          <h1 className="font-black leading-none tracking-tight mb-6">
            <span className="block text-white" style={{ fontSize: 'clamp(2.2rem, 9vw, 5.5rem)' }}>This Is Our</span>
            <span className="block" style={{ fontSize: 'clamp(2.8rem, 12vw, 7rem)', background: 'linear-gradient(135deg, #a78bfa, #00FFC8, #30BFFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Contribute Page.
            </span>
          </h1>

          <p className="text-white/50 leading-relaxed max-w-xl mx-auto mb-8" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)' }}>
            Every ticket you buy is a declaration. Every word you drop is a signal.
            Every DASH you send is a vote for a world where{' '}
            <em className="text-white/80">founders fund each other</em>.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <a href="/lottery"
              className="px-6 py-3 rounded-xl font-bold transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(0,255,200,0.15))', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa' }}>
              ⚡ Enter the Lottery
            </a>
            <a href="/reserve"
              className="px-6 py-3 rounded-xl font-bold transition-all hover:scale-105"
              style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)', color: '#00D4AA' }}>
              🏦 The Reserve →
            </a>
          </div>
        </div>
      </section>

      <Divider color="rgba(167,139,250,0.12)" />

      {/* ══════════════════ LATEST GITHUB COMMIT ══════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-8 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,255,200,0.04), rgba(48,191,255,0.04))', border: '1px solid rgba(0,255,200,0.18)' }}>
            {/* Top glow line */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,200,0.6), rgba(48,191,255,0.4), transparent)' }} />
            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Icon + label */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: 'rgba(0,255,200,0.08)', border: '1px solid rgba(0,255,200,0.2)' }}>
                    ⬡
                  </div>
                  <div>
                    <div className="text-[9px] font-mono font-bold tracking-[0.2em] mb-0.5" style={{ color: 'rgba(0,255,200,0.5)' }}>LATEST COMMIT</div>
                    <div className="text-[11px] font-mono font-bold" style={{ color: '#00FFC8' }}>
                      Open Source. Verifiable. Yours.
                    </div>
                  </div>
                </div>

                {/* Commit info */}
                <div className="flex-1 min-w-0 sm:border-l sm:pl-4" style={{ borderColor: 'rgba(0,255,200,0.12)' }}>
                  {commit ? (
                    <>
                      <div className="text-white/80 text-sm font-medium leading-snug truncate mb-1">
                        {commit.message}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono">
                        <a href={commit.url} target="_blank" rel="noopener noreferrer"
                          className="hover:opacity-80 transition-opacity"
                          style={{ color: '#30BFFF' }}>
                          #{commit.sha}
                        </a>
                        <span className="text-white/25">·</span>
                        <span className="text-white/35">
                          {new Date(commit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-white/25">·</span>
                        <a href={commit.repo} target="_blank" rel="noopener noreferrer"
                          className="hover:opacity-80 transition-opacity text-white/40 hover:text-white/60">
                          InitiumBuilders/timely-lottery ↗
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="text-white/30 text-sm font-mono animate-pulse">Loading latest commit…</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Divider color="rgba(0,255,200,0.08)" />

      {/* ══════════════════ YOUR INITIUM, ON-CHAIN ════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-14 sm:py-20 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute rounded-full" style={{ width: 700, height: 400, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'radial-gradient(ellipse, rgba(0,255,200,0.03) 0%, rgba(48,191,255,0.02) 40%, transparent 70%)' }} />
        </div>

        <div className="max-w-4xl mx-auto relative">
          {/* Section header */}
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full text-[10px] font-mono font-bold tracking-[0.2em]"
              style={{ background: 'rgba(48,191,255,0.08)', border: '1px solid rgba(48,191,255,0.25)', color: '#30BFFF' }}>
              ⛓ DASH DRIVE · DECENTRALIZED STORAGE
            </div>
            <h2 className="font-black leading-tight mb-4" style={{ fontSize: 'clamp(1.8rem, 6vw, 3.5rem)' }}>
              <span className="text-white">Your Initium,</span>{' '}
              <span style={{ background: 'linear-gradient(135deg, #00FFC8, #30BFFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>On-Chain.</span>
            </h2>
            <p className="text-white/50 leading-relaxed max-w-2xl mx-auto" style={{ fontSize: 'clamp(0.95rem, 2.2vw, 1.1rem)' }}>
              When you register an Initium here, it lives on{' '}
              <span className="text-white/70 font-semibold">Dash Drive</span> — Dash&apos;s decentralized storage layer.{' '}
              No server can delete it. No company can lose it.{' '}
              <em className="text-white/80">Your idea, on-chain.</em>
            </p>
          </div>

          {/* Flow diagram */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-12 text-sm font-mono">
            {[
              { label: 'Your Initium', icon: '💡', color: '#a78bfa' },
              { label: '→', icon: null, color: 'rgba(255,255,255,0.2)' },
              { label: 'Timely.Works', icon: '⚡', color: '#FFD700' },
              { label: '→', icon: null, color: 'rgba(255,255,255,0.2)' },
              { label: 'Dash Drive', icon: '🔵', color: '#30BFFF' },
              { label: '→', icon: null, color: 'rgba(255,255,255,0.2)' },
              { label: 'Forever', icon: '∞', color: '#00FFC8' },
            ].map((step, i) => step.icon ? (
              <div key={i} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl"
                style={{ background: `${step.color}08`, border: `1px solid ${step.color}25` }}>
                <span>{step.icon}</span>
                <span style={{ color: step.color }}>{step.label}</span>
              </div>
            ) : (
              <span key={i} className="text-lg font-light" style={{ color: step.color }}>{step.label}</span>
            ))}
          </div>

          {/* Three cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-10">
            {/* Card 1: Permanent */}
            <div className="rounded-2xl p-5 sm:p-6 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(0,255,200,0.06), rgba(0,255,200,0.02))', border: '1px solid rgba(0,255,200,0.18)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,200,0.5), transparent)' }} />
              <div className="text-3xl mb-3">∞</div>
              <h3 className="text-white font-bold text-base mb-2">Permanent Address</h3>
              <p className="text-white/45 text-sm leading-relaxed">
                Every Initium gets a permanent address on the Dash blockchain. No domain. No hosting. No expiry. It simply exists.
              </p>
            </div>

            {/* Card 2: No Server */}
            <div className="rounded-2xl p-5 sm:p-6 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(48,191,255,0.06), rgba(48,191,255,0.02))', border: '1px solid rgba(48,191,255,0.18)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(48,191,255,0.5), transparent)' }} />
              <div className="text-3xl mb-3">🔓</div>
              <h3 className="text-white font-bold text-base mb-2">No Server Required</h3>
              <p className="text-white/45 text-sm leading-relaxed">
                Anyone can query your Initium directly from Dash Drive via DAPI — without going through our servers. The data is yours.
              </p>
            </div>

            {/* Card 3: Open Protocol */}
            <div className="rounded-2xl p-5 sm:p-6 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(167,139,250,0.02))', border: '1px solid rgba(167,139,250,0.18)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)' }} />
              <div className="text-3xl mb-3">📄</div>
              <h3 className="text-white font-bold text-base mb-2">Open Data Contract</h3>
              <p className="text-white/45 text-sm leading-relaxed">
                A Data Contract is like a public schema — it defines the exact shape of the data stored on-chain. The network enforces it. No one can change it.
              </p>
            </div>
          </div>

          {/* Contract ID card */}
          <div className="rounded-2xl p-5 sm:p-6 mb-6 relative overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-mono font-bold tracking-[0.2em] mb-2" style={{ color: 'rgba(48,191,255,0.5)' }}>
                  ⛓ DATA CONTRACT
                </div>
                <div className="font-mono text-sm break-all mb-1"
                  style={{ color: contractId ? '#30BFFF' : 'rgba(255,255,255,0.2)' }}>
                  {contractId || 'Coming soon — testnet active'}
                </div>
                <div className="text-[11px] text-white/30 font-mono">
                  {contractId
                    ? 'Live on Dash Platform — fully verifiable'
                    : 'Run platform/contracts/register.mjs to activate'}
                </div>
              </div>
              {contractId && (
                <a href={`https://platform-explorer.pshenmic.dev/dataContract/${contractId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: 'rgba(48,191,255,0.1)', border: '1px solid rgba(48,191,255,0.25)', color: '#30BFFF' }}>
                  View on Explorer ↗
                </a>
              )}
            </div>
          </div>

          {/* Query section */}
          <div className="rounded-2xl p-5 sm:p-6 relative overflow-hidden"
            style={{ background: 'rgba(0,255,200,0.03)', border: '1px solid rgba(0,255,200,0.1)' }}>
            <div className="text-[9px] font-mono font-bold tracking-[0.2em] mb-3" style={{ color: 'rgba(0,255,200,0.5)' }}>
              QUERY FROM ANYWHERE
            </div>
            <div className="font-mono text-xs sm:text-sm text-white/60 bg-black/30 rounded-xl p-4 mb-3 overflow-x-auto">
              <span className="text-white/30">GET</span>{' '}
              <span style={{ color: '#00FFC8' }}>https://timely.works/api/platform/initiums</span>
              <br />
              <span className="text-white/30">GET</span>{' '}
              <span style={{ color: '#00FFC8' }}>https://timely.works/api/platform/initiums?slug=your-initium</span>
            </div>
            <p className="text-white/35 text-xs font-mono">
              No API key. No auth. The data is public on Dash Drive — we just make it easy to reach.
            </p>
          </div>

          {/* Bottom tagline */}
          <div className="text-center mt-10">
            <p className="text-white/30 text-sm font-mono italic">
              &ldquo;This is what decentralized infrastructure looks like.&rdquo;
            </p>
            <a href="https://platform-explorer.pshenmic.dev" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-mono hover:opacity-80 transition-opacity"
              style={{ color: 'rgba(48,191,255,0.5)' }}>
              Explore Dash Platform → platform-explorer.pshenmic.dev ↗
            </a>
          </div>
        </div>
      </section>

      <Divider color="rgba(48,191,255,0.08)" />

      {/* ═══════════════════════════ TICKET + VOTUS ════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[10px] font-mono tracking-[0.2em] mb-3" style={{ color: 'rgba(255,200,0,0.6)' }}>// HOW YOUR DASH WORKS</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">0.1 $DASH Unlocks Two Things</h2>
            <p className="text-white/35 text-sm mt-2 max-w-md mx-auto">Every ticket purchase is both a bet and a voice.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
            {/* Ticket */}
            <div className="relative rounded-2xl p-6 sm:p-8 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(255,200,0,0.06), rgba(255,140,0,0.04))', border: '1px solid rgba(255,200,0,0.2)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,200,0,0.5), transparent)' }} />
              <div className="text-4xl mb-4">🎟</div>
              <div className="text-[10px] font-mono font-bold tracking-widest mb-2" style={{ color: 'rgba(255,200,0,0.7)' }}>1 LOTTERY TICKET</div>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-3">0.1 $DASH = 1 Ticket</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Each ticket is your shot at the pool. Stack more tickets to increase your weighted probability. 10 tickets = 10× better odds.
              </p>
              <div className="space-y-2">
                {['Weighted random selection at draw', 'Community upvotes = bonus tickets', 'More tickets = more chances to win'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-white/40">
                    <span className="text-[10px]" style={{ color: '#FFD700' }}>◆</span>{f}
                  </div>
                ))}
              </div>
            </div>

            {/* Votus */}
            <div className="relative rounded-2xl p-6 sm:p-8 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(0,255,200,0.06), rgba(0,141,228,0.04))', border: '1px solid rgba(0,255,200,0.2)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,200,0.5), transparent)' }} />
              <div className="text-4xl mb-4">⬡</div>
              <div className="text-[10px] font-mono font-bold tracking-widest mb-2" style={{ color: 'rgba(0,255,200,0.7)' }}>1 VOTUS CREDIT</div>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-3">0.1 $DASH = 1 Votus</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Votus are your governance voice. Use them to vote for the Initiums you believe in — the projects you want to see win the pool.
              </p>
              <div className="space-y-2">
                {['Vote for projects in the active pool', 'Each Votus = 1 bonus ticket for that entry', 'Shapes who wins — community signals matter'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-white/40">
                    <span className="text-[10px]" style={{ color: '#00FFC8' }}>◆</span>{f}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary row */}
          <div className="rounded-2xl p-4 sm:p-5 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-white/50 text-sm font-mono">
              <span className="font-black text-white">0.1 $DASH</span>
              <span className="mx-2 text-white/20">=</span>
              <span style={{ color: '#FFD700' }}>🎟 1 Lottery Ticket</span>
              <span className="mx-2 text-white/20">+</span>
              <span style={{ color: '#00FFC8' }}>⬡ 1 Votus Credit</span>
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ══════════════════════════ SPLIT BREAKDOWN ════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[10px] font-mono tracking-[0.2em] mb-3" style={{ color: 'rgba(0,212,170,0.6)' }}>// WHERE EVERY DASH GOES</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">The Timely Split</h2>
            <p className="text-white/35 text-sm mt-2 max-w-sm mx-auto">Transparent, automatic, on-chain. No exceptions.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { pct: '85%', label: 'The Winner', sub: '85% of the Timely Lottery Pool goes to the winner — auto-paid on-chain the moment the lottery ends.', color: '#F59E0B', icon: '🏆', who: 'Winner Takes' },
              { pct: '10%', label: 'The Reserve', sub: 'Flows to The Timely Reserve — a permanent community fund for peace keeping, systems education, and the projects that matter.', color: '#00D4AA', icon: '🏦', who: 'Community Fund' },
              { pct: '5%',  label: 'Next Lottery', sub: '5% allocated to the next Timely Lottery pool. The pot keeps growing — every game seeded by the last.', color: '#008DE4', icon: '🌱', who: 'Seeds Next Round' },
            ].map(item => (
              <div key={item.pct} className="relative rounded-2xl p-5 sm:p-6 text-center overflow-hidden"
                style={{ background: `${item.color}06`, border: `1px solid ${item.color}20` }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-px" style={{ background: `linear-gradient(90deg, transparent, ${item.color}60, transparent)` }} />
                <div className="text-4xl sm:text-5xl font-black font-mono mb-1 leading-none" style={{ color: item.color }}>{item.pct}</div>
                <div className="font-black text-white text-base mb-0.5">{item.icon} {item.label}</div>
                <div className="text-[9px] font-mono tracking-widest mb-3" style={{ color: `${item.color}60` }}>{item.who}</div>
                <p className="text-xs leading-relaxed text-white/40">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="text-center text-[10px] font-mono text-white/15 tracking-widest">
            SPLIT EXECUTED AUTOMATICALLY · EVERY DEPOSIT · IMMEDIATELY ON CONFIRMATION
          </div>
        </div>
      </section>

      <Divider />

      {/* ════════════════════════ THE RESERVE STRUCTURE ════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[10px] font-mono tracking-[0.2em] mb-3" style={{ color: 'rgba(0,212,170,0.6)' }}>// THE TIMELY RESERVE</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              A Permanent Fund.<br /><span style={{ color: '#00D4AA' }}>For The People.</span>
            </h2>
            <p className="text-white/40 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              10% of every lottery flows here — automatically, forever. The Reserve is not a company account. It is a community commons, governed by the same founders who built it.
            </p>
          </div>

          {/* Live balance */}
          {reserveBal !== null && (
            <div className="text-center mb-10">
              <div className="inline-block rounded-2xl px-8 py-5"
                style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)' }}>
                <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(0,212,170,0.6)' }}>LIVE RESERVE BALANCE</div>
                <div className="text-4xl sm:text-5xl font-black font-mono" style={{ color: '#00D4AA' }}>
                  {reserveBal.toFixed(4)} <span className="text-2xl opacity-60">DASH</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-1 text-xs font-mono" style={{ color: 'rgba(0,212,170,0.5)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />On-chain · Verified
                </div>
              </div>
            </div>
          )}

          {/* Reserve purposes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-10">
            {[
              { icon: '🕊️', title: 'Peace Keeping', desc: 'NVC-powered conflict resolution + digital dialogue infrastructure', color: '#63DCB4' },
              { icon: '🔂', title: 'Systems Education', desc: 'Semble partnership — teaching communities to See, Map, Move, Make', color: '#a78bfa' },
              { icon: '🛡', title: 'Security Audits', desc: 'Fund smart contract audits for community-critical protocols', color: '#30BFFF' },
              { icon: '🌱', title: 'Altruistic Projects', desc: 'Community-nominated impact projects that create real-world good', color: '#4ade80' },
              { icon: '🏛', title: 'Democratic Infrastructure', desc: 'On-chain voting, DAOs, Votus, and civic participation tools', color: '#FFD700' },
              { icon: '🚀', title: 'Timely Startups', desc: 'Seed funding for early founders building with values', color: '#FF9F43' },
            ].map((p, i) => (
              <div key={i} className="rounded-xl p-4 transition-all hover:-translate-y-0.5 duration-200"
                style={{ background: `${p.color}06`, border: `1px solid ${p.color}18` }}>
                <div className="text-xl mb-2">{p.icon}</div>
                <div className="font-bold text-xs sm:text-sm mb-1" style={{ color: p.color }}>{p.title}</div>
                <p className="text-[10px] sm:text-xs leading-relaxed text-white/40">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Crowdfunding / direct contribute to reserve */}
          <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.05), rgba(0,141,228,0.04))', border: '1px solid rgba(0,212,170,0.2)' }}>
            <div className="p-6 sm:p-8 md:p-10">
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 items-start">
                <div className="flex-1">
                  <div className="text-[10px] font-mono font-bold tracking-widest mb-3" style={{ color: 'rgba(0,212,170,0.7)' }}>CONTRIBUTE DIRECTLY TO THE RESERVE</div>
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-3">Run a Campaign. Fund the Commons.</h3>
                  <p className="text-white/50 text-sm leading-relaxed mb-4">
                    Anyone can contribute directly to The Timely Reserve. Individuals, organizations, and communities can run crowdfunding campaigns in service of the fund — nominating specific causes, rallying their networks, and building the commons together.
                  </p>
                  <div className="space-y-2 mb-6">
                    {[
                      { icon: '🎯', text: 'Nominate a cause — propose how the reserve should be deployed' },
                      { icon: '📢', text: 'Rally your community — share the reserve address with your people' },
                      { icon: '🔍', text: 'Verify on-chain — every contribution is publicly auditable' },
                      { icon: '🗳️', text: 'Vote on allocation — Votus governance determines deployment' },
                    ].map((f, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-white/45">
                        <span className="text-base flex-shrink-0">{f.icon}</span>{f.text}
                      </div>
                    ))}
                  </div>
                  <CopyBlock value={RESERVE_ADDR} label="TIMELY RESERVE ADDRESS" color="#00D4AA" />
                </div>
                <div className="flex-shrink-0 flex flex-col items-center gap-3">
                  <div className="p-4 bg-white rounded-2xl" style={{ boxShadow: '0 0 40px rgba(0,212,170,0.2)' }}>
                    <QRCodeSVG value={`dash:${RESERVE_ADDR}`} size={140} level="M" />
                  </div>
                  <div className="text-[10px] font-mono text-center text-white/30">Scan to fund the reserve</div>
                  <a href="/reserve" className="text-xs font-bold px-4 py-2 rounded-xl transition-all hover:scale-105"
                    style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.25)', color: '#00D4AA' }}>
                    🏦 Full Reserve Page →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ═══════════════════════════ ONE WORD FEATURE ══════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-[10px] font-mono tracking-[0.2em] mb-3" style={{ color: 'rgba(167,139,250,0.6)' }}>// THE WORD DROP</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Drop One Word.<br /><span style={{ color: '#a78bfa' }}>Shape What's Next.</span>
            </h2>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
              Every signed-in founder gets one word per lottery. Use it for the current pool or the next one. Together, our words become a map of what this community cares about.
            </p>
          </div>

          {/* Submit forms — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
            {/* Current lottery */}
            <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'rgba(255,200,0,0.04)', border: '1px solid rgba(255,200,0,0.15)' }}>
              <div className="text-[9px] font-mono font-bold tracking-widest mb-1" style={{ color: 'rgba(255,200,0,0.7)' }}>CURRENT LOTTERY</div>
              <h3 className="text-base font-black text-white mb-1">
                {wordData?.currentLotteryTitle || 'Active Pool'}
              </h3>
              <p className="text-white/35 text-xs mb-4">Drop one word for the active lottery — your signal for what this round means to you.</p>
              <WordForm user={user} target="current" onSubmit={onWordSubmit} color="#FFD700" label="current lottery" />
            </div>

            {/* Next lottery */}
            <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)' }}>
              <div className="text-[9px] font-mono font-bold tracking-widest mb-1" style={{ color: 'rgba(167,139,250,0.7)' }}>NEXT LOTTERY</div>
              <h3 className="text-base font-black text-white mb-1">The One After This</h3>
              <p className="text-white/35 text-xs mb-4">Submit a theme, vision, or direction for the next lottery. What should it be about?</p>
              <WordForm user={user} target="next" onSubmit={onWordSubmit} color="#a78bfa" label="next lottery" />
            </div>
          </div>

          {/* Word visualization tabs */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Tab bar */}
            <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {[
                { k: 'cloud',   label: '☁️ Word Cloud' },
                { k: 'current', label: '🎟 Current' },
                { k: 'next',    label: '🔮 Next' },
              ].map(t => (
                <button key={t.k} onClick={() => setWordTab(t.k as 'current'|'next'|'cloud')}
                  className="flex-1 py-3 text-xs sm:text-sm font-semibold transition-all"
                  style={{
                    background: wordTab === t.k ? 'rgba(255,255,255,0.04)' : 'transparent',
                    color: wordTab === t.k ? '#fff' : 'rgba(255,255,255,0.35)',
                    borderBottom: wordTab === t.k ? '2px solid #a78bfa' : '2px solid transparent',
                  }}>
                  {t.label}
                  {t.k === 'current' && wordData && <span className="ml-1.5 text-[9px] opacity-60">({wordData.currentWords.length})</span>}
                  {t.k === 'next'    && wordData && <span className="ml-1.5 text-[9px] opacity-60">({wordData.nextWords.length})</span>}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 min-h-[200px]">
              {wordTab === 'cloud' && <WordCloud freq={allFreq} />}
              {wordTab === 'current' && (
                <WordStream
                  words={wordData?.currentWords || []}
                  color="#FFD700"
                  emptyText="No words submitted for this lottery yet. Be first."
                />
              )}
              {wordTab === 'next' && (
                <WordStream
                  words={wordData?.nextWords || []}
                  color="#a78bfa"
                  emptyText="No words for the next lottery yet. Shape it."
                />
              )}
            </div>
          </div>

          {!user && (
            <div className="text-center mt-5 text-xs text-white/25 font-mono">
              <a href="/account" className="text-purple-400/70 hover:text-purple-400 underline transition-colors">Create a free account</a> to drop your word
            </div>
          )}
        </div>
      </section>

      <Divider />

      {/* ══════════════════════════ SUPPORT THE PLATFORM ═══════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[10px] font-mono tracking-[0.2em] mb-3" style={{ color: 'rgba(0,141,228,0.6)' }}>// SUPPORT THE PLATFORM</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Keep the Engine Running</h2>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
              Timely.Works is independently built and maintained. Your contributions go directly to development, infrastructure, and the mission of making founder funding radically accessible.
            </p>
          </div>

          <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(0,141,228,0.04)', border: '1px solid rgba(0,141,228,0.2)' }}>
            <div className="p-6 sm:p-8 md:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* QR + address */}
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-white rounded-2xl" style={{ boxShadow: '0 0 40px rgba(0,141,228,0.25)' }}>
                    <QRCodeSVG value={`dash:${TIP_ADDRESS}`} size={155} level="M" />
                  </div>
                  <div className="text-[10px] font-mono text-white/30 text-center">Scan with any Dash wallet</div>
                  <div className="text-center">
                    <div className="text-xs font-mono text-white/25 mb-1 tracking-widest">OR SEND TO</div>
                    <div className="text-xl font-black" style={{ color: '#30BFFF' }}>@August</div>
                    <div className="text-[10px] text-white/25 font-mono">Dash Evolution username</div>
                  </div>
                </div>

                {/* Info + copy */}
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-mono font-bold tracking-widest mb-2" style={{ color: 'rgba(0,141,228,0.7)' }}>WHERE YOUR SUPPORT GOES</div>
                    <div className="space-y-2">
                      {[
                        { icon: '🖥️', text: 'VPS & infrastructure costs' },
                        { icon: '⚡', text: 'New features and improvements' },
                        { icon: '🛡', text: 'Security, audits, and maintenance' },
                        { icon: '🌱', text: 'The mission — accessible founder funding' },
                      ].map((f, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm text-white/45">
                          <span className="text-base">{f.icon}</span>{f.text}
                        </div>
                      ))}
                    </div>
                  </div>
                  <CopyBlock value={TIP_ADDRESS} label="PLATFORM DASH ADDRESS" color="#30BFFF" />
                  <div className="text-[10px] font-mono text-white/20 text-center">All contributions verified on-chain · Direct to platform development</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ══════════════════════════════ THE BUILDER ════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-5xl mx-auto">

          {/* Section label */}
          <div className="text-center mb-10 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-mono tracking-[0.2em] mb-4"
              style={{ background: 'rgba(0,255,200,0.06)', border: '1px solid rgba(0,255,200,0.2)', color: 'rgba(0,255,200,0.7)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFC8] animate-pulse flex-shrink-0" />
              BUILDER.ID // VERIFIED
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">The Builder Behind<br />
              <span style={{ background: 'linear-gradient(135deg, #00FFC8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Timely.Works
              </span>
            </h2>
          </div>

          {/* ── BUILDER CARD ── */}
          <div className="relative rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(0,8,20,0.98) 0%, rgba(3,3,22,0.98) 100%)',
              border: '1px solid rgba(0,255,200,0.22)',
              boxShadow: '0 0 80px rgba(0,255,200,0.07), 0 0 40px rgba(167,139,250,0.05), inset 0 0 60px rgba(0,0,0,0.5)',
            }}>

            {/* Top glow strip */}
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(0,255,200,0.6) 30%, rgba(167,139,250,0.5) 70%, transparent 95%)' }} />
            {/* Subtle grid overlay */}
            <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
              style={{ backgroundImage: 'linear-gradient(rgba(0,255,200,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,200,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <div className="flex flex-col lg:flex-row">

              {/* ── PHOTO COLUMN ── */}
              <div className="lg:w-[360px] xl:w-[400px] flex-shrink-0 relative">
                <div className="relative overflow-hidden"
                  style={{ minHeight: 420, height: '100%' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/august-james.jpg"
                    alt="August James — Founder, Timely.Works"
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: 'center top',
                      minHeight: 420,
                      filter: 'contrast(1.08) brightness(0.9)',
                    }}
                  />
                  {/* Right-edge gradient fade into card */}
                  <div className="absolute inset-0 hidden lg:block"
                    style={{ background: 'linear-gradient(to right, transparent 55%, rgba(0,8,20,0.98) 100%)' }} />
                  {/* Bottom gradient */}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(0,8,20,0.85) 0%, transparent 35%)' }} />

                  {/* Corner scanner UI decorations */}
                  {[
                    'top-4 left-4 border-t-2 border-l-2',
                    'top-4 right-4 border-t-2 border-r-2 hidden lg:block',
                    'bottom-4 left-4 border-b-2 border-l-2',
                    'bottom-4 right-4 border-b-2 border-r-2 hidden lg:block',
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-6 h-6 ${cls}`}
                      style={{ borderColor: 'rgba(0,255,200,0.55)' }} />
                  ))}

                  {/* Photo bottom label (mobile only) */}
                  <div className="absolute bottom-0 left-0 right-0 p-5 lg:hidden">
                    <div className="text-[9px] font-mono text-[#00FFC8]/60 tracking-widest mb-1">ID // BUILDER</div>
                    <div className="text-2xl font-black text-white">August James</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#00FFC8' }}>@BuiltByAugust · Founder</div>
                  </div>

                  {/* Scan line animation */}
                  <div className="absolute left-0 right-0 h-px opacity-30 animate-pulse"
                    style={{ top: '30%', background: 'linear-gradient(90deg, transparent, rgba(0,255,200,0.8), transparent)' }} />
                </div>
              </div>

              {/* ── CONTENT COLUMN ── */}
              <div className="flex-1 p-6 sm:p-8 lg:p-10 flex flex-col gap-5">

                {/* Identity header (desktop) */}
                <div className="hidden lg:block">
                  <div className="text-[9px] font-mono tracking-[0.3em] mb-2" style={{ color: 'rgba(0,255,200,0.4)' }}>
                    BUILDER.ID / / VERIFIED ◈
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mb-1.5">
                    <h3 className="text-3xl font-black text-white leading-none">August James</h3>
                    <span className="text-[10px] font-mono px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(0,255,200,0.08)', border: '1px solid rgba(0,255,200,0.3)', color: '#00FFC8' }}>
                      @BuiltByAugust
                    </span>
                  </div>
                  <p className="text-sm font-mono" style={{ color: 'rgba(0,255,200,0.55)' }}>
                    Founder, Timely.Works · Emergent Strategist · Systems Thinker
                  </p>
                </div>

                {/* Role tags */}
                <div className="flex flex-wrap gap-1.5">
                  {['Emergent Strategist', 'Systems Thinker', 'Founder', 'Educator', 'Builder', 'Musician', 'Pacifist', 'Semble Creator', 'Dash DAO', 'Dreamer'].map((t, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold"
                      style={{
                        background: i % 3 === 0 ? 'rgba(0,255,200,0.07)' : i % 3 === 1 ? 'rgba(167,139,250,0.07)' : 'rgba(0,141,228,0.07)',
                        border: `1px solid ${i % 3 === 0 ? 'rgba(0,255,200,0.2)' : i % 3 === 1 ? 'rgba(167,139,250,0.2)' : 'rgba(0,141,228,0.2)'}`,
                        color: i % 3 === 0 ? '#00FFC8' : i % 3 === 1 ? '#a78bfa' : '#30BFFF',
                      }}>
                      {t}
                    </span>
                  ))}
                </div>

                {/* Bio */}
                <div className="space-y-3 text-white/55 text-sm leading-relaxed">
                  <p>
                    August James is a <strong className="text-white/85">lifelong learner, teacher first</strong> — a builder who believes that the most important infrastructure we can create helps people trust each other, fund each other, and see each other more clearly.
                  </p>
                  <p>
                    An <strong className="text-white/85">Emergent Strategist</strong> in the tradition of adrienne maree brown, studying for his <strong className="text-white/85">CSTA (Certified Systems Thinking Associate)</strong> in the Donella Meadows tradition. Creator of <strong className="text-white/85">Semble</strong> — the Emergent State — and founder of <strong className="text-white/85">Votus</strong> on-chain micro-democracy. <strong className="text-white/85">Dash DAO governance researcher</strong>. Musician. Future civic leader.
                  </p>
                </div>

                {/* ── SPOTIFY PLAYER ── */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ border: '1px solid rgba(29,185,84,0.25)', background: 'rgba(0,0,0,0.3)' }}>
                  <div className="flex items-center gap-2.5 px-4 pt-3 pb-1">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(29,185,84,0.2)', border: '1px solid rgba(29,185,84,0.4)' }}>
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#1db954">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: 'rgba(29,185,84,0.7)' }}>NOW PLAYING · CITY OF SOUL</div>
                    <a href="https://open.spotify.com/track/4HMdocxNTZSsPgDBuxn2nf?si=238f7bfbaedb4fa0"
                      target="_blank" rel="noreferrer"
                      className="ml-auto text-[10px] font-mono hover:opacity-100 transition-opacity"
                      style={{ color: 'rgba(29,185,84,0.5)' }}>
                      Open ↗
                    </a>
                  </div>
                  <iframe
                    src="https://open.spotify.com/embed/track/4HMdocxNTZSsPgDBuxn2nf?utm_source=generator&theme=0"
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    style={{ display: 'block' }}
                    title="City Of Soul by August James on Spotify"
                  />
                </div>

                {/* Social links */}
                <div className="flex flex-wrap gap-2.5">
                  <a href={X_URL} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff' }}>
                    <span>𝕏</span> @BuiltByAugust
                  </a>
                  <a href={SITE_URL} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
                    style={{ background: 'rgba(0,255,200,0.07)', border: '1px solid rgba(0,255,200,0.22)', color: '#00FFC8' }}>
                    🌐 AugustJames.Live
                  </a>
                  <a href="https://open.spotify.com/track/4HMdocxNTZSsPgDBuxn2nf?si=238f7bfbaedb4fa0"
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
                    style={{ background: 'rgba(29,185,84,0.08)', border: '1px solid rgba(29,185,84,0.25)', color: '#1db954' }}>
                    🎵 City of Soul
                  </a>
                </div>

              </div>
            </div>

            {/* ── QUOTE FOOTER STRIP ── */}
            <div className="border-t px-6 sm:px-10 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{ borderColor: 'rgba(0,255,200,0.1)', background: 'rgba(0,255,200,0.02)' }}>
              <p className="text-base sm:text-lg font-black italic" style={{ color: '#00FFC8' }}>
                &ldquo;I am small. I am strong. And I am always still learning.&rdquo;
              </p>
              <p className="text-white/25 text-[10px] font-mono flex-shrink-0">
                — August James · Founder, Timely.Works
              </p>
            </div>

            {/* Bottom glow strip */}
            <div className="absolute bottom-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(167,139,250,0.4) 40%, rgba(0,255,200,0.3) 70%, transparent 95%)' }} />
          </div>

          {/* Donella Meadows footer */}
          <div className="mt-5 text-center">
            <p className="text-white/20 text-[10px] font-mono tracking-widest">
              &ldquo;Hold fast to the goal of goodness. Keep standards absolute.&rdquo; — Donella Meadows
            </p>
          </div>

        </div>
      </section>

      {/* ════════════════════════════ OPEN SOURCE ════════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-mono font-bold tracking-widest"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00D4FF' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              OPEN SOURCE — V1.02
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Fork It.{' '}
              <span style={{ background: 'linear-gradient(135deg, #00D4FF, #00FFC8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Build Your Own.
              </span>
            </h2>
            <p className="text-white/35 text-sm max-w-xl mx-auto leading-relaxed">
              Timely.Works is fully open source — built on Dash Evolution, designed for the Dash community.
              Fork it, spin up your own lottery, build something new. The code is yours.
            </p>
          </div>

          {/* Main card */}
          <div className="rounded-3xl overflow-hidden"
            style={{ background: 'rgba(0,20,30,0.6)', border: '1px solid rgba(0,212,255,0.15)', backdropFilter: 'blur(20px)' }}>

            {/* Top bar — browser chrome style */}
            <div className="flex items-center justify-between px-5 py-3 border-b"
              style={{ background: 'rgba(0,212,255,0.05)', borderColor: 'rgba(0,212,255,0.12)' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#ffbd2e' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#27c93f' }} />
              </div>
              <a href="https://github.com/InitiumBuilders/timely-lottery" target="_blank" rel="noopener noreferrer"
                className="text-xs font-mono text-cyan-400/70 hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                InitiumBuilders/timely-lottery
              </a>
              <span className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.2)' }}>
                V1.02
              </span>
            </div>

            <div className="p-6 sm:p-8">
              {/* What + Quick Start */}
              <div className="grid sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-xs font-mono text-white/30 mb-3 tracking-widest">{'// WHAT YOU\'RE LOOKING AT'}</div>
                  <h3 className="text-lg font-bold text-white mb-2">Timely.Works</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-4">
                    A fully autonomous, DASH-powered community lottery. Built on Dash Evolution.
                    AI names each round. 85% goes to the winner — on-chain, transparent, verifiable.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Next.js 14', 'Dash SDK', 'DPNS Login', 'DAPI', 'PM2', 'SQLite'].map(tag => (
                      <span key={tag} className="text-xs font-mono px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)', color: '#00D4FF' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono text-white/30 mb-3 tracking-widest">{'// QUICK START'}</div>
                  <div className="rounded-xl p-4 font-mono text-xs leading-relaxed"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-cyan-400/60 mb-1"># clone the repo</div>
                    <div className="text-white/80">git clone github.com/</div>
                    <div className="text-white/80 ml-2">InitiumBuilders/timely-lottery</div>
                    <div className="text-cyan-400/60 mt-2 mb-1"># install + configure</div>
                    <div className="text-white/80">cp .env.example .env.local</div>
                    <div className="text-white/80">npm install</div>
                    <div className="text-cyan-400/60 mt-2 mb-1"># run it</div>
                    <div className="text-emerald-400">npm run dev</div>
                  </div>
                </div>
              </div>

              {/* Feature grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { icon: '🏗️', label: 'Dash Evolution', sub: 'DAPI + Data Contracts' },
                  { icon: '🤖', label: 'Auto Admin', sub: 'AI names each round' },
                  { icon: '🔑', label: 'DPNS Login', sub: 'username.dash auth' },
                  { icon: '⛓️', label: 'On-Chain Results', sub: '85/10/5 split' },
                ].map(f => (
                  <div key={f.label} className="p-3 rounded-xl text-center"
                    style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.08)' }}>
                    <div className="text-2xl mb-1">{f.icon}</div>
                    <div className="text-xs font-bold text-white/80">{f.label}</div>
                    <div className="text-xs text-white/30 mt-0.5">{f.sub}</div>
                  </div>
                ))}
              </div>

              {/* How to adapt */}
              <div className="rounded-xl p-5 mb-6"
                style={{ background: 'rgba(0,255,200,0.03)', border: '1px solid rgba(0,255,200,0.1)' }}>
                <div className="text-xs font-mono text-emerald-400/60 mb-3 tracking-widest">{'// BUILD YOUR OWN'}</div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { title: 'Fork & Customize', desc: 'Clone the repo. Swap colors, change lottery mechanics, adjust split percentages. The architecture is modular by design.' },
                    { title: 'Deploy on Your VPS', desc: 'Point a Dash HD wallet at your own mnemonic. Configure PM2. Add your admin password via .env. Your lottery is live in minutes.' },
                    { title: 'Build on Dash Evo', desc: 'Use the data contracts + DPNS login as a foundation. This is the first autonomous lottery on Dash Platform — be the second.' },
                  ].map(item => (
                    <div key={item.title}>
                      <div className="text-sm font-bold text-emerald-400 mb-1">{item.title}</div>
                      <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dash Evo Next Steps */}
              <div className="rounded-xl p-5 mb-6"
                style={{ background: 'rgba(0,141,228,0.04)', border: '1px solid rgba(0,141,228,0.15)' }}>
                <div className="text-xs font-mono mb-3 tracking-widest" style={{ color: 'rgba(0,141,228,0.6)' }}>{'// DASH EVOLUTION — NEXT STEPS'}</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    '🔲 Register data contracts on Dash Platform mainnet',
                    '🔲 Sync every lottery + result to Platform Documents',
                    '🔲 Full DPNS-only login (remove email option)',
                    '🔲 Verifiable Random Function (VRF) for provably fair draws',
                    '🔲 Identity-based ticket ownership proofs on-chain',
                    '🔲 Native DashPay + Timely.Works mobile integration',
                  ].map((step, i) => (
                    <div key={i} className="text-xs font-mono text-white/50 flex items-start gap-2">
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <a href="https://github.com/InitiumBuilders/timely-lottery/blob/main/DASH-EVOLUTION.md"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs font-mono font-bold transition-colors hover:opacity-80"
                  style={{ color: '#008DE4' }}>
                  Đ Read the full Dash Evolution docs →
                </a>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="https://github.com/InitiumBuilders/timely-lottery"
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,255,200,0.1))', border: '1px solid rgba(0,212,255,0.35)', color: '#00D4FF' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  View Source on GitHub
                </a>
                <a href="https://github.com/InitiumBuilders/timely-lottery/fork"
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
                  style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
                  🍴 Fork & Build Your Own
                </a>
                <a href="https://github.com/InitiumBuilders/timely-lottery/blob/main/DASH-EVOLUTION.md"
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all hover:scale-105"
                  style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)', color: '#00D4AA' }}>
                  Đ Dash Evo Docs →
                </a>
              </div>
            </div>

            {/* Footer bar */}
            <div className="px-6 py-3 border-t flex items-center justify-between flex-wrap gap-2"
              style={{ borderColor: 'rgba(0,212,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
              <span className="text-xs font-mono text-white/20">MIT License · Built by August James · Powered by $DASH</span>
              <span className="text-xs font-mono text-white/20">V1.02 · Dash Evolution Platform</span>
            </div>
          </div>

          <p className="text-center text-xs text-white/20 font-mono mt-6">
            The Dash community built the infrastructure. We built the first autonomous lottery on top of it. Now it&apos;s yours.
          </p>
        </div>
      </section>

      {/* ════════════════════════════ FINAL CTA ════════════════════════════ */}
      <section className="relative z-10 px-4 sm:px-6 py-12 sm:py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-white/20 text-xs font-mono tracking-[0.2em] mb-4">// THIS IS WHAT WE'RE BUILDING</p>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            A World Where Founders<br />
            <span style={{ background: 'linear-gradient(135deg, #a78bfa, #00FFC8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Fund Each Other.
            </span>
          </h2>
          <p className="text-white/35 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
            Timely.Works is proof of concept. That peer-to-peer funding works. That community signals are real. That trust — built in small interactions — becomes something powerful.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/lottery" className="px-8 py-4 rounded-2xl font-bold text-base transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(0,255,200,0.15))', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa' }}>
              ⚡ Enter the Lottery
            </a>
            <a href="/reserve" className="px-8 py-4 rounded-2xl font-bold text-base transition-all hover:scale-105"
              style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)', color: '#00D4AA' }}>
              🏦 The Reserve →
            </a>
          </div>
        </div>
      </section>

      {/* Bottom shimmer */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.3), transparent)' }} />

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.3); border-radius: 4px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
