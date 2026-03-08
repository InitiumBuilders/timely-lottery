'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string; email: string; displayName?: string; emailVerified: boolean;
  dashUsername?: string; xHandle?: string; timelyTruth?: string; avatarUrl?: string;
  createdAt: string;
}
interface Entry {
  id: string; lotteryId: string; displayName?: string; initiumTitle?: string;
  initiumDescription?: string; dashContributed: number; totalTickets: number;
  votusCredits: number; votusAvailable: number; createdAt: number; isAnonymous?: boolean;
  mediaUrl?: string; mediaType?: string;
}

function ProfileContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [tab, setTab] = useState<'profile'|'entries'|'security'>('profile');

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [dashUsername, setDashUsername] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [timelyTruth, setTimelyTruth] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  // Password fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/me');
      const d = await r.json();
      if (!d.user) { router.push('/auth'); return; }
      setUser(d.user);
      setDisplayName(d.user.displayName || '');
      setDashUsername(d.user.dashUsername || '');
      setXHandle(d.user.xHandle || '');
      setTimelyTruth(d.user.timelyTruth || '');
      setAvatarPreview(d.user.avatarUrl || '');

      // Load entries
      const er = await fetch('/api/lottery/pool');
      const ed = await er.json();
      // Filter entries related to this user (by displayName, dashUsername, or email matching)
      // Since entries are anonymous by nature, show all entries by this session
      const stored = sessionStorage.getItem('myEntryIds');
      const myIds: string[] = stored ? JSON.parse(stored) : [];
      const myEntries = (ed.entries || []).filter((e: Entry) =>
        myIds.includes(e.id) ||
        (d.user.dashUsername && e.displayName?.replace('@','')?.toLowerCase() === d.user.dashUsername.toLowerCase())
      );
      setEntries(myEntries);
    } catch { router.push('/auth'); }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleSaveProfile = async () => {
    setSaving(true); setSaveMsg('');
    try {
      let avatarUrl = user?.avatarUrl;
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const ur = await fetch('/api/upload', { method: 'POST', body: fd });
        const ud = await ur.json();
        if (ud.url) avatarUrl = ud.url;
      }
      const r = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, dashUsername, xHandle, timelyTruth, avatarUrl }),
      });
      const d = await r.json();
      if (d.ok) { setUser(d.user); setSaveMsg('✅ Profile saved!'); setAvatarFile(null); }
      else setSaveMsg('❌ ' + d.error);
    } catch { setSaveMsg('❌ Network error'); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { setPwMsg('❌ Passwords do not match'); return; }
    if (newPw.length < 8) { setPwMsg('❌ Password must be 8+ characters'); return; }
    setSaving(true); setPwMsg('');
    const r = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const d = await r.json();
    setPwMsg(d.ok ? '✅ Password updated!' : '❌ ' + d.error);
    if (d.ok) { setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
    setSaving(false);
    setTimeout(() => setPwMsg(''), 4000);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this entry?')) return;
    await fetch('/api/entry/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId }) });
    setEntries(prev => prev.filter(e => e.id !== entryId));
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.15) 0%, #050510 60%)' }}>
      <div className="w-10 h-10 border-2 border-t-cyan-400 border-white/10 rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;

  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

  return (
    <div className="min-h-screen px-4 py-8"
         style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.12) 0%, #050510 60%)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-white/50 hover:text-white/80 transition-colors text-sm">← timely.works</Link>
          <button onClick={handleLogout} className="text-xs text-white/30 hover:text-red-400/70 transition-colors px-3 py-1.5 rounded-lg border border-white/6 hover:border-red-400/20">Sign Out</button>
        </div>

        {/* Avatar + Name */}
        <div className="flex items-center gap-5 mb-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center text-2xl">
              {avatarPreview ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" /> : '👤'}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-cyan-500/80 flex items-center justify-center cursor-pointer text-xs hover:bg-cyan-400 transition-colors">
              ✏️
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
          <div>
            <div className="text-xl font-bold text-white/90">{(user.dashUsername ? `@${user.dashUsername}` : user.displayName) || user.email?.split('@')[0]?.replace(/[._-]+/g,' ').trim() || 'Builder'}</div>
            <div className="text-sm text-white/30">{user.email}</div>
            {!user.emailVerified && (
              <div className="text-xs text-orange-400/70 mt-1">⚠️ Email not verified</div>
            )}
          </div>
        </div>

        {/* Verified banner */}
        {params.get('verified') && (
          <div className="rounded-xl px-4 py-3 mb-6 text-sm text-cyan-300/80 border border-cyan-400/15"
               style={{ background: 'rgba(0,255,255,0.04)' }}>
            ✅ Email verified! Welcome to Timely.
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-white/8 p-1 gap-1 mb-6"
             style={{ background: 'rgba(255,255,255,0.02)' }}>
          {(['profile','entries','security'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
                    className="flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize"
                    style={tab === t ? { background: 'rgba(0,255,255,0.1)', border: '1px solid rgba(0,255,255,0.15)', color: 'rgba(0,255,255,0.9)' } : { color: 'rgba(255,255,255,0.35)' }}>
              {t === 'entries' ? `🎟 Entries (${entries.length})` : t === 'security' ? '🔒 Security' : '👤 Profile'}
            </button>
          ))}
        </div>

        {/* ── Profile Tab ──────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div className="rounded-2xl p-6 border border-white/6 space-y-4"
               style={{ background: 'rgba(255,255,255,0.02)' }}>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Display Name</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                       placeholder="Your name" className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none"
                       style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Dash Username</label>
                <input value={dashUsername} onChange={e => setDashUsername(e.target.value)}
                       placeholder="@username"
                       className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none"
                       style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">X.com Handle</label>
                <input value={xHandle} onChange={e => setXHandle(e.target.value)}
                       placeholder="@handle"
                       className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none"
                       style={inputStyle} />
              </div>
            </div>

            {/* Timely Truth */}
            <div>
              <label className="block text-xs text-cyan-300/50 mb-1.5">
                ⬡ Your Timely Truth
                <span className="text-white/20 ml-2 font-normal normal-case tracking-normal">Something that matters deeply to you right now</span>
              </label>
              <textarea value={timelyTruth} onChange={e => setTimelyTruth(e.target.value)} rows={3}
                        placeholder="What truth are you building your life around right now?"
                        className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none resize-none"
                        style={{ ...inputStyle, border: '1px solid rgba(0,255,255,0.1)' }} />
            </div>

            {saveMsg && (
              <div className={`rounded-xl px-4 py-2.5 text-sm ${saveMsg.startsWith('✅') ? 'text-cyan-300/80 border border-cyan-400/15' : 'text-red-400/80 border border-red-400/15'}`}
                   style={{ background: saveMsg.startsWith('✅') ? 'rgba(0,255,255,0.04)' : 'rgba(255,60,60,0.05)' }}>
                {saveMsg}
              </div>
            )}

            <button onClick={handleSaveProfile} disabled={saving}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, rgba(0,200,255,0.12), rgba(0,80,200,0.18))', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(0,220,255,0.9)' }}>
              {saving ? '⏳ Saving…' : 'Save Profile →'}
            </button>
          </div>
        )}

        {/* ── Entries Tab ──────────────────────────────────────────── */}
        {tab === 'entries' && (
          <div className="space-y-3">
            {entries.length === 0 ? (
              <div className="text-center py-12 text-white/25">
                <div className="text-3xl mb-3">🎟</div>
                <div className="text-sm">No entries linked to your account yet.</div>
                <p className="text-xs mt-2 text-white/15">Enter a lottery and your entries will appear here.</p>
                <Link href="/lottery" className="inline-flex mt-4 px-5 py-2 rounded-full text-xs text-cyan-400/70 border border-cyan-400/15 hover:border-cyan-400/30 transition-all">
                  → Go to Lottery
                </Link>
              </div>
            ) : entries.map(entry => (
              <div key={entry.id} className="rounded-xl p-4 border border-white/6"
                   style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {entry.initiumTitle && <div className="font-medium text-white/80 text-sm mb-1">{entry.initiumTitle}</div>}
                    <div className="flex flex-wrap gap-3 text-xs text-white/30 font-mono">
                      <span>{entry.dashContributed.toFixed(4)} DASH</span>
                      <span>🎟 {entry.totalTickets} tickets</span>
                      <span className="text-cyan-400/50">⬡ {entry.votusCredits} Votus</span>
                      {entry.votusAvailable > 0 && <span className="text-cyan-300/60">{entry.votusAvailable} available</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteEntry(entry.id)}
                          className="text-xs text-red-400/40 hover:text-red-400/80 transition-colors px-2 py-1 rounded border border-red-400/0 hover:border-red-400/15 flex-shrink-0">
                    Delete
                  </button>
                </div>
                {entry.mediaUrl && (
                  <div className="mt-3">
                    {entry.mediaType === 'video'
                      ? <video src={entry.mediaUrl} className="rounded-lg max-h-40 w-full object-cover" controls muted />
                      : <img src={entry.mediaUrl} alt="initium media" className="rounded-lg max-h-40 w-full object-cover" />
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Security Tab ─────────────────────────────────────────── */}
        {tab === 'security' && (
          <div className="rounded-2xl p-6 border border-white/6 space-y-4"
               style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-sm text-white/50 mb-2">Change Password</div>
            {[
              { label: 'Current Password', value: currentPw, setter: setCurrentPw },
              { label: 'New Password (8+ chars)', value: newPw, setter: setNewPw },
              { label: 'Confirm New Password', value: confirmPw, setter: setConfirmPw },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="block text-xs text-white/40 mb-1.5">{label}</label>
                <input type="password" value={value} onChange={e => setter(e.target.value)}
                       placeholder="••••••••"
                       className="w-full px-4 py-3 rounded-xl text-sm text-white/90 outline-none"
                       style={inputStyle} />
              </div>
            ))}
            {pwMsg && (
              <div className={`rounded-xl px-4 py-2.5 text-sm ${pwMsg.startsWith('✅') ? 'text-cyan-300/80' : 'text-red-400/80'}`}>{pwMsg}</div>
            )}
            <button onClick={handleChangePassword} disabled={saving}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
              Update Password
            </button>

            <div className="pt-4 border-t border-white/6">
              <div className="text-sm text-white/30 mb-3">Danger Zone</div>
              <button onClick={async () => { if (confirm('Delete your account permanently?')) { await fetch('/api/profile', { method: 'DELETE' }); router.push('/'); }}}
                      className="w-full py-2.5 rounded-xl text-sm text-red-400/60 border border-red-400/10 hover:border-red-400/30 hover:text-red-400/80 transition-all">
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.12) 0%, #050510 60%)' }}>
        <div className="w-10 h-10 border-2 border-t-cyan-400 border-white/10 rounded-full animate-spin" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
