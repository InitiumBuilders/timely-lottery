export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';
import {
  addWordSubmission, getWordSubmissions, getWordFrequency,
  getActiveLottery, WordSubmission,
} from '@/lib/store';

// ── GET /api/words?target=current|next|all ────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const target = req.nextUrl.searchParams.get('target') as 'current' | 'next' | 'all' | null;
    const lottery = getActiveLottery();

    let currentWords: WordSubmission[] = [];
    let nextWords: WordSubmission[]    = [];

    if (!target || target === 'current' || target === 'all') {
      currentWords = getWordSubmissions({ target: 'current', lotteryId: lottery?.id });
    }
    if (!target || target === 'next' || target === 'all') {
      nextWords = getWordSubmissions({ target: 'next' });
    }

    const allWords = target === 'current' ? currentWords
                   : target === 'next'    ? nextWords
                   : [...currentWords, ...nextWords];

    return NextResponse.json({
      currentWords:    currentWords.slice(0, 200),
      nextWords:       nextWords.slice(0, 200),
      currentFreq:     getWordFrequency(currentWords),
      nextFreq:        getWordFrequency(nextWords),
      allFreq:         getWordFrequency(allWords),
      currentLotteryId: lottery?.id,
      currentLotteryTitle: lottery?.title,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST /api/words ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const user  = await getSessionUser(token);
    if (!user) return NextResponse.json({ error: 'Sign in to submit a word' }, { status: 401 });

    const body  = await req.json();
    const raw   = (body.word || '').toString().trim();
    const target: 'current' | 'next' = body.target === 'next' ? 'next' : 'current';

    // Validation
    if (!raw) return NextResponse.json({ error: 'Word is required' }, { status: 400 });
    if (raw.includes(' ') || raw.length > 32) {
      return NextResponse.json({ error: 'One word only, max 32 characters' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9\-_#@]+$/.test(raw)) {
      return NextResponse.json({ error: 'Letters, numbers, hyphens only' }, { status: 400 });
    }

    const lottery = getActiveLottery();
    const lotteryId = target === 'current' ? lottery?.id : undefined;

    const sub: WordSubmission = {
      id:        nanoid(8),
      word:      raw.toLowerCase(),
      target,
      lotteryId,
      userId:    user.id,
      username:  user.dashUsername ? `@${user.dashUsername}` : (user.displayName || user.email?.split('@')[0]?.replace(/[._-]+/g,' ').trim() || 'Builder'),
      timestamp: Date.now(),
    };

    addWordSubmission(sub);
    return NextResponse.json({ ok: true, submission: sub });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
