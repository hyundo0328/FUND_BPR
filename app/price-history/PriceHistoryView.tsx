'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { NormalizedPriceRecordQuery } from '@/lib/priceRecords';
import type { PriceRecordListResponse, PriceRecordSortField, PriceRecordStatus, SortOrder } from '@/types';

type DateMode = 'date' | 'range';

type FilterDraft = {
  mode: DateMode;
  date: string;
  from: string;
  to: string;
  fndCod: string;
  fndNm: string;
};

const COLUMNS: { field: PriceRecordSortField; label: string }[] = [
  { field: 'price_date', label: '일자' },
  { field: 'fnd_nm', label: '펀드명' },
  { field: 'fnd_cod', label: '펀드코드' },
  { field: 'tr_bpr', label: '거래기준가' },
  { field: 'status', label: '상태' },
];

function statusBadge(status: PriceRecordStatus) {
  if (status === 'issue') {
    return <Badge color="red">이상</Badge>;
  }
  if (status === 'registered') {
    return <Badge color="green">등록완료</Badge>;
  }
  return <Badge color="gray">정상</Badge>;
}

function toInputDate(value: string | null): string {
  if (!value || value.length !== 8) return '';
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function toQueryDate(value: string): string {
  return value.replace(/-/g, '');
}

function draftFromQuery(query: NormalizedPriceRecordQuery): FilterDraft {
  return {
    mode: query.from || query.to ? 'range' : 'date',
    date: toInputDate(query.date),
    from: toInputDate(query.from),
    to: toInputDate(query.to),
    fndCod: query.fndCod ?? '',
    fndNm: query.fndNm ?? '',
  };
}

function buildParams(input: {
  date: string | null;
  from: string | null;
  to: string | null;
  fndCod: string | null;
  fndNm: string | null;
  sort: PriceRecordSortField;
  order: SortOrder;
  page: number;
}): URLSearchParams {
  const params = new URLSearchParams();

  if (input.date) {
    params.set('date', input.date);
  } else {
    if (input.from) params.set('from', input.from);
    if (input.to) params.set('to', input.to);
  }

  if (input.fndCod) params.set('fnd_cod', input.fndCod);
  if (input.fndNm) params.set('fnd_nm', input.fndNm);

  params.set('sort', input.sort);
  params.set('order', input.order);
  params.set('page', String(input.page));

  return params;
}

export function PriceHistoryView({
  result,
  query,
}: {
  result: PriceRecordListResponse;
  query: NormalizedPriceRecordQuery;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<FilterDraft>(() => draftFromQuery(query));

  function navigate(params: URLSearchParams) {
    router.push(`/price-history?${params.toString()}`);
  }

  function handleSearch() {
    navigate(
      buildParams({
        date: draft.mode === 'date' && draft.date ? toQueryDate(draft.date) : null,
        from: draft.mode === 'range' && draft.from ? toQueryDate(draft.from) : null,
        to: draft.mode === 'range' && draft.to ? toQueryDate(draft.to) : null,
        fndCod: draft.fndCod || null,
        fndNm: draft.fndNm || null,
        sort: query.sort,
        order: query.order,
        page: 1,
      }),
    );
  }

  function handleReset() {
    setDraft({ mode: 'date', date: '', from: '', to: '', fndCod: '', fndNm: '' });
    router.push('/price-history');
  }

  function handleSort(field: PriceRecordSortField) {
    let nextOrder: SortOrder = 'desc';
    if (field === query.sort) {
      nextOrder = query.order === 'asc' ? 'desc' : 'asc';
    }
    navigate(
      buildParams({
        date: query.date,
        from: query.from,
        to: query.to,
        fndCod: query.fndCod,
        fndNm: query.fndNm,
        sort: field,
        order: nextOrder,
        page: 1,
      }),
    );
  }

  function goToPage(page: number) {
    navigate(
      buildParams({
        date: query.date,
        from: query.from,
        to: query.to,
        fndCod: query.fndCod,
        fndNm: query.fndNm,
        sort: query.sort,
        order: query.order,
        page,
      }),
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size));

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold text-[#0a0a0a] mb-2">등록 이력 조회</h1>
      <p className="text-sm text-[#555] mb-6">
        업로드·등록된 기준가 데이터를 날짜, 펀드코드, 펀드명으로 검색합니다.
      </p>

      <Card className="mb-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={draft.mode === 'date' ? 'primary' : 'secondary'}
              onClick={() => setDraft((d) => ({ ...d, mode: 'date' }))}
            >
              특정일
            </Button>
            <Button
              size="sm"
              variant={draft.mode === 'range' ? 'primary' : 'secondary'}
              onClick={() => setDraft((d) => ({ ...d, mode: 'range' }))}
            >
              기간
            </Button>

            {draft.mode === 'date' ? (
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                className="rounded-md border border-[#e5e5e5] px-2 py-1.5 text-sm text-[#333]"
              />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={draft.from}
                  onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  className="rounded-md border border-[#e5e5e5] px-2 py-1.5 text-sm text-[#333]"
                />
                <span className="text-sm text-[#999]">~</span>
                <input
                  type="date"
                  value={draft.to}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  className="rounded-md border border-[#e5e5e5] px-2 py-1.5 text-sm text-[#333]"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="펀드코드"
              value={draft.fndCod}
              onChange={(e) => setDraft((d) => ({ ...d, fndCod: e.target.value }))}
              className="rounded-md border border-[#e5e5e5] px-3 py-1.5 text-sm text-[#333] w-40"
            />
            <input
              type="text"
              placeholder="펀드명"
              value={draft.fndNm}
              onChange={(e) => setDraft((d) => ({ ...d, fndNm: e.target.value }))}
              className="rounded-md border border-[#e5e5e5] px-3 py-1.5 text-sm text-[#333] w-56"
            />
            <Button size="sm" onClick={handleSearch}>
              검색
            </Button>
            <Button size="sm" variant="secondary" onClick={handleReset}>
              초기화
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-[#999]">
                {COLUMNS.map((column) => (
                  <th
                    key={column.field}
                    className={clsx('py-2 pr-3 font-medium', column.field === 'tr_bpr' && 'text-right')}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(column.field)}
                      className={clsx(
                        'flex items-center gap-1 hover:text-[#333]',
                        column.field === 'tr_bpr' && 'ml-auto',
                      )}
                    >
                      {column.label}
                      {query.sort === column.field && <span>{query.order === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                ))}
                <th className="py-2 pr-3 font-medium">업로드일</th>
              </tr>
            </thead>
            <tbody>
              {result.records.map((record) => (
                <tr key={record.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-mono tabular-nums">{record.price_date}</td>
                  <td className="py-2 pr-3">{record.fnd_nm || '-'}</td>
                  <td className="py-2 pr-3 font-mono">{record.fnd_cod || '-'}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{record.tr_bpr}</td>
                  <td className="py-2 pr-3">{statusBadge(record.status)}</td>
                  <td className="py-2 pr-3">
                    <Link
                      href={`/price-uploads/${record.upload_id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {record.upload_date}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.records.length === 0 && (
            <div className="py-8 text-center text-sm text-[#999]">결과 없음</div>
          )}
        </div>

        {result.total > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-[#555]">
            <span>
              전체 {result.total}건 중 {(result.page - 1) * result.page_size + 1}–
              {Math.min(result.page * result.page_size, result.total)}건
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => goToPage(Math.max(1, result.page - 1))}
                disabled={result.page <= 1}
              >
                이전
              </Button>
              <span className="text-xs text-[#999]">
                {result.page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => goToPage(Math.min(totalPages, result.page + 1))}
                disabled={result.page >= totalPages}
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
