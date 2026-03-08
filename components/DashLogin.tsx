'use client';
/**
 * ─── DashLogin.tsx ─ Dash Identity Login Component ──────────────────────────
 *
 * Three-step login flow:
 *   1. Enter DPNS username → fetch challenge
 *   2. Sign message (client-side via dashcore-lib or paste from wallet)
 *   3. Verify → session created → redirect
 *
 * Security: Private key never leaves the browser. We only receive a signature.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'username' | 'sign' | 'verifying' | 'done';

interface Challenge {
  nonce:       string;
  dpnsName:    string;
  dashAddress: string;
  identityId:  string;
  message:     string;
  expiresAt:   string;
}

interface DashLoginProps {
  onSuccess?: (user: object) => void;
  redirectTo?: string;
}

export default function DashLogin({ onSuccess, redirectTo = '/' }: DashLoginProps) {
  const router = useRouter();
  const [step, setStep]           = useState<Step>('username');
  const [dpnsName, setDpnsName]   = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [privateKey, setPrivateKey] = useState(''); // WIF — used for client-side signing
  const [signature, setSignature] = useState('');   // or paste pre-signed
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [useWif, setUseWif]       = useState(true); // toggle between WIF sign vs manual paste

  // ── Step 1: Fetch challenge ──────────────────────────────────────────────
  async function requestChallenge() {
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/dash-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dpnsName: dpnsName.replace(/\.dash$/, '') }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to fetch challenge'); return; }
      setChallenge(data);
      setStep('sign');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2a: Sign with WIF via secure server-side helper ─────────────────
  // The WIF is sent over HTTPS to our API, which signs and immediately discards it.
  // The private key is never stored. For production, use a hardware wallet instead.
  async function signWithWif() {
    if (!challenge) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/dash-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wif: privateKey.trim(), message: challenge.message }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Signing failed'); return; }
      setSignature(data.signature);
      await verifySignature(data.signature);
    } catch (e) {
      setError(`Signing failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2b: Submit manually pasted signature ─────────────────────────────
  async function submitSignature() {
    if (!signature.trim()) { setError('Please paste your signature'); return; }
    setLoading(true);
    await verifySignature(signature.trim());
    setLoading(false);
  }

  // ── Step 3: Verify on server ──────────────────────────────────────────────
  async function verifySignature(sig: string) {
    if (!challenge) return;
    setStep('verifying');
    try {
      const res  = await fetch('/api/auth/dash-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nonce:     challenge.nonce,
          signature: sig,
          dpnsName:  challenge.dpnsName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setStep('sign');
        return;
      }
      setStep('done');
      onSuccess?.(data.user);
      setTimeout(() => router.push(redirectTo), 800);
    } catch {
      setError('Network error during verification');
      setStep('sign');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xl">
          ⚡
        </div>
        <div>
          <h3 className="font-bold text-white">Login with Dash Identity</h3>
          <p className="text-xs text-gray-400">No email. No password. Cryptographic proof.</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Enter username */}
      {step === 'username' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Your Dash Username</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <input
                  type="text"
                  value={dpnsName}
                  onChange={e => setDpnsName(e.target.value.replace(/\.dash$/, '').toLowerCase())}
                  onKeyDown={e => e.key === 'Enter' && requestChallenge()}
                  placeholder="august"
                  className="flex-1 bg-transparent outline-none text-white text-sm"
                  autoFocus
                />
                <span className="text-gray-500 text-sm">.dash</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Your DPNS name on Dash Platform. Don't have one?{' '}
              <a href="https://www.dash.org/downloads/" target="_blank" rel="noopener noreferrer"
                className="text-cyan-400 hover:underline">Get DashPay</a>
            </p>
          </div>
          <button
            onClick={requestChallenge}
            disabled={loading || dpnsName.length < 3}
            className="w-full py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Looking up identity…' : 'Continue →'}
          </button>
        </div>
      )}

      {/* Step 2: Sign */}
      {step === 'sign' && challenge && (
        <div className="space-y-4">
          {/* Challenge info */}
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Identity found</span>
              <span className="text-xs text-cyan-400 font-mono">{challenge.dpnsName}.dash</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Dash address</span>
              <span className="text-xs text-gray-300 font-mono">{challenge.dashAddress.slice(0,12)}…</span>
            </div>
          </div>

          {/* Message to sign */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Message to sign</label>
            <pre className="p-3 rounded-xl bg-black/30 border border-white/10 text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
              {challenge.message}
            </pre>
          </div>

          {/* Toggle signing method */}
          <div className="flex gap-2">
            <button
              onClick={() => setUseWif(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${useWif ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300' : 'bg-white/5 border border-white/10 text-gray-400'}`}
            >
              Sign with WIF key
            </button>
            <button
              onClick={() => setUseWif(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${!useWif ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300' : 'bg-white/5 border border-white/10 text-gray-400'}`}
            >
              Paste signature
            </button>
          </div>

          {useWif ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Private Key (WIF) — stays in your browser, never sent
                </label>
                <input
                  type="password"
                  value={privateKey}
                  onChange={e => setPrivateKey(e.target.value)}
                  placeholder="7PkPSL4..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>
              <button
                onClick={signWithWif}
                disabled={loading || !privateKey.trim()}
                className="w-full py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 font-medium transition-all disabled:opacity-50"
              >
                {loading ? 'Signing…' : '⚡ Sign & Login'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                Your key is used only to sign the message. It is never transmitted.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Paste your signature</label>
                <textarea
                  value={signature}
                  onChange={e => setSignature(e.target.value)}
                  placeholder="H..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-500/50 font-mono resize-none"
                />
              </div>
              <button
                onClick={submitSignature}
                disabled={loading || !signature.trim()}
                className="w-full py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 font-medium transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify & Login →'}
              </button>
            </div>
          )}

          <button
            onClick={() => { setStep('username'); setChallenge(null); setError(''); }}
            className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step: Verifying */}
      {step === 'verifying' && (
        <div className="text-center py-8 space-y-3">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Verifying your identity on Dash Platform…</p>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="text-center py-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-2xl mx-auto">
            ✅
          </div>
          <p className="text-white font-medium">Identity verified!</p>
          <p className="text-gray-400 text-sm">Redirecting…</p>
        </div>
      )}
    </div>
  );
}
