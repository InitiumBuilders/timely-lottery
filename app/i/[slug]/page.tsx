'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Initium {
  id: string; title: string; description?: string; url?: string;
  mediaUrl?: string; mediaType?: string; slug: string; viewCount: number;
  timesUsed: number; createdAt: string; updatedAt: string; userId: string;
  totalDashEarned?: number; totalVotusEarned?: number; dashAddress?: string;
  lotteryDashWon?: number; lotteryWins?: number;
  user: { displayName?: string; avatarUrl?: string; dashUsername?: string };
}

interface DashBalance {
  balance: number;
  totalReceived: number;
  usdBalance: number;
  usdReceived: number;
  dashPriceUsd: number;
}

interface Me { id: string; displayName?: string; avatarUrl?: string }

export default function InitiumPage() {
  const { slug } = useParams<{ slug: string }>();
  const [initium, setInitium]   = useState<Initium | null>(null);
  const [me, setMe]             = useState<Me | null>(null);
  const [loading, setLoading]         = useState(true);
  const [copied, setCopied]           = useState(false);
  const [addrCopied, setAddrCopied]   = useState(false);
  const [dashBalance, setDashBalance] = useState<DashBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balLastUpdated, setBalLastUpdated] = useState<number | null>(null);

  // Edit state
  const [editing, setEditing]   = useState(false);
  const [editTitle, setEditTitle]       = useState('');
  const [editDesc, setEditDesc]         = useState('');
  const [editUrl, setEditUrl]           = useState('');
  const [editSlug, setEditSlug]         = useState('');
  const [editMedia, setEditMedia]       = useState('');
  const [editMediaType, setEditMediaType] = useState('');
  const [editFile, setEditFile]         = useState<File | null>(null);
  const [editPreview, setEditPreview]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [editError, setEditError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/initium/view/${slug}`, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ user: null })),
    ]).then(([initData, meData]) => {
      if (initData.initium) {
        setInitium(initData.initium);
        // Seed edit fields
        setEditTitle(initData.initium.title || '');
        setEditDesc(initData.initium.description || '');
        setEditUrl(initData.initium.url || '');
        setEditSlug(initData.initium.slug || '');
        setEditMedia(initData.initium.mediaUrl || '');
        setEditMediaType(initData.initium.mediaType || '');
        setEditPreview(initData.initium.mediaUrl || '');
      }
      if (meData.user) setMe(meData.user);
    }).finally(() => setLoading(false));
  }, [slug]);

  // Fetch live DASH balance + auto-refresh every 20s
  useEffect(() => {
    if (!initium?.dashAddress) return;
    const addr = initium.dashAddress;

    const fetchBalance = () => {
      fetch(`/api/initium/dash-balance?address=${addr}`)
        .then(r => r.json())
        .then(d => { setDashBalance(d); setBalLastUpdated(Date.now()); })
        .catch(() => {})
        .finally(() => setBalanceLoading(false));
    };

    setBalanceLoading(true);
    fetchBalance();
    const interval = setInterval(fetchBalance, 20_000); // refresh every 20s
    return () => clearInterval(interval);
  }, [initium?.dashAddress]);

  const isOwner = !!(me && initium && me.id === initium.userId);

  const copy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setAddrCopied(true);
    setTimeout(() => setAddrCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setEditFile(f);
    setEditMediaType(f.type.startsWith('video') ? 'video' : 'image');
    const reader = new FileReader();
    reader.onload = ev => setEditPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (!initium || saving) return;
    setSaving(true); setEditError('');
    try {
      let mediaUrl = editMedia;
      let mediaType = editMediaType;

      // Upload new file if selected
      if (editFile) {
        const formData = new FormData();
        formData.append('file', editFile);
        const up = await fetch('/api/upload', { method: 'POST', body: formData });
        const upData = await up.json();
        if (upData.url) { mediaUrl = upData.url; mediaType = editMediaType; }
      }

      const res = await fetch(`/api/initium/${initium.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || undefined,
          url: editUrl.trim() || undefined,
          mediaUrl: mediaUrl || undefined,
          mediaType: mediaType || undefined,
          customSlug: editSlug !== initium.slug ? editSlug : undefined,
          isPublic: true,
        }),
      });
      const data = await res.json();
      if (data.error) { setEditError(data.error); return; }
      // Refresh initium data; slug might have changed
      const newSlug = data.initium?.slug || editSlug;
      if (newSlug !== slug) {
        window.location.href = `/i/${newSlug}`;
        return;
      }
      setInitium(prev => prev ? { ...prev, ...data.initium } : prev);
      setEditing(false);
    } catch (e: any) {
      setEditError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-xl px-4 py-2.5 text-sm text-white/80 outline-none transition-all focus:ring-1 focus:ring-cyan-400/40";
  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.15) 0%, #050510 70%)' }}>
      <div className="w-10 h-10 border-2 border-t-cyan-400 border-white/10 rounded-full animate-spin" />
    </div>
  );

  if (!initium) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#050510' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">💡</div>
        <div className="text-white/50 text-lg">Initium not found</div>
        <Link href="/lottery" className="mt-6 inline-block text-cyan-400/70 hover:text-cyan-300 text-sm">→ Browse the lottery</Link>
      </div>
    </div>
  );

  const bg = 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.15) 0%, #050510 70%)';

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: bg }}>
      <div className="max-w-2xl mx-auto">

        {/* Header nav */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-white/30 hover:text-white/60 transition-colors text-sm flex items-center gap-1.5">
            <span>⚡</span> timely.works
          </Link>
          <div className="flex items-center gap-2">
            {isOwner && !editing && (
              <button onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
                style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: 'rgba(0,220,255,0.8)' }}>
                ✏️ Edit Initium
              </button>
            )}
            <button onClick={copy} className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all">
              {copied ? '✅ Copied!' : '🔗 Share'}
            </button>
          </div>
        </div>

        {/* ── EDIT FORM (owner only) ─────────────────────────────── */}
        {editing && (
          <div className="rounded-3xl overflow-hidden border border-cyan-400/20 mb-6 p-8"
               style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.04) 0%, rgba(0,0,0,0.15) 100%)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white/90">Edit Initium</h2>
              <button onClick={() => setEditing(false)} className="text-white/30 hover:text-white/70 text-xl leading-none">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Title *</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Your bold idea..." />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
                  className={inputCls + ' resize-none'} style={inputStyle} placeholder="Describe your initium..." />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Link URL</label>
                <input value={editUrl} onChange={e => setEditUrl(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Short URL slug</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30 font-mono">timely.works/i/</span>
                  <input value={editSlug} onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className={inputCls + ' flex-1'} style={inputStyle} placeholder="your-idea" />
                </div>
              </div>

              {/* Media */}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Media (image or video)</label>
                {editPreview && (
                  <div className="mb-3 rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    {editMediaType === 'video'
                      ? <video src={editPreview} className="w-full max-h-64 object-contain" controls muted playsInline />
                      : <img src={editPreview} alt="" className="w-full max-h-64 object-contain" style={{ display: 'block' }} />
                    }
                  </div>
                )}
                <button onClick={() => fileRef.current?.click()}
                  className="w-full py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition-all text-center border border-dashed border-white/10 hover:border-white/20">
                  {editPreview ? '🔄 Replace media' : '📎 Upload image / video'}
                </button>
                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
                {editMedia && (
                  <button onClick={() => { setEditMedia(''); setEditPreview(''); setEditFile(null); setEditMediaType(''); }}
                    className="mt-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors">
                    ✕ Remove media
                  </button>
                )}
              </div>
            </div>

            {editError && <div className="mt-4 text-red-400/80 text-xs text-center">{editError}</div>}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !editTitle.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, rgba(0,200,255,0.2), rgba(0,80,200,0.25))', border: '1px solid rgba(0,200,255,0.3)', color: 'rgba(0,220,255,0.9)' }}>
                {saving ? 'Saving…' : '✓ Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* ── MAIN CARD ─────────────────────────────────────────── */}
        {!editing && (
          <div className="rounded-3xl overflow-hidden border border-white/8 mb-6"
               style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.03) 0%, rgba(0,0,0,0.1) 100%)', backdropFilter: 'blur(20px)' }}>

            {/* Media — NEVER cropped, always object-contain */}
            {initium.mediaUrl && (
              <div className="w-full flex items-center justify-center"
                   style={{ background: 'rgba(0,0,0,0.3)', minHeight: '200px' }}>
                {initium.mediaType === 'video'
                  ? <video src={initium.mediaUrl}
                      className="w-full max-h-[480px] object-contain"
                      controls muted playsInline
                      style={{ display: 'block' }} />
                  : <img src={initium.mediaUrl} alt={initium.title}
                      className="w-full max-h-[480px] object-contain"
                      style={{ display: 'block' }} />
                }
              </div>
            )}

            <div className="p-8">
              {/* Badge row */}
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono"
                     style={{ background: 'rgba(0,255,200,0.08)', border: '1px solid rgba(0,255,200,0.15)', color: 'rgba(0,255,200,0.7)' }}>
                  ◈ INITIUM
                </div>
                <div className="text-xs text-white/25 font-mono">{initium.viewCount.toLocaleString()} views</div>
                {initium.timesUsed > 0 && (
                  <div className="text-xs text-cyan-400/40 font-mono">🎟 Used in {initium.timesUsed} lottery{initium.timesUsed !== 1 ? 'ies' : 'y'}</div>
                )}
                {(initium.lotteryDashWon ?? 0) > 0 ? (
                  <div className="text-xs text-white/30 font-mono">
                    🏆 {initium.lotteryDashWon!.toFixed(4)} DASH won
                    {(initium.lotteryWins ?? 0) > 1 && ` (${initium.lotteryWins} wins)`}
                  </div>
                ) : (initium.totalDashEarned ?? 0) > 0 ? (
                  <div className="text-xs text-white/30 font-mono">💰 {initium.totalDashEarned!.toFixed(4)} DASH contributed</div>
                ) : null}
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-white mb-4 leading-tight">{initium.title}</h1>

              {/* Description */}
              {initium.description && (
                <p className="text-white/60 text-base leading-relaxed mb-6 whitespace-pre-wrap">{initium.description}</p>
              )}

              {/* External URL */}
              {initium.url && (
                <a href={initium.url.startsWith('http') ? initium.url : `https://${initium.url}`}
                   target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-2 text-sm text-cyan-400/70 hover:text-cyan-300 transition-colors mb-6">
                  🔗 <span className="underline underline-offset-2">{initium.url.replace(/^https?:\/\//, '')}</span>
                </a>
              )}

              {/* Author + date */}
              <div className="flex items-center gap-3 pt-6 border-t border-white/6">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center text-sm flex-shrink-0">
                  {initium.user.avatarUrl
                    ? <img src={initium.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : '👤'}
                </div>
                <div>
                  <div className="text-sm font-medium text-white/70">
                    {initium.user.dashUsername
                      ? `@${initium.user.dashUsername.replace(/^@/, '')}`
                      : (initium.user.displayName && !initium.user.displayName.includes('@')
                          ? initium.user.displayName : 'Builder')}
                  </div>
                  {initium.user.dashUsername && (
                    <div className="text-xs text-white/30 font-mono">{initium.user.dashUsername.replace(/^@/, '')}.dash</div>
                  )}
                </div>
                <div className="ml-auto text-xs text-white/20 font-mono">
                  {new Date(initium.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* ── DASH ADDRESS PANEL ─────────────────────────────── */}
              {initium.dashAddress && (
                <div className="mt-6 rounded-2xl overflow-hidden"
                     style={{
                       background: 'linear-gradient(135deg, rgba(0,200,80,0.06) 0%, rgba(0,120,255,0.06) 100%)',
                       border: '1px solid rgba(0,220,120,0.2)',
                       boxShadow: '0 0 24px rgba(0,200,80,0.06), inset 0 1px 0 rgba(0,255,150,0.08)',
                     }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3"
                       style={{ borderBottom: '1px solid rgba(0,200,80,0.1)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <span className="text-xs font-bold tracking-widest uppercase"
                            style={{ color: 'rgba(0,220,120,0.85)', letterSpacing: '0.12em' }}>
                        Dash Address
                      </span>
                      {/* Live pulse */}
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                style={{ background: 'rgba(0,255,120,0.6)' }} />
                          <span className="relative inline-flex rounded-full h-2 w-2"
                                style={{ background: 'rgba(0,255,120,0.9)' }} />
                        </span>
                        <span className="text-[8px] font-mono" style={{ color: 'rgba(0,220,100,0.5)' }}>LIVE</span>
                      </div>
                    </div>
                    <a href={`https://insight.dash.org/insight/address/${initium.dashAddress}`}
                       target="_blank" rel="noreferrer"
                       className="flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full transition-all hover:scale-105"
                       style={{ background: 'rgba(0,200,80,0.1)', border: '1px solid rgba(0,200,80,0.25)', color: 'rgba(0,220,120,0.8)', textDecoration: 'none' }}>
                      <span>🔍</span> View on Explorer ↗
                    </a>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-px"
                       style={{ background: 'rgba(0,200,80,0.08)' }}>
                    <div className="px-5 py-4" style={{ background: 'rgba(0,0,0,0.25)' }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest mb-1"
                           style={{ color: 'rgba(0,200,80,0.5)' }}>Current Balance</div>
                      {balanceLoading ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border border-t-emerald-400 border-white/10 animate-spin" />
                          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>Loading…</span>
                        </div>
                      ) : dashBalance ? (
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black" style={{
                              color: dashBalance.balance > 0 ? 'rgba(0,255,150,0.95)' : 'rgba(255,255,255,0.3)',
                              textShadow: dashBalance.balance > 0 ? '0 0 20px rgba(0,255,120,0.4)' : 'none',
                            }}>
                              Ð {dashBalance.balance.toFixed(4)}
                            </span>
                            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>DASH</span>
                          </div>
                          {dashBalance.usdBalance > 0 && (
                            <div className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(0,255,120,0.45)' }}>
                              ≈ ${dashBalance.usdBalance.toFixed(2)} USD
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>—</div>
                      )}
                    </div>
                    <div className="px-5 py-4" style={{ background: 'rgba(0,0,0,0.25)' }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest mb-1"
                           style={{ color: 'rgba(0,200,80,0.5)' }}>Lifetime Received</div>
                      {balanceLoading ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full border border-t-emerald-400 border-white/10 animate-spin" />
                          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>Loading…</span>
                        </div>
                      ) : dashBalance ? (
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black" style={{
                              color: dashBalance.totalReceived > 0 ? 'rgba(0,200,255,0.9)' : 'rgba(255,255,255,0.3)',
                              textShadow: dashBalance.totalReceived > 0 ? '0 0 20px rgba(0,180,255,0.3)' : 'none',
                            }}>
                              Ð {dashBalance.totalReceived.toFixed(4)}
                            </span>
                            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>DASH</span>
                          </div>
                          {dashBalance.usdReceived > 0 && (
                            <div className="text-[10px] font-mono mt-0.5" style={{ color: 'rgba(0,180,255,0.4)' }}>
                              ≈ ${dashBalance.usdReceived.toFixed(2)} USD
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>—</div>
                      )}
                    </div>
                  </div>

                  {/* Address row — copyable + explorer */}
                  <div className="px-5 py-4">
                    <div className="text-[9px] font-mono uppercase tracking-widest mb-2"
                         style={{ color: 'rgba(0,200,80,0.4)' }}>Address</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 font-mono text-[11px] py-2.5 px-3 rounded-xl overflow-hidden"
                           style={{
                             background: 'rgba(0,0,0,0.35)',
                             border: '1px solid rgba(0,200,80,0.12)',
                             color: 'rgba(255,255,255,0.5)',
                             wordBreak: 'break-all',
                           }}>
                        {initium.dashAddress}
                      </div>
                      <button
                        onClick={() => copyAddr(initium.dashAddress!)}
                        className="flex-shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-[10px] font-mono transition-all hover:scale-105 active:scale-95"
                        style={{
                          background: addrCopied ? 'rgba(0,255,120,0.15)' : 'rgba(0,200,80,0.1)',
                          border: `1px solid ${addrCopied ? 'rgba(0,255,120,0.4)' : 'rgba(0,200,80,0.2)'}`,
                          color: addrCopied ? 'rgba(0,255,120,0.9)' : 'rgba(0,220,120,0.7)',
                        }}>
                        {addrCopied ? '✓ Copied' : '⎘ Copy'}
                      </button>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <a href={`https://insight.dash.org/insight/address/${initium.dashAddress}`}
                         target="_blank" rel="noreferrer"
                         className="text-[9px] font-mono flex items-center gap-1 transition-colors hover:opacity-100"
                         style={{ color: 'rgba(0,200,80,0.5)', textDecoration: 'none' }}>
                        insight.dash.org ↗
                      </a>
                      <span style={{ color: 'rgba(255,255,255,0.08)' }}>·</span>
                      <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
                        Verified on Dash blockchain
                      </span>
                      {dashBalance && dashBalance.dashPriceUsd > 0 && (
                        <>
                          <span style={{ color: 'rgba(255,255,255,0.08)' }}>·</span>
                          <span className="text-[9px] font-mono" style={{ color: 'rgba(0,200,80,0.35)' }}>
                            1 DASH = ${dashBalance.dashPriceUsd.toFixed(2)}
                          </span>
                        </>
                      )}
                      {balLastUpdated && (
                        <>
                          <span style={{ color: 'rgba(255,255,255,0.08)' }}>·</span>
                          <span className="text-[9px] font-mono" style={{ color: 'rgba(0,200,80,0.35)' }}>
                            refreshes every 20s
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        {!editing && (
          <div className="rounded-2xl p-6 border border-white/6 flex items-center justify-between gap-4"
               style={{ background: 'rgba(0,255,255,0.02)' }}>
            <div>
              <div className="text-white/60 text-sm font-medium">Enter this idea in the lottery</div>
              <div className="text-xs text-white/30 mt-0.5">Send 0.1+ DASH to earn tickets</div>
            </div>
            <Link href="/lottery"
              className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, rgba(0,200,255,0.15), rgba(0,80,200,0.2))', border: '1px solid rgba(0,200,255,0.25)', color: 'rgba(0,220,255,0.9)' }}>
              Enter Lottery →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
