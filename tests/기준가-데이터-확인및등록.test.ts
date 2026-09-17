import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/testDb';
import { makeGetRequest, makeTextFile, makeUploadRequest } from './helpers/request';
import type { PriceRecord, PriceUpload } from '@/types';

type FieldOverrides = Partial<{
  price_date: string;
  fnd_nm: string;
  fnd_cod: string;
  mgmt_com_cod: string;
  mgmt_com_nm: string;
  tr_bpr: string;
  tx_bpr: string;
  fr_tax_free_bpr: string;
  full_tr_bpr: string;
  income_tax_law: string;
  currency_type: string;
}>;

function priceLine(overrides: FieldOverrides = {}): string {
  const fields = {
    price_date: '20260917',
    fnd_nm: '테스트펀드',
    fnd_cod: 'F001',
    mgmt_com_cod: 'M01',
    mgmt_com_nm: '운용사',
    tr_bpr: '1000',
    tx_bpr: '900',
    fr_tax_free_bpr: '800',
    full_tr_bpr: '1100',
    income_tax_law: '비과세',
    currency_type: 'KRW',
    ...overrides,
  };

  return [
    fields.price_date,
    fields.fnd_nm,
    fields.fnd_cod,
    fields.mgmt_com_cod,
    fields.mgmt_com_nm,
    fields.tr_bpr,
    fields.tx_bpr,
    fields.fr_tax_free_bpr,
    fields.full_tr_bpr,
    fields.income_tax_law,
    fields.currency_type,
  ].join(',');
}

