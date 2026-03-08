'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// ── Types ──
interface ICard {
  source: 'lottery' | 'profile';
  entryId: string;
  lotteryId: string | null;
  lotteryTitle: string | null;
  lotteryStatus: string | null;
  isCurrentLottery: boolean;
  displayName?: string;
  dashUsername?: string;
  initiumTitle: string;
  initiumDescription?: string;
  initiumUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  totalTickets: number;
  dashContributed: number;
  isAnonymous?: boolean;
  createdAt: number;
  upvoteCount: number;
  slug?: string;
  initiumId?: string;
  viewCount: number;
  totalDashEarned: number;
  totalVotusEarned: number;
  totalWins: number;
  totalLotteries: number;
  dashAddress?: string;
}

interface DashBal { balance: number; totalReceived: number }

type ViewMode = 'carousel' | 'grid';
type SortOption = 'views' | 'dash' | 'votus' | 'newest' | 'wins';
type SectionOption = 'current' | 'all';

// ── Sound ──
const playSwipeSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch { /* silent fail */ }
};

// ── Styles ──
const slideStyles = `
@keyframes slideInLeft {
  from { transform: translateX(-60px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slideInRight {
  from { transform: translateX(60px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.slide-in-left { animation: slideInLeft 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
.slide-in-right { animation: slideInRight 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
`;

