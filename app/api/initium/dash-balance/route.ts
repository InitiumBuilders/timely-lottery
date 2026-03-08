export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

const CHAINZ  = 'https://chainz.cryptoid.info/dash/api.dws';
const INSIGHT = 'https://insight.dash.org/insight-api';
const GECKO   = 'https://api.coingecko.com/api/v3/simple/price?ids=dash&vs_currencies=usd';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; TimelyLottery/1.0)' };

interface Cache { data: BalanceResult; ts: number }
const cache = new Map<string, Cache>();

// Shared DASH price cache (5-min TTL)
let dashPriceCache = { usd: 0, ts: 0 };

export interface BalanceResult {
  balance: number;        // current balance in DASH
  totalReceived: number;  // lifetime received in DASH
  usdBalance: number;     // current balance in USD
  usdReceived: number;    // lifetime received in USD
  dashPriceUsd: number;   // DASH/USD price used
}

async function getDashPrice(): Promise<number> {
  if (dashPriceCache.usd > 0 && Date.now() - dashPriceCache.ts < 5 * 60_000) {
    return dashPriceCache.usd;
  }
  try {
    const r = await fetch(GECKO, { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    const price = d?.dash?.usd || 0;
    if (price > 0) dashPriceCache = { usd: price, ts: Date.now() };
    return price;
  } catch { return dashPriceCache.usd || 0; }
}

async function fetchFromChainz(addr: string): Promise<{ balance: number; totalReceived: number }> {
  // Chainz works reliably from Vercel (no Cloudflare block)
  const [balRes, recRes] = await Promise.all([
    fetch(`${CHAINZ}?q=getbalance&a=${addr}`, { headers: HEADERS, signal: AbortSignal.timeout(6000) }),
    fetch(`${CHAINZ}?q=getreceivedbyaddress&a=${addr}`, { headers: HEADERS, signal: AbortSignal.timeout(6000) }),
  ]);
  const balText = await balRes.text();
  const recText = await recRes.text();
  const balance      = parseFloat(balText) || 0;
  const totalReceived = parseFloat(recText) || 0;
  return { balance, totalReceived };
}

async function fetchFromInsight(addr: string): Promise<{ balance: number; totalReceived: number }> {
  // Fallback: insight.dash.org (may be blocked from datacenter IPs)
  const r = await fetch(`${INSIGHT}/addr/${addr}`, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`Insight ${r.status}`);
  const d = await r.json();
  return {
    balance:       d.balance       || 0,
    totalReceived: (d.totalReceivedSat || 0) / 1e8,
  };
}

export async function GET(req: NextRequest) {
  const addr = req.nextUrl.searchParams.get('address');
  if (!addr || !/^X[a-zA-Z0-9]{33}$/.test(addr)) {
    return NextResponse.json({ balance: 0, totalReceived: 0, usdBalance: 0, usdReceived: 0, dashPriceUsd: 0 });
  }

  // Return cached result if fresh (30s TTL)
  const cached = cache.get(addr);
  if (cached && Date.now() - cached.ts < 30_000) {
    return NextResponse.json(cached.data);
  }

  try {
    // Fetch balance + DASH price in parallel
    const [chainData, dashPrice] = await Promise.all([
      fetchFromChainz(addr).catch(() => fetchFromInsight(addr)),
      getDashPrice(),
    ]);

    const result: BalanceResult = {
      balance:       chainData.balance,
      totalReceived: chainData.totalReceived,
      usdBalance:    parseFloat((chainData.balance * dashPrice).toFixed(2)),
      usdReceived:   parseFloat((chainData.totalReceived * dashPrice).toFixed(2)),
      dashPriceUsd:  dashPrice,
    };

    cache.set(addr, { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[dash-balance] Error:', err);
    return NextResponse.json({ balance: 0, totalReceived: 0, usdBalance: 0, usdReceived: 0, dashPriceUsd: 0 });
  }
}
