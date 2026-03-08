export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAllWinners, getTotalStats } from '@/lib/store';

export async function GET() {
  const winners = getAllWinners();
  const stats   = getTotalStats();
  return NextResponse.json({ winners, stats });
}
