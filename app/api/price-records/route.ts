import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { normalizePriceRecordQuery, queryPriceRecords } from '@/lib/priceRecords';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const query = normalizePriceRecordQuery({
    date: params.get('date'),
    from: params.get('from'),
    to: params.get('to'),
    fnd_cod: params.get('fnd_cod'),
    fnd_nm: params.get('fnd_nm'),
    sort: params.get('sort'),
    order: params.get('order'),
    page: params.get('page'),
    page_size: params.get('page_size'),
  });

  const db = getDB();
  const response = queryPriceRecords(db, query);

  return NextResponse.json(response);
}
