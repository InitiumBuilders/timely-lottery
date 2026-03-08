'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode.react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Lottery {
  id: string;
  title: string;
  description: string;
  address: string;
  status: string;
  endTime: number;
  totalDash: number;
  totalTickets: number;
  participantCount: number;
}

interface Entry {
  id: string;
  displayName?: string;
  dashUsername?: string;
  dashEvolutionUsername?: string;
  dashAddress?: string;
  initium?: string;
  initiumTitle?: string;
  initiumDescription?: string;
  initiumUrl?: string;
  initiumSlug?: string;
  dashContributed: number;
  baseTickets: number;
  upvoteTickets: number;
  totalTickets: number;
  votusCredits: number;
  votusSpent: number;
  votusAvailable: number;
  upvoters: string[];
  verifiedTxIds: string[];
  isAnonymous?: boolean;
  entryAddress?: string;
  mediaUrl?: string;
  mediaType?: string;
  createdAt: number;
}

// ─── On-Chain Badge ───────────────────────────────────────────────────────────
// Shows "⛓ On Dash Platform" when the lottery is published to Dash Drive.
// Clicking opens an info panel explaining what that means.
function OnChainBadge({ lotteryId }: { lotteryId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-medium transition-all"
        style={{
          background:  'rgba(0,210,180,0.08)',
          border:      '1px solid rgba(0,210,180,0.25)',
          color:       'rgba(0,210,180,0.85)',
          cursor:      'pointer',
        }}
        title="Click to learn what On Dash Platform means"
      >
        <span>⛓</span>
        <span>On Dash Platform</span>
        <span style={{ opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="mt-3 max-w-sm text-left rounded-2xl px-5 py-4 text-xs leading-relaxed"
          style={{
            background:  'rgba(0,210,180,0.05)',
            border:      '1px solid rgba(0,210,180,0.15)',
            color:       'rgba(255,255,255,0.65)',
          }}
        >
          <p className="font-semibold mb-2" style={{ color: 'rgba(0,210,180,0.9)' }}>
            What does this mean?
          </p>
          <p className="mb-2">
            This lottery is recorded on <strong style={{ color: 'rgba(0,210,180,0.85)' }}>Dash Platform</strong> — a decentralized data layer built on the Dash blockchain.
          </p>
          <p className="mb-2">
            Every lottery, result, and entry is written to <strong>Dash Drive</strong> — a permanent, censorship-resistant data store. Anyone can independently verify the outcome without trusting Timely.Works.
          </p>
          <p className="mb-3">
            The chain doesn&apos;t lie.
          </p>
          <a
            href={`/api/platform/verify?lotteryId=${lotteryId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
            style={{ color: 'rgba(0,210,180,0.85)' }}
          >
            Verify on-chain →
          </a>
        </div>
      )}
    </div>
  );
}

function useCountdown(endTime: number) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, endTime - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { h, m, s, expired: remaining === 0 };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl sm:text-4xl font-mono font-bold text-cyan-300 tabular-nums min-w-[3ch] text-center"
           style={{ textShadow: '0 0 20px rgba(0,255,255,0.5)' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{label}</div>
    </div>
  );
}

function Separator() {
  return <span className="text-3xl font-mono text-cyan-400/60 self-start pt-1">:</span>;
}

function TicketCard({ entry, onUpvote, canUpvote, myVotusAvailable }: {
  entry: Entry;
  onUpvote?: (id: string) => void;
  canUpvote?: boolean;
  myVotusAvailable?: number;
}) {
  const [firing, setFiring]   = useState(false);
  const [floatKey, setFloatKey] = useState(0);
  const [portalActive, setPortalActive] = useState(false);
  const [ripplePos, setRipplePos] = useState<{x: number; y: number}>({ x: 0, y: 0 });
  const cardRef  = useRef<HTMLDivElement>(null);
  const router   = useRouter();

  const handleCardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const slug = entry.initiumSlug;
    if (!slug) return;
    // Don't intercept Votus button, external URL anchors (<a target="_blank">), or video elements
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('a[target="_blank"]') || t.tagName === 'VIDEO' || t.closest('video')) return;

    // Capture click position for ripple origin
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) setRipplePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    setPortalActive(true);
    setTimeout(() => {
      router.push(`/i/${slug}`);
      setTimeout(() => setPortalActive(false), 200);
    }, 420);
  }, [entry.initiumSlug, router]);

  const handleVotus = (id: string) => {
    if (!onUpvote) return;
    setFiring(true);
    setFloatKey(k => k + 1);
    setTimeout(() => setFiring(false), 600);
    onUpvote(id);
  };

  // Only use dashAddress as display if it looks like a real DASH address (starts with X, 34 chars)
  const isDashAddr = (s?: string) => !!s && /^X[a-zA-Z0-9]{33}$/.test(s);
  const name = entry.displayName
    || (entry.dashEvolutionUsername ? `@${entry.dashEvolutionUsername}` : null)
    || (entry.dashUsername ? `@${entry.dashUsername}` : null)
    || (isDashAddr(entry.dashAddress)
        ? `${entry.dashAddress!.slice(0, 6)}...${entry.dashAddress!.slice(-4)}`
        : entry.isAnonymous ? 'Anonymous' : 'Contributor');

  const hasInitium = entry.initiumTitle || entry.initiumDescription || entry.initium;
  const pct = entry.totalTickets > 0 ? Math.min(100, entry.totalTickets * 3) : 1;

  const slug = entry.initiumSlug;

  return (
    <div
      ref={cardRef}
      onClick={slug ? handleCardClick : undefined}
      className={`relative rounded-2xl overflow-hidden border transition-all duration-300 group select-none
        ${slug ? 'initium-clickable border-white/10 hover:border-cyan-400/40 hover:shadow-[0_0_24px_rgba(0,255,255,0.1)]' : 'border-white/10 hover:border-cyan-400/30'}
        ${portalActive ? 'portal-card-active' : ''}`}
      style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>

      {/* Portal ripple overlay — fires on click */}
      {portalActive && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none z-40">
          <div className="portal-ring"         style={{ left: ripplePos.x, top: ripplePos.y }} />
          <div className="portal-ring portal-ring-4" style={{ left: ripplePos.x, top: ripplePos.y }} />
          <div className="portal-ring portal-ring-2" style={{ left: ripplePos.x, top: ripplePos.y }} />
          <div className="portal-ring portal-ring-3" style={{ left: ripplePos.x, top: ripplePos.y }} />
          <div className="portal-flash" style={{ '--fx': `${ripplePos.x}px`, '--fy': `${ripplePos.y}px` } as React.CSSProperties} />
          <div className="portal-scanline" style={{ top: ripplePos.y }} />
        </div>
      )}

      {/* Hover glow accent */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
           style={{ background: 'radial-gradient(ellipse at top, rgba(0,255,255,0.05) 0%, transparent 70%)' }} />

      {/* Initium-clickable hint badge */}
      {slug && (
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full flex items-center gap-1"
            style={{ background: 'rgba(0,255,255,0.1)', border: '1px solid rgba(0,255,255,0.2)', color: 'rgba(0,255,255,0.7)' }}>
            ◈ tap to view
          </span>
        </div>
      )}

      <div className="p-5 relative z-10">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {entry.isAnonymous && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 font-mono">
                  ANON
                </span>
              )}
              <span className="font-semibold text-white/90 truncate">{name}</span>
              {(entry.dashEvolutionUsername || entry.dashUsername) && (
                <span className="text-xs text-cyan-400/70 font-mono truncate">
                  @{entry.dashEvolutionUsername || entry.dashUsername}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs text-white/30 font-mono">{entry.dashContributed.toFixed(4)} DASH</span>
              <span className="text-xs text-white/20">·</span>
              {/* Ticket breakdown: Base + Votus = Total */}
              <span className="text-xs font-mono flex items-center gap-1 flex-wrap">
                <span style={{ color: 'rgba(0,200,255,0.7)' }}>
                  🎟 {entry.baseTickets} Base
                </span>
                {entry.upvoteTickets > 0 && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>+</span>
                    <span style={{ color: 'rgba(0,220,160,0.8)' }}>
                      ⬡ {entry.upvoteTickets} Votus
                    </span>
                  </>
                )}
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>=</span>
                <span className="font-bold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {entry.totalTickets} Ticket{entry.totalTickets !== 1 ? 's' : ''}
                </span>
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-2xl font-bold text-cyan-300 font-mono"
                 style={{ textShadow: '0 0 15px rgba(0,255,255,0.4)' }}>
              {entry.totalTickets}
            </div>
            <div className="text-[9px] text-white/30 uppercase tracking-wider">TICKETS</div>
          </div>
        </div>

        {/* Win probability bar */}
        <div className="h-0.5 rounded-full bg-white/5 mb-4 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00ffff, #0088ff)' }} />
        </div>

        {/* Initium block — whole card handles nav; external URL gets stopPropagation */}
        {hasInitium && (
          <div className="rounded-xl p-4 mb-3 border border-cyan-400/10 transition-all duration-200"
               style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.04) 0%, rgba(0,100,255,0.04) 100%)' }}>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400/60 text-xs font-mono mt-0.5 flex-shrink-0">⬡</span>
              <div className="flex-1 min-w-0">
                {entry.initiumTitle && (
                  <div className="font-semibold text-sm text-white/90 mb-1 leading-tight">
                    {entry.initiumTitle}
                  </div>
                )}
                {(entry.initiumDescription || entry.initium) && (
                  <p className="text-xs text-white/50 leading-relaxed line-clamp-3">
                    {entry.initiumDescription || entry.initium}
                  </p>
                )}
                {entry.initiumUrl && (
                  <a href={entry.initiumUrl.startsWith('http') ? entry.initiumUrl : `https://${entry.initiumUrl}`}
                     target="_blank" rel="noopener noreferrer"
                     onClick={e => e.stopPropagation()}
                     className="inline-flex items-center gap-1 mt-2 text-[10px] font-mono text-cyan-400/60 hover:text-cyan-300 transition-colors">
                    <span>↗</span>
                    <span className="truncate max-w-[180px]">{entry.initiumUrl.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Media — object-contain, never cropped */}
        {entry.mediaUrl && (
          <div className="mb-3 rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)' }}>
            {entry.mediaType === 'video'
              ? <video src={entry.mediaUrl} className="w-full max-h-72 object-contain rounded-xl" controls muted playsInline onClick={e => e.stopPropagation()} />
              : <img src={entry.mediaUrl} alt="" className="w-full max-h-72 object-contain rounded-xl" style={{ display: 'block' }} />
            }
          </div>
        )}

        {/* Upvote with Votus — only for entries WITH an Initium and not anonymous */}
        {onUpvote && !entry.isAnonymous && entry.initiumTitle ? (
          <div className="flex items-center justify-end relative">
            <div className="relative">
              {firing && (
                <div key={floatKey} className="votus-floatup absolute -top-6 right-3 text-xs font-bold pointer-events-none z-20"
                     style={{ color: 'rgba(0,255,180,0.9)', textShadow: '0 0 10px rgba(0,255,180,0.8)' }}>
                  +1 🎟
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); handleVotus(entry.id); }}
                disabled={!canUpvote || (myVotusAvailable !== undefined && myVotusAvailable < 1)}
                title={myVotusAvailable !== undefined && myVotusAvailable < 1 ? 'No Votus — send more DASH to earn credits' : 'Spend 1 Votus → gives this entry +1 ticket'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 ${firing ? 'votus-firing' : ''}`}
                style={{
                  background: canUpvote ? 'rgba(0,200,150,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${canUpvote ? 'rgba(0,200,150,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: canUpvote ? 'rgba(0,230,165,0.9)' : 'rgba(255,255,255,0.2)',
                }}>
                ⬡ Boost (1 Votus)
              </button>
            </div>
          </div>
        ) : onUpvote && (entry.isAnonymous || !entry.initiumTitle) ? (
          /* Show reason — no Votus for anon or no-initium entries */
          <div className="flex justify-end">
            <span className="text-[9px] font-mono text-white/15 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {entry.isAnonymous ? '⬡ anon · no Votus' : '⬡ add Initium to earn Votus'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LotteryPage() {
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'feed' | 'enter'>('feed');
  const [qrCopied, setQrCopied] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDashUser, setFormDashUser] = useState('');
  const [formReceiveAddr, setFormReceiveAddr] = useState('');
  const [formInitiumTitle, setFormInitiumTitle] = useState('');
  const [formInitiumDesc, setFormInitiumDesc] = useState('');
  const [formInitiumUrl, setFormInitiumUrl] = useState('');
  const [formMedia, setFormMedia] = useState<File | null>(null);
  const [formMediaPreview, setFormMediaPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Entry | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [myEntryId, setMyEntryId] = useState('');
  const [myEntryAddress, setMyEntryAddress] = useState('');
  const [myVotusAvailable, setMyVotusAvailable] = useState(0);
  // Live deposit watcher
  const [watchDash, setWatchDash] = useState(0);
  const [watchTickets, setWatchTickets] = useState(0);
  const [watchVotus, setWatchVotus] = useState(0);
  const [watchTxCount, setWatchTxCount] = useState(0);
  const [watchPending, setWatchPending] = useState(0);
  const [watchLastScan, setWatchLastScan] = useState(0);
  const [watchScanning, setWatchScanning] = useState(false);
  const [watchNewFlash, setWatchNewFlash] = useState(false);
  const [watchAddrCopied, setWatchAddrCopied] = useState(false);
  const watchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [savedInitiums, setSavedInitiums] = useState<Array<{id:string;title:string;description?:string;url?:string;mediaUrl?:string;mediaType?:string;slug:string;timesUsed:number;totalDashEarned:number;totalVotusEarned:number}>>([]);
  const [selectedInitiumId, setSelectedInitiumId] = useState('');
  const [initiumMode, setInitiumMode] = useState<'select'|'create'>('select'); // 'select' or 'create'
  const [formSlug, setFormSlug] = useState('');
  const [formInitDashAddr, setFormInitDashAddr] = useState('');
  const [formMediaType, setFormMediaType] = useState('');
  const [formExistingMediaUrl, setFormExistingMediaUrl] = useState('');
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [initiumSavedMsg, setInitiumSavedMsg] = useState('');
  const [initiumAttachedMsg, setInitiumAttachedMsg] = useState('');
  const [attachingInitium, setAttachingInitium] = useState(false);
  // TX verification flow (anonymous entry confirm)
  const [txInput, setTxInput] = useState('');
  const [txName, setTxName] = useState('');
  const [txVerifying, setTxVerifying] = useState(false);
  const [txResult, setTxResult] = useState<{ ok: boolean; message: string; tickets?: number } | null>(null);
  const [txExpanded, setTxExpanded] = useState(true);

  const countdown = useCountdown(lottery?.endTime || 0);

  const lastScanRef = useRef<number>(0);
  const loadingRef  = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return; // prevent overlap
    loadingRef.current = true;
    try {
      // Trigger blockchain scan at most once per 10s
      if (Date.now() - lastScanRef.current > 4000) {
        lastScanRef.current = Date.now();
        fetch('/api/lottery/scan', { method: 'POST', cache: 'no-store' }).catch(() => {});
      }
      const [lr, er] = await Promise.all([
        fetch('/api/lottery/current', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/lottery/pool',    { cache: 'no-store' }).then(r => r.json()),
      ]);
      if (lr.lottery) setLottery(lr.lottery);
      if (er.entries) setEntries(er.entries);
    } catch { /* noop */ }
    loadingRef.current = false;
    setLoading(false);
  }, []); // stable reference — no deps

  // On first load, check if user is logged in and has an entry + saved initiums
  const loadMyEntry = useCallback(async () => {
    try {
      const [entryR, initiumR] = await Promise.all([
        fetch('/api/entry/my', { cache: 'no-store' }),
        fetch('/api/initium/list', { cache: 'no-store' }),
      ]);
      const entryD = await entryR.json();
      if (entryD.entry) {
        setMyEntryId(entryD.entry.id);
        setMyEntryAddress(entryD.entry.entryAddress || '');
        setMyVotusAvailable(entryD.votusAvailable || 0);
        // Seed watcher for returning visitors
        setWatchDash(entryD.entry.dashContributed || 0);
        setWatchTickets(entryD.entry.totalTickets || 0);
        setWatchVotus(entryD.votusAvailable || 0);
        setWatchTxCount((entryD.entry.verifiedTxIds || []).length);
        // Restore submitted state so they see the watcher if they return to Enter tab
        setSubmitted(entryD.entry);
      }
      const initiumD = await initiumR.json();
      if (initiumD.initiums) {
        setSavedInitiums(initiumD.initiums);
        // If user has no saved initiums, default to "Create New" mode
        if (!initiumD.initiums.length) setInitiumMode('create');
      }
    } catch { /* not logged in or no entry */ }
  }, []);

  // Live scan of THIS entry's deposit address
  const scanMyEntry = useCallback(async (entryId: string, silent = false) => {
    if (!silent) setWatchScanning(true);
    try {
      const r = await fetch(`/api/entry/status?entryId=${entryId}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.entryId) {
        const prevDash = watchDash;
        setWatchDash(d.dashContributed || 0);
        setWatchTickets(d.totalTickets || 0);
        setWatchVotus(d.votusAvailable || 0);
        setWatchTxCount((d.verifiedTxIds || []).length);
        setWatchPending(d.pendingDash || 0);
        setWatchLastScan(Date.now());
        // Flash animation when new DASH is detected
        if (d.newDashDetected || (d.dashContributed > prevDash && prevDash >= 0)) {
          setWatchNewFlash(true);
          setTimeout(() => setWatchNewFlash(false), 2500);
          load(); // also refresh the global pool
        }
      }
    } catch { /* non-fatal */ }
    if (!silent) setWatchScanning(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchDash, load]);

  // Start/stop the 5s deposit watcher when entry is submitted
  useEffect(() => {
    if (submitted?.id && myEntryId) {
      // Immediate first scan
      scanMyEntry(myEntryId);
      // Poll every 5 seconds
      watchIntervalRef.current = setInterval(() => scanMyEntry(myEntryId, true), 5000);
    }
    return () => {
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted?.id, myEntryId]);

  useEffect(() => {
    load(); // initial load
    loadMyEntry(); // check if logged in
    const id = setInterval(load, 4000); // poll every 10s
    return () => clearInterval(id);
  }, [load, loadMyEntry]);

  const handleSelectInitium = (init: typeof savedInitiums[0]) => {
    setSelectedInitiumId(init.id);
    setFormInitiumTitle(init.title);
    setFormInitiumDesc(init.description || '');
    setFormInitiumUrl(init.url || '');
    setFormSlug(init.slug || '');
    setFormInitDashAddr((init as any).dashAddress || '');
    setFormExistingMediaUrl(init.mediaUrl || '');
    setFormMediaType(init.mediaType || '');
    if (init.mediaUrl) {
      setFormMediaPreview(init.mediaUrl);
      setFormMedia(null);
    }
    setInitiumMode('select');
    setTab('enter');
  };

  const handleClearInitium = () => {
    setSelectedInitiumId('');
    setFormInitiumTitle(''); setFormInitiumDesc(''); setFormInitiumUrl('');
    setFormSlug(''); setFormInitDashAddr(''); setFormMedia(null); setFormMediaPreview('');
    setFormExistingMediaUrl(''); setFormMediaType('');
  };

  const handleSwitchToCreate = () => {
    handleClearInitium();
    setInitiumMode('create');
  };

  // POST-ENTRY: attach a selected existing Initium to the current entry
  const handleAttachInitium = async () => {
    if (!myEntryId || !selectedInitiumId) return;
    const init = savedInitiums.find(i => i.id === selectedInitiumId);
    if (!init) return;
    setAttachingInitium(true);
    try {
      const r = await fetch('/api/entry/update-initium', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId:            myEntryId,
          initiumId:          init.id,
          initiumTitle:       init.title,
          initiumDescription: init.description || undefined,
          initiumUrl:         init.url || undefined,
          mediaUrl:           init.mediaUrl || undefined,
          mediaType:          init.mediaType || undefined,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setInitiumAttachedMsg(`✅ "${init.title}" attached to your entry!`);
        setTimeout(() => setInitiumAttachedMsg(''), 4000);
      }
    } catch { /* non-fatal */ }
    setAttachingInitium(false);
  };

  // POST-ENTRY: create a brand-new Initium, save to profile, and attach to entry
  const handleCreateAndAttach = async () => {
    if (!formInitiumTitle) return;
    setAttachingInitium(true);
    try {
      // Upload media if any
      let mediaUrl = formExistingMediaUrl || undefined;
      let mediaType = formMediaType || undefined;
      if (formMedia) {
        const fd = new FormData();
        fd.append('file', formMedia);
        const ur = await fetch('/api/upload', { method: 'POST', body: fd });
        const ud = await ur.json();
        if (ud.url) { mediaUrl = ud.url; mediaType = ud.type || formMediaType || 'image'; }
      }

      // Save to profile first (required to get an initiumId)
      let newInitiumId: string | undefined;
      try {
        const initR = await fetch('/api/initium/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:       formInitiumTitle,
            description: formInitiumDesc || undefined,
            url:         formInitiumUrl  || undefined,
            customSlug:  formSlug        || undefined,
            dashAddress: formInitDashAddr.trim() || undefined,
            mediaUrl,
            mediaType,
          }),
        });
        const initD = await initR.json();
        if (initD.initium?.id) {
          newInitiumId = initD.initium.id;
          // Refresh saved initiums list
          const ir = await fetch('/api/initium/list', { cache: 'no-store' });
          const id = await ir.json();
          if (id.initiums) setSavedInitiums(id.initiums);
        }
      } catch { /* non-fatal save */ }

      // Attach to entry
      if (myEntryId) {
        const r = await fetch('/api/entry/update-initium', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryId:            myEntryId,
            initiumId:          newInitiumId,
            initiumTitle:       formInitiumTitle,
            initiumDescription: formInitiumDesc || undefined,
            initiumUrl:         formInitiumUrl  || undefined,
            mediaUrl,
            mediaType,
          }),
        });
        const d = await r.json();
        if (d.ok) {
          setInitiumAttachedMsg(`✅ "${formInitiumTitle}" saved & attached to your entry!`);
          setTimeout(() => setInitiumAttachedMsg(''), 4000);
          // Clear form + switch to select mode to see the new initium
          handleClearInitium();
          setInitiumMode('select');
        }
      }
    } catch { /* non-fatal */ }
    setAttachingInitium(false);
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr).catch(() => {});
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 2000);
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormMedia(file);
    setFormMediaPreview(URL.createObjectURL(file));
    setFormMediaType(file.type.startsWith('video') ? 'video' : 'image');
    setFormExistingMediaUrl(''); // clear existing URL since we have a new file
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setInitiumSavedMsg('');
    try {
      // Upload new media file if present, otherwise fall back to existing URL
      let mediaUrl: string | undefined = formExistingMediaUrl || undefined;
      let mediaType: string | undefined = formMediaType || undefined;
      if (formMedia) {
        const fd = new FormData();
        fd.append('file', formMedia);
        const ur = await fetch('/api/upload', { method: 'POST', body: fd });
        const ud = await ur.json();
        if (ud.url) { mediaUrl = ud.url; mediaType = ud.type || formMediaType || 'image'; }
      }

      const body = {
        displayName:        formName || undefined,
        dashUsername:       formDashUser || undefined,
        dashReceiveAddress: formReceiveAddr || undefined,
        initiumTitle:       formInitiumTitle || undefined,
        initiumDescription: formInitiumDesc || undefined,
        initiumUrl:         formInitiumUrl || undefined,
        mediaUrl,
        mediaType,
        initiumId:          selectedInitiumId || undefined,
      };
      const r = await fetch('/api/entry/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.error) { setSubmitError(d.error); return; }
      setSubmitted(d.entry);
      setMyEntryId(d.entry.id);
      setMyEntryAddress(d.entry.entryAddress);
      setMyVotusAvailable(d.entry.votusAvailable || 0);
      // Seed live watcher from entry data right away
      setWatchDash(d.entry.dashContributed || 0);
      setWatchTickets(d.entry.totalTickets || 0);
      setWatchVotus(d.entry.votusAvailable || 0);
      setWatchTxCount((d.entry.verifiedTxIds || []).length);
      // Persist entry ID for session
      const stored = JSON.parse(sessionStorage.getItem('myEntryIds') || '[]');
      if (!stored.includes(d.entry.id)) { stored.push(d.entry.id); sessionStorage.setItem('myEntryIds', JSON.stringify(stored)); }

      // ── Auto-save new Initium to profile (if not reusing an existing one) ──
      if (saveToProfile && formInitiumTitle && !selectedInitiumId) {
        try {
          const initR = await fetch('/api/initium/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title:       formInitiumTitle,
              description: formInitiumDesc || undefined,
              url:         formInitiumUrl  || undefined,
              customSlug:  formSlug        || undefined,
              dashAddress: formInitDashAddr.trim() || undefined,
              mediaUrl:    mediaUrl        || undefined,
              mediaType:   mediaType       || undefined,
            }),
          });
          const initD = await initR.json();
          if (initD.ok || initD.initium) {
            setInitiumSavedMsg('✅ Initium saved to your profile!');
            // Refresh saved initiums so they appear next time
            const ir = await fetch('/api/initium/list', { cache: 'no-store' });
            const id = await ir.json();
            if (id.initiums) setSavedInitiums(id.initiums);
          }
        } catch { /* non-fatal */ }
      }

      load();
    } catch {
      setSubmitError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (entryId: string) => {
    if (!myEntryId) return;
    try {
      const r = await fetch('/api/entry/upvote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, voterEntryId: myEntryId }),
      });
      const d = await r.json();
      if (d.votusRemaining !== undefined) setMyVotusAvailable(d.votusRemaining);
      load();
    } catch { /* noop */ }
  };

  const handleVerifyTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txInput.trim()) return;
    setTxVerifying(true);
    setTxResult(null);
    try {
      const r = await fetch('/api/entry/verify-anon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId: txInput.trim(), displayName: txName.trim() || undefined }),
      });
      const d = await r.json();
      if (d.message) {
        setTxResult({ ok: r.ok, message: d.message, tickets: d.tickets });
        if (r.ok) { setTxInput(''); setTxName(''); load(); }
      } else {
        setTxResult({ ok: false, message: d.error || 'Unknown error' });
      }
    } catch { setTxResult({ ok: false, message: 'Network error — try again' }); }
    setTxVerifying(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,100,200,0.15) 0%, #050510 60%)' }}>
        <div className="text-center">
          <div className="inline-block w-12 h-12 rounded-full border-2 border-t-cyan-400 border-white/10 animate-spin mb-4" />
          <div className="text-white/40 text-sm tracking-widest uppercase">Loading</div>
        </div>
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
           style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,100,200,0.12) 0%, #050510 60%)' }}>
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">⬡</div>
          <h2 className="text-2xl font-bold text-white/80 mb-3">No Active Lottery</h2>
          <p className="text-white/40 mb-8">The next lottery hasn&apos;t started yet. Check back soon.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-white/70 border border-white/10 hover:border-cyan-400/30 transition-all">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.15) 0%, #050510 55%)' }}>
      {/* Top nav */}
      <nav className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between border-b border-white/5"
           style={{ background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(20px)' }}>
        <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm">
          <span>←</span>
          <span className="font-light tracking-wide">timely.works</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/initiums" className="text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-full border border-white/5 hover:border-white/10">💡 Initiums</Link>
          <Link href="/history" className="text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-full border border-white/5 hover:border-white/10">📜 History</Link>
          <Link href="/search" className="text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-full border border-white/5 hover:border-white/10">🔍 Search</Link>
          <Link href="/winners" className="text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-full border border-white/5 hover:border-white/10">🏆</Link>
          <Link href="/account" className="text-xs text-cyan-400/60 hover:text-cyan-300 transition-colors px-3 py-1.5 rounded-full border border-cyan-400/10 hover:border-cyan-400/20">👤 Account</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── Hero: Title + Timer ──────────────────────────────────────────── */}
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-medium mb-4"
               style={{ background: 'rgba(0,255,255,0.06)', border: '1px solid rgba(0,255,255,0.15)', color: 'rgba(0,255,255,0.7)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Live Lottery
          </div>

          {/* ── On-Chain Badge (shown when TIMELY_CONTRACT_ID is set) ──────── */}
          {process.env.NEXT_PUBLIC_ON_CHAIN === '1' && (
            <OnChainBadge lotteryId={lottery.id} />
          )}
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 leading-tight">
            {lottery.title}
          </h1>
          {lottery.description && (
            <p className="text-white/40 text-sm max-w-lg mx-auto">{lottery.description}</p>
          )}
        </div>

        {/* ── Stats strip ──────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] uppercase tracking-widest text-white/20">Live Pool</span>
            <span className="flex items-center gap-1.5 text-[9px] text-green-400/70 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400/80 animate-pulse inline-block" />
              LIVE · updates every 15s
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'POOL', value: `${(lottery.totalDash || 0).toFixed(4)}`, unit: 'DASH' },
              { label: 'TICKETS', value: `${lottery.totalTickets || 0}`, unit: 'sold' },
              { label: 'PLAYERS', value: `${lottery.participantCount || 0}`, unit: 'entries' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4 text-center border border-white/5"
                   style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1">{s.label}</div>
                <div className="text-xl font-bold font-mono text-white/90">{s.value}</div>
                <div className="text-[10px] text-white/20 font-mono">{s.unit}</div>
              </div>
            ))}
          </div>

          {/* ── Live Fund Split Preview ─────────────────────────────────── */}
          {(lottery.totalDash || 0) > 0 && (() => {
            const pool = lottery.totalDash || 0;
            const winner = parseFloat((pool * 0.85).toFixed(8));
            const reserve = parseFloat((pool * 0.10).toFixed(8));
            const nextPot = parseFloat((pool * 0.05).toFixed(8));
            return (
              <div className="rounded-2xl p-4 border" style={{ background: 'rgba(0,255,255,0.02)', borderColor: 'rgba(0,255,255,0.08)' }}>
                <div className="text-[9px] uppercase tracking-widest mb-3" style={{ color: 'rgba(0,255,255,0.4)' }}>
                  INSTANT SPLIT — EVERY DEPOSIT
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center rounded-xl py-2 px-1" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                    <div className="text-[9px] font-mono tracking-widest" style={{ color: 'rgba(245,158,11,0.7)' }}>🏆 WINNER</div>
                    <div className="text-sm font-black font-mono text-white">{winner.toFixed(4)}</div>
                    <div className="text-[9px] font-mono" style={{ color: 'rgba(245,158,11,0.5)' }}>85% DASH</div>
                  </div>
                  <div className="text-center rounded-xl py-2 px-1" style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)' }}>
                    <div className="text-[9px] font-mono tracking-widest" style={{ color: 'rgba(0,212,170,0.7)' }}>🏦 RESERVE</div>
                    <div className="text-sm font-black font-mono text-white">{reserve.toFixed(4)}</div>
                    <div className="text-[9px] font-mono" style={{ color: 'rgba(0,212,170,0.5)' }}>10% DASH</div>
                  </div>
                  <div className="text-center rounded-xl py-2 px-1" style={{ background: 'rgba(0,141,228,0.06)', border: '1px solid rgba(0,141,228,0.15)' }}>
                    <div className="text-[9px] font-mono tracking-widest" style={{ color: 'rgba(0,141,228,0.7)' }}>🌱 NEXT POT</div>
                    <div className="text-sm font-black font-mono text-white">{nextPot.toFixed(4)}</div>
                    <div className="text-[9px] font-mono" style={{ color: 'rgba(0,141,228,0.5)' }}>5% DASH</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Countdown ────────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 text-center border border-white/5"
             style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4">Time Remaining</div>
          {countdown.expired ? (
            <div className="text-2xl font-bold text-orange-400">Lottery Ended — Picking Winner…</div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <CountdownUnit value={countdown.h} label="hours" />
              <Separator />
              <CountdownUnit value={countdown.m} label="min" />
              <Separator />
              <CountdownUnit value={countdown.s} label="sec" />
            </div>
          )}
        </div>

        {/* ── QR / Anonymous Entry Card ────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden border border-cyan-400/15"
             style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.04) 0%, rgba(0,80,200,0.06) 100%)' }}>
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              {/* QR Code */}
              <div className="flex-shrink-0">
                <div className="p-4 rounded-2xl bg-white shadow-2xl shadow-cyan-400/10">
                  <QRCode
                    value={lottery.address}
                    size={160}
                    level="H"
                    includeMargin={false}
                    renderAs="svg"
                  />
                </div>
              </div>
              {/* Instructions */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium mb-3"
                     style={{ background: 'rgba(0,255,255,0.06)', border: '1px solid rgba(0,255,255,0.12)', color: 'rgba(0,255,255,0.7)' }}>
                  ⚡ Instant Entry
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Scan & Send to Enter</h3>
                <p className="text-white/50 text-sm mb-4 leading-relaxed">
                  Send <span className="text-cyan-300 font-mono font-medium">0.1 DASH</span> or more to this address.
                  Every <span className="text-cyan-300 font-mono font-medium">0.1 DASH</span> = 1 ticket.
                  Works anonymously — no form required.
                </p>
                {/* Address display */}
                <div className="flex items-center gap-2 rounded-xl p-3 border border-white/10 max-w-full overflow-hidden"
                     style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <span className="font-mono text-xs text-white/60 truncate flex-1 min-w-0">
                    {lottery.address}
                  </span>
                  <button
                    onClick={() => handleCopyAddress(lottery.address)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95"
                    style={{
                      background: qrCopied ? 'rgba(0,255,100,0.1)' : 'rgba(0,255,255,0.08)',
                      border: `1px solid ${qrCopied ? 'rgba(0,255,100,0.2)' : 'rgba(0,255,255,0.15)'}`,
                      color: qrCopied ? 'rgba(0,255,100,0.8)' : 'rgba(0,255,255,0.8)',
                    }}>
                    {qrCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-white/25 mt-3">
                  Auto-detected every 5 seconds. Or paste your TX hash below to confirm instantly.
                </p>
              </div>
            </div>
          </div>

          {/* Verify TX section */}
          <div className="border-t border-white/6">
            <button
              onClick={() => setTxExpanded(!txExpanded)}
              className="w-full flex items-center justify-between px-6 py-3 text-sm text-white/70 hover:text-white transition-colors font-medium">
              <span>📋 Already sent DASH? Paste your TX hash to confirm your tickets</span>
              <span className="text-xs text-white/30">{txExpanded ? '▲' : '▼ open'}</span>
            </button>
            {txExpanded && (
              <form onSubmit={handleVerifyTx} className="px-6 pb-5 space-y-3">
                <input
                  type="text"
                  value={txInput}
                  onChange={e => setTxInput(e.target.value)}
                  placeholder="Paste TX hash or insight.dash.org/tx/... link"
                  className="w-full px-4 py-3 rounded-xl text-white/80 text-sm font-mono outline-none"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace' }}
                />
                <input
                  type="text"
                  value={txName}
                  onChange={e => setTxName(e.target.value)}
                  placeholder="Your name or @dashusername (optional)"
                  className="w-full px-4 py-3 rounded-xl text-white/80 text-sm outline-none"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'inherit' }}
                />
                <button
                  type="submit"
                  disabled={txVerifying || !txInput.trim()}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: 'rgba(0,255,200,0.08)', border: '1px solid rgba(0,255,200,0.15)', color: 'rgba(0,255,200,0.8)' }}>
                  {txVerifying ? '⏳ Verifying…' : '✓ Verify & Claim Tickets'}
                </button>
                {txResult && (
                  <div className="text-sm text-center py-2 rounded-xl px-3"
                       style={{ background: txResult.ok ? 'rgba(0,255,136,0.06)' : 'rgba(255,80,80,0.06)', color: txResult.ok ? 'rgba(0,255,136,0.8)' : 'rgba(255,100,100,0.8)' }}>
                    {txResult.message}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* ── Tabs: Feed / Enter ───────────────────────────────────────────── */}
        <div className="flex rounded-xl overflow-hidden border border-white/8 p-1 gap-1"
             style={{ background: 'rgba(255,255,255,0.02)' }}>
          {(['feed', 'enter'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
                    className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all"
                    style={tab === t ? {
                      background: 'rgba(0,255,255,0.1)',
                      border: '1px solid rgba(0,255,255,0.15)',
                      color: 'rgba(0,255,255,0.9)',
                    } : {
                      color: 'rgba(255,255,255,0.35)',
                    }}>
              {t === 'feed' ? `🎟 Ticket Feed (${entries.filter(e => e.dashContributed >= 0.0999).length})` : '+ Enter with Initium'}
            </button>
          ))}
        </div>

        {/* ── TAB: Ticket Feed ─────────────────────────────────────────────── */}
        {tab === 'feed' && (
          <div className="space-y-4">
            {entries.length === 0 ? (
              <div className="text-center py-16 text-white/25">
                <div className="text-4xl mb-3">⬡</div>
                <div className="text-sm">No entries yet — be the first!</div>
              </div>
            ) : (
              // Only show entries that have actually funded (≥ 0.1 DASH sent)
              // Prevents the initium card from appearing before the user sends DASH
              entries.filter(entry => entry.dashContributed >= 0.0999).map(entry => (
                <TicketCard
                  key={entry.id}
                  entry={entry}
                  onUpvote={myEntryId ? handleUpvote : undefined}
                  canUpvote={
                    !!myEntryId &&
                    entry.id !== myEntryId &&
                    !entry.isAnonymous &&          // no Votus for anon entries
                    !!entry.initiumTitle           // must have a real Initium attached
                  }
                  myVotusAvailable={myVotusAvailable}
                />
              ))
            )}
          </div>
        )}

        {/* ── TAB: Enter with Initium ──────────────────────────────────────── */}
        {tab === 'enter' && (
          <div>
            {/* ── INITIUM SECTION — always visible (pre + post entry) ──────── */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-mono tracking-widest text-white/30">
                  {submitted ? '⬡ YOUR INITIUM · select or create — saves to your profile' : '⬡ ADD AN INITIUM (optional · boosts visibility)'}
                </div>
              </div>
                {/* Mode tabs */}
                <div className="flex rounded-xl overflow-hidden mb-4"
                  style={{ border: '1px solid rgba(0,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
                  <button type="button"
                    onClick={() => setInitiumMode('select')}
                    className="flex-1 py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-2"
                    style={{
                      background: initiumMode === 'select' ? 'rgba(0,255,255,0.1)' : 'transparent',
                      color: initiumMode === 'select' ? 'rgba(0,220,255,0.9)' : 'rgba(255,255,255,0.3)',
                      borderRight: '1px solid rgba(0,255,255,0.1)',
                    }}>
                    <span>📚</span>
                    <span>My Initiums</span>
                    {savedInitiums.length > 0 && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                        style={{
                          background: initiumMode === 'select' ? 'rgba(0,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                          color: initiumMode === 'select' ? 'rgba(0,220,255,0.9)' : 'rgba(255,255,255,0.3)',
                        }}>
                        {savedInitiums.length}
                      </span>
                    )}
                  </button>
                  <button type="button"
                    onClick={handleSwitchToCreate}
                    className="flex-1 py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-2"
                    style={{
                      background: initiumMode === 'create' ? 'rgba(0,255,200,0.1)' : 'transparent',
                      color: initiumMode === 'create' ? '#00FFC8' : 'rgba(255,255,255,0.3)',
                    }}>
                    <span>✨</span>
                    <span>Create New</span>
                  </button>
                </div>

                {/* ── SELECT MODE: show all saved initiums ── */}
                {initiumMode === 'select' && (
                  <div>
                    {savedInitiums.length === 0 ? (
                      <div className="text-center py-6 rounded-xl"
                        style={{ background: 'rgba(0,255,200,0.02)', border: '1px dashed rgba(0,255,200,0.15)' }}>
                        <div className="text-2xl mb-2">⬡</div>
                        <p className="text-white/35 text-xs mb-3">No saved Initiums yet.</p>
                        <button type="button" onClick={handleSwitchToCreate}
                          className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                          style={{ background: 'rgba(0,255,200,0.08)', border: '1px solid rgba(0,255,200,0.2)', color: '#00FFC8' }}>
                          ✨ Create your first Initium
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-[10px] font-mono text-white/30 mb-3 tracking-widest">
                          SELECT AN INITIUM TO ENTER WITH — OR <button type="button" onClick={handleSwitchToCreate} className="hover:underline" style={{ color: 'rgba(0,255,200,0.6)' }}>CREATE NEW ✨</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                          {savedInitiums.map(init => (
                            <button key={init.id} type="button"
                              onClick={() => handleSelectInitium(init)}
                              className="rounded-2xl overflow-hidden text-left transition-all duration-300 flex flex-col relative"
                              style={{
                                border: selectedInitiumId === init.id
                                  ? '1.5px solid rgba(0,255,200,0.7)'
                                  : '1px solid rgba(255,255,255,0.07)',
                                background: selectedInitiumId === init.id
                                  ? 'linear-gradient(160deg, rgba(0,255,200,0.07) 0%, rgba(0,40,60,0.9) 100%)'
                                  : 'linear-gradient(160deg, rgba(20,20,40,0.9) 0%, rgba(8,8,20,0.95) 100%)',
                                boxShadow: selectedInitiumId === init.id
                                  ? '0 0 30px rgba(0,255,200,0.15)'
                                  : '0 4px 20px rgba(0,0,0,0.5)',
                                minHeight: 300,
                              }}>
                              {/* Media — object-contain, full visible, no crop */}
                              <div className="relative flex-shrink-0" style={{ height: 150, background: 'rgba(0,0,0,0.7)' }}>
                                {init.mediaUrl ? (
                                  init.mediaType === 'video'
                                    ? <video src={init.mediaUrl} className="w-full h-full" style={{ objectFit: 'contain' }} muted playsInline />
                                    : <img src={init.mediaUrl} alt="" className="w-full h-full" style={{ objectFit: 'contain' }} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 40, opacity: 0.1 }}>⬡</div>
                                )}
                                {selectedInitiumId === init.id && (
                                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold z-10"
                                    style={{ background: '#00FFC8', color: '#000' }}>✓</div>
                                )}
                                {(init as any).dashAddress && (
                                  <div className="absolute bottom-2 left-2 text-[8px] font-mono px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'rgba(0,180,80,0.25)', border: '1px solid rgba(0,200,80,0.4)', color: 'rgba(0,220,100,0.9)' }}>
                                    💰 Crowdfunding
                                  </div>
                                )}
                              </div>
                              {/* Body */}
                              <div className="flex flex-col gap-1.5 p-3 flex-1">
                                <div className="text-xs font-bold line-clamp-2 leading-snug"
                                  style={{ color: selectedInitiumId === init.id ? '#00FFC8' : 'rgba(255,255,255,0.9)' }}>
                                  {init.title}
                                </div>
                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-mono mt-0.5">
                                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>👁 {(init as any).viewCount || 0}</span>
                                  <span style={{ color: 'rgba(0,200,255,0.5)' }}>🎟 {init.timesUsed}×</span>
                                  {init.totalDashEarned > 0 && (
                                    <span style={{ color: 'rgba(0,220,180,0.7)' }}>Ð {init.totalDashEarned.toFixed(3)}</span>
                                  )}
                                  {(init as any).totalWins > 0 && (
                                    <span style={{ color: 'rgba(255,210,0,0.8)' }}>🏆 {(init as any).totalWins}w</span>
                                  )}
                                </div>
                                {init.url && (
                                  <div className="mt-auto pt-2">
                                    <div className="text-[9px] font-mono truncate px-2 py-1 rounded-lg flex items-center gap-1"
                                      style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.12)', color: 'rgba(0,180,255,0.7)' }}>
                                      <span>🔗</span>
                                      <span className="truncate">{(() => { try { return new URL(init.url).hostname; } catch { return init.url.slice(0,28); } })()}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                        {selectedInitiumId && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                              style={{ background: 'rgba(0,255,200,0.06)', border: '1px solid rgba(0,255,200,0.2)' }}>
                              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#00FFC8' }}>
                                <span>⬡</span>
                                <span>{savedInitiums.find(i => i.id === selectedInitiumId)?.title}</span>
                                <span className="text-white/30 font-normal">selected</span>
                              </div>
                              <button type="button" onClick={handleClearInitium}
                                className="text-[10px] text-white/30 hover:text-white/60 transition-colors">✕ Clear</button>
                            </div>
                            {/* POST-ENTRY: attach to existing entry */}
                            {submitted && myEntryId && (
                              <button type="button" onClick={handleAttachInitium} disabled={attachingInitium}
                                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, rgba(0,255,200,0.15), rgba(0,200,150,0.1))', border: '1px solid rgba(0,255,200,0.35)', color: '#00FFC8' }}>
                                {attachingInitium ? 'Attaching…' : '⬡ Attach to My Entry'}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── CREATE MODE: full inline creation form ── */}
                {initiumMode === 'create' && (
                  <div className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid rgba(0,255,200,0.15)', background: 'rgba(0,255,200,0.02)' }}>
                    <div className="px-4 pt-4 pb-2">
                      <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: 'rgba(0,255,200,0.5)' }}>
                        ✨ NEW INITIUM · SAVED TO YOUR PROFILE
                      </div>
                      <p className="text-[10px] text-white/30">
                        Fill out the fields below. After you enter the lottery, this Initium is saved to your account for reuse.
                      </p>
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                      {/* Title */}
                      <div>
                        <label className="block text-xs text-cyan-300/50 mb-1 font-medium">Title <span className="text-red-400/60">*</span></label>
                        <input type="text" value={formInitiumTitle} onChange={e => setFormInitiumTitle(e.target.value)}
                          placeholder="What's your idea called?"
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none"
                          style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.12)' }} />
                      </div>
                      {/* Description */}
                      <div>
                        <label className="block text-xs text-cyan-300/50 mb-1 font-medium">Description</label>
                        <textarea value={formInitiumDesc} onChange={e => setFormInitiumDesc(e.target.value)}
                          placeholder="Describe your idea, what problem it solves..."
                          rows={3}
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none resize-none"
                          style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.12)' }} />
                      </div>
                      {/* URL + Slug row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-cyan-300/50 mb-1 font-medium">Project URL</label>
                          <input type="text" value={formInitiumUrl} onChange={e => setFormInitiumUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none"
                            style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.12)' }} />
                        </div>
                        <div>
                          <label className="block text-xs text-cyan-300/50 mb-1 font-medium">URL Slug</label>
                          <div className="flex rounded-xl overflow-hidden"
                            style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.12)' }}>
                            <span className="px-2 text-[10px] font-mono text-white/20 flex items-center border-r flex-shrink-0"
                              style={{ borderColor: 'rgba(0,255,255,0.08)' }}>/i/</span>
                            <input type="text" value={formSlug}
                              onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                              placeholder="my-idea"
                              className="flex-1 px-2 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none bg-transparent" />
                          </div>
                          {formSlug && (
                            <div className="text-[9px] font-mono mt-0.5 px-1" style={{ color: 'rgba(0,255,200,0.4)' }}>
                              timely.works/i/{formSlug}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Crowdfunding DASH Address */}
                      <div>
                        <label className="block text-xs text-cyan-300/50 mb-1 font-medium">
                          💰 Crowdfunding DASH Address <span className="text-white/20 font-normal">(optional)</span>
                        </label>
                        <input type="text" value={formInitDashAddr}
                          onChange={e => setFormInitDashAddr(e.target.value)}
                          placeholder="XxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX"
                          maxLength={34}
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none font-mono"
                          style={{ background: 'rgba(0,180,80,0.04)', border: '1px solid rgba(0,180,80,0.18)' }} />
                        <div className="text-[9px] mt-1 px-1" style={{ color: 'rgba(0,200,80,0.35)' }}>
                          Anyone can send DASH here to support your Initium. Live balance shown on your card.
                        </div>
                      </div>
                      {/* Media upload */}
                      <div>
                        <label className="block text-xs text-cyan-300/50 mb-1 font-medium">
                          Media <span className="text-white/20 font-normal">(image or video · max 50MB)</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer rounded-xl p-3 border border-dashed transition-all hover:border-cyan-400/30"
                          style={{ background: 'rgba(0,255,255,0.02)', borderColor: formMediaPreview ? 'rgba(0,255,200,0.3)' : 'rgba(0,255,255,0.14)' }}>
                          <span className="text-cyan-400/40 text-lg flex-shrink-0">📎</span>
                          <span className="text-xs text-white/35 truncate">
                            {formMedia ? formMedia.name : formExistingMediaUrl ? '✓ Media from saved Initium' : 'Click to upload image or video'}
                          </span>
                          <input type="file" accept="image/*,video/mp4,video/webm,video/mov" onChange={handleMediaChange} className="hidden" />
                        </label>
                        {formMediaPreview && (
                          <div className="mt-2 relative rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
                            {formMediaType === 'video'
                              ? <video src={formMediaPreview} className="w-full max-h-48 object-contain" muted controls />
                              : <img src={formMediaPreview} alt="preview" className="w-full max-h-48 object-contain" />
                            }
                            <button type="button"
                              onClick={() => { setFormMedia(null); setFormMediaPreview(''); setFormExistingMediaUrl(''); setFormMediaType(''); }}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white/70 text-xs flex items-center justify-center">✕</button>
                            <div className="absolute bottom-2 left-2 text-[9px] font-mono px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(0,0,0,0.6)', color: formMediaType === 'video' ? '#60a5fa' : '#00FFC8' }}>
                              {formMediaType === 'video' ? '🎬 Video' : '🖼 Image'}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Save toggle — only relevant pre-entry */}
                      {!submitted && (
                        <button type="button" onClick={() => setSaveToProfile(p => !p)}
                          className="flex items-center gap-2 text-[10px] font-mono transition-all px-3 py-2 rounded-xl w-full"
                          style={{
                            background: saveToProfile ? 'rgba(0,255,200,0.07)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${saveToProfile ? 'rgba(0,255,200,0.2)' : 'rgba(255,255,255,0.07)'}`,
                            color: saveToProfile ? '#00FFC8' : 'rgba(255,255,255,0.25)',
                          }}>
                          <span>{saveToProfile ? '✅' : '○'}</span>
                          <span>Save this Initium to my profile for future reuse</span>
                        </button>
                      )}

                      {/* POST-ENTRY: save to profile + attach to existing entry */}
                      {submitted && myEntryId && (
                        <button type="button" onClick={handleCreateAndAttach}
                          disabled={attachingInitium || !formInitiumTitle}
                          className="w-full py-3 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-40"
                          style={{ background: 'linear-gradient(135deg, rgba(0,255,200,0.15), rgba(0,200,150,0.1))', border: '1px solid rgba(0,255,200,0.35)', color: '#00FFC8' }}>
                          {attachingInitium ? 'Saving…' : '✨ Save to Profile & Attach to My Entry'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* Success message for post-entry attach */}
              {initiumAttachedMsg && (
                <div className="mt-3 text-center text-xs font-mono py-2.5 px-4 rounded-xl"
                  style={{ background: 'rgba(0,255,200,0.08)', border: '1px solid rgba(0,255,200,0.25)', color: '#00FFC8' }}>
                  {initiumAttachedMsg}
                </div>
              )}
            </div>

            {submitted ? (
              /* ── LIVE DEPOSIT WATCHER ──────────────────────────────────────── */
              <div className="space-y-4">

                {/* Flash banner when new DASH detected */}
                {watchNewFlash && (
                  <div className="rounded-2xl px-5 py-4 text-center animate-pulse"
                       style={{ background: 'linear-gradient(135deg, rgba(0,255,150,0.12), rgba(0,200,100,0.08))', border: '1px solid rgba(0,255,150,0.3)' }}>
                    <div className="text-2xl mb-1">🎉</div>
                    <div className="text-sm font-bold" style={{ color: 'rgba(0,255,150,0.9)' }}>
                      DASH received! Tickets updated.
                    </div>
                  </div>
                )}

                {/* Main card */}
                <div className="rounded-2xl overflow-hidden border border-cyan-400/20"
                     style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.03) 0%, rgba(0,60,160,0.08) 100%)' }}>

                  {/* Header */}
                  <div className="px-6 pt-6 pb-4 text-center border-b border-white/5">
                    <div className="text-3xl mb-2">🎟</div>
                    <h3 className="text-xl font-bold text-white mb-1">You&apos;re In!</h3>
                    <p className="text-white/40 text-xs">Send DASH to your personal address · <span className="text-cyan-300 font-mono font-medium">0.1 DASH = 1 ticket</span></p>
                  </div>

                  {/* Live stats strip */}
                  <div className="grid grid-cols-3 border-b border-white/5">
                    {[
                      {
                        label: 'DASH Sent',
                        value: watchDash > 0 ? watchDash.toFixed(4) : '—',
                        unit: watchDash > 0 ? 'DASH' : 'waiting',
                        color: watchDash > 0 ? 'rgba(0,200,255,0.9)' : 'rgba(255,255,255,0.25)',
                      },
                      {
                        label: 'Your Tickets',
                        value: watchTickets > 0 ? `${watchTickets}` : '—',
                        unit: watchTickets > 0 ? 'tickets' : 'send to earn',
                        color: watchTickets > 0 ? 'rgba(0,255,200,0.9)' : 'rgba(255,255,255,0.25)',
                      },
                      {
                        label: 'Votus',
                        value: watchVotus > 0 ? `${watchVotus}` : '—',
                        unit: watchVotus > 0 ? 'available' : 'earned w/ DASH',
                        color: watchVotus > 0 ? 'rgba(180,100,255,0.9)' : 'rgba(255,255,255,0.25)',
                      },
                    ].map(s => (
                      <div key={s.label} className="py-4 text-center">
                        <div className="text-[9px] uppercase tracking-widest text-white/25 mb-1">{s.label}</div>
                        <div className={`text-lg font-bold font-mono transition-all duration-500 ${watchNewFlash && s.label !== 'Votus' ? 'scale-110' : ''}`}
                             style={{ color: s.color }}>
                          {s.value}
                        </div>
                        <div className="text-[9px] text-white/20 font-mono">{s.unit}</div>
                      </div>
                    ))}
                  </div>

                  {/* Pending TX indicator */}
                  {watchPending > 0 && (
                    <div className="px-6 py-2.5 border-b border-white/5 text-center">
                      <div className="inline-flex items-center gap-2 text-xs font-mono"
                           style={{ color: 'rgba(255,200,50,0.8)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
                        {watchPending.toFixed(4)} DASH pending confirmation (~1 min)
                      </div>
                    </div>
                  )}

                  {/* QR + Address */}
                  <div className="p-6">
                    <div className="text-[10px] uppercase tracking-widest text-white/25 text-center mb-4">
                      Your Private Deposit Address
                    </div>
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-white rounded-2xl shadow-2xl shadow-cyan-400/10">
                        <QRCode value={myEntryAddress} size={160} level="H" renderAs="svg" />
                      </div>
                    </div>
                    {/* Address row */}
                    <div className="flex items-center gap-2 rounded-xl p-3 mb-4"
                         style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <span className="font-mono text-xs text-white/60 truncate flex-1 min-w-0">{myEntryAddress}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(myEntryAddress).catch(() => {});
                          setWatchAddrCopied(true);
                          setTimeout(() => setWatchAddrCopied(false), 2000);
                        }}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95"
                        style={{
                          background: watchAddrCopied ? 'rgba(0,255,100,0.12)' : 'rgba(0,255,255,0.08)',
                          border: `1px solid ${watchAddrCopied ? 'rgba(0,255,100,0.25)' : 'rgba(0,255,255,0.15)'}`,
                          color: watchAddrCopied ? 'rgba(0,255,100,0.9)' : 'rgba(0,255,255,0.8)',
                        }}>
                        {watchAddrCopied ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>

                    {/* Live watcher status + manual refresh */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 text-[10px] font-mono"
                           style={{ color: watchScanning ? 'rgba(0,255,200,0.7)' : 'rgba(255,255,255,0.2)' }}>
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${watchScanning ? 'animate-pulse bg-cyan-400' : 'bg-white/20'}`} />
                        {watchScanning
                          ? 'Scanning blockchain…'
                          : watchLastScan > 0
                            ? `Last checked ${Math.round((Date.now() - watchLastScan) / 1000)}s ago · auto-refreshes every 5s`
                            : 'Auto-refreshes every 5s'
                        }
                      </div>
                      <button
                        onClick={() => { if (myEntryId) scanMyEntry(myEntryId); }}
                        disabled={watchScanning}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                        style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)', color: 'rgba(0,200,255,0.8)' }}>
                        {watchScanning ? '⏳' : '↻'} Check Now
                      </button>
                    </div>

                    {/* TX history */}
                    {watchTxCount > 0 && (
                      <div className="mt-4 rounded-xl p-3 border border-white/5" style={{ background: 'rgba(0,255,150,0.03)' }}>
                        <div className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Confirmed Transactions</div>
                        <div className="text-xs font-mono text-green-400/70">
                          {watchTxCount} TX{watchTxCount > 1 ? 's' : ''} confirmed · {watchDash.toFixed(4)} DASH total · {watchTickets} ticket{watchTickets !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={() => setTab('feed')}
                          className="flex-1 py-3 rounded-xl text-sm font-medium text-white/50 border border-white/8 hover:border-white/15 hover:text-white/70 transition-all">
                    View Ticket Feed
                  </button>
                  <button onClick={() => { if (myEntryId) scanMyEntry(myEntryId); }}
                          disabled={watchScanning}
                          className="flex-1 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                          style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(0,220,255,0.9)' }}>
                    {watchScanning ? '⏳ Checking…' : '↻ Refresh Now'}
                  </button>
                </div>
              </div>
            ) : (
              /* Entry form */
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-2xl p-6 border border-white/6"
                     style={{ background: 'rgba(255,255,255,0.02)' }}>

                  {/* Identity section */}
                  <div className="mb-6">
                    <div className="text-[10px] uppercase tracking-widest text-white/30 mb-4 font-medium">
                      Identity <span className="text-white/15 normal-case tracking-normal">(all optional — anonymous entry OK)</span>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/40 mb-1.5">Display Name</label>
                          <input
                            type="text" value={formName} onChange={e => setFormName(e.target.value)}
                            placeholder="Your name or handle"
                            className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none transition-all"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/40 mb-1.5">Dash Username</label>
                          <input
                            type="text" value={formDashUser} onChange={e => setFormDashUser(e.target.value)}
                            placeholder="@username"
                            className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none transition-all"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">
                          Receive Address <span className="text-white/20">(DASH address to receive prize payout)</span>
                        </label>
                        <input
                          type="text" value={formReceiveAddr} onChange={e => setFormReceiveAddr(e.target.value)}
                          placeholder="Xabc... mainnet DASH address"
                          className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none transition-all"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {submitError && (
                  <div className="rounded-xl px-4 py-3 text-sm text-red-400/80 border border-red-400/15"
                       style={{ background: 'rgba(255,60,60,0.05)' }}>
                    {submitError}
                  </div>
                )}

                <button
                  type="submit" disabled={submitting}
                  className="w-full py-4 rounded-2xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,200,255,0.15) 0%, rgba(0,80,200,0.2) 100%)',
                    border: '1px solid rgba(0,200,255,0.25)',
                    color: 'rgba(0,220,255,0.9)',
                  }}>
                  {submitting ? 'Registering Entry…' : '→ Register My Entry & Get Deposit Address'}
                </button>

                {initiumSavedMsg && (
                  <div className="text-center text-xs font-mono py-2 px-4 rounded-xl"
                    style={{ background: 'rgba(0,255,200,0.06)', border: '1px solid rgba(0,255,200,0.15)', color: '#00FFC8' }}>
                    {initiumSavedMsg}
                  </div>
                )}

                <p className="text-center text-[11px] text-white/20">
                  After registering, you&apos;ll receive a personal deposit address. Send DASH there to earn tickets.
                  {!selectedInitiumId && formInitiumTitle && saveToProfile && (
                    <> · <span style={{ color: 'rgba(0,255,200,0.4)' }}>Initium will be saved to your profile.</span></>
                  )}
                </p>
              </form>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="text-center py-8 mt-8 border-t border-white/5 text-[11px] text-white/20">
        <p>
          This App Was Built By August &nbsp;·&nbsp;{' '}
          <a href="https://X.Com/BuiltByAugust" target="_blank" rel="noopener noreferrer"
             className="hover:text-white/40 transition-colors">
            @BuiltByAugust
          </a>
        </p>
      </footer>
    </div>
  );
}
