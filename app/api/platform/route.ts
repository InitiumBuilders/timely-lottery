import { NextRequest, NextResponse } from 'next/server';
import { 
  getLotteriesFromChain, 
  getResultFromChain, 
  getInitiumsFromChain,
  getInitiumFromChain,
  verifyLotteryOnChain 
} from '@/lib/platform';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const lotteryId = searchParams.get('lotteryId');
  const slug = searchParams.get('slug');

  try {
    switch (action) {
      case 'lotteries':
        const lotteries = await getLotteriesFromChain();
        return NextResponse.json({ success: true, lotteries });

      case 'result':
        if (!lotteryId) return NextResponse.json({ error: 'lotteryId required' }, { status: 400 });
        const result = await getResultFromChain(lotteryId);
        return NextResponse.json({ success: true, result });

      case 'initiums':
        const initiums = await getInitiumsFromChain();
        return NextResponse.json({ success: true, initiums });

      case 'initium':
        if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
        const initium = await getInitiumFromChain(slug);
        return NextResponse.json({ success: true, initium });

      case 'verify':
        if (!lotteryId) return NextResponse.json({ error: 'lotteryId required' }, { status: 400 });
        const verification = await verifyLotteryOnChain(lotteryId);
        return NextResponse.json({ success: true, verification });

      default:
        return NextResponse.json({ 
          success: true, 
          message: 'Dash Platform API active',
          contractId: process.env.TIMELY_CONTRACT_ID,
          identityId: process.env.DASH_IDENTITY_ID
        });
    }
  } catch (error: any) {
    console.error('[api/platform] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
