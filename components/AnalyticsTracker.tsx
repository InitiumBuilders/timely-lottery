'use client';
/**
 * AnalyticsTracker — invisible client-side tracker for Timely Insight.
 * Tracks page views, time-on-page, and session continuity.
 * Fires zero requests on server — pure client behavior.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface Props {
  userId?: string | null;
}

export function AnalyticsTracker({ userId }: Props) {
  const pathname    = usePathname();
  const sidRef      = useRef<string>('');
  const prevPageRef = useRef<string>('');
  const enterTimeRef = useRef<number>(0);

  // ── Create/restore session ID ──────────────────────────────────────────────
  useEffect(() => {
    try {
      let sid = sessionStorage.getItem('_tw_sid');
      if (!sid) {
        sid = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem('_tw_sid', sid);
      }
      sidRef.current = sid;
    } catch {
      // Private browsing / blocked storage — still track without persistence
      if (!sidRef.current) {
        sidRef.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
    }
  }, []);

  // ── Track page views on route change ──────────────────────────────────────
  useEffect(() => {
    const sid = sidRef.current;
    if (!sid) return;

    const now = Date.now();
    const timeOnPrev = prevPageRef.current && enterTimeRef.current
      ? now - enterTimeRef.current
      : 0;
    const prevPage = prevPageRef.current;

    // Fire and forget — never block navigation
    fetch('/api/analytics/track', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId:    sid,
        page:         pathname,
        userId:       userId || undefined,
        timeOnPageMs: timeOnPrev > 500 ? timeOnPrev : undefined,
        prevPage:     prevPage || undefined,
      }),
    }).catch(() => {/* silent */});

    prevPageRef.current  = pathname;
    enterTimeRef.current = now;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── Track time on final page when tab closes ──────────────────────────────
  useEffect(() => {
    const handleUnload = () => {
      const sid = sidRef.current;
      if (!sid || !prevPageRef.current || !enterTimeRef.current) return;
      const timeMs = Date.now() - enterTimeRef.current;
      if (timeMs < 500) return;

      // sendBeacon is fire-and-forget, survives page unload
      const payload = JSON.stringify({
        sessionId:    sid,
        page:         pathname,
        userId:       userId || undefined,
        timeOnPageMs: timeMs,
        prevPage:     prevPageRef.current,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/track', new Blob([payload], { type: 'application/json' }));
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [pathname, userId]);

  return null; // renders nothing
}