// ── Card Component ──
function InitiumCardComponent({
  card, size = 'carousel', onVotus, myEntry, votusMsg,
}: {
  card: ICard; size?: 'carousel' | 'grid'; onVotus?: (entryId: string) => void; myEntry?: any; loggedIn?: boolean; votusMsg?: string;
}) {
  const [showOg, setShowOg]       = useState(false);
  const [ogData, setOgData]       = useState<any>(null);
  const [copied, setCopied]       = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);
  const [dashBal, setDashBal]     = useState<DashBal | null>(null);
  const [balLoading, setBalLoading] = useState(false);
  const isCarousel = size === 'carousel';

  const hostname = card.initiumUrl
    ? (() => { try { return new URL(card.initiumUrl).hostname; } catch { return card.initiumUrl?.slice(0, 24); } })()
    : null;

  // Initium's own page link (via slug) OR fall back to external URL
  const initiumPageHref = card.slug ? `/i/${card.slug}` : null;
  const shareUrl = initiumPageHref ? `https://timely.works${initiumPageHref}` : card.initiumUrl || 'https://timely.works';

  // Display name: never show raw email — dashUsername takes priority
  const creatorLabel = card.dashUsername
    ? `@${card.dashUsername.replace(/^@/, '')}`
    : (card.displayName || 'Builder');

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: card.initiumTitle, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* */ }
  };

  const fetchOg = async () => {
    if (!card.initiumUrl || ogData) return;
    try {
      const r = await fetch(`/api/og-preview?url=${encodeURIComponent(card.initiumUrl)}`);
      setOgData(await r.json());
    } catch { /* */ }
  };

  // Lazy-load DASH address balance + auto-refresh every 30s
  useEffect(() => {
    const addr = card.dashAddress;
    if (!addr) return;

    const fetchBal = () => {
      fetch(`/api/initium/dash-balance?address=${addr}`)
        .then(r => r.json())
        .then(d => setDashBal(d))
        .catch(() => {})
        .finally(() => setBalLoading(false));
    };

    setBalLoading(true);
    fetchBal();
    const interval = setInterval(fetchBal, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [card.dashAddress]);

  const copyAddr = () => {
    if (!card.dashAddress) return;
    navigator.clipboard.writeText(card.dashAddress);
    setAddrCopied(true);
    setTimeout(() => setAddrCopied(false), 2000);
  };

  return (
    <div className="relative flex flex-col rounded-3xl overflow-visible" style={{
      background: 'linear-gradient(160deg, rgba(15,15,40,0.97) 0%, rgba(5,5,20,0.99) 100%)',
      border: '1px solid rgba(255,255,255,0.09)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,255,200,0.04)',
      minHeight: isCarousel ? 520 : 340, width: '100%',
    }}>

      {/* ── Media — clickable to initium page ── */}
      <div className="relative flex-shrink-0 rounded-t-3xl overflow-hidden"
        style={{ height: isCarousel ? 240 : 160, background: 'rgba(0,0,0,0.8)' }}>
        {initiumPageHref ? (
          <Link href={initiumPageHref} className="block w-full h-full" style={{ textDecoration: 'none' }}>
            {card.mediaUrl ? (
              card.mediaType === 'video'
                ? <video src={card.mediaUrl} className="w-full h-full" style={{ objectFit: 'contain' }} muted autoPlay={isCarousel} loop playsInline />
                : <img src={card.mediaUrl} alt={card.initiumTitle} className="w-full h-full" style={{ objectFit: 'contain' }} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, rgba(0,255,200,0.03) 0%, rgba(123,47,255,0.05) 100%)' }}>
                <span style={{ fontSize: isCarousel ? 60 : 40, opacity: 0.07 }}>⬡</span>
                <span className="text-[9px] font-mono text-white/15">view initium →</span>
              </div>
            )}
          </Link>
        ) : card.mediaUrl ? (
          card.mediaType === 'video'
            ? <video src={card.mediaUrl} className="w-full h-full" style={{ objectFit: 'contain' }} muted autoPlay={isCarousel} loop playsInline />
            : <img src={card.mediaUrl} alt={card.initiumTitle} className="w-full h-full" style={{ objectFit: 'contain' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(0,255,200,0.03) 0%, rgba(123,47,255,0.05) 100%)' }}>
            <span style={{ fontSize: isCarousel ? 60 : 40, opacity: 0.07 }}>⬡</span>
          </div>
        )}

        {/* Badge row — overlaid on top of media */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
          <div className="flex flex-wrap gap-1.5 pointer-events-auto">
            {card.isCurrentLottery && (
              <span className="text-[9px] font-mono font-bold px-2 py-1 rounded-full"
                style={{ background: 'rgba(0,255,200,0.2)', border: '1px solid rgba(0,255,200,0.4)', color: '#00FFC8', backdropFilter: 'blur(8px)' }}>
                🎟 LIVE
              </span>
            )}
            {card.totalWins > 0 && (
              <span className="text-[9px] font-mono font-bold px-2 py-1 rounded-full"
                style={{ background: 'rgba(255,180,0,0.15)', border: '1px solid rgba(255,180,0,0.35)', color: 'rgba(255,210,0,0.95)', backdropFilter: 'blur(8px)' }}>
                🏆 {card.totalWins}×
              </span>
            )}
          </div>
          <button type="button" onClick={handleShare} className="pointer-events-auto text-[9px] font-mono px-2.5 py-1 rounded-full flex items-center gap-1 transition-all hover:scale-105"
            style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(8px)' }}>
            {copied ? '✓ Copied' : '↗ Share'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col gap-2.5 p-4 flex-1">

        {/* Title + creator */}
        <div>
          {initiumPageHref ? (
            <Link href={initiumPageHref} style={{ textDecoration: 'none' }}>
              <h3 className={`font-black leading-tight text-white hover:text-cyan-300 transition-colors mb-1 ${isCarousel ? 'text-xl' : 'text-sm'}`}>
                {card.initiumTitle}
              </h3>
            </Link>
          ) : (
            <h3 className={`font-black leading-tight text-white mb-1 ${isCarousel ? 'text-xl' : 'text-sm'}`}>
              {card.initiumTitle}
            </h3>
          )}
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {creatorLabel}
          </div>
        </div>

        {/* Description */}
        {card.initiumDescription && (
          <p className={`leading-relaxed ${isCarousel ? 'text-xs line-clamp-4' : 'text-[10px] line-clamp-2'}`}
            style={{ color: 'rgba(255,255,255,0.45)' }}>
            {card.initiumDescription}
          </p>
        )}

        {/* Stats chips */}
        <div className="flex flex-wrap gap-1.5">
          {[
            card.viewCount > 0      && { icon: '👁', val: card.viewCount,                          color: 'rgba(255,255,255,0.35)' },
            (card.totalVotusEarned || card.upvoteCount) > 0
                                    && { icon: '⬡', val: `${card.totalVotusEarned || card.upvoteCount} Votus`, color: 'rgba(0,200,255,0.7)' },
            (card.totalDashEarned || card.dashContributed) > 0
                                    && { icon: 'Ð', val: (card.totalDashEarned || card.dashContributed).toFixed(3), color: 'rgba(0,220,180,0.8)' },
            card.totalLotteries > 0 && { icon: '🎟', val: `${card.totalLotteries}×`,              color: 'rgba(180,130,255,0.7)' },
          ].filter(Boolean).map((s: any, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full text-[9px] font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: s.color }}>
              {s.icon} {s.val}
            </span>
          ))}
        </div>

        {/* ── DASH Address Panel ── */}
        {card.dashAddress && (
          <div className="rounded-2xl overflow-hidden mt-1"
               style={{
                 background: 'linear-gradient(135deg, rgba(0,180,70,0.07) 0%, rgba(0,100,220,0.06) 100%)',
                 border: '1px solid rgba(0,210,100,0.2)',
                 boxShadow: '0 0 16px rgba(0,180,70,0.06), inset 0 1px 0 rgba(0,255,120,0.06)',
               }}>
            {/* Header + explorer link */}
            <div className="flex items-center justify-between px-3 pt-2.5 pb-2"
                 style={{ borderBottom: '1px solid rgba(0,200,80,0.1)' }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold font-mono uppercase tracking-widest"
                      style={{ color: 'rgba(0,220,110,0.7)' }}>⚡ Dash</span>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                        style={{ background: 'rgba(0,255,120,0.7)' }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                        style={{ background: 'rgba(0,255,120,0.9)' }} />
                </span>
              </div>
              <a href={`https://insight.dash.org/insight/address/${card.dashAddress}`}
                 target="_blank" rel="noreferrer"
                 onClick={e => e.stopPropagation()}
                 className="text-[8px] font-mono flex items-center gap-1 px-2 py-0.5 rounded-full transition-all hover:scale-105"
                 style={{ background: 'rgba(0,180,70,0.12)', border: '1px solid rgba(0,200,80,0.22)', color: 'rgba(0,220,110,0.75)', textDecoration: 'none' }}>
                🔍 Explorer ↗
              </a>
            </div>

            {/* Balance stats */}
            <div className="grid grid-cols-2 gap-px px-0"
                 style={{ background: 'rgba(0,180,70,0.06)' }}>
              <div className="px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-[8px] font-mono uppercase mb-1" style={{ color: 'rgba(0,200,80,0.45)' }}>Balance</div>
                {balLoading ? (
                  <div className="w-2.5 h-2.5 rounded-full border border-t-emerald-400 border-white/10 animate-spin" />
                ) : dashBal ? (
                  <div className="flex items-baseline gap-1">
                    <span className={`${isCarousel ? 'text-base' : 'text-sm'} font-black`}
                          style={{ color: dashBal.balance > 0 ? 'rgba(0,255,140,0.95)' : 'rgba(255,255,255,0.25)', textShadow: dashBal.balance > 0 ? '0 0 12px rgba(0,255,100,0.35)' : 'none' }}>
                      Ð {dashBal.balance.toFixed(4)}
                    </span>
                  </div>
                ) : <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>}
              </div>
              <div className="px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-[8px] font-mono uppercase mb-1" style={{ color: 'rgba(0,200,80,0.45)' }}>Total Received</div>
                {balLoading ? (
                  <div className="w-2.5 h-2.5 rounded-full border border-t-cyan-400 border-white/10 animate-spin" />
                ) : dashBal ? (
                  <div className="flex items-baseline gap-1">
                    <span className={`${isCarousel ? 'text-base' : 'text-sm'} font-black`}
                          style={{ color: dashBal.totalReceived > 0 ? 'rgba(0,200,255,0.9)' : 'rgba(255,255,255,0.25)', textShadow: dashBal.totalReceived > 0 ? '0 0 12px rgba(0,180,255,0.3)' : 'none' }}>
                      Ð {dashBal.totalReceived.toFixed(4)}
                    </span>
                  </div>
                ) : <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>}
              </div>
            </div>

            {/* Address + copy */}
            <div className="flex items-center gap-1.5 px-3 py-2.5">
              <div className="flex-1 font-mono text-[8px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {card.dashAddress}
              </div>
              <button type="button" onClick={e => { e.stopPropagation(); copyAddr(); }}
                className="flex-shrink-0 px-2 py-1 rounded-lg text-[8px] font-mono transition-all hover:scale-105 active:scale-95"
                style={{
                  background: addrCopied ? 'rgba(0,255,120,0.15)' : 'rgba(0,200,80,0.08)',
                  border: `1px solid ${addrCopied ? 'rgba(0,255,120,0.35)' : 'rgba(0,200,80,0.18)'}`,
                  color: addrCopied ? 'rgba(0,255,120,0.9)' : 'rgba(0,220,110,0.65)',
                }}>
                {addrCopied ? '✓' : '⎘'}
              </button>
            </div>
          </div>
        )}

        {/* URL button + OG preview (at bottom, outside media) */}
        {card.initiumUrl && (
          <div className="relative mt-auto">
            <div className="flex items-center gap-2">
              <a href={card.initiumUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold transition-all hover:scale-[1.01]"
                style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.18)', color: 'rgba(0,180,255,0.85)', textDecoration: 'none' }}>
                <span>🔗</span>
                <span className="truncate">{hostname}</span>
              </a>
              <button type="button"
                onMouseEnter={() => { setShowOg(true); fetchOg(); }}
                onMouseLeave={() => setShowOg(false)}
                className="px-2.5 py-2 rounded-xl text-[9px] flex-shrink-0 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
                👁
              </button>
            </div>
            {/* OG preview popup — floats ABOVE, z-50, never cut by card */}
            {showOg && ogData && (ogData.title || ogData.image) && (
              <div className="absolute bottom-full mb-2 left-0 right-0 z-50 rounded-2xl overflow-hidden"
                style={{ background: 'rgba(8,8,25,0.98)', border: '1px solid rgba(0,200,255,0.25)', boxShadow: '0 10px 40px rgba(0,0,0,0.9)', pointerEvents: 'none' }}>
                {ogData.image && (
                  <img src={ogData.image} alt="" className="w-full"
                    style={{ maxHeight: 100, objectFit: 'cover', display: 'block' }} />
                )}
                <div className="p-3">
                  {ogData.siteName && <div className="text-[8px] font-mono text-white/20 mb-0.5">{ogData.siteName}</div>}
                  {ogData.title && <div className="text-xs font-bold text-white/80 line-clamp-2">{ogData.title}</div>}
                  {ogData.description && <div className="text-[9px] text-white/40 mt-1 line-clamp-2">{ogData.description}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Votus button (only if entry has Initium + not anon) */}
        {!card.isAnonymous && card.initiumTitle && onVotus && myEntry && myEntry.id !== card.entryId && (
          <button type="button" onClick={() => onVotus(card.entryId)} disabled={!myEntry?.votusAvailable}
            className="w-full py-2.5 rounded-2xl text-xs font-semibold transition-all hover:scale-[1.01] disabled:opacity-30"
            style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(0,200,255,0.85)' }}>
            {votusMsg || `⬡ Send Votus · ${myEntry?.votusAvailable || 0} available`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sort/Section Config ──
const SORTS: { key: SortOption; label: string }[] = [
  { key: 'newest', label: '🆕 Newest' },
  { key: 'views', label: '👁 Views' },
  { key: 'dash', label: 'Ð DASH' },
  { key: 'votus', label: '⬡ Votus' },
  { key: 'wins', label: '🏆 Wins' },
];

const SECTION_DESC: Record<'current' | 'all', string> = {
  current: 'Initiums competing in the active lottery',
  all: 'Every Initium ever submitted or created on Timely',

};

// ── Page ──
export default function InitiumsPage() {
  const [allItems, setAllItems] = useState<ICard[]>([]);
  const [currentLotteryItems, setCurrentLotteryItems] = useState<ICard[]>([]);
  const [total, setTotal] = useState(0);
  const [currentCount, setCurrentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('carousel');
  const [sort, setSort] = useState<SortOption>('newest');
  const [section, setSection] = useState<SectionOption>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [idx, setIdx] = useState(0);
  const [myEntry, setMyEntry] = useState<any>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [votusMsg, setVotusMsg] = useState('');
  const [cardKey, setCardKey] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [exitDir, setExitDir] = useState<'left' | 'right'>('left');
  const touchStartX = useRef(0);
  const debounceRef = useRef<any>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section, sort, search });
      const r = await fetch(`/api/initiums?${params}`);
      const d = await r.json();
      setAllItems(d.initiums || []);
      setCurrentLotteryItems(d.currentLotteryInitiums || []);
      setTotal(d.total || 0);
      setCurrentCount(d.currentLotteryCount || 0);
      setIdx(0);
      setCardKey(k => k + 1);
    } catch { /* */ }
    setLoading(false);
  }, [section, sort, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Check login
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/me');
        if (r.ok) {
          const d = await r.json();
          if (d.user) { setLoggedIn(true); setMyEntry(d.entry || null); }
        }
      } catch { /* */ }
    })();
  }, []);

  // Search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Items for current section
  const sorted = section === 'current' ? currentLotteryItems : allItems;

  // Carousel navigation
  const go = useCallback((dir: 1 | -1) => {
    if (animating || sorted.length === 0) return;
    const next = idx + dir;
    if (next < 0 || next >= sorted.length) return;
    setAnimating(true);
    setExitDir(dir > 0 ? 'left' : 'right');
    playSwipeSound();
    setTimeout(() => {
      setIdx(i => Math.max(0, Math.min(sorted.length - 1, i + dir)));
      setCardKey(k => k + 1);
      setAnimating(false);
    }, 250);
  }, [animating, sorted.length, idx]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (view !== 'carousel') return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, view]);

  // Touch
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  // Votus
  const handleVotus = async (entryId: string) => {
    setVotusMsg('Sending...');
    try {
      const r = await fetch('/api/votus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId }) });
      const d = await r.json();
      setVotusMsg(d.message || '⬡ Sent!');
      setTimeout(() => setVotusMsg(''), 3000);
      if (d.entry) setMyEntry(d.entry);
    } catch { setVotusMsg('Error'); setTimeout(() => setVotusMsg(''), 2000); }
  };

  const dots = sorted.length <= 20 ? sorted.length : 20;
  const extraDots = sorted.length > 20 ? sorted.length - 20 : 0;

  const pillStyle = (active: boolean) => ({
    background: active ? 'rgba(0,255,200,0.12)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? 'rgba(0,255,200,0.3)' : 'rgba(255,255,255,0.08)'}`,
    color: active ? '#00FFC8' : 'rgba(255,255,255,0.45)',
  });

  return (
    <div className="min-h-screen" style={{ background: '#050510' }}>
      <style dangerouslySetInnerHTML={{ __html: slideStyles }} />

      {/* Header */}
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-black text-white">⬡ Initiums</h1>
          <Link href="/" className="text-[10px] font-mono px-3 py-1.5 rounded-full transition-all hover:scale-105" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>← Home</Link>
        </div>
        <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>Discover builders and their ideas on Timely.Works</p>

        {/* Search */}
        <div className="relative mb-5">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>🔍</span>
          <input
            type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search Initiums..." className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)' }}
          />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); setSearch(''); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
          )}
        </div>

        {/* View toggle + Sort */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setView('carousel')} className="text-[10px] font-mono px-3 py-1.5 rounded-full transition-all" style={pillStyle(view === 'carousel')}>◫ Feed</button>
            <button type="button" onClick={() => setView('grid')} className="text-[10px] font-mono px-3 py-1.5 rounded-full transition-all" style={pillStyle(view === 'grid')}>▦ Grid</button>
          </div>
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {SORTS.map(s => (
              <button key={s.key} type="button" onClick={() => { setSort(s.key); setIdx(0); }}
                className="text-[9px] font-mono px-2.5 py-1 rounded-full whitespace-nowrap transition-all" style={pillStyle(sort === s.key)}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar">
          <button type="button" onClick={() => { setSection('current'); setIdx(0); }}
            className="text-[10px] font-mono px-3 py-1.5 rounded-full whitespace-nowrap transition-all" style={pillStyle(section === 'current')}>
            🎟 Current Lottery ({currentCount})
          </button>
          <button type="button" onClick={() => { setSection('all'); setIdx(0); }}
            className="text-[10px] font-mono px-3 py-1.5 rounded-full whitespace-nowrap transition-all" style={pillStyle(section === 'all')}>
            🌐 All Initiums ({total})
          </button>

        </div>

        {/* Section description */}
        <p className="text-[10px] font-mono mb-6" style={{ color: 'rgba(255,255,255,0.25)' }}>{SECTION_DESC[section]}</p>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-sm font-mono" style={{ color: 'rgba(0,255,200,0.5)' }}>Loading...</div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4" style={{ opacity: 0.1 }}>⬡</span>
            <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {section === 'current' ? 'No Initiums in the current lottery yet.' : 'No Initiums yet. Be the first builder!'}
            </p>
            <Link href="/enter" className="text-xs font-semibold px-4 py-2 rounded-full transition-all hover:scale-105"
              style={{ background: 'rgba(0,255,200,0.12)', border: '1px solid rgba(0,255,200,0.3)', color: '#00FFC8', textDecoration: 'none' }}>Enter now →</Link>
          </div>
        ) : view === 'carousel' ? (
          <div>
            {/* Carousel */}
            <div className="relative flex items-center gap-3" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <button type="button" onClick={() => go(-1)} disabled={idx === 0 || animating}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110 disabled:opacity-20"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>←</button>
              <div className="flex-1 min-w-0">
                <div key={cardKey} className={exitDir === 'left' ? 'slide-in-right' : 'slide-in-left'}>
                  {sorted[idx] && <InitiumCardComponent card={sorted[idx]} size="carousel" onVotus={handleVotus} myEntry={myEntry} loggedIn={loggedIn} votusMsg={votusMsg} />}
                </div>
              </div>
              <button type="button" onClick={() => go(1)} disabled={idx >= sorted.length - 1 || animating}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110 disabled:opacity-20"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>→</button>
            </div>

            {/* Dots */}
            <div className="flex items-center justify-center gap-1.5 mt-5">
              {Array.from({ length: dots }).map((_, i) => (
                <button key={i} type="button" onClick={() => { if (!animating) { setExitDir(i > idx ? 'left' : 'right'); playSwipeSound(); setIdx(i); setCardKey(k => k + 1); } }}
                  className="rounded-full transition-all" style={{
                    width: i === idx ? 16 : 6, height: 6,
                    background: i === idx ? '#00FFC8' : 'rgba(255,255,255,0.15)',
                  }} />
              ))}
              {extraDots > 0 && <span className="text-[9px] font-mono ml-1" style={{ color: 'rgba(255,255,255,0.25)' }}>+{extraDots}</span>}
            </div>

            {/* Counter */}
            <div className="text-center mt-3 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{idx + 1} / {sorted.length}</div>
          </div>
        ) : (
          /* Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map(card => (
              <InitiumCardComponent key={card.entryId || card.initiumId} card={card} size="grid" onVotus={handleVotus} myEntry={myEntry} loggedIn={loggedIn} votusMsg={votusMsg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
