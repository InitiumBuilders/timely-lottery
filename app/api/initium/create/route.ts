export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { COOKIE_NAME, getSessionUser } from '@/lib/auth';

function toSlug(title: string, id: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
    + '-' + id.slice(-6);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, description, url, mediaUrl, mediaType, customSlug, dashAddress } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  // Generate slug
  const tempId = Math.random().toString(36).slice(-6);
  let slug = customSlug?.trim()
    ? customSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g,'').slice(0,50)
    : toSlug(title.trim(), tempId);

  // Ensure unique slug
  const existing = await prisma.initium.findUnique({ where: { slug } });
  if (existing) slug = slug + '-' + Date.now().toString(36).slice(-4);

  const initium = await prisma.initium.create({
    data: {
      userId: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      url: url?.trim() || null,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      dashAddress: dashAddress?.trim() || null,
      slug,
    },
  });
  return NextResponse.json({ ok: true, initium });
}
