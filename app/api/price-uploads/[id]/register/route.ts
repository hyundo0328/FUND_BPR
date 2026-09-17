import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { recomputeUploadStatus } from '@/lib/priceRecords';
import type { PriceUpload } from '@/types';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const pendingCount = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM price_records WHERE upload_id = ? AND status = 'pending'`)
      .get(uploadId) as { count: number }
  ).count;

  if (pendingCount === 0) {
    return NextResponse.json({ error: '등록할 항목이 없습니다.' }, { status: 400 });
  }

  const register = db.transaction(() => {
    db.prepare(
      `UPDATE price_records
       SET status = 'registered'
       WHERE upload_id = ? AND status = 'pending'`,
    ).run(uploadId);

    db.prepare(`UPDATE price_uploads SET registered_at = datetime('now', 'localtime') WHERE id = ?`).run(
      uploadId,
    );

    recomputeUploadStatus(db, uploadId);
  });

  register();

  return NextResponse.json({ registeredCount: pendingCount });
}
