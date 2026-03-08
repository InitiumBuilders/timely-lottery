export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';

const UPLOAD_DIR = process.env.LOTTERY_DATA_DIR
  ? join(process.env.LOTTERY_DATA_DIR, 'uploads')
  : '/root/.openclaw/workspace/timely-lottery-data/uploads';

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGE = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/mov', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE, ...ALLOWED_VIDEO];

export async function POST(req: NextRequest) {
  try {
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: images (jpg/png/gif/webp) and videos (mp4/webm/mov)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const filename = `${nanoid(16)}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);
    writeFileSync(filepath, Buffer.from(bytes));

    const isVideo = ALLOWED_VIDEO.includes(file.type);
    const url = `/api/uploads/${filename}`;
    return NextResponse.json({ ok: true, url, type: isVideo ? 'video' : 'image', filename });
  } catch (e) {
    console.error('[upload]', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
