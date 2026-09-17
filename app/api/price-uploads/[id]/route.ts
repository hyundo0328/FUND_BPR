import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { getUploadDetail } from '@/lib/priceRecords';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uploadId = Number(id);

  if (!Number.isInteger(uploadId)) {
    return NextResponse.json({ error: '올바르지 않은 업로드 ID입니다.' }, { status: 400 });
  }

  const db = getDB();
  const detail = getUploadDetail(db, uploadId);

  if (!detail) {
    return NextResponse.json({ error: '업로드 내역을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json(detail);
}
