export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

const cache = new Map<string, { data: any; ts: number }>();

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !url.startsWith('http')) return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < 3_600_000) return NextResponse.json(cached.data);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TimelyWorksBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return NextResponse.json({ title: '', description: '', image: '' });
    const html = await r.text();
    const get = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m?.[1] || '';
    };
    const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const result = {
      title: get('og:title') || titleM?.[1] || '',
      description: get('og:description') || get('description') || '',
      image: get('og:image') || '',
      siteName: get('og:site_name') || '',
    };
    cache.set(url, { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch { return NextResponse.json({ title: '', description: '', image: '' }); }
}
