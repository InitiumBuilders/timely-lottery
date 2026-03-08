'use client';
import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AnalyticsTracker } from '@/components/AnalyticsTracker';

// ── Admin gate: only these accounts see the Admin link ────────────────────────
const ADMIN_EMAILS    = ['initiumbulders@gmail.com', 'initiumbuliders@gmail.com', 'initiumbuilders@gmail.com'];
const ADMIN_USERNAMES = ['august', 'semberdotsol', 'builtbyaugust'];

function isAdminUser(user: { email?: string; displayName?: string; dashUsername?: string } | null) {
  if (!user) return false;
  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) return true;
  if (user.displayName && ADMIN_USERNAMES.includes(user.displayName.toLowerCase())) return true;
  if (user.dashUsername && ADMIN_USERNAMES.includes(user.dashUsername.toLowerCase())) return true;
  return false;
}

const NAV_LINKS = [
  { href: '/',           label: 'Home' },
  { href: '/lottery',    label: 'Lottery' },
  { href: '/initiums',   label: '💡 Initiums' },
  { href: '/reserve',    label: '🏦 Reserve' },
  { href: '/history',    label: '📜 History' },
  { href: '/contribute', label: 'Contribute' },
  { href: '/account',    label: '👤 Account' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin,  setIsAdmin]  = useState(false);
  const [userId,   setUserId]   = useState<string | null>(null);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (menuOpen) document.body.classList.add('mobile-menu-open');
    else document.body.classList.remove('mobile-menu-open');
    return () => document.body.classList.remove('mobile-menu-open');
  }, [menuOpen]);

  // Check if current user is admin + capture user ID for analytics
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        setIsAdmin(isAdminUser(d.user));
        setUserId(d.user?.id || null);
      })
      .catch(() => { setIsAdmin(false); setUserId(null); });
  }, []);

  return (
    <html lang="en">
      <head>
        <title>Timely.Works — The Founder's Lottery</title>
        <meta name="description" content="The Founder's Lottery. Submit your Initium, buy tickets with $DASH, and compete for the prize pool. 85% to winner · 10% to The Reserve · 5% seeds next lottery." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#020208" />
        {/* Open Graph */}
        <meta property="og:title" content="Timely.Works — The Founder's Lottery" />
        <meta property="og:description" content="Submit your Initium. Buy tickets with $DASH. One founder wins 85% of the pool." />
        <meta property="og:image" content="/logo.png" />
        <meta property="og:url" content="https://www.timely.works" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:image" content="/logo.png" />
        {/* Favicon — teal/green clock SVG mirroring the logo */}
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="scanline grid-bg">

        {/* Background orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="orb w-72 h-72 md:w-[600px] md:h-[600px] bg-cyan-500/5 -top-32 -left-16 md:-top-64 md:-left-32" />
          <div className="orb w-48 h-48 md:w-[400px] md:h-[400px] bg-blue-600/8 top-1/2 -right-24 md:-right-48" />
          <div className="orb w-40 h-40 md:w-[300px] md:h-[300px] bg-purple-600/6 bottom-32 left-1/4" />
        </div>

        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <nav className="fixed top-0 left-0 right-0 z-50"
          style={{ background: 'rgba(2,2,8,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(0,255,255,0.08)', height: '72px' }}>
          <div className="max-w-6xl mx-auto px-4 md:px-6 h-full flex items-center justify-between">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Timely.Works Logo"
                className="w-12 h-12 md:w-14 md:h-14 object-contain flex-shrink-0 transition-transform group-hover:scale-110"
                style={{ filter: 'drop-shadow(0 0 10px rgba(0,230,140,0.55))' }} />
              <span className="font-black tracking-wide group-hover:text-cyan-400 transition-colors"
                style={{ fontSize: 'clamp(0.9rem, 3vw, 1.05rem)', color: '#fff', letterSpacing: '0.04em' }}>
                TIMELY<span className="text-cyan-400">.</span><span className="text-white">WORKS</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-5 lg:gap-6">
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href} className={`nav-link ${pathname === l.href ? 'active' : ''}`}>{l.label}</Link>
              ))}
              {/* Admin — only visible to August */}
              {isAdmin && (
                <Link href="/admin" className="nav-link flex items-center gap-1"
                  style={{ color: 'rgba(0,141,228,0.8)', fontWeight: 700 }}>
                  <span className="text-[10px]">⚙️</span> Admin
                </Link>
              )}
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(o => !o)}
              className="md:hidden flex flex-col gap-1.5 p-2 -mr-2" aria-label="Toggle menu">
              <span className="block w-6 h-0.5 bg-white/70 transition-all" style={{ transform: menuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none' }} />
              <span className="block w-6 h-0.5 bg-white/70 transition-all" style={{ opacity: menuOpen ? 0 : 1 }} />
              <span className="block w-6 h-0.5 bg-white/70 transition-all" style={{ transform: menuOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none' }} />
            </button>
          </div>
        </nav>

        {/* Mobile slide-down menu */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 pt-[72px]" style={{ background: 'rgba(2,2,8,0.98)', backdropFilter: 'blur(24px)' }}>
            <div className="px-6 py-6 space-y-1">
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href} className={`nav-link-mobile ${pathname === l.href ? 'active' : ''}`}>{l.label}</Link>
              ))}
              {isAdmin && (
                <Link href="/admin" className="nav-link-mobile" style={{ color: 'rgba(0,141,228,0.85)', fontWeight: 700 }}>
                  ⚙️ Admin Panel
                </Link>
              )}
            </div>
            <div className="px-6 mt-8 pt-8 border-t" style={{ borderColor: 'rgba(0,255,255,0.08)' }}>
              <p className="text-white/30 text-sm">Powered by <span className="text-[#008DE4]">$DASH</span> — Decentralized Founder Lottery</p>
            </div>
          </div>
        )}

        {/* Analytics tracker — invisible, fire-and-forget */}
        <AnalyticsTracker userId={userId} />

        {/* Main */}
        <main className="relative z-10 pt-[72px]">
          {children}
        </main>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer className="relative z-10 mt-16 md:mt-24 border-t"
          style={{ borderColor: 'rgba(0,255,255,0.08)', background: 'rgba(2,2,8,0.6)' }}>
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">

              {/* Brand */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Timely.Works" className="w-8 h-8 object-contain" style={{ filter: 'drop-shadow(0 0 6px rgba(0,230,140,0.4))' }} />
                  <span className="font-black text-white tracking-wide">TIMELY<span className="text-cyan-400">.</span>WORKS</span>
                </div>
                <p className="text-white/35 text-sm leading-relaxed">
                  The Founder's Lottery. Submit your Initium, buy tickets with $DASH, and compete for the prize pool.
                </p>
              </div>

              {/* Links */}
              <div>
                <div className="text-xs font-mono text-white/30 tracking-widest mb-4">NAVIGATE</div>
                <div className="space-y-2">
                  {NAV_LINKS.map(l => (
                    <Link key={l.href} href={l.href} className="block text-sm text-white/40 hover:text-cyan-400 transition-colors">{l.label}</Link>
                  ))}
                </div>
              </div>

              {/* Built by */}
              <div>
                <div className="text-xs font-mono text-white/30 tracking-widest mb-4">BUILT BY</div>
                <a href="https://AugustJames.Live" target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl transition-all group"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #00FFFF20, #008DE420)', border: '1px solid rgba(0,255,255,0.2)' }}>
                    <span className="text-lg">👤</span>
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm group-hover:text-cyan-400 transition-colors">August James</div>
                    <div className="text-white/30 text-xs font-mono">@BuiltByAugust · AugustJames.Live →</div>
                  </div>
                </a>
              </div>
            </div>

            <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
              style={{ borderColor: 'rgba(0,255,255,0.06)' }}>
              <div className="text-xs text-white/20 font-mono text-center sm:text-left">
                TIMELY.WORKS · Powered by <span className="text-[#008DE4]">$DASH</span> · Built on Emergent Strategy
              </div>
              <div className="flex items-center gap-4">
                <Link href="/contribute" className="text-xs text-cyan-400/50 hover:text-cyan-400 font-mono transition-colors">
                  Support the Platform →
                </Link>
                <span className="text-xs text-white/15 font-mono">Built by August</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
