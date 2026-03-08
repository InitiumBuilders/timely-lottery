'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface User { id: string; email: string; displayName?: string; emailVerified: boolean; dashUsername?: string; xHandle?: string; timelyTruth?: string; avatarUrl?: string; bio?: string; createdAt: string; }
interface Stats { totalDashContributed: number; totalDashWon: number; totalTicketsEarned: number; totalVotusEarned: number; totalVotusAllocated: number; totalVotusAvailable: number; lotteriesEntered: number; initiumCount: number; entriesThisLottery: number; }
interface InitiumCard { id: string; title: string; description?: string; url?: string; mediaUrl?: string; mediaType?: string; slug: string; viewCount: number; timesUsed: number; totalDashEarned: number; totalVotusEarned: number; dashAddress?: string; createdAt: string; }
interface Entry { id: string; lotteryId: string; dashContributed: number; totalTickets: number; votusCredits: number; votusAvailable: number; displayName?: string; initiumTitle?: string; createdAt: number; }

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5 border border-white/6" style={{ background: 'rgba(255,255,255,0.025)' }}>
      <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: accent || 'rgba(255,255,255,0.3)' }}>{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: accent ? accent.replace('0.3', '0.9') : 'rgba(255,255,255,0.9)' }}>{value}</div>
      {sub && <div className="text-[10px] mt-1 font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{sub}</div>}
    </div>
  );
}

function AccountContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [initiums, setInitiums] = useState<InitiumCard[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const tabParam = params.get('tab') as 'overview'|'initiums'|'settings'|'security' | null;
  const [tab, setTab] = useState<'overview'|'initiums'|'settings'|'security'>(tabParam || 'overview');

  // Profile edit
  const [displayName, setDisplayName] = useState('');
  const [dashUsername, setDashUsername] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [bio, setBio] = useState('');
  const [timelyTruth, setTimelyTruth] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailConfirmUrl, setEmailConfirmUrl] = useState('');

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  // Initium editor
  const [showInitiumForm, setShowInitiumForm] = useState(false);
  const [editingInitium, setEditingInitium] = useState<InitiumCard | null>(null);
  const [initTitle, setInitTitle] = useState('');
  const [initDesc, setInitDesc] = useState('');
  const [initUrl, setInitUrl] = useState('');
  const [initSlug, setInitSlug] = useState('');
  const [initDashAddress, setInitDashAddress] = useState('');
  const [initMediaFile, setInitMediaFile] = useState<File | null>(null);
  const [initMediaPreview, setInitMediaPreview] = useState('');
  const [initMediaUrl, setInitMediaUrl] = useState('');
  const [initMediaType, setInitMediaType] = useState('');
  const [initSaving, setInitSaving] = useState(false);

  // TX Claim
  const [claimTx, setClaimTx] = useState('');
  const [claimMsg, setClaimMsg] = useState('');
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    const [mr, sr, ir] = await Promise.all([
      fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/account/stats', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/initium/list', { cache: 'no-store' }).then(r => r.json()),
    ]);
    if (!mr.user) { router.push('/auth'); return; }
    setUser(mr.user);
    setDisplayName(mr.user.displayName || '');
    setDashUsername(mr.user.dashUsername || '');
    setXHandle(mr.user.xHandle || '');
    setBio(mr.user.bio || '');
    setTimelyTruth(mr.user.timelyTruth || '');
    setAvatarPreview(mr.user.avatarUrl || '');
    if (sr.stats) setStats(sr.stats);
    if (sr.entries) setEntries(sr.entries);
    if (ir.initiums) setInitiums(ir.initiums);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleSaveProfile = async () => {
    setSaving(true); setSaveMsg('');
    let avatarUrl = user?.avatarUrl;
    if (avatarFile) {
      const fd = new FormData(); fd.append('file', avatarFile);
      const ur = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
      if (ur.url) { avatarUrl = ur.url; setAvatarFile(null); }
    }
    const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, dashUsername, xHandle, bio, timelyTruth, avatarUrl }) });
    const d = await r.json();
    setSaveMsg(d.ok ? '✅ Saved!' : '❌ ' + d.error);
    if (d.ok) setUser(d.user);
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleChangeEmail = async () => {
    const r = await fetch('/api/auth/change-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newEmail, currentPassword: emailPw }) });
    const d = await r.json();
    setEmailMsg(d.message || (d.error ? '❌ ' + d.error : ''));
    if (d.confirmUrl) setEmailConfirmUrl(d.confirmUrl);
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { setPwMsg('❌ Passwords do not match'); return; }
    const r = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
    const d = await r.json();
    setPwMsg(d.ok ? '✅ Password updated!' : '❌ ' + d.error);
    if (d.ok) { setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
    setTimeout(() => setPwMsg(''), 4000);
  };

  const handleClaimTx = async () => {
    setClaiming(true); setClaimMsg('');
    const r = await fetch('/api/entry/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txId: claimTx }) });
    const d = await r.json();
    setClaimMsg(d.message || (d.error ? '❌ ' + d.error : ''));
    if (d.ok) { setClaimTx(''); load(); }
    setClaiming(false);
  };

  const openInitiumForm = (init?: InitiumCard) => {
    setEditingInitium(init || null);
    setInitTitle(init?.title || '');
    setInitDesc(init?.description || '');
    setInitUrl(init?.url || '');
    setInitSlug(init?.slug || '');
    setInitDashAddress(init?.dashAddress || '');
    setInitMediaFile(null);
    setInitMediaPreview(init?.mediaUrl || '');
    setInitMediaUrl(init?.mediaUrl || '');
    setInitMediaType(init?.mediaType || '');
    setShowInitiumForm(true);
  };

  const handleInitMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInitMediaFile(file);
    setInitMediaPreview(URL.createObjectURL(file));
    setInitMediaType(file.type.startsWith('video') ? 'video' : 'image');
  };

  const handleSaveInitium = async () => {
    setInitSaving(true);
    try {
      // Upload media first if a new file was selected
      let finalMediaUrl = initMediaUrl;
      let finalMediaType = initMediaType;
      if (initMediaFile) {
        const fd = new FormData(); fd.append('file', initMediaFile);
        const ur = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
        if (ur.url) { finalMediaUrl = ur.url; finalMediaType = ur.type || initMediaType; }
      }
      const apiUrl = editingInitium ? `/api/initium/${editingInitium.id}` : '/api/initium/create';
      const method = editingInitium ? 'PATCH' : 'POST';
      const r = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: initTitle,
          description: initDesc,
          url: initUrl,
          customSlug: initSlug,
          dashAddress: initDashAddress.trim() || null,
          mediaUrl: finalMediaUrl || null,
          mediaType: finalMediaType || null,
        }),
      });
      const d = await r.json();
      if (d.ok || d.initium) { load(); setShowInitiumForm(false); }
    } finally {
      setInitSaving(false);
    }
  };

  const handleDeleteInitium = async (id: string) => {
    if (!confirm('Delete this initium card?')) return;
    await fetch(`/api/initium/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.12) 0%, #050510 60%)' }}>
      <div className="w-10 h-10 border-2 border-t-cyan-400 border-white/10 rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;
  const iStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.12) 0%, #050510 60%)' }}>
      <div className="max-w-3xl mx-auto">

        {/* Messages */}
        {params.get('verified') && <div className="rounded-xl px-4 py-3 mb-4 text-sm text-cyan-300/80 border border-cyan-400/15" style={{ background: 'rgba(0,255,255,0.04)' }}>✅ Email verified!</div>}
        {params.get('emailChanged') && <div className="rounded-xl px-4 py-3 mb-4 text-sm text-green-300/80 border border-green-400/15" style={{ background: 'rgba(0,255,120,0.04)' }}>✅ Email updated successfully!</div>}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-white/40 hover:text-white/70 text-sm transition-colors">← timely.works</Link>
          <div className="flex gap-3">
            <Link href="/lottery" className="text-xs px-3 py-1.5 rounded-full border border-cyan-400/15 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/30 transition-all">🎟 Lottery</Link>
            <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); }}
                    className="text-xs text-white/30 hover:text-red-400/60 px-3 py-1.5 rounded-full border border-white/6 hover:border-red-400/15 transition-all">
              Sign Out
            </button>
          </div>
        </div>

        {/* Profile hero */}
        <div className="rounded-3xl p-6 border border-white/6 mb-6 flex items-center gap-5"
             style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.03) 0%, rgba(0,0,80,0.2) 100%)' }}>
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center text-2xl">
              {avatarPreview ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" /> : '👤'}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-cyan-500/80 flex items-center justify-center cursor-pointer text-xs">
              ✏️<input type="file" accept="image/*" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f){setAvatarFile(f);setAvatarPreview(URL.createObjectURL(f));} }} />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold text-white/90">{(user.dashUsername ? `@${user.dashUsername}` : user.displayName) || user.email?.split('@')[0]?.replace(/[._-]+/g,' ').trim() || 'Builder'}</div>
            <div className="text-sm text-white/30">{user.email}</div>
            {user.dashUsername && <div className="text-xs text-cyan-400/50 font-mono mt-0.5">@{user.dashUsername}.dash</div>}
            {!user.emailVerified && <div className="text-xs text-orange-400/70 mt-1">⚠️ Email not verified</div>}
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-white/20 font-mono">Member since</div>
            <div className="text-sm text-white/50">{new Date(user.createdAt).toLocaleDateString('en-US',{month:'short',year:'numeric'})}</div>
          </div>
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="DASH Contributed" value={`${stats.totalDashContributed.toFixed(4)}`} sub="DASH" accent="rgba(0,200,255,0.3)" />
            <StatCard label="DASH Won" value={`${stats.totalDashWon.toFixed(4)}`} sub="DASH" accent="rgba(0,255,150,0.3)" />
            <StatCard label="Total Tickets" value={`${stats.totalTicketsEarned}`} sub="earned" accent="rgba(180,100,255,0.35)" />
            <StatCard label="Votus Available" value={`${stats.totalVotusAvailable}`} sub="current lottery only" accent="rgba(0,255,200,0.3)" />
            <StatCard label="Lifetime Votus Sent" value={`${stats.totalVotusAllocated}`} sub="allocated to initiums" accent="rgba(0,200,160,0.25)" />
          </div>
        )}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard label="Lotteries Entered" value={`${stats.lotteriesEntered}`} />
            <StatCard label="Initium Cards" value={`${stats.initiumCount}`} />
            <StatCard label="Active Entries" value={`${stats.entriesThisLottery}`} sub="this lottery" accent="rgba(0,255,255,0.3)" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-white/8 p-1 gap-1 mb-6" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {(['overview','initiums','settings','security'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
                    className="flex-1 py-2 text-xs font-medium rounded-lg transition-all capitalize"
                    style={tab===t ? { background:'rgba(0,255,255,0.08)', border:'1px solid rgba(0,255,255,0.15)', color:'rgba(0,255,255,0.9)' } : { color:'rgba(255,255,255,0.3)' }}>
              {t === 'overview' ? '📊 Overview' : t === 'initiums' ? `💡 Initiums (${initiums.length})` : t === 'settings' ? '⚙️ Profile' : '🔒 Security'}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Claim TX */}
            <div className="rounded-2xl p-5 border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-sm font-medium text-white/60 mb-3">🔗 Claim a DASH Transaction</div>
              <p className="text-xs text-white/30 mb-3">Sent DASH anonymously? Paste your TX hash here to link it to your account.</p>
              <div className="flex gap-2">
                <input value={claimTx} onChange={e => setClaimTx(e.target.value)} placeholder="TX hash or insight.dash.org/tx/... link"
                       className="flex-1 px-3 py-2.5 rounded-xl text-xs text-white/80 placeholder-white/20 outline-none font-mono" style={iStyle} />
                <button onClick={handleClaimTx} disabled={!claimTx.trim() || claiming}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-40 transition-all"
                        style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(0,220,255,0.9)' }}>
                  {claiming ? '…' : 'Claim →'}
                </button>
              </div>
              {claimMsg && <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${claimMsg.startsWith('✅') ? 'text-cyan-300/80' : 'text-red-400/70'}`}>{claimMsg}</div>}
            </div>

            {/* Entry History */}
            <div className="rounded-2xl p-5 border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-sm font-medium text-white/60 mb-4">🎟 Your Lottery Entries</div>
              {entries.length === 0 ? (
                <div className="text-center py-6 text-white/20 text-sm">No entries yet — <Link href="/lottery" className="text-cyan-400/60 hover:text-cyan-300">join the lottery</Link></div>
              ) : (
                <div className="space-y-2">
                  {entries.map(e => (
                    <div key={e.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div>
                        {e.initiumTitle && <div className="text-xs font-medium text-white/70">{e.initiumTitle}</div>}
                        <div className="text-[10px] font-mono text-white/30">{e.dashContributed.toFixed(4)} DASH</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white/50 font-mono">🎟 {e.totalTickets}</div>
                        <div className="text-[10px] font-mono" style={{ color: 'rgba(0,200,150,0.6)' }}>⬡ {e.votusAvailable} Votus</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timely Truth */}
            {user.timelyTruth && (
              <div className="rounded-2xl p-5 border border-cyan-400/10" style={{ background: 'rgba(0,255,255,0.02)' }}>
                <div className="text-[9px] uppercase tracking-widest text-cyan-400/40 mb-2">⬡ Your Timely Truth</div>
                <p className="text-white/60 text-sm italic leading-relaxed">"{user.timelyTruth}"</p>
              </div>
            )}
          </div>
        )}

        {/* ── INITIUMS ─────────────────────────────────────────── */}
        {tab === 'initiums' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/30">Create reusable idea cards. Use them in any lottery. Share the link.</p>
              <button onClick={() => openInitiumForm()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-105"
                      style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(0,220,255,0.9)' }}>
                + New Initium
              </button>
            </div>

            {initiums.length === 0 && !showInitiumForm && (
              <div className="rounded-2xl p-10 border border-dashed border-white/8 text-center">
                <div className="text-4xl mb-3">💡</div>
                <div className="text-white/40 text-sm">No initium cards yet</div>
                <button onClick={() => openInitiumForm()} className="mt-4 text-xs text-cyan-400/60 hover:text-cyan-300 transition-colors">+ Create your first initium</button>
              </div>
            )}

            {/* Initium form */}
            {showInitiumForm && (
              <div className="rounded-2xl p-6 border border-cyan-400/15" style={{ background: 'rgba(0,255,255,0.02)' }}>
                <div className="text-sm font-semibold text-white/70 mb-5">{editingInitium ? '✏️ Edit Initium' : '💡 New Initium Card'}</div>
                <div className="space-y-4">
                  {/* Media upload — same as lottery form */}
                  <div>
                    <label className="text-xs text-cyan-300/50 mb-2 block">📎 Image or Video <span className="text-white/20">(optional, max 50MB)</span></label>
                    {initMediaPreview ? (
                      <div className="relative rounded-xl overflow-hidden mb-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                        {initMediaType === 'video'
                          ? <video src={initMediaPreview} className="w-full object-contain rounded-xl" style={{ maxHeight: '200px' }} muted controls />
                          : <img src={initMediaPreview} alt="preview" className="w-full object-contain rounded-xl" style={{ maxHeight: '200px', display: 'block' }} />
                        }
                        <button type="button"
                                onClick={() => { setInitMediaFile(null); setInitMediaPreview(''); setInitMediaUrl(''); setInitMediaType(''); }}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm"
                                style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.8)' }}>✕</button>
                      </div>
                    ) : null}
                    <label className="flex items-center gap-3 cursor-pointer rounded-xl p-3 border border-dashed transition-all hover:border-cyan-400/30"
                           style={{ background: 'rgba(0,255,255,0.02)', borderColor: initMediaPreview ? 'rgba(0,255,255,0.08)' : 'rgba(0,255,255,0.15)' }}>
                      <span className="text-cyan-400/40 text-lg">📎</span>
                      <span className="text-xs text-white/30">{initMediaFile ? initMediaFile.name : initMediaPreview ? 'Replace media…' : 'Click to upload image or video'}</span>
                      <input type="file" accept="image/*,video/mp4,video/webm,video/mov" onChange={handleInitMediaChange} className="hidden" />
                    </label>
                  </div>

                  <div>
                    <label className="text-xs text-white/30 mb-1 block">Title *</label>
                    <input value={initTitle} onChange={e => setInitTitle(e.target.value)} placeholder="What's your big idea?"
                           className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none" style={iStyle} />
                  </div>
                  <div>
                    <label className="text-xs text-white/30 mb-1 block">Description</label>
                    <textarea value={initDesc} onChange={e => setInitDesc(e.target.value)} rows={3} placeholder="Describe it — what does it do, why does it matter?"
                              className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none resize-none" style={iStyle} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/30 mb-1 block">Project URL</label>
                      <input value={initUrl} onChange={e => setInitUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none" style={iStyle} />
                    </div>
                    <div>
                      <label className="text-xs text-white/30 mb-1 block">Custom URL slug</label>
                      <input value={initSlug} onChange={e => setInitSlug(e.target.value)} placeholder="my-ai-startup" className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none font-mono" style={iStyle} />
                    </div>
                  </div>
                  {initSlug && <div className="text-xs text-cyan-400/40 font-mono">timely.works/i/{initSlug}</div>}

                  {/* Crowdfunding DASH Address */}
                  <div>
                    <label className="text-xs text-white/30 mb-1 block">💰 Crowdfunding DASH Address <span className="text-white/20">(optional)</span></label>
                    <input
                      value={initDashAddress}
                      onChange={e => setInitDashAddress(e.target.value)}
                      placeholder="XxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxX"
                      className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none font-mono"
                      style={iStyle}
                      maxLength={34}
                    />
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      Set a DASH address to receive direct contributions. Live balance shown on your Initium card.
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveInitium} disabled={!initTitle.trim() || initSaving}
                            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 hover:scale-[1.01] active:scale-[0.99]"
                            style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.25)', color: 'rgba(0,220,255,0.9)' }}>
                      {initSaving ? '⏳ Saving…' : editingInitium ? 'Update Initium' : 'Create Initium →'}
                    </button>
                    <button onClick={() => setShowInitiumForm(false)} className="px-4 py-3 rounded-xl text-sm text-white/40 border border-white/8 hover:border-white/15 transition-all">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Initium cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {initiums.map(init => (
                <div key={init.id} className="rounded-2xl overflow-hidden border border-white/6 group hover:border-cyan-400/20 transition-all"
                     style={{ background: 'rgba(255,255,255,0.025)' }}>

                  {/* Media — full image, no crop */}
                  {init.mediaUrl && (
                    <div style={{ background: 'rgba(0,0,0,0.3)' }}>
                      {init.mediaType === 'video'
                        ? <video src={init.mediaUrl} className="w-full object-contain" style={{ maxHeight: '180px', display: 'block' }} muted />
                        : <img src={init.mediaUrl} alt="" className="w-full object-contain" style={{ maxHeight: '180px', display: 'block' }} />
                      }
                    </div>
                  )}

                  <div className="p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono"
                           style={{ background: 'rgba(0,255,200,0.07)', border: '1px solid rgba(0,255,200,0.12)', color: 'rgba(0,255,200,0.6)' }}>
                        ◈ INITIUM
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openInitiumForm(init)} className="text-xs text-white/30 hover:text-white/70 transition-colors px-2 py-1 rounded-lg border border-white/8 hover:border-white/20">✏️ Edit</button>
                        <button onClick={() => handleDeleteInitium(init.id)} className="text-xs text-red-400/30 hover:text-red-400/70 transition-colors">🗑</button>
                      </div>
                    </div>

                    <div className="font-semibold text-white/85 text-sm mb-1 leading-snug">{init.title}</div>
                    {init.description && <p className="text-xs text-white/40 line-clamp-2 mb-3">{init.description}</p>}

                    {/* Lifetime stats */}
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      {[
                        { label: 'Used', value: `${init.timesUsed}×`, color: 'rgba(180,130,255,0.7)' },
                        { label: 'Views', value: `${init.viewCount}`, color: 'rgba(255,255,255,0.35)' },
                        { label: 'DASH earned', value: `${(init.totalDashEarned || 0).toFixed(3)}`, color: 'rgba(0,200,255,0.7)' },
                        { label: 'Votus earned', value: `${init.totalVotusEarned || 0}`, color: 'rgba(0,230,165,0.7)' },
                      ].map(s => (
                        <div key={s.label} className="rounded-lg px-2.5 py-1.5 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="text-[9px] text-white/25 uppercase tracking-wide">{s.label}</div>
                          <div className="text-xs font-bold font-mono mt-0.5" style={{ color: s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Crowdfunding DASH address */}
                    {init.dashAddress && (
                      <div className="mb-3 rounded-xl px-3 py-2" style={{ background: 'rgba(0,180,80,0.05)', border: '1px solid rgba(0,200,80,0.15)' }}>
                        <div className="text-[9px] text-green-400/50 mb-0.5">💰 Crowdfunding Address</div>
                        <div className="font-mono text-[9px] text-white/30 truncate">{init.dashAddress}</div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <a href={`/i/${init.slug}`} target="_blank" rel="noreferrer"
                         className="text-[10px] text-cyan-400/40 hover:text-cyan-300 font-mono transition-colors">
                        /i/{init.slug} ↗
                      </a>
                      <Link href="/lottery"
                            className="text-[10px] px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                            style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.15)', color: 'rgba(0,200,255,0.7)' }}>
                        Use in Lottery →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ─────────────────────────────────────────── */}
        {tab === 'settings' && (
          <div className="rounded-2xl p-6 border border-white/6 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[ ['Display Name', displayName, setDisplayName, 'Your name'], ['Dash Username', dashUsername, setDashUsername, '@username'], ['X.com Handle', xHandle, setXHandle, '@handle'] ].map(([label, val, setter, ph]) => (
                <div key={label as string}>
                  <label className="text-xs text-white/35 mb-1.5 block">{label as string}</label>
                  <input value={val as string} onChange={e => (setter as any)(e.target.value)} placeholder={ph as string}
                         className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none" style={iStyle} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-white/35 mb-1.5 block">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} placeholder="A brief bio..."
                        className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none resize-none" style={iStyle} />
            </div>
            <div>
              <label className="text-xs text-cyan-300/40 mb-1.5 block">⬡ Timely Truth <span className="text-white/20 font-normal">— something that deeply matters to you</span></label>
              <textarea value={timelyTruth} onChange={e => setTimelyTruth(e.target.value)} rows={2} placeholder="What truth are you living right now?"
                        className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none resize-none"
                        style={{ ...iStyle, border: '1px solid rgba(0,255,255,0.1)' }} />
            </div>
            {saveMsg && <div className={`text-sm rounded-xl px-3 py-2 ${saveMsg.startsWith('✅') ? 'text-cyan-300/80' : 'text-red-400/80'}`}>{saveMsg}</div>}
            <button onClick={handleSaveProfile} disabled={saving} className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                    style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(0,220,255,0.9)' }}>
              {saving ? '⏳ Saving…' : 'Save Profile →'}
            </button>

            {/* Change email */}
            <div className="pt-4 border-t border-white/6 space-y-3">
              <div className="text-xs text-white/40">Change Email Address</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="New email address"
                       className="px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none" style={iStyle} />
                <input value={emailPw} onChange={e => setEmailPw(e.target.value)} type="password" placeholder="Current password"
                       className="px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none" style={iStyle} />
              </div>
              {emailMsg && <div className="text-xs text-white/50">{emailMsg}</div>}
              {emailConfirmUrl && <a href={emailConfirmUrl} className="block text-xs font-mono text-cyan-400/60 break-all hover:text-cyan-300">{emailConfirmUrl}</a>}
              <button onClick={handleChangeEmail} disabled={!newEmail || !emailPw}
                      className="w-full py-2.5 rounded-xl text-sm text-white/50 border border-white/10 hover:border-white/20 disabled:opacity-40 transition-all">
                Send Confirmation Email →
              </button>
            </div>
          </div>
        )}

        {/* ── SECURITY ─────────────────────────────────────────── */}
        {tab === 'security' && (
          <div className="rounded-2xl p-6 border border-white/6 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-sm text-white/40 mb-2">Change Password</div>
            {[['Current Password', currentPw, setCurrentPw], ['New Password (8+)', newPw, setNewPw], ['Confirm Password', confirmPw, setConfirmPw]].map(([l,v,s]) => (
              <div key={l as string}>
                <label className="text-xs text-white/30 mb-1.5 block">{l as string}</label>
                <input type="password" value={v as string} onChange={e => (s as any)(e.target.value)} placeholder="••••••••"
                       className="w-full px-4 py-3 rounded-xl text-sm text-white/90 outline-none" style={iStyle} />
              </div>
            ))}
            {pwMsg && <div className={`text-sm ${pwMsg.startsWith('✅') ? 'text-cyan-300/80' : 'text-red-400/80'}`}>{pwMsg}</div>}
            <button onClick={handleChangePassword} className="w-full py-3 rounded-xl text-sm text-white/50 border border-white/10 hover:border-white/20 transition-all">
              Update Password
            </button>
            <div className="pt-4 border-t border-white/6">
              <button onClick={async () => { if(confirm('Delete your account?')){await fetch('/api/profile',{method:'DELETE'});router.push('/');}}}
                      className="w-full py-2.5 rounded-xl text-sm text-red-400/50 border border-red-400/10 hover:border-red-400/25 hover:text-red-400/70 transition-all">
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{background:'#050510'}}><div className="w-10 h-10 border-2 border-t-cyan-400 border-white/10 rounded-full animate-spin"/></div>}>
      <AccountContent />
    </Suspense>
  );
}
