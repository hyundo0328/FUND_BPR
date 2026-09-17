import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import type { PriceRecord, PriceUpload } from '@/types';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uploadId = Number(id);

  if (!Number.isInteger(uploadId)) {
    return NextResponse.json({ error: '올바르지 않은 업로드 ID입니다.' }, { status: 400 });
  }

  const db = getDB();

  const upload = db.prepare('SELECT * FROM price_uploads WHERE id = ?').get(uploadId) as
    | PriceUpload
    | undefined;

  if (!upload) {
    return NextResponse.json({ error: '업로드 내역을 찾을 수 없습니다.' }, { status: 404 });
  }

  const records = db
    .prepare('SELECT * FROM price_records WHERE upload_id = ? ORDER BY id ASC')
    .all(uploadId) as PriceRecord[];

  return NextResponse.json({ upload, records });
}
