export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const initium = await prisma.initium.findUnique({ where: { id: params.id }, include: { user: { select: { displayName: true, avatarUrl: true } } } });
  if (!initium || !initium.isPublic) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ initium });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const initium = await prisma.initium.findUnique({ where: { id: params.id } });
  if (!initium || initium.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { title, description, url, mediaUrl, mediaType, customSlug, isPublic, dashAddress } = await req.json();
  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (url !== undefined) data.url = url?.trim() || null;
  if (mediaUrl !== undefined) data.mediaUrl = mediaUrl || null;
  if (mediaType !== undefined) data.mediaType = mediaType || null;
  if (isPublic !== undefined) data.isPublic = !!isPublic;
  if (dashAddress !== undefined) data.dashAddress = dashAddress?.trim() || null;

  if (customSlug) {
    const newSlug = customSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g,'').slice(0,50);
    const conflict = await prisma.initium.findFirst({ where: { slug: newSlug, NOT: { id: params.id } } });
    if (conflict) return NextResponse.json({ error: 'That URL is already taken' }, { status: 409 });
    data.slug = newSlug;
  }

  const updated = await prisma.initium.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, initium: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const initium = await prisma.initium.findUnique({ where: { id: params.id } });
  if (!initium || initium.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.initium.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
