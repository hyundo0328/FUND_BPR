import type Database from 'better-sqlite3';
import type {
  PriceRecord,
  PriceRecordListResponse,
  PriceRecordSortField,
  PriceRecordStatus,
  PriceRecordWithUpload,
  PriceUpload,
  SortOrder,
  TodayPriceStatus,
} from '@/types';

export function evaluatePriceRecordStatus(
  fndCod: string,
  fndNm: string,
  trBprRaw: string,
  trBprNum: number,
): { status: PriceRecordStatus; issue_reason: string | null } {
  if (!fndCod || !fndNm || !trBprRaw) {
    return { status: 'issue', issue_reason: '값 없음' };
  }

  if (Number.isNaN(trBprNum) || trBprNum <= 0) {
    return { status: 'issue', issue_reason: '거래기준가 값 이상' };
  }

  return { status: 'pending', issue_reason: null };
}

export function recomputeUploadStatus(db: Database.Database, uploadId: number): void {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'registered' THEN 1 ELSE 0 END) AS registered
       FROM price_records
       WHERE upload_id = ?`,
    )
    .get(uploadId) as { total: number; registered: number };

  const status =
    counts.total > 0 && counts.registered === counts.total
      ? 'registered'
      : counts.registered > 0
        ? 'partially_registered'
        : 'uploaded';

  db.prepare('UPDATE price_uploads SET status = ? WHERE id = ?').run(status, uploadId);
}

export function todayKstDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

export function getTodayPriceStatus(db: Database.Database): TodayPriceStatus {
  const uploadDate = todayKstDateString();

  const upload = db.prepare('SELECT * FROM price_uploads WHERE upload_date = ?').get(uploadDate) as
    | PriceUpload
    | undefined;

  if (!upload) {
    return { status: 'not_uploaded' };
  }

  const counts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'issue' THEN 1 ELSE 0 END) AS issue,
         SUM(CASE WHEN status = 'registered' THEN 1 ELSE 0 END) AS registered
       FROM price_records
       WHERE upload_id = ?`,
    )
    .get(upload.id) as { pending: number; issue: number; registered: number };

  const status = counts.pending > 0 || counts.issue > 0 ? 'needs_review' : 'completed';

  return { status, upload, counts };
}

export function getUploadDetail(
  db: Database.Database,
  uploadId: number,
): { upload: PriceUpload; records: PriceRecord[] } | null {
  const upload = db.prepare('SELECT * FROM price_uploads WHERE id = ?').get(uploadId) as
    | PriceUpload
    | undefined;

  if (!upload) {
    return null;
  }

  const records = db
    .prepare('SELECT * FROM price_records WHERE upload_id = ? ORDER BY id ASC')
    .all(uploadId) as PriceRecord[];

  return { upload, records };
}

const PRICE_RECORD_SORT_COLUMNS: Record<PriceRecordSortField, string> = {
  price_date: 'pr.price_date',
  fnd_cod: 'pr.fnd_cod',
  fnd_nm: 'pr.fnd_nm',
  tr_bpr: 'pr.tr_bpr',
  status: 'pr.status',
};

const DEFAULT_PRICE_RECORD_PAGE_SIZE = 50;

export type PriceRecordQueryInput = {
  date?: string | null;
  from?: string | null;
  to?: string | null;
  fnd_cod?: string | null;
  fnd_nm?: string | null;
  sort?: string | null;
  order?: string | null;
  page?: string | null;
  page_size?: string | null;
};

export type NormalizedPriceRecordQuery = {
  date: string | null;
  from: string | null;
  to: string | null;
  fndCod: string | null;
  fndNm: string | null;
  sort: PriceRecordSortField;
  order: SortOrder;
  page: number;
  pageSize: number;
};

function parsePositiveInt(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function normalizePriceRecordQuery(input: PriceRecordQueryInput): NormalizedPriceRecordQuery {
  const sort =
    input.sort && input.sort in PRICE_RECORD_SORT_COLUMNS ? (input.sort as PriceRecordSortField) : 'price_date';
  const order: SortOrder = input.order === 'asc' ? 'asc' : 'desc';

  return {
    date: input.date || null,
    from: input.from || null,
    to: input.to || null,
    fndCod: input.fnd_cod || null,
    fndNm: input.fnd_nm || null,
    sort,
    order,
    page: parsePositiveInt(input.page, 1),
    pageSize: parsePositiveInt(input.page_size, DEFAULT_PRICE_RECORD_PAGE_SIZE),
  };
}

export function queryPriceRecords(
  db: Database.Database,
  query: NormalizedPriceRecordQuery,
): PriceRecordListResponse {
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (query.date) {
    conditions.push('pr.price_date = ?');
    values.push(query.date);
  } else {
    if (query.from) {
      conditions.push('pr.price_date >= ?');
      values.push(query.from);
    }
    if (query.to) {
      conditions.push('pr.price_date <= ?');
      values.push(query.to);
    }
  }

  if (query.fndCod) {
    conditions.push('pr.fnd_cod LIKE ?');
    values.push(`%${query.fndCod}%`);
  }

  if (query.fndNm) {
    conditions.push('pr.fnd_nm LIKE ?');
    values.push(`%${query.fndNm}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderColumn = PRICE_RECORD_SORT_COLUMNS[query.sort];
  const orderDirection = query.order === 'asc' ? 'ASC' : 'DESC';

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM price_records pr ${whereClause}`)
    .get(...values) as { total: number };

  const records = db
    .prepare(
      `SELECT pr.*, pu.upload_date AS upload_date, pu.original_filename AS original_filename
       FROM price_records pr
       JOIN price_uploads pu ON pr.upload_id = pu.id
       ${whereClause}
       ORDER BY ${orderColumn} ${orderDirection}, pr.id ${orderDirection}
       LIMIT ? OFFSET ?`,
    )
    .all(...values, query.pageSize, (query.page - 1) * query.pageSize) as PriceRecordWithUpload[];

  return {
    records,
    total: totalRow.total,
    page: query.page,
    page_size: query.pageSize,
  };
}
