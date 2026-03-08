// GET /api/platform/verify?lotteryId=xxx
//
// Returns on-chain verification status for a lottery.
// Queries Dash Drive for the lottery, result, and entry documents.
//
// Response shape:
//   { onChain: true,  contractId, docs: { lottery, result, entries }, verifiedAt }
//   { onChain: false, contractId: null, docs: { lottery: null, result: null, entries: [] }, verifiedAt }
//
// Always returns HTTP 200 — never throws. Missing or unconfigured = { onChain: false }.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyLotteryOnChain } from '@/lib/platform';

export async function GET(req: NextRequest) {
  const lotteryId = req.nextUrl.searchParams.get('lotteryId')?.trim();

  if (!lotteryId) {
    return NextResponse.json(
      { error: 'Missing required query param: lotteryId' },
      { status: 400 },
    );
  }

  try {
    const result = await verifyLotteryOnChain(lotteryId);
    return NextResponse.json(result);
  } catch (e: unknown) {
    // Should never reach here — verifyLotteryOnChain swallows all errors
    console.error('[api/platform/verify] Unexpected error:', e);
    return NextResponse.json(
      {
        onChain:     false,
        contractId:  process.env.TIMELY_CONTRACT_ID || null,
        docs:        { lottery: null, result: null, entries: [] },
        verifiedAt:  Date.now(),
      },
    );
  }
}
