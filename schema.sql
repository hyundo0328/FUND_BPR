-- 여기에 테이블을 정의하세요.
-- lib/db.ts의 getDB()가 앱 시작 시 이 파일을 자동으로 실행합니다.
--
-- 예시:
-- CREATE TABLE IF NOT EXISTS items (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   title TEXT NOT NULL,
--   status TEXT NOT NULL DEFAULT 'active',
--   created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
-- );

CREATE TABLE IF NOT EXISTS price_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_date TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  status TEXT NOT NULL DEFAULT 'uploaded',
  registered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_price_uploads_upload_date ON price_uploads(upload_date);

CREATE TABLE IF NOT EXISTS price_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id INTEGER NOT NULL REFERENCES price_uploads(id),
  price_date TEXT NOT NULL,
  fnd_nm TEXT NOT NULL,
  fnd_cod TEXT NOT NULL,
  mgmt_com_cod TEXT NOT NULL,
  mgmt_com_nm TEXT NOT NULL,
  tr_bpr REAL NOT NULL,
  tx_bpr REAL NOT NULL,
  fr_tax_free_bpr REAL NOT NULL,
  full_tr_bpr REAL NOT NULL,
  income_tax_law TEXT NOT NULL,
  currency_type TEXT NOT NULL,
  raw_line TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  issue_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_price_records_upload_id ON price_records(upload_id);
