import { notFound } from 'next/navigation';
import { getDB } from '@/lib/db';
import { PriceUploadDetailView } from './PriceUploadDetailView';
import type { PriceRecord, PriceUpload } from '@/types';

export default async function PriceUploadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uploadId = Number(id);

  if (!Number.isInteger(uploadId)) {
    notFound();
  }

  const db = getDB();

  const upload = db.prepare('SELECT * FROM price_uploads WHERE id = ?').get(uploadId) as
    | PriceUpload
    | undefined;

  if (!upload) {
    notFound();
  }

  const records = db
    .prepare('SELECT * FROM price_records WHERE upload_id = ? ORDER BY id ASC')
    .all(uploadId) as PriceRecord[];

  return <PriceUploadDetailView upload={upload} records={records} />;
}
