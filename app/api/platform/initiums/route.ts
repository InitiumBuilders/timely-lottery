// GET /api/platform/initiums
// GET /api/platform/initiums?slug=my-slug
//
// Query Initiums from Dash Drive (Dash Platform).
// Returns gracefully when TIMELY_CONTRACT_ID is not set.
// All results are read-only — no auth required.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getInitiumsFromChain, getInitiumFromChain } from '@/lib/platform';

export async function GET(req: NextRequest) {
  const contractId = process.env.TIMELY_CONTRACT_ID || null;
  const onChain    = !!contractId;

  const slug = req.nextUrl.searchParams.get('slug');
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') || '20', 10) || 20,
    100,
  );

  try {
    if (slug) {
      // Single Initium lookup by slug
      const initium = await getInitiumFromChain(slug);
      return NextResponse.json({
        onChain,
        contractId,
        initium: initium ? serializeDoc(initium) : null,
        found: !!initium,
      });
    }

    // List Initiums
    const docs     = await getInitiumsFromChain(limit);
    const initiums = docs.map(serializeDoc);

    return NextResponse.json({
      onChain,
      contractId,
      initiums,
      count: initiums.length,
      queried: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/platform/initiums]', msg);
    return NextResponse.json(
      { onChain, contractId, error: 'Query failed', initiums: [], count: 0 },
      { status: 200 }, // 200 — degrade gracefully, never 500 for Drive issues
    );
  }
}

// ─── Serialize a Dash Drive document to plain JSON ────────────────────────────
function serializeDoc(doc: any): Record<string, unknown> {
  try {
    // Dash SDK documents expose .getData() or .toJSON()
    if (typeof doc.toJSON === 'function') return doc.toJSON();
    if (typeof doc.getData === 'function') return doc.getData();
    // Fallback: spread known fields
    return {
      initiumId:       doc.get?.('initiumId')       ?? doc.initiumId,
      slug:            doc.get?.('slug')             ?? doc.slug,
      title:           doc.get?.('title')            ?? doc.title,
      description:     doc.get?.('description')      ?? doc.description,
      url:             doc.get?.('url')              ?? doc.url,
      ownerDpns:       doc.get?.('ownerDpns')        ?? doc.ownerDpns,
      timesUsed:       doc.get?.('timesUsed')        ?? doc.timesUsed,
      totalDashEarned: doc.get?.('totalDashEarned')  ?? doc.totalDashEarned,
      createdAt:       doc.get?.('createdAt')        ?? doc.createdAt,
    };
  } catch {
    return {};
  }
}
