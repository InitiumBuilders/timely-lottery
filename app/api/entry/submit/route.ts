export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getActiveLottery, getEntryByAddress, getNextEntryAddressIndex, upsertEntry } from '@/lib/store';
import { deriveEntryAddress, getContributions, isValidDashAddress } from '@/lib/dash';
import { publishEntry } from '@/lib/platform';
import { ticketsForDash, votusForTickets, totalTickets } from '@/lib/ticket-utils';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      dashUsername, displayName,
      initium, initiumTitle, initiumDescription, initiumUrl,
      dashReceiveAddress, dashEvolutionUsername,
      mediaUrl: bodyMediaUrl, mediaType: bodyMediaType,
      initiumId,   // ← ID of a saved Prisma Initium card (optional)
    } = body;

    const lottery = getActiveLottery();
    if (!lottery) return NextResponse.json({ error: 'No active lottery' }, { status: 404 });

    // ── Resolve logged-in user (for profile avatar fallback + initiumId lookup) ─
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const loggedInUser = token ? await getSessionUser(token) : null;

    // ── If an initiumId was provided, load content from the saved card ──────────
    let resolvedTitle       = initiumTitle;
    let resolvedDescription = initiumDescription;
    let resolvedUrl         = initiumUrl;
    let resolvedMediaUrl    = bodyMediaUrl;
    let resolvedMediaType   = bodyMediaType;
    let resolvedInitiumId   = initiumId || undefined;
    let resolvedInitiumSlug: string | undefined;

    if (initiumId) {
      try {
        const card = await prisma.initium.findUnique({ where: { id: initiumId } });
        if (card && (!loggedInUser || card.userId === loggedInUser.id)) {
          resolvedInitiumSlug = card.slug;
          resolvedTitle       = resolvedTitle       || card.title;
          resolvedDescription = resolvedDescription || card.description || undefined;
          resolvedUrl         = resolvedUrl         || card.url || undefined;
          // Use card media if no explicit media uploaded
          if (!resolvedMediaUrl && card.mediaUrl) {
            resolvedMediaUrl = card.mediaUrl;
            resolvedMediaType = card.mediaType || undefined;
          }
          // Increment timesUsed on the initium card
          await prisma.initium.update({
            where: { id: initiumId },
            data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
          });
        }
      } catch { /* non-fatal */ }
    }

    // ── Profile avatar fallback — use avatarUrl if no media set ─────────────────
    if (!resolvedMediaUrl && loggedInUser?.avatarUrl) {
      resolvedMediaUrl  = loggedInUser.avatarUrl;
      resolvedMediaType = 'image';
    }

    // Validate DASH receive address if provided
    if (dashReceiveAddress && !isValidDashAddress(dashReceiveAddress)) {
      return NextResponse.json({ error: 'Invalid DASH receive address: must start with X and be 34 characters' }, { status: 400 });
    }

    // Build identity string for dedup — anonymous ok
    const identityKey = dashReceiveAddress?.trim()
      || (dashUsername?.trim() ? `${dashUsername.trim()}.dash` : null)
      || (displayName?.trim() ? `name-${displayName.trim()}` : null)
      || (loggedInUser?.id ? `user-${loggedInUser.id}` : null)
      || `anon-${nanoid(6)}`;

    // Check if entry already exists for this identity in this lottery
    const existing = getEntryByAddress(lottery.id, identityKey);
    if (existing) return NextResponse.json({ entry: existing, existing: true });

    // Derive unique deposit address for this entry
    let entryAddress: string;
    let entryAddressIndex: number;
    try {
      entryAddressIndex = getNextEntryAddressIndex();
      const derived = deriveEntryAddress(entryAddressIndex);
      entryAddress = derived.address;
    } catch (err) {
      return NextResponse.json({ error: `Could not generate deposit address: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }

    // Check for pre-existing contributions
    let dashContributed = 0;
    let baseTickets = 0;
    let verifiedTxIds: string[] = [];
    try {
      const contribs = await getContributions(entryAddress);
      dashContributed = contribs.reduce((s, c) => s + c.amount, 0);
      baseTickets = ticketsForDash(dashContributed);
      verifiedTxIds = contribs.map(c => c.txId);
    } catch { /* no contributions yet */ }

    // 1 Votus per 0.3 DASH (per 3 base tickets); unspent Votus count as bonus tickets
    const votusCredits = votusForTickets(baseTickets);
    const cleanUsername = dashEvolutionUsername?.trim().replace(/^@/, '') || undefined;

    const entry = {
      id:                    nanoid(10),
      lotteryId:             lottery.id,
      dashAddress:           identityKey,
      dashReceiveAddress:    dashReceiveAddress?.trim() || undefined,
      dashEvolutionUsername: cleanUsername,
      dashUsername:          dashUsername?.trim().replace(/^@/, '') || loggedInUser?.dashUsername?.trim().replace(/^@/, '') || undefined,
      // Display name: Dash username takes priority — NEVER use email as display
      displayName:           displayName?.trim() || loggedInUser?.displayName || undefined,
      initium:               initium?.trim() || undefined,
      initiumTitle:          resolvedTitle?.trim() || undefined,
      initiumDescription:    resolvedDescription?.trim() || undefined,
      initiumUrl:            resolvedUrl?.trim() || undefined,
      initiumId:             resolvedInitiumId,
      initiumSlug:           resolvedInitiumSlug,
      isAnonymous:           false,
      userId:                loggedInUser?.id || undefined,
      entryAddress,
      entryAddressIndex,
      dashContributed,
      baseTickets,
      upvoteTickets:   0,
      totalTickets:    totalTickets(baseTickets, 0), // no Votus bonus on own entry
      verifiedTxIds,
      upvoters:        [],
      upvotedEntries:  [],
      votusCredits,
      votusSpent:      0,
      votusAvailable:  votusCredits,
      mediaUrl:        resolvedMediaUrl  || undefined,
      mediaType:       resolvedMediaType || undefined,
      createdAt:       Date.now(),
    };

    upsertEntry(entry);

    // ── Publish anonymized entry to Dash Drive (fire-and-forget) ─────────────
    // NO PII: only public DPNS username, contribution amount, ticket count, initium title
    publishEntry(entry).catch(e => console.error('[platform] publishEntry:', e));

    return NextResponse.json({ entry });
  } catch (err) {
    console.error('[submit] Error:', err);
    return NextResponse.json({ error: `Server error: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
