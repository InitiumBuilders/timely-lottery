import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';
import { getEntry, upsertEntry } from '@/lib/store';
import prisma from '@/lib/db';

// PATCH /api/entry/update-initium
// Attach or update the Initium on an existing entry (post-submission).
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const user = token ? await getSessionUser(token) : null;
    const body = await req.json();
    const { entryId, initiumId, initiumTitle, initiumDescription, initiumUrl, mediaUrl, mediaType } = body;

    if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 });

    const entry = getEntry(entryId);
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    // Allow owner (by userId) or anonymous (no userId on entry)
    if (user && entry.userId && entry.userId !== user.id) {
      return NextResponse.json({ error: 'Not your entry' }, { status: 403 });
    }

    // Update initium fields — also resolve + store the slug when initiumId is set
    if (initiumId !== undefined) {
      (entry as any).initiumId = initiumId || undefined;
      if (initiumId) {
        try {
          const card = await prisma.initium.findUnique({ where: { id: initiumId }, select: { slug: true } });
          if (card) (entry as any).initiumSlug = card.slug;
        } catch { /* non-fatal */ }
      } else {
        (entry as any).initiumSlug = undefined;
      }
    }
    if (initiumTitle !== undefined) entry.initiumTitle                = initiumTitle || undefined;
    if (initiumDescription !== undefined) entry.initiumDescription   = initiumDescription || undefined;
    if (initiumUrl  !== undefined) entry.initiumUrl                  = initiumUrl  || undefined;
    if (mediaUrl    !== undefined) entry.mediaUrl                    = mediaUrl    || undefined;
    if (mediaType   !== undefined) entry.mediaType                   = mediaType   || undefined;

    upsertEntry(entry);
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    console.error('[update-initium]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
