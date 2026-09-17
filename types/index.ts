// 여기에 타입을 정의하세요.
// 모든 타입은 이 파일에서 단일 관리합니다.
//
// 예시:
// export type Item = {
//   id: number;
//   title: string;
//   status: string;
//   created_at: string;
// };

export type PriceUploadStatus = 'uploaded' | 'partially_registered' | 'registered';

export type PriceUpload = {
  id: number;
  upload_date: string;
  original_filename: string;
  uploaded_at: string;
  status: PriceUploadStatus;
  registered_at: string | null;
};

export type PriceRecordStatus = 'pending' | 'issue' | 'registered';

export type PriceRecord = {
  id: number;
  upload_id: number;
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
  status: PriceRecordStatus;
  issue_reason: string | null;
};

export type PriceRecordStatusCounts = {
  pending: number;
  issue: number;
  registered: number;
};

export type TodayPriceStatus =
  | { status: 'not_uploaded' }
  | { status: 'needs_review' | 'completed'; upload: PriceUpload; counts: PriceRecordStatusCounts };

export type PriceRecordSortField = 'price_date' | 'fnd_cod' | 'fnd_nm' | 'tr_bpr' | 'status';

export type SortOrder = 'asc' | 'desc';

export type PriceRecordWithUpload = PriceRecord & {
  upload_date: string;
  original_filename: string;
};

export type PriceRecordListResponse = {
  records: PriceRecordWithUpload[];
  total: number;
  page: number;
  page_size: number;
};
