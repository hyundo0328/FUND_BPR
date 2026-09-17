/**
 * 로컬 개발용 기준가 샘플 데이터 시딩 스크립트.
 * 실행: npm run db:seed [-- --reset] [-- --days=14] [-- --today=review|done|none]
 */
import { getDB } from '../lib/db';
import { evaluatePriceRecordStatus, recomputeUploadStatus } from '../lib/priceRecords';
import type { PriceRecordStatus } from '../types';

type Fund = {
  cod: string;
  nm: string;
  mgmtCod: string;
  mgmtNm: string;
  base: number;
};

const FUNDS: Fund[] = [
  { cod: 'KR0001', nm: '코리아성장증권투자신탁1호', mgmtCod: 'M01', mgmtNm: '한빛자산운용', base: 1032.45 },
  { cod: 'KR0002', nm: '글로벌헬스케어증권자투자신탁(H)', mgmtCod: 'M01', mgmtNm: '한빛자산운용', base: 1587.12 },
  { cod: 'KR0003', nm: '배당성장증권투자신탁1호', mgmtCod: 'M02', mgmtNm: '대성자산운용', base: 987.03 },
  { cod: 'KR0004', nm: '4차산업증권자투자신탁(UH)', mgmtCod: 'M02', mgmtNm: '대성자산운용', base: 2104.87 },
  { cod: 'KR0005', nm: '단기채권증권투자신탁', mgmtCod: 'M03', mgmtNm: '푸른자산운용', base: 1005.21 },
  { cod: 'KR0006', nm: '중국본토증권자투자신탁', mgmtCod: 'M03', mgmtNm: '푸른자산운용', base: 812.6 },
  { cod: 'KR0007', nm: '미국나스닥증권자투자신탁(H)', mgmtCod: 'M04', mgmtNm: '서해자산운용', base: 1743.99 },
  { cod: 'KR0008', nm: '금융채권증권투자신탁', mgmtCod: 'M04', mgmtNm: '서해자산운용', base: 1051.34 },
  { cod: 'KR0009', nm: '반도체산업증권자투자신탁', mgmtCod: 'M05', mgmtNm: '동인자산운용', base: 1922.18 },
  { cod: 'KR0010', nm: '글로벌리츠증권자투자신탁', mgmtCod: 'M05', mgmtNm: '동인자산운용', base: 998.77 },
];

type TodayMode = 'review' | 'done' | 'none';

