// GET /api/github-commit
//
// Returns the latest commit from the public InitiumBuilders/timely-lottery repo.
// Cached for 5 minutes. No auth required (public repo).

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const GITHUB_REPO = 'InitiumBuilders/timely-lottery';
const GITHUB_API  = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;
const CACHE_MS    = 5 * 60 * 1000; // 5 minutes

let _cache: { sha: string; message: string; date: string; url: string } | null = null;
let _cacheTime = 0;

export async function GET() {
  // Serve from in-process cache if fresh
  if (_cache && Date.now() - _cacheTime < CACHE_MS) {
    return NextResponse.json(_cache, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
    });
  }

  try {
    const res = await fetch(GITHUB_API, {
      headers: {
        'Accept':     'application/vnd.github.v3+json',
        'User-Agent': 'Timely.Works/1.2',
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    const commit = {
      sha:     (data.sha || '').slice(0, 7),
      shaFull: data.sha || '',
      message: (data.commit?.message || '').split('\n')[0].slice(0, 120), // first line only
      date:    data.commit?.committer?.date || data.commit?.author?.date || new Date().toISOString(),
      author:  data.commit?.author?.name || 'Unknown',
      url:     data.html_url || `https://github.com/${GITHUB_REPO}`,
      repo:    `https://github.com/${GITHUB_REPO}`,
    };

    _cache     = commit;
    _cacheTime = Date.now();

    return NextResponse.json(commit, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/github-commit]', msg);

    // Return last cached value if available, else a placeholder
    if (_cache) return NextResponse.json(_cache);
    return NextResponse.json({
      sha:     '—',
      shaFull: '',
      message: 'Open source. Verifiable. Yours.',
      date:    new Date().toISOString(),
      author:  'InitiumBuilders',
      url:     `https://github.com/${GITHUB_REPO}`,
      repo:    `https://github.com/${GITHUB_REPO}`,
    });
  }
}
