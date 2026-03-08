'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashLogin from '@/components/DashLogin';

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register' | 'dash'>(
    params.get('mode') === 'register' ? 'register' : params.get('mode') === 'dash' ? 'dash' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body: Record<string,string> = { email, password };
      if (mode === 'register' && displayName) body.displayName = displayName;
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Something went wrong'); return; }
      if (d.verifyUrl) {
        setVerifyUrl(d.verifyUrl);
      } else if (d.emailSent) {
        setVerifyUrl('EMAIL_SENT');
      } else {
        router.push('/account');
        router.refresh();
      }
    } catch { setError('Network error — try again'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.15) 0%, #050510 60%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-white/80 hover:text-white transition-colors">
            ⚡ timely.works
          </Link>
          <p className="text-white/30 text-sm mt-2">
            {mode === 'dash' ? 'Sign in with your Dash identity' :
             mode === 'login' ? 'Sign in to your account' : 'Create your Timely account'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 overflow-hidden"
             style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>

          {/* Mode tabs */}
          <div className="flex border-b border-white/6">
            {(['login','register','dash'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setVerifyUrl(''); }}
                      className="flex-1 py-3.5 text-xs font-medium transition-all"
                      style={mode === m
                        ? { color: m === 'dash' ? 'rgba(0,255,200,0.9)' : 'rgba(0,255,255,0.9)', borderBottom: `2px solid ${m === 'dash' ? 'rgba(0,255,200,0.5)' : 'rgba(0,255,255,0.5)'}`, background: m === 'dash' ? 'rgba(0,255,200,0.04)' : 'rgba(0,255,255,0.04)' }
                        : { color: 'rgba(255,255,255,0.3)' }}>
                {m === 'login' ? 'Sign In' : m === 'register' ? 'Create Account' : '⚡ Dash Login'}
              </button>
            ))}
          </div>

          {/* Dash Login Panel */}
          {mode === 'dash' && (
            <div className="p-6">
              <DashLogin
                onSuccess={() => { router.refresh(); }}
                redirectTo="/account"
              />
            </div>
          )}

          {/* Email/Password Panel */}
          {(mode === 'login' || mode === 'register') && (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Display Name <span className="text-white/20">(optional)</span></label>
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                         placeholder="Your name or handle"
                         className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none"
                         style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
              )}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                       placeholder="you@example.com"
                       className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none"
                       style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                       placeholder="••••••••"
                       className="w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/20 outline-none"
                       style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>

              {error && (
                <div className="rounded-xl p-3 border border-red-400/15 text-sm text-red-300/80"
                     style={{ background: 'rgba(255,0,0,0.04)' }}>
                  {error}
                </div>
              )}

              {verifyUrl === 'EMAIL_SENT' ? (
                <div className="rounded-xl p-4 border border-green-400/15 space-y-2"
                     style={{ background: 'rgba(0,255,100,0.04)' }}>
                  <p className="text-sm text-green-300/80 font-medium">✅ Check your email!</p>
                  <p className="text-xs text-white/50">We sent a verification link to {email}.</p>
                </div>
              ) : verifyUrl ? (
                <div className="rounded-xl p-4 border border-yellow-400/15 space-y-3"
                     style={{ background: 'rgba(255,200,0,0.04)' }}>
                  <p className="text-sm text-yellow-300/80 font-medium">✅ Account created!</p>
                  <p className="text-xs text-white/50">Email service not yet configured. Use this link to verify:</p>
                  <a href={verifyUrl} className="block text-xs font-mono text-cyan-400/70 break-all hover:text-cyan-300 transition-colors">{verifyUrl}</a>
                  <button type="button" onClick={() => router.push('/account')}
                          className="w-full py-2.5 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:border-white/20 transition-all">
                    Skip to Profile →
                  </button>
                </div>
              ) : (
                <button type="submit" disabled={loading}
                        className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, rgba(0,200,255,0.15), rgba(0,80,200,0.2))', border: '1px solid rgba(0,200,255,0.25)', color: 'rgba(0,220,255,0.9)' }}>
                  {loading ? '⏳ Please wait…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
                </button>
              )}

              {/* Dash login CTA */}
              <div className="pt-2 border-t border-white/5 text-center">
                <p className="text-xs text-white/30 mb-2">Have a Dash identity?</p>
                <button type="button" onClick={() => { setMode('dash'); setError(''); }}
                        className="text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors">
                  ⚡ Sign in with Dash instead →
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          <Link href="/" className="hover:text-white/40 transition-colors">← Back to timely.works</Link>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,80,180,0.15) 0%, #050510 60%)' }}>
        <div className="w-10 h-10 border-2 border-t-cyan-400 border-white/10 rounded-full animate-spin" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
