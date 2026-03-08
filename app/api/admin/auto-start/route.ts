import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getActiveLottery, upsertLottery, getNextAddressIndex, getAdminSettings, saveAdminSettings, getReserveStats } from '@/lib/store';
import { deriveLotteryAddress, sweepNextLotteryFundsToLottery } from '@/lib/dash';

const ADMIN_PASS   = process.env.ADMIN_PASSWORD || '';
const OPENAI_KEY   = process.env.OPENAI_API_KEY || '';

export const dynamic = 'force-dynamic';

// ── AI name/description generator ────────────────────────────────────────────
async function generateLotteryMeta(durationDays: number): Promise<{ title: string; description: string }> {
  if (!OPENAI_KEY) return defaultMeta(durationDays);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const hour = now.getUTCHours();
  const timeOfDay = hour < 6 ? 'deep night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'midnight';
  const season = now.getMonth() < 3 ? 'winter' : now.getMonth() < 6 ? 'spring' : now.getMonth() < 9 ? 'summer' : 'autumn';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 250,
        temperature: 1.1,
        messages: [
          {
            role: 'system',
            content: `You are the wildly creative naming director for Timely.Works — a DASH-powered autonomous community lottery.
Your names are LEGENDARY. Unexpected. Poetic. Culture-aware. They stop people mid-scroll.

Rules:
- Title: 2-6 words. Can be punchy, philosophical, cultural, playful, strange, or profound.
- NO generic month names like "The March Round" — be SPECIFIC and creative.
- Connect to: current tech/AI trends, human moments, philosophy, pop culture, blockchain culture, cosmic events, social movements, street culture, language, music, memes — whatever feels most alive RIGHT NOW.
- Vary the style wildly between rounds: sometimes short+punchy ("Proof of Belief"), sometimes poetic ("When Stars Trade Coordinates"), sometimes cultural ("The Vibe Shift Tax"), sometimes philosophical ("What Comes After Certainty"), sometimes memey ("This Is Fine. Bid Anyway."), sometimes future-forward ("Year Zero of the New Economy")
- Description: 1-2 sentences, 15-25 words. Poetic but grounded. Should make the reader FEEL something.
- Return ONLY valid JSON: {"title": "...", "description": "..."}`,
          },
          {
            role: 'user',
            content: `Create a name for a ${durationDays}-day DASH lottery.
Date: ${dateStr} | Day: ${dayOfWeek} | Time: ${timeOfDay} | Season: ${season}

Be unexpected. Make history. This name should be remembered.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return defaultMeta(durationDays);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.title && parsed.description) {
      console.log(`[auto-start] 🎨 AI named this round: "${parsed.title}"`);
      return { title: parsed.title, description: parsed.description };
    }
  } catch (e) {
    console.error('[auto-start] AI generation failed:', e);
  }

  return defaultMeta(durationDays);
}

function defaultMeta(durationDays: number): { title: string; description: string } {
  // Creative fallback names — way better than "The March Round"
  const now = new Date();
  const season = now.getMonth() < 3 ? 'Winter' : now.getMonth() < 6 ? 'Spring' : now.getMonth() < 9 ? 'Summer' : 'Autumn';
  const banks = [
    { title: 'Proof of Belief', description: `${durationDays} days. One winner. The chain doesn't lie.` },
    { title: 'The Vibe Shift Tax', description: `Something is changing. Feel it? Prove it. ${durationDays} days, one payout.` },
    { title: 'When Stars Trade Coordinates', description: `A ${durationDays}-day window where community and chance collide on-chain.` },
    { title: 'This Is Fine. Bid Anyway.', description: `Chaos is the market. ${durationDays} days to find the signal in the noise.` },
    { title: 'Year Zero of the New Economy', description: `${durationDays} days. Powered by $DASH. This is what the future looks like.` },
    { title: `${season} Singularity Round`, description: `The season turns. ${durationDays} days of community momentum, one winner takes all.` },
    { title: 'The Algorithm Chose You', description: `Not really — but someone gets chosen. ${durationDays} days, transparent, on-chain.` },
    { title: 'Momentum Has a Name', description: `${durationDays} days to submit your Initium and let the community decide.` },
    { title: 'Quiet Revolution Drop', description: `Change doesn't always announce itself. This lottery does. ${durationDays} days.` },
    { title: 'Trust the Protocol', description: `Decentralized. Transparent. ${durationDays} days, one winner, zero middlemen.` },
  ];
  return banks[Math.floor(Math.random() * banks.length)];
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.password !== ADMIN_PASS) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if auto-admin is enabled
    const settings = getAdminSettings();
    if (!settings.autoAdmin && !body.force) {
      return NextResponse.json({ ok: false, reason: 'Auto Admin is disabled' });
    }

    // Don't start if lottery already active
    const existing = getActiveLottery();
    if (existing) {
      return NextResponse.json({ ok: false, reason: 'Lottery already active', lotteryId: existing.id });
    }

    const durationDays = body.durationDays ?? settings.autoAdminDurationDays ?? 7;
    const durationMinutes = durationDays * 24 * 60;

    // Generate AI name + description
    const { title, description } = await generateLotteryMeta(durationDays);

    // Derive address
    const addressIndex = getNextAddressIndex();
    let address: string;
    try {
      const derived = deriveLotteryAddress(addressIndex);
      address = derived.address;
    } catch (err) {
      return NextResponse.json({ error: `Address generation failed: ${err}` }, { status: 500 });
    }

    const now  = Date.now();
    const id   = nanoid(10);

    const lottery = {
      id,
      title,
      description,
      address,
      addressIndex,
      status: 'active' as const,
      durationMinutes,
      startTime: now,
      endTime: now + durationMinutes * 60 * 1000,
      totalDash: 0,
      totalTickets: 0,
      participantCount: 0,
      createdAt: now,
      autoStarted: true,
    };

    upsertLottery(lottery);

    // Record last auto-start time
    settings.autoAdminLastStarted = now;
    saveAdminSettings(settings);

    // Seed from next-lottery funds
    const maxIdx = getReserveStats().nextLotteryFundAddressIndex || 0;
    if (maxIdx > 0) {
      sweepNextLotteryFundsToLottery(address, maxIdx).then(result => {
        if (result.totalSwept > 0) {
          console.log(`[auto-start] Seeded ${result.totalSwept.toFixed(4)} DASH into new lottery`);
        }
      }).catch(e => console.error('[auto-start] Seed sweep failed:', e));
    }

    console.log(`[auto-start] ✅ New lottery created: "${title}" | ${durationDays} days | ${id}`);
    return NextResponse.json({ ok: true, lottery, durationDays });

  } catch (err) {
    console.error('[auto-start] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
