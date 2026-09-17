import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { getTodayPriceStatus } from '@/lib/priceRecords';

export async function GET() {
  const db = getDB();
  const today = getTodayPriceStatus(db);

  return NextResponse.json(today);
}
