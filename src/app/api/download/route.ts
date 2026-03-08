import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get('file') || '';
  const allowed = ['run-topup.cjs'];
  if (!allowed.includes(file)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const filePath = path.join(process.cwd(), 'public', file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