describe('기준가 데이터 확인 및 등록', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('US-4: 등록 API는 한 번 호출로 해당 업로드의 pending 레코드를 모두 등록 처리한다', async () => {
    const { POST: uploadPOST } = await import('@/app/api/price-uploads/route');
    const { POST: registerPOST } = await import('@/app/api/price-uploads/[id]/register/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const content = [
      priceLine({ fnd_cod: 'F001' }),
      priceLine({ fnd_cod: 'F002' }),
      priceLine({ fnd_cod: 'F003', tr_bpr: '' }),
    ].join('\n');

    const uploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(content)),
    );
    const uploadBody = await uploadResponse.json();
    const uploadId = uploadBody.uploadId as number;

    const registerResponse = await registerPOST(new Request('http://localhost'), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const registerBody = await registerResponse.json();

    expect(registerResponse.status).toBe(200);
    expect(registerBody.registeredCount).toBe(2);

    const getResponse = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const getBody = await getResponse.json();
    const records = getBody.records as PriceRecord[];

    const registeredRecords = records.filter((r) => r.fnd_cod === 'F001' || r.fnd_cod === 'F002');
    expect(registeredRecords).toHaveLength(2);
    expect(registeredRecords.every((r) => r.status === 'registered')).toBe(true);
  });

  it('US-5: 등록 시 issue 레코드는 등록 대상에서 자동으로 빠지고 그대로 유지된다', async () => {
    const { POST: uploadPOST } = await import('@/app/api/price-uploads/route');
    const { POST: registerPOST } = await import('@/app/api/price-uploads/[id]/register/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const content = [priceLine({ fnd_cod: 'F001' }), priceLine({ fnd_cod: 'F002', tr_bpr: '' })].join('\n');

    const uploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(content)),
    );
    const uploadBody = await uploadResponse.json();
    const uploadId = uploadBody.uploadId as number;

    await registerPOST(new Request('http://localhost'), {
      params: Promise.resolve({ id: String(uploadId) }),
    });

    const getResponse = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const getBody = await getResponse.json();
    const records = getBody.records as PriceRecord[];
    const issueRecord = records.find((r) => r.fnd_cod === 'F002');

    expect(issueRecord?.status).toBe('issue');
    expect(issueRecord?.issue_reason).toBe('값 없음');
  });

  it('ID-register: pending 레코드를 registered로 바꾸고 registered_at을 기록한다', async () => {
    const { POST: uploadPOST } = await import('@/app/api/price-uploads/route');
    const { POST: registerPOST } = await import('@/app/api/price-uploads/[id]/register/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const content = priceLine({ fnd_cod: 'F001' });
    const uploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(content)),
    );
    const uploadBody = await uploadResponse.json();
    const uploadId = uploadBody.uploadId as number;

    await registerPOST(new Request('http://localhost'), {
      params: Promise.resolve({ id: String(uploadId) }),
    });

    const getResponse = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const getBody = await getResponse.json();
    const upload = getBody.upload as PriceUpload;
    const records = getBody.records as PriceRecord[];

    expect(records[0].status).toBe('registered');
    expect(upload.registered_at).toBeTruthy();
  });

  it('US-10: 이상 항목이 하나도 없으면 등록 후 업로드 상태가 registered가 된다', async () => {
    const { POST: uploadPOST } = await import('@/app/api/price-uploads/route');
    const { POST: registerPOST } = await import('@/app/api/price-uploads/[id]/register/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const content = [priceLine({ fnd_cod: 'F001' }), priceLine({ fnd_cod: 'F002' })].join('\n');
    const uploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(content)),
    );
    const uploadBody = await uploadResponse.json();
    const uploadId = uploadBody.uploadId as number;

    await registerPOST(new Request('http://localhost'), {
      params: Promise.resolve({ id: String(uploadId) }),
    });

    const getResponse = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const getBody = await getResponse.json();
    const upload = getBody.upload as PriceUpload;

    expect(upload.status).toBe('registered');
  });

  it('ID-register-partial: 이상 레코드가 남아있으면 등록 후 업로드 상태가 partially_registered가 된다', async () => {
    const { POST: uploadPOST } = await import('@/app/api/price-uploads/route');
    const { POST: registerPOST } = await import('@/app/api/price-uploads/[id]/register/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const content = [priceLine({ fnd_cod: 'F001' }), priceLine({ fnd_cod: 'F002', tr_bpr: '' })].join('\n');
    const uploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(content)),
    );
    const uploadBody = await uploadResponse.json();
    const uploadId = uploadBody.uploadId as number;

    await registerPOST(new Request('http://localhost'), {
      params: Promise.resolve({ id: String(uploadId) }),
    });

    const getResponse = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const getBody = await getResponse.json();
    const upload = getBody.upload as PriceUpload;

    expect(upload.status).toBe('partially_registered');
  });

  it('US-7: 등록 처리 후 몇 건 등록됐고 몇 건 이상으로 제외됐는지 확인할 수 있다', async () => {
    const { POST: uploadPOST } = await import('@/app/api/price-uploads/route');
    const { POST: registerPOST } = await import('@/app/api/price-uploads/[id]/register/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const content = [
      priceLine({ fnd_cod: 'F001' }),
      priceLine({ fnd_cod: 'F002' }),
      priceLine({ fnd_cod: 'F003', tr_bpr: '' }),
    ].join('\n');
    const uploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(content)),
    );
    const uploadBody = await uploadResponse.json();
    const uploadId = uploadBody.uploadId as number;

    await registerPOST(new Request('http://localhost'), {
      params: Promise.resolve({ id: String(uploadId) }),
    });

    const getResponse = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const getBody = await getResponse.json();
    const records = getBody.records as PriceRecord[];

    const registeredCount = records.filter((r) => r.status === 'registered').length;
    const issueCount = records.filter((r) => r.status === 'issue').length;

    expect(registeredCount).toBe(2);
    expect(issueCount).toBe(1);
  });

  it('US-8: 이미 등록된 항목은 이후에도 등록완료 상태로 남아 다시 등록되지 않는다', async () => {
    const { POST: uploadPOST } = await import('@/app/api/price-uploads/route');
    const { POST: registerPOST } = await import('@/app/api/price-uploads/[id]/register/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const content = priceLine({ fnd_cod: 'F001' });
    const uploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(content)),
    );
    const uploadBody = await uploadResponse.json();
    const uploadId = uploadBody.uploadId as number;

    await registerPOST(new Request('http://localhost'), {
      params: Promise.resolve({ id: String(uploadId) }),
    });

    const secondRegisterResponse = await registerPOST(new Request('http://localhost'), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const secondRegisterBody = await secondRegisterResponse.json();

    expect(secondRegisterResponse.status).toBe(400);
    expect(typeof secondRegisterBody.error).toBe('string');
    expect(secondRegisterBody.error.length).toBeGreaterThan(0);

    const getResponse = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const getBody = await getResponse.json();
    const records = getBody.records as PriceRecord[];

    expect(records[0].status).toBe('registered');
  });

  it('US-9: 재업로드 시 registered 레코드는 유지되고 이상/대기 레코드만 새 값으로 재검증된다', async () => {
    const { POST: uploadPOST } = await import('@/app/api/price-uploads/route');
    const { POST: registerPOST } = await import('@/app/api/price-uploads/[id]/register/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const firstContent = [
      priceLine({ fnd_cod: 'F001', tr_bpr: '1000' }),
      priceLine({ fnd_cod: 'F002', tr_bpr: '' }),
    ].join('\n');

    const firstUploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(firstContent)),
    );
    const firstUploadBody = await firstUploadResponse.json();
    const uploadId = firstUploadBody.uploadId as number;

    await registerPOST(new Request('http://localhost'), {
      params: Promise.resolve({ id: String(uploadId) }),
    });

    const reuploadContent = [
      priceLine({ fnd_cod: 'F001', tr_bpr: '9999' }),
      priceLine({ fnd_cod: 'F002', tr_bpr: '2000' }),
    ].join('\n');

    const reuploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(reuploadContent), true),
    );
    const reuploadBody = await reuploadResponse.json();

    expect(reuploadResponse.status).toBe(200);
    expect(reuploadBody.uploadId).toBe(uploadId);

    const getResponse = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const getBody = await getResponse.json();
    const records = getBody.records as PriceRecord[];

    const f001 = records.find((r) => r.fnd_cod === 'F001');
    const f002 = records.find((r) => r.fnd_cod === 'F002');

    expect(f001?.status).toBe('registered');
    expect(f001?.tr_bpr).toBe(1000);
    expect(f002?.status).toBe('pending');
    expect(f002?.tr_bpr).toBe(2000);
  });

  it('ID-validation-scope: tx_bpr 등 나머지 항목은 1차 검증 대상에 포함되지 않는다', async () => {
    const { POST: uploadPOST } = await import('@/app/api/price-uploads/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const content = priceLine({ fnd_cod: 'F010', tx_bpr: 'Infinity' });

    const uploadResponse = await uploadPOST(
      makeUploadRequest('http://localhost/api/price-uploads', makeTextFile(content)),
    );
    const uploadBody = await uploadResponse.json();
    const uploadId = uploadBody.uploadId as number;

    const getResponse = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const getBody = await getResponse.json();
    const records = getBody.records as PriceRecord[];

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('pending');
  });

  it('US-11: 오늘 날짜가 아닌 예전 업로드 건도 열어서 확인할 수 있다', async () => {
    const { getDB } = await import('@/lib/db');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const db = getDB();
    const uploadResult = db
      .prepare(`INSERT INTO price_uploads (upload_date, original_filename, status) VALUES (?, ?, 'uploaded')`)
      .run('2020-01-01', 'old.txt');
    const uploadId = Number(uploadResult.lastInsertRowid);

    db.prepare(
      `INSERT INTO price_records (
        upload_id, price_date, fnd_nm, fnd_cod, mgmt_com_cod, mgmt_com_nm,
        tr_bpr, tx_bpr, fr_tax_free_bpr, full_tr_bpr, income_tax_law, currency_type, raw_line,
        status, issue_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(uploadId, '20200101', '옛날펀드', 'F999', 'M01', '운용사', 1000, 900, 800, 1100, '비과세', 'KRW', 'raw', 'pending', null);

    const response = await GET(makeGetRequest(`http://localhost/api/price-uploads/${uploadId}`), {
      params: Promise.resolve({ id: String(uploadId) }),
    });
    const body = await response.json();
    const upload = body.upload as PriceUpload;
    const records = body.records as PriceRecord[];

    expect(response.status).toBe(200);
    expect(upload.upload_date).toBe('2020-01-01');
    expect(records).toHaveLength(1);
    expect(records[0].fnd_cod).toBe('F999');
  });
});
