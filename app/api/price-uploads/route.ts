import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';
import { getDB } from '@/lib/db';
import { evaluatePriceRecordStatus, recomputeUploadStatus } from '@/lib/priceRecords';
import type { PriceRecord } from '@/types';

const FIELD_COUNT = 11;

function decodeFileBuffer(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return iconv.decode(buffer, 'euc-kr');
  }
}

function todayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

type ParsedRecord = Omit<PriceRecord, 'id' | 'upload_id'>;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 첨부되지 않았습니다.' }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith('.txt')) {
    return NextResponse.json({ error: 'txt 파일만 업로드할 수 있습니다.' }, { status: 400 });
  }

  const overwriteQuery = request.nextUrl.searchParams.get('overwrite');
  const overwriteField = formData.get('overwrite');
  const overwrite = overwriteQuery === 'true' || overwriteField === 'true';

  const buffer = Buffer.from(await file.arrayBuffer());
  const content = decodeFileBuffer(buffer);

  const lines = content
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return NextResponse.json({ error: '파일에 처리할 내용이 없습니다.' }, { status: 400 });
  }

  const parsedRecords: ParsedRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const parts = raw.split(',').map((part) => part.trim());

    if (parts.length !== FIELD_COUNT) {
      return NextResponse.json(
        {
          error: `${i + 1}번째 줄의 항목 개수가 예상(${FIELD_COUNT}개)과 다릅니다. 파일 형식을 확인해주세요.`,
        },
        { status: 400 },
      );
    }

    const [
      price_date,
      fnd_nm,
      fnd_cod,
      mgmt_com_cod,
      mgmt_com_nm,
      tr_bpr,
      tx_bpr,
      fr_tax_free_bpr,
      full_tr_bpr,
      income_tax_law,
      currency_type,
    ] = parts;

    const trBprNum = Number(tr_bpr);
    const { status, issue_reason } = evaluatePriceRecordStatus(fnd_cod, fnd_nm, tr_bpr, trBprNum);

    parsedRecords.push({
      price_date,
      fnd_nm,
      fnd_cod,
      mgmt_com_cod,
      mgmt_com_nm,
      tr_bpr: Number.isNaN(trBprNum) ? 0 : trBprNum,
      tx_bpr: Number(tx_bpr),
      fr_tax_free_bpr: Number(fr_tax_free_bpr),
      full_tr_bpr: Number(full_tr_bpr),
      income_tax_law,
      currency_type,
      raw_line: raw,
      status,
      issue_reason,
    });
  }

  const db = getDB();
  const uploadDate = todayDate();

  const existing = db
    .prepare('SELECT id FROM price_uploads WHERE upload_date = ?')
    .get(uploadDate) as { id: number } | undefined;

  if (existing && !overwrite) {
    return NextResponse.json(
      {
        error: '오늘 이미 업로드된 기준가 파일이 있습니다. 덮어쓰시겠습니까?',
        existingUploadId: existing.id,
      },
      { status: 409 },
    );
  }

  const insertAll = db.transaction(() => {
    let uploadId: number;
    let recordsToInsert = parsedRecords;

    if (existing) {
      uploadId = existing.id;

      const registeredFndCods = new Set(
        (
          db
            .prepare(`SELECT fnd_cod FROM price_records WHERE upload_id = ? AND status = 'registered'`)
            .all(uploadId) as { fnd_cod: string }[]
        ).map((row) => row.fnd_cod),
      );

      db.prepare(`DELETE FROM price_records WHERE upload_id = ? AND status != 'registered'`).run(uploadId);

      db.prepare(
        `UPDATE price_uploads SET original_filename = ?, uploaded_at = datetime('now', 'localtime') WHERE id = ?`,
      ).run(file.name, uploadId);

      recordsToInsert = parsedRecords.filter((record) => !registeredFndCods.has(record.fnd_cod));
    } else {
      const uploadResult = db
        .prepare(
          `INSERT INTO price_uploads (upload_date, original_filename, status)
           VALUES (?, ?, 'uploaded')`,
        )
        .run(uploadDate, file.name);

      uploadId = Number(uploadResult.lastInsertRowid);
    }

    const insertRecord = db.prepare(`
      INSERT INTO price_records (
        upload_id, price_date, fnd_nm, fnd_cod, mgmt_com_cod, mgmt_com_nm,
        tr_bpr, tx_bpr, fr_tax_free_bpr, full_tr_bpr, income_tax_law, currency_type, raw_line,
        status, issue_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const record of recordsToInsert) {
      insertRecord.run(
        uploadId,
        record.price_date,
        record.fnd_nm,
        record.fnd_cod,
        record.mgmt_com_cod,
        record.mgmt_com_nm,
        record.tr_bpr,
        record.tx_bpr,
        record.fr_tax_free_bpr,
        record.full_tr_bpr,
        record.income_tax_law,
        record.currency_type,
        record.raw_line,
        record.status,
        record.issue_reason,
      );
    }

    recomputeUploadStatus(db, uploadId);

    return uploadId;
  });

  const uploadId = insertAll();

  return NextResponse.json({ uploadId, count: parsedRecords.length });
}
