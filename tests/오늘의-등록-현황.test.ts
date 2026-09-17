import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/testDb';

function insertUpload(db: Database.Database, uploadDate: string, filename = 'price.txt'): number {
  const result = db
    .prepare(
      `INSERT INTO price_uploads (upload_date, original_filename, status)
       VALUES (?, ?, 'uploaded')`,
    )
    .run(uploadDate, filename);
  return Number(result.lastInsertRowid);
}

function insertRecord(
  db: Database.Database,
  uploadId: number,
  status: 'pending' | 'issue' | 'registered',
  priceDate = '2024-01-01',
): void {
  db.prepare(
    `INSERT INTO price_records (
       upload_id, price_date, fnd_nm, fnd_cod, mgmt_com_cod, mgmt_com_nm,
       tr_bpr, tx_bpr, fr_tax_free_bpr, full_tr_bpr, income_tax_law,
       currency_type, raw_line, status
     ) VALUES (?, ?, '테스트펀드', 'F001', 'M001', '테스트자산운용',
       1000, 1000, 1000, 1000, '과세',
       'KRW', 'raw', ?)`,
  ).run(uploadId, priceDate, status);
}

describe('오늘의 등록 현황', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('US-1/US-2: 오늘 날짜의 업로드가 없으면 not_uploaded 상태를 반환한다', async () => {
    const { getDB } = await import('@/lib/db');
    const { getTodayPriceStatus } = await import('@/lib/priceRecords');

    const db = getDB();
    const result = getTodayPriceStatus(db);

    expect(result).toEqual({ status: 'not_uploaded' });
    expect('upload' in result).toBe(false);
    expect('counts' in result).toBe(false);
  });

  it('US-3/US-5: 업로드는 있지만 pending 또는 issue 레코드가 남아있으면 needs_review 상태와 pending/issue/registered 건수를 반환한다', async () => {
    const { getDB } = await import('@/lib/db');
    const { getTodayPriceStatus, todayKstDateString } = await import('@/lib/priceRecords');

    const db = getDB();
    const uploadId = insertUpload(db, todayKstDateString());
    insertRecord(db, uploadId, 'pending');
    insertRecord(db, uploadId, 'pending');
    insertRecord(db, uploadId, 'issue');
    insertRecord(db, uploadId, 'registered');
    insertRecord(db, uploadId, 'registered');
    insertRecord(db, uploadId, 'registered');

    const result = getTodayPriceStatus(db);

    expect(result.status).toBe('needs_review');
    if (result.status === 'not_uploaded') throw new Error('unexpected not_uploaded');
    expect(result.upload.id).toBe(uploadId);
    expect(result.counts).toEqual({ pending: 2, issue: 1, registered: 3 });
  });

  it('US-4: 업로드가 있고 모든 레코드가 registered면 completed 상태를 반환한다', async () => {
    const { getDB } = await import('@/lib/db');
    const { getTodayPriceStatus, todayKstDateString } = await import('@/lib/priceRecords');

    const db = getDB();
    const uploadId = insertUpload(db, todayKstDateString());
    for (let i = 0; i < 5; i += 1) {
      insertRecord(db, uploadId, 'registered');
    }

    const result = getTodayPriceStatus(db);

    expect(result.status).toBe('completed');
    if (result.status === 'not_uploaded') throw new Error('unexpected not_uploaded');
    expect(result.upload.id).toBe(uploadId);
    expect(result.counts).toEqual({ pending: 0, issue: 0, registered: 5 });
  });

  it('Impl: issue 레코드만 있고 pending이 없어도 needs_review다', async () => {
    const { getDB } = await import('@/lib/db');
    const { getTodayPriceStatus, todayKstDateString } = await import('@/lib/priceRecords');

    const db = getDB();
    const uploadId = insertUpload(db, todayKstDateString());
    insertRecord(db, uploadId, 'issue');
    insertRecord(db, uploadId, 'issue');
    insertRecord(db, uploadId, 'registered');
    insertRecord(db, uploadId, 'registered');
    insertRecord(db, uploadId, 'registered');

    const result = getTodayPriceStatus(db);

    expect(result.status).toBe('needs_review');
    if (result.status === 'not_uploaded') throw new Error('unexpected not_uploaded');
    expect(result.counts).toEqual({ pending: 0, issue: 2, registered: 3 });
  });

  it('Impl: 오늘 업로드에 속하지 않은 price_records는 집계에 포함되지 않는다', async () => {
    const { getDB } = await import('@/lib/db');
    const { getTodayPriceStatus, todayKstDateString } = await import('@/lib/priceRecords');

    const db = getDB();
    const todayUploadId = insertUpload(db, todayKstDateString(), 'today.txt');
    insertRecord(db, todayUploadId, 'pending');

    const otherUploadId = insertUpload(db, '2000-01-01', 'other.txt');
    for (let i = 0; i < 5; i += 1) {
      insertRecord(db, otherUploadId, 'registered');
    }

    const result = getTodayPriceStatus(db);

    expect(result.status).toBe('needs_review');
    if (result.status === 'not_uploaded') throw new Error('unexpected not_uploaded');
    expect(result.upload.id).toBe(todayUploadId);
    expect(result.counts).toEqual({ pending: 1, issue: 0, registered: 0 });
  });

  it('US-8: 홈 화면을 열 때마다 최신 상태를 반환한다 (캐싱하지 않음)', async () => {
    const { getDB } = await import('@/lib/db');
    const { getTodayPriceStatus, todayKstDateString } = await import('@/lib/priceRecords');

    const db = getDB();

    const firstResult = getTodayPriceStatus(db);
    expect(firstResult).toEqual({ status: 'not_uploaded' });

    const uploadId = insertUpload(db, todayKstDateString());
    insertRecord(db, uploadId, 'pending');

    const secondResult = getTodayPriceStatus(db);

    expect(secondResult.status).toBe('needs_review');
    if (secondResult.status === 'not_uploaded') throw new Error('unexpected not_uploaded');
    expect(secondResult.upload.id).toBe(uploadId);
    expect(secondResult.counts).toEqual({ pending: 1, issue: 0, registered: 0 });
  });

  it('Impl: GET /api/price-uploads/today 라우트 핸들러가 getTodayPriceStatus의 결과를 그대로 JSON으로 반환한다', async () => {
    const { getDB } = await import('@/lib/db');
    const { getTodayPriceStatus, todayKstDateString } = await import('@/lib/priceRecords');
    const { GET } = await import('@/app/api/price-uploads/today/route');

    const db = getDB();

    const emptyResponse = await GET();
    const emptyBody = await emptyResponse.json();
    expect(emptyBody).toEqual(getTodayPriceStatus(db));
    expect(emptyBody).toEqual({ status: 'not_uploaded' });

    const uploadId = insertUpload(db, todayKstDateString());
    insertRecord(db, uploadId, 'registered');

    const filledResponse = await GET();
    const filledBody = await filledResponse.json();
    expect(filledBody).toEqual(getTodayPriceStatus(db));
    expect(filledBody.status).toBe('completed');
    expect(filledBody.upload.id).toBe(uploadId);
    expect(filledBody.counts).toEqual({ pending: 0, issue: 0, registered: 1 });
  });
});
