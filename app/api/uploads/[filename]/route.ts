export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { lookup } from 'mime-types';

const UPLOAD_DIR = process.env.LOTTERY_DATA_DIR
  ? join(process.env.LOTTERY_DATA_DIR, 'uploads')
  : '/root/.openclaw/workspace/timely-lottery-data/uploads';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  // Security: no path traversal
  if (filename.includes('/') || filename.includes('..') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }
  const filepath = join(UPLOAD_DIR, filename);
  if (!existsSync(filepath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const buffer = readFileSync(filepath);
  const mimeType = (lookup(filename) as string) || 'application/octet-stream';
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