function parseArgs(argv: string[]) {
  const reset = argv.includes('--reset');
  const daysArg = argv.find((a) => a.startsWith('--days='));
  const todayArg = argv.find((a) => a.startsWith('--today='));

  const days = daysArg ? Number(daysArg.split('=')[1]) : 14;
  const today = (todayArg ? todayArg.split('=')[1] : 'review') as TodayMode;

  if (!['review', 'done', 'none'].includes(today)) {
    throw new Error(`--today는 review|done|none 중 하나여야 합니다: ${today}`);
  }
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error(`--days는 양의 정수여야 합니다: ${daysArg}`);
  }

  return { reset, days, today };
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function fmtCompact(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function fmtDashed(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 펀드별 기준가를 영업일 오프셋에 따라 완만하게 흔들어 실제 시세처럼 보이게 한다. */
function priceFor(fund: Fund, dayOffset: number): number {
  const wiggle = Math.sin(dayOffset * 0.7 + fund.base) * (fund.base * 0.01);
  return Math.round((fund.base + wiggle + dayOffset * 0.15) * 100) / 100;
}

function buildRawLine(fields: {
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
}): string {
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

function main() {
  const { reset, days, today } = parseArgs(process.argv.slice(2));
  const db = getDB();

  if (reset) {
    db.prepare('DELETE FROM price_records').run();
    db.prepare('DELETE FROM price_uploads').run();
    db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('price_records', 'price_uploads')`).run();
    console.log('기존 데이터 삭제 완료');
  }

  const insertUpload = db.prepare(
    `INSERT INTO price_uploads (upload_date, original_filename, uploaded_at, status, registered_at)
     VALUES (?, ?, datetime('now', 'localtime'), ?, ?)`,
  );

  const insertRecord = db.prepare(`
    INSERT INTO price_records (
      upload_id, price_date, fnd_nm, fnd_cod, mgmt_com_cod, mgmt_com_nm,
      tr_bpr, tx_bpr, fr_tax_free_bpr, full_tr_bpr, income_tax_law, currency_type, raw_line,
      status, issue_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction(() => {
    let uploadCount = 0;
    let recordCount = 0;

    // 과거 영업일: 전부 등록 완료 상태로 채워서 등록 이력 조회 화면을 바로 테스트할 수 있게 한다.
    const businessDays: Date[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - 1); // 오늘 제외, 어제부터 역순
    while (businessDays.length < days) {
      if (!isWeekend(cursor)) businessDays.push(new Date(cursor));
      cursor.setDate(cursor.getDate() - 1);
    }

    businessDays.reverse().forEach((date, idx) => {
      const dayOffset = idx - businessDays.length;
      const priceDateCompact = fmtCompact(date);
      const uploadDateDashed = fmtDashed(date);

      const uploadResult = insertUpload.run(
        uploadDateDashed,
        `기준가_${priceDateCompact}.txt`,
        'registered',
        `${uploadDateDashed} 18:00:00`,
      );
      const uploadId = Number(uploadResult.lastInsertRowid);
      uploadCount++;

      for (const fund of FUNDS) {
        const trBpr = priceFor(fund, dayOffset);
        const fields = {
          price_date: priceDateCompact,
          fnd_nm: fund.nm,
          fnd_cod: fund.cod,
          mgmt_com_cod: fund.mgmtCod,
          mgmt_com_nm: fund.mgmtNm,
          tr_bpr: String(trBpr),
          tx_bpr: String(Math.round((trBpr * 0.95) * 100) / 100),
          fr_tax_free_bpr: String(Math.round((trBpr * 0.9) * 100) / 100),
          full_tr_bpr: String(Math.round((trBpr * 1.02) * 100) / 100),
          income_tax_law: '비과세',
          currency_type: 'KRW',
        };

        insertRecord.run(
          uploadId,
          fields.price_date,
          fields.fnd_nm,
          fields.fnd_cod,
          fields.mgmt_com_cod,
          fields.mgmt_com_nm,
          trBpr,
          Number(fields.tx_bpr),
          Number(fields.fr_tax_free_bpr),
          Number(fields.full_tr_bpr),
          fields.income_tax_law,
          fields.currency_type,
          buildRawLine(fields),
          'registered' satisfies PriceRecordStatus,
          null,
        );
        recordCount++;
      }
    });

    // 오늘 데이터: --today 옵션에 따라 업로드 전 / 확인 필요 / 완료 상태를 만든다.
    if (today !== 'none') {
      const now = new Date();
      const priceDateCompact = fmtCompact(now);
      const uploadDateDashed = fmtDashed(now);

      const uploadResult = insertUpload.run(uploadDateDashed, `기준가_${priceDateCompact}.txt`, 'uploaded', null);
      const uploadId = Number(uploadResult.lastInsertRowid);
      uploadCount++;

      FUNDS.forEach((fund, i) => {
        const isIssueRow = today === 'review' && i === 2;
        const trBprRaw = isIssueRow ? '0' : String(priceFor(fund, 0));
        const trBprNum = Number(trBprRaw);
        const { status, issue_reason } = evaluatePriceRecordStatus(fund.cod, fund.nm, trBprRaw, trBprNum);

        const finalStatus: PriceRecordStatus = today === 'done' && status !== 'issue' ? 'registered' : status;

        const fields = {
          price_date: priceDateCompact,
          fnd_nm: fund.nm,
          fnd_cod: fund.cod,
          mgmt_com_cod: fund.mgmtCod,
          mgmt_com_nm: fund.mgmtNm,
          tr_bpr: trBprRaw,
          tx_bpr: String(Math.round(Math.max(trBprNum, 0) * 0.95 * 100) / 100),
          fr_tax_free_bpr: String(Math.round(Math.max(trBprNum, 0) * 0.9 * 100) / 100),
          full_tr_bpr: String(Math.round(Math.max(trBprNum, 0) * 1.02 * 100) / 100),
          income_tax_law: '비과세',
          currency_type: 'KRW',
        };

        insertRecord.run(
          uploadId,
          fields.price_date,
          fields.fnd_nm,
          fields.fnd_cod,
          fields.mgmt_com_cod,
          fields.mgmt_com_nm,
          Number.isNaN(trBprNum) ? 0 : trBprNum,
          Number(fields.tx_bpr),
          Number(fields.fr_tax_free_bpr),
          Number(fields.full_tr_bpr),
          fields.income_tax_law,
          fields.currency_type,
          buildRawLine(fields),
          finalStatus,
          issue_reason,
        );
        recordCount++;
      });

      recomputeUploadStatus(db, uploadId);
    }

    return { uploadCount, recordCount };
  });

  const { uploadCount, recordCount } = insertAll();

  console.log(`시딩 완료: 업로드 ${uploadCount}건, 레코드 ${recordCount}건`);
  console.log(`오늘 상태: ${today === 'none' ? '업로드 전 (시딩 안 함)' : today === 'review' ? '확인 필요' : '완료'}`);
}

main();
