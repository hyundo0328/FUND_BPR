import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb, teardownTestDb } from './helpers/testDb';
import { makeTextFile, makeUploadRequest } from './helpers/request';

function todayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

describe('기준가 파일 업로드', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('US-3: txt가 아닌 파일을 업로드하면 오류를 반환한다', async () => {
    const { POST } = await import('@/app/api/price-uploads/route');

    const file = makeTextFile(
      '20260917,테스트펀드,F001,M01,운용사,1000,900,800,1100,비과세,KRW',
      'data.csv',
    );
    const request = makeUploadRequest('http://localhost/api/price-uploads', file);
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('txt 파일만 업로드할 수 있습니다');
  });

  it('US-4: 파일의 각 줄이 정해진 11개 항목 순서대로 나뉘어 펀드별 레코드로 저장된다', async () => {
    const { POST } = await import('@/app/api/price-uploads/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const file = makeTextFile('20260917,테스트펀드,F001,M01,운용사,1000,900,800,1100,비과세,KRW');
    const uploadRequest = makeUploadRequest('http://localhost/api/price-uploads', file);
    const uploadResponse = await POST(uploadRequest);
    const uploadBody = await uploadResponse.json();

    expect(uploadResponse.status).toBe(200);

    const getResponse = await GET(new Request('http://localhost/api/price-uploads/1'), {
      params: Promise.resolve({ id: String(uploadBody.uploadId) }),
    });
    const getBody = await getResponse.json();

    expect(getBody.records).toHaveLength(1);
    const record = getBody.records[0];
    expect(record.price_date).toBe('20260917');
    expect(record.fnd_nm).toBe('테스트펀드');
    expect(record.fnd_cod).toBe('F001');
    expect(record.mgmt_com_cod).toBe('M01');
    expect(record.mgmt_com_nm).toBe('운용사');
    expect(record.tr_bpr).toBe(1000);
    expect(record.tx_bpr).toBe(900);
    expect(record.fr_tax_free_bpr).toBe(800);
    expect(record.full_tr_bpr).toBe(1100);
    expect(record.income_tax_law).toBe('비과세');
    expect(record.currency_type).toBe('KRW');
  });

  it('US-5: 줄의 항목 개수가 예상과 다르면 오류 메시지를 반환한다', async () => {
    const { POST } = await import('@/app/api/price-uploads/route');
    const { getDB } = await import('@/lib/db');

    const file = makeTextFile('20260917,테스트펀드,F001,M01,운용사,1000,900,800,1100');
    const request = makeUploadRequest('http://localhost/api/price-uploads', file);
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('항목 개수가 예상');

    const db = getDB();
    const recordCount = db.prepare('SELECT COUNT(*) AS c FROM price_records').get() as { c: number };
    expect(recordCount.c).toBe(0);
  });

  it('US-6: 업로드가 끝나면 처리된 펀드 데이터 건수를 응답으로 반환한다', async () => {
    const { POST } = await import('@/app/api/price-uploads/route');

    const content = [
      '20260917,펀드A,F001,M01,운용사,1000,900,800,1100,비과세,KRW',
      '20260917,펀드B,F002,M01,운용사,2000,1900,1800,2100,일반과세,KRW',
      '20260917,펀드C,F003,M01,운용사,3000,2900,2800,3100,비과세,USD',
    ].join('\n');
    const file = makeTextFile(content);
    const request = makeUploadRequest('http://localhost/api/price-uploads', file);
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(3);
  });

  it('US-7: 업로드한 파일의 원본 파일명과 업로드 시각이 남는다', async () => {
    const { POST } = await import('@/app/api/price-uploads/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const file = makeTextFile(
      '20260917,테스트펀드,F001,M01,운용사,1000,900,800,1100,비과세,KRW',
      '가격표0917.txt',
    );
    const uploadRequest = makeUploadRequest('http://localhost/api/price-uploads', file);
    const uploadResponse = await POST(uploadRequest);
    const uploadBody = await uploadResponse.json();

    const getResponse = await GET(new Request('http://localhost/api/price-uploads/1'), {
      params: Promise.resolve({ id: String(uploadBody.uploadId) }),
    });
    const getBody = await getResponse.json();

    expect(getBody.upload.original_filename).toBe('가격표0917.txt');
    expect(getBody.upload.uploaded_at).toBeTruthy();
  });

  it('US-8: 같은 날짜에 이미 업로드가 있으면 덮어쓰기 확인을 요구하고, 확인 시 기존 레코드를 지우고 새로 만든다', async () => {
    const { POST } = await import('@/app/api/price-uploads/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const firstFile = makeTextFile('20260917,펀드A,F001,M01,운용사,1000,900,800,1100,비과세,KRW');
    const firstRequest = makeUploadRequest('http://localhost/api/price-uploads', firstFile);
    const firstResponse = await POST(firstRequest);
    const firstBody = await firstResponse.json();

    expect(firstResponse.status).toBe(200);

    const conflictFile = makeTextFile('20260917,펀드A,F001,M01,운용사,1000,900,800,1100,비과세,KRW');
    const conflictRequest = makeUploadRequest('http://localhost/api/price-uploads', conflictFile);
    const conflictResponse = await POST(conflictRequest);
    const conflictBody = await conflictResponse.json();

    expect(conflictResponse.status).toBe(409);
    expect(conflictBody.error).toContain('덮어쓰');
    expect(conflictBody.existingUploadId).toBe(firstBody.uploadId);

    const overwriteContent = [
      '20260917,펀드B,F002,M01,운용사,2000,1900,1800,2100,일반과세,KRW',
      '20260917,펀드C,F003,M01,운용사,3000,2900,2800,3100,비과세,USD',
    ].join('\n');
    const overwriteFile = makeTextFile(overwriteContent);
    const overwriteRequest = makeUploadRequest('http://localhost/api/price-uploads', overwriteFile, true);
    const overwriteResponse = await POST(overwriteRequest);
    const overwriteBody = await overwriteResponse.json();

    expect(overwriteResponse.status).toBe(200);
    expect(overwriteBody.uploadId).toBe(firstBody.uploadId);
    expect(overwriteBody.count).toBe(2);

    const getResponse = await GET(new Request('http://localhost/api/price-uploads/1'), {
      params: Promise.resolve({ id: String(firstBody.uploadId) }),
    });
    const getBody = await getResponse.json();

    expect(getBody.records).toHaveLength(2);
    const fndCods = getBody.records.map((r: { fnd_cod: string }) => r.fnd_cod).sort();
    expect(fndCods).toEqual(['F002', 'F003']);
  });

  it('US-10: 파일 인코딩이 EUC-KR이어도 한글이 깨지지 않고 읽힌다', async () => {
    const { POST } = await import('@/app/api/price-uploads/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const file = makeTextFile(
      '20260917,한글가격펀드,F001,M01,운용사,1000,900,800,1100,비과세,KRW',
      'price.txt',
      'euc-kr',
    );
    const uploadRequest = makeUploadRequest('http://localhost/api/price-uploads', file);
    const uploadResponse = await POST(uploadRequest);
    const uploadBody = await uploadResponse.json();

    expect(uploadResponse.status).toBe(200);

    const getResponse = await GET(new Request('http://localhost/api/price-uploads/1'), {
      params: Promise.resolve({ id: String(uploadBody.uploadId) }),
    });
    const getBody = await getResponse.json();

    expect(getBody.records[0].fnd_nm).toBe('한글가격펀드');
  });

  it("US-11: 업로드한 데이터는 자동으로 오늘 날짜 및 'uploaded' 상태로 연결된다", async () => {
    const { POST } = await import('@/app/api/price-uploads/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const file = makeTextFile('20260917,테스트펀드,F001,M01,운용사,1000,900,800,1100,비과세,KRW');
    const uploadRequest = makeUploadRequest('http://localhost/api/price-uploads', file);
    const uploadResponse = await POST(uploadRequest);
    const uploadBody = await uploadResponse.json();

    const getResponse = await GET(new Request('http://localhost/api/price-uploads/1'), {
      params: Promise.resolve({ id: String(uploadBody.uploadId) }),
    });
    const getBody = await getResponse.json();

    expect(getBody.upload.upload_date).toBe(todayDateString());
    expect(getBody.upload.status).toBe('uploaded');
  });

  it('Impl: price_date는 파일의 원본 형식(YYYYMMDD) 그대로 저장되고 구분자가 추가되지 않는다', async () => {
    const { POST } = await import('@/app/api/price-uploads/route');
    const { GET } = await import('@/app/api/price-uploads/[id]/route');

    const file = makeTextFile('20260914,테스트펀드,F001,M01,운용사,1000,900,800,1100,비과세,KRW');
    const uploadRequest = makeUploadRequest('http://localhost/api/price-uploads', file);
    const uploadResponse = await POST(uploadRequest);
    const uploadBody = await uploadResponse.json();

    const getResponse = await GET(new Request('http://localhost/api/price-uploads/1'), {
      params: Promise.resolve({ id: String(uploadBody.uploadId) }),
    });
    const getBody = await getResponse.json();

    expect(getBody.records[0].price_date).toBe('20260914');
    expect(getBody.records[0].price_date).not.toContain('-');
  });

  it('Impl: 업로드 API는 파일 한 개당 price_uploads 1건과 price_records N건을 생성한다', async () => {
    const { POST } = await import('@/app/api/price-uploads/route');
    const { getDB } = await import('@/lib/db');

    const content = [
      '20260917,펀드A,F001,M01,운용사,1000,900,800,1100,비과세,KRW',
      '20260917,펀드B,F002,M01,운용사,2000,1900,1800,2100,일반과세,KRW',
      '20260917,펀드C,F003,M01,운용사,3000,2900,2800,3100,비과세,USD',
    ].join('\n');
    const file = makeTextFile(content);
    const request = makeUploadRequest('http://localhost/api/price-uploads', file);
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);

    const db = getDB();
    const uploadCount = db.prepare('SELECT COUNT(*) AS c FROM price_uploads').get() as { c: number };
    const recordCount = db
      .prepare('SELECT COUNT(*) AS c FROM price_records WHERE upload_id = ?')
      .get(body.uploadId) as { c: number };

    expect(uploadCount.c).toBe(1);
    expect(recordCount.c).toBe(3);
  });
});
