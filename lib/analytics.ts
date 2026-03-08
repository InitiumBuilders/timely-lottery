/**
 * ─── lib/analytics.ts ─ Timely Insight Analytics Engine ─────────────────────
 *
 * File-based analytics store. Tracks page views, sessions, countries,
 * time-on-site, and aggregated stats for the Timely Insight dashboard.
 *
 * DATA FILE: $LOTTERY_DATA_DIR/analytics.json
 * COUNTRY CACHE: $LOTTERY_DATA_DIR/country-cache.json
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR          = process.env.LOTTERY_DATA_DIR || '/root/.openclaw/workspace/timely-lottery-data';
const ANALYTICS_FILE    = path.join(DATA_DIR, 'analytics.json');
const COUNTRY_CACHE_FILE = path.join(DATA_DIR, 'country-cache.json');

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface DayStats {
  views: number;
  sessions: number;       // unique sessions that day (deduplicated)
  timeMs: number;         // total time spent in ms
  sessionIds: string[];   // hashed session IDs for deduplication
}

export interface PageStats {
  views: number;
  sessions: number;
  timeMs: number;
  sessionIds: string[];
}

export interface AnalyticsStore {
  totalViews: number;
  totalUniqueSessions: number;
  totalTimeMs: number;
  byDay: Record<string, DayStats>;      // "YYYY-MM-DD" → DayStats
  byPage: Record<string, PageStats>;    // "/path" → PageStats
  byCountry: Record<string, number>;    // "US" → view count
  lastUpdated: number;
}

type CountryCache = Record<string, string>; // ipHash → countryCode

// ─── File helpers ─────────────────────────────────────────────────────────────

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ok */ }
}

function load(): AnalyticsStore {
  ensureDir();
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8'));
    }
  } catch { /* corrupt */ }
  return {
    totalViews: 0,
    totalUniqueSessions: 0,
    totalTimeMs: 0,
    byDay: {},
    byPage: {},
    byCountry: {},
    lastUpdated: Date.now(),
  };
}

function save(data: AnalyticsStore) {
  ensureDir();
  data.lastUpdated = Date.now();
  try {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data), 'utf-8');
  } catch (e) {
    console.error('[analytics] save error:', e);
  }
}

function loadCountryCache(): CountryCache {
  try {
    if (fs.existsSync(COUNTRY_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(COUNTRY_CACHE_FILE, 'utf-8'));
    }
  } catch { /* ok */ }
  return {};
}

function saveCountryCache(cache: CountryCache) {
  try { fs.writeFileSync(COUNTRY_CACHE_FILE, JSON.stringify(cache), 'utf-8'); } catch { /* ok */ }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function hashStr(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

// ─── Country resolution (cached IP → country code via ip-api.com) ─────────────

export async function resolveCountry(ip: string): Promise<string> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' ||
      ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    return 'Local';
  }
  const cache = loadCountryCache();
  const key   = hashStr(ip);
  if (cache[key]) return cache[key];

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const j = await res.json() as { countryCode?: string };
      const code = j.countryCode || 'Unknown';
      cache[key] = code;
      saveCountryCache(cache);
      return code;
    }
  } catch { /* timeout / network */ }

  return 'Unknown';
}

// ─── Event tracking ───────────────────────────────────────────────────────────

export interface TrackInput {
  sessionId: string;
  page: string;
  userId?: string | null;
  country: string;
  timeOnPageMs?: number;  // time spent on prevPage (sent when navigating away)
  prevPage?: string;
}

export function recordPageView(input: TrackInput): void {
  const data        = load();
  const today       = new Date().toISOString().slice(0, 10);
  const sessionHash = hashStr(input.sessionId);
  const page        = (input.page.split('?')[0] || '/').slice(0, 120);

  // ── All-time views ────────────────────────────────────────────────────────
  data.totalViews += 1;

  // ── Daily ────────────────────────────────────────────────────────────────
  if (!data.byDay[today]) {
    data.byDay[today] = { views: 0, sessions: 0, timeMs: 0, sessionIds: [] };
  }
  const day = data.byDay[today];
  day.views += 1;
  if (!day.sessionIds.includes(sessionHash)) {
    day.sessionIds.push(sessionHash);
    day.sessions += 1;
    data.totalUniqueSessions += 1;
  }

  // ── Time attribution (attributed to the page the user just left) ──────────
  if (
    input.timeOnPageMs &&
    input.prevPage &&
    input.timeOnPageMs > 500 &&
    input.timeOnPageMs < 1_800_000   // max 30 min per page
  ) {
    const ms    = input.timeOnPageMs;
    const prevP = (input.prevPage.split('?')[0] || '/').slice(0, 120);
    day.timeMs        += ms;
    data.totalTimeMs  += ms;
    if (!data.byPage[prevP]) {
      data.byPage[prevP] = { views: 0, timeMs: 0, sessions: 0, sessionIds: [] };
    }
    data.byPage[prevP].timeMs += ms;
  }

  // ── Per-page stats ────────────────────────────────────────────────────────
  if (!data.byPage[page]) {
    data.byPage[page] = { views: 0, timeMs: 0, sessions: 0, sessionIds: [] };
  }
  const pg = data.byPage[page];
  pg.views += 1;
  if (!pg.sessionIds.includes(sessionHash)) {
    pg.sessionIds.push(sessionHash);
    pg.sessions += 1;
  }

  // ── Country ───────────────────────────────────────────────────────────────
  if (input.country && input.country !== 'Unknown' && input.country !== 'Local') {
    data.byCountry[input.country] = (data.byCountry[input.country] || 0) + 1;
  }

  // ── Prune daily stats older than 90 days ─────────────────────────────────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const key of Object.keys(data.byDay)) {
    if (key < cutoffStr) delete data.byDay[key];
  }

  // Prune session ID arrays after 500 entries per page/day to avoid unbounded growth
  for (const key of Object.keys(data.byDay)) {
    if (data.byDay[key].sessionIds.length > 500) {
      data.byDay[key].sessionIds = data.byDay[key].sessionIds.slice(-200);
    }
  }
  for (const key of Object.keys(data.byPage)) {
    if (data.byPage[key].sessionIds.length > 500) {
      data.byPage[key].sessionIds = data.byPage[key].sessionIds.slice(-200);
    }
  }

  save(data);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getStats(): AnalyticsStore {
  return load();
}
