import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import type { PriceRecordListResponse } from '@/types';
import { setupTestDb, teardownTestDb } from './helpers/testDb';
import { makeGetRequest } from './helpers/request';

type UploadOverrides = Partial<{
  upload_date: string;
  original_filename: string;
}>;

type RecordOverrides = Partial<{
  price_date: string;
  fnd_nm: string;
  fnd_cod: string;
  mgmt_com_cod: string;
  mgmt_com_nm: string;
  tr_bpr: number;
  tx_bpr: number;
  fr_tax_free_bpr: number;
  full_tr_bpr: number;
  income_tax_law: string;
  currency_type: string;
  raw_line: string;
  status: string;
  issue_reason: string | null;
}>;

function insertUpload(db: Database.Database, overrides: UploadOverrides = {}): number {
  const upload = {
    upload_date: '20260914',
    original_filename: 'price.txt',
    ...overrides,
  };
  const result = db
    .prepare(`INSERT INTO price_uploads (upload_date, original_filename) VALUES (?, ?)`)
    .run(upload.upload_date, upload.original_filename);
  return Number(result.lastInsertRowid);
}

function insertRecord(db: Database.Database, uploadId: number, overrides: RecordOverrides = {}): void {
  const record = {
    price_date: '20260914',
    fnd_nm: '테스트펀드',
    fnd_cod: 'F001',
    mgmt_com_cod: 'M001',
    mgmt_com_nm: '테스트운용사',
    tr_bpr: 1000,
    tx_bpr: 1000,
    fr_tax_free_bpr: 1000,
    full_tr_bpr: 1000,
    income_tax_law: 'Y',
    currency_type: 'KRW',
    raw_line: 'raw-line',
    status: 'pending',
    issue_reason: null,
    ...overrides,
  };

  db.prepare(
    `INSERT INTO price_records (
      upload_id, price_date, fnd_nm, fnd_cod, mgmt_com_cod, mgmt_com_nm,
      tr_bpr, tx_bpr, fr_tax_free_bpr, full_tr_bpr, income_tax_law, currency_type,
      raw_line, status, issue_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
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

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

describe('GET /api/price-records', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('US-1: date 파라미터로 특정 등록일자 데이터만 조회', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, { price_date: '20260913', fnd_cod: 'D13' });
    insertRecord(db, uploadId, { price_date: '20260914', fnd_cod: 'D14' });
    insertRecord(db, uploadId, { price_date: '20260915', fnd_cod: 'D15' });

    const response = await GET(makeGetRequest('http://localhost/api/price-records?date=20260914'));
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.records).toHaveLength(1);
    expect(body.records.every((r) => r.price_date === '20260914')).toBe(true);
  });

  it('US-1: date가 있으면 from/to보다 우선 적용된다', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, { price_date: '20260914', fnd_cod: 'MATCH' });
    insertRecord(db, uploadId, { price_date: '20260905', fnd_cod: 'INRANGE' });

    const response = await GET(
      makeGetRequest('http://localhost/api/price-records?date=20260914&from=20260901&to=20260910'),
    );
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.records).toHaveLength(1);
    expect(body.records[0].fnd_cod).toBe('MATCH');
    expect(body.records[0].price_date).toBe('20260914');
  });

  it('US-2: from/to 기간으로 데이터 조회', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, { price_date: '20260831', fnd_cod: 'OUT1' });
    insertRecord(db, uploadId, { price_date: '20260903', fnd_cod: 'IN1' });
    insertRecord(db, uploadId, { price_date: '20260905', fnd_cod: 'IN2' });
    insertRecord(db, uploadId, { price_date: '20260907', fnd_cod: 'IN3' });
    insertRecord(db, uploadId, { price_date: '20260912', fnd_cod: 'OUT2' });

    const response = await GET(makeGetRequest('http://localhost/api/price-records?from=20260903&to=20260907'));
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.records.map((r) => r.fnd_cod).sort()).toEqual(['IN1', 'IN2', 'IN3']);
    expect(body.records.every((r) => r.price_date >= '20260903' && r.price_date <= '20260907')).toBe(true);
  });

  it('US-3: fnd_cod로 특정 펀드 이력만 조회', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, { fnd_cod: 'F001' });
    insertRecord(db, uploadId, { fnd_cod: 'F002' });
    insertRecord(db, uploadId, { fnd_cod: 'ABF001CD' });

    const response = await GET(makeGetRequest('http://localhost/api/price-records?fnd_cod=F001'));
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.records.map((r) => r.fnd_cod).sort()).toEqual(['ABF001CD', 'F001']);
    expect(body.records.every((r) => r.fnd_cod.includes('F001'))).toBe(true);
  });

  it('US-4: fnd_nm 일부 입력으로 검색', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, { fnd_cod: 'N1', fnd_nm: '삼성글로벌펀드' });
    insertRecord(db, uploadId, { fnd_cod: 'N2', fnd_nm: 'KB단기채펀드' });
    insertRecord(db, uploadId, { fnd_cod: 'N3', fnd_nm: 'KB글로벌리츠펀드' });

    const response = await GET(
      makeGetRequest(`http://localhost/api/price-records?fnd_nm=${encodeURIComponent('글로벌')}`),
    );
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.records.map((r) => r.fnd_cod).sort()).toEqual(['N1', 'N3']);
    expect(body.records.every((r) => r.fnd_nm.includes('글로벌'))).toBe(true);
  });

  it('US-5: 날짜/펀드코드/펀드명 조건을 함께 적용', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, {
      fnd_cod: 'MATCH',
      price_date: '20260914',
      fnd_nm: '삼성글로벌펀드',
    });
    insertRecord(db, uploadId, {
      fnd_cod: 'WRONG_CODE',
      price_date: '20260914',
      fnd_nm: '삼성글로벌펀드',
    });
    insertRecord(db, uploadId, {
      fnd_cod: 'MATCH',
      price_date: '20260913',
      fnd_nm: '삼성글로벌펀드',
    });
    insertRecord(db, uploadId, {
      fnd_cod: 'MATCH',
      price_date: '20260914',
      fnd_nm: 'KB단기채펀드',
    });

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/price-records?date=20260914&fnd_cod=MATCH&fnd_nm=${encodeURIComponent('글로벌')}`,
      ),
    );
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.records).toHaveLength(1);
    expect(body.records[0]).toMatchObject({
      fnd_cod: 'MATCH',
      price_date: '20260914',
      fnd_nm: '삼성글로벌펀드',
    });
  });

  it('US-6: sort 파라미터로 지정한 열 기준 정렬', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, {
      fnd_cod: 'F003',
      fnd_nm: '다펀드',
      price_date: '20260910',
      tr_bpr: 3000,
      status: 'registered',
    });
    insertRecord(db, uploadId, {
      fnd_cod: 'F001',
      fnd_nm: '가펀드',
      price_date: '20260912',
      tr_bpr: 1000,
      status: 'issue',
    });
    insertRecord(db, uploadId, {
      fnd_cod: 'F002',
      fnd_nm: '나펀드',
      price_date: '20260914',
      tr_bpr: 2000,
      status: 'pending',
    });

    const byPriceDate = (await (
      await GET(makeGetRequest('http://localhost/api/price-records?sort=price_date&order=asc'))
    ).json()) as PriceRecordListResponse;
    expect(byPriceDate.records.map((r) => r.fnd_cod)).toEqual(['F003', 'F001', 'F002']);

    const byFndCod = (await (
      await GET(makeGetRequest('http://localhost/api/price-records?sort=fnd_cod&order=asc'))
    ).json()) as PriceRecordListResponse;
    expect(byFndCod.records.map((r) => r.fnd_cod)).toEqual(['F001', 'F002', 'F003']);

    const byFndNm = (await (
      await GET(makeGetRequest('http://localhost/api/price-records?sort=fnd_nm&order=asc'))
    ).json()) as PriceRecordListResponse;
    expect(byFndNm.records.map((r) => r.fnd_cod)).toEqual(['F001', 'F002', 'F003']);

    const byTrBpr = (await (
      await GET(makeGetRequest('http://localhost/api/price-records?sort=tr_bpr&order=asc'))
    ).json()) as PriceRecordListResponse;
    expect(byTrBpr.records.map((r) => r.fnd_cod)).toEqual(['F001', 'F002', 'F003']);

    const byStatus = (await (
      await GET(makeGetRequest('http://localhost/api/price-records?sort=status&order=asc'))
    ).json()) as PriceRecordListResponse;
    expect(byStatus.records.map((r) => r.fnd_cod)).toEqual(['F001', 'F002', 'F003']);
  });

  it('US-7: order 파라미터로 오름차순/내림차순 전환', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, { fnd_cod: 'B001', tr_bpr: 1000 });
    insertRecord(db, uploadId, { fnd_cod: 'B002', tr_bpr: 2000 });
    insertRecord(db, uploadId, { fnd_cod: 'B003', tr_bpr: 3000 });

    const asc = (await (
      await GET(makeGetRequest('http://localhost/api/price-records?sort=tr_bpr&order=asc'))
    ).json()) as PriceRecordListResponse;
    expect(asc.records.map((r) => r.fnd_cod)).toEqual(['B001', 'B002', 'B003']);

    const desc = (await (
      await GET(makeGetRequest('http://localhost/api/price-records?sort=tr_bpr&order=desc'))
    ).json()) as PriceRecordListResponse;
    expect(desc.records.map((r) => r.fnd_cod)).toEqual(['B003', 'B002', 'B001']);
  });

  it('구현결정: sort/order 기본값은 price_date 내림차순', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, { fnd_cod: 'D1', price_date: '20260910' });
    insertRecord(db, uploadId, { fnd_cod: 'D2', price_date: '20260914' });
    insertRecord(db, uploadId, { fnd_cod: 'D3', price_date: '20260912' });

    const response = await GET(makeGetRequest('http://localhost/api/price-records'));
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.records.map((r) => r.fnd_cod)).toEqual(['D2', 'D3', 'D1']);
    expect(body.records.map((r) => r.price_date)).toEqual(['20260914', '20260912', '20260910']);
  });

  it('구현결정: page/page_size로 페이지 분할, 기본 50건', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    for (let i = 1; i <= 55; i += 1) {
      insertRecord(db, uploadId, {
        fnd_cod: `P${pad2(i)}`,
        price_date: `202610${pad2(i)}`,
      });
    }

    const defaultResponse = (await (
      await GET(makeGetRequest('http://localhost/api/price-records'))
    ).json()) as PriceRecordListResponse;
    expect(defaultResponse.records).toHaveLength(50);

    const pagedResponse = (await (
      await GET(makeGetRequest('http://localhost/api/price-records?page=2&page_size=10'))
    ).json()) as PriceRecordListResponse;
    const expectedPriceDates = Array.from({ length: 10 }, (_, idx) => `202610${pad2(45 - idx)}`);
    expect(pagedResponse.records.map((r) => r.price_date)).toEqual(expectedPriceDates);
  });

  it('구현결정: price_records와 price_uploads 조인으로 업로드일·원본 파일명 포함', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db, {
      upload_date: '20260914',
      original_filename: 'price_20260914.txt',
    });
    insertRecord(db, uploadId, { fnd_cod: 'JOIN1', price_date: '20260914' });

    const response = await GET(makeGetRequest('http://localhost/api/price-records?date=20260914'));
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.records).toHaveLength(1);
    expect(body.records[0].upload_date).toBe('20260914');
    expect(body.records[0].original_filename).toBe('price_20260914.txt');
  });

  it('US-8: 응답에 등록 상태(status)가 항목별로 구분되어 내려온다', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, { fnd_cod: 'S_REG', status: 'registered' });
    insertRecord(db, uploadId, { fnd_cod: 'S_ISS', status: 'issue' });
    insertRecord(db, uploadId, { fnd_cod: 'S_PEN', status: 'pending' });

    const response = await GET(makeGetRequest('http://localhost/api/price-records'));
    const body = (await response.json()) as PriceRecordListResponse;

    const byCode = Object.fromEntries(body.records.map((r) => [r.fnd_cod, r.status]));
    expect(byCode).toEqual({
      S_REG: 'registered',
      S_ISS: 'issue',
      S_PEN: 'pending',
    });
  });

  it('US-9: 응답에 total/page/page_size가 포함되어 페이지 분할 정보를 제공한다', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    for (let i = 1; i <= 12; i += 1) {
      insertRecord(db, uploadId, { fnd_cod: `T${pad2(i)}` });
    }

    const response = await GET(makeGetRequest('http://localhost/api/price-records?page_size=5'));
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.total).toBe(12);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(5);
    expect(body.records).toHaveLength(5);
  });

  it('US-11: 조건 없이 조회 시 최신 50건이 price_date 내림차순으로 보인다', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    for (let i = 1; i <= 55; i += 1) {
      insertRecord(db, uploadId, {
        fnd_cod: `L${pad2(i)}`,
        price_date: `202610${pad2(i)}`,
      });
    }

    const response = await GET(makeGetRequest('http://localhost/api/price-records'));
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.total).toBe(55);
    expect(body.records).toHaveLength(50);
    expect(body.records[0].price_date).toBe('20261055');
    expect(body.records[body.records.length - 1].price_date).toBe('20261006');
    for (let i = 0; i < body.records.length - 1; i += 1) {
      expect(body.records[i].price_date >= body.records[i + 1].price_date).toBe(true);
    }
  });

  it('US-12: 조건에 맞는 데이터가 없으면 빈 결과가 명확히 반환된다', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-records/route');
    const db = getDB();
    const uploadId = insertUpload(db);
    insertRecord(db, uploadId, { fnd_cod: 'F001' });
    insertRecord(db, uploadId, { fnd_cod: 'F002' });

    const response = await GET(
      makeGetRequest('http://localhost/api/price-records?fnd_cod=NONEXISTENT_CODE'),
    );
    const body = (await response.json()) as PriceRecordListResponse;

    expect(body.records).toEqual([]);
    expect(body.total).toBe(0);
  });
});
