'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { PriceRecord, PriceUpload } from '@/types';

function statusBadge(record: PriceRecord) {
  if (record.status === 'issue') {
    return <Badge color="red">이상</Badge>;
  }
  if (record.status === 'registered') {
    return <Badge color="green">등록완료</Badge>;
  }
  return <Badge color="gray">정상</Badge>;
}

export function PriceUploadDetailView({
  upload,
  records,
}: {
  upload: PriceUpload;
  records: PriceRecord[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);

  const pendingCount = records.filter((r) => r.status === 'pending').length;
  const issueCount = records.filter((r) => r.status === 'issue').length;
  const registeredCount = records.filter((r) => r.status === 'registered').length;

  async function handleRegister() {
    if (pendingCount === 0) return;
    if (!window.confirm(`${pendingCount}건을 등록합니다`)) return;

    setRegistering(true);
    const res = await fetch(`/api/price-uploads/${upload.id}/register`, { method: 'POST' });
    const data = await res.json();
    setRegistering(false);

    if (!res.ok) {
      window.alert(data.error ?? '등록 중 오류가 발생했습니다.');
      return;
    }

    router.refresh();
  }

  return (
    <div className="max-w-4xl">
      <Link href="/price-uploads" className="text-xs text-[#999] hover:underline">
        ← 기준가 업로드 목록
      </Link>

      <h1 className="text-xl font-semibold text-[#0a0a0a] mt-2 mb-1">
        기준가 확인 및 등록 · {upload.upload_date}
      </h1>
      <p className="text-sm text-[#555] mb-6">{upload.original_filename}</p>

      <Card className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 text-sm text-[#333]">
            <span>
              정상 <span className="font-semibold">{pendingCount}</span>건
            </span>
            <span>
              이상 <span className="font-semibold text-red-600">{issueCount}</span>건
            </span>
            <span>
              등록완료 <span className="font-semibold text-green-700">{registeredCount}</span>건
            </span>
          </div>
          <Button onClick={handleRegister} disabled={pendingCount === 0 || registering}>
            {registering ? '등록 중...' : `등록 (${pendingCount}건)`}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-[#999]">
                <th className="py-2 pr-3 font-medium">일자</th>
                <th className="py-2 pr-3 font-medium">펀드명</th>
                <th className="py-2 pr-3 font-medium">펀드코드</th>
                <th className="py-2 pr-3 font-medium">거래기준가</th>
                <th className="py-2 pr-3 font-medium">상태</th>
                <th className="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const isExpanded = expandedId === record.id;
                return (
                  <Fragment key={record.id}>
                    <tr className="border-b border-gray-100 align-top">
                      <td className="py-2 pr-3">{record.price_date}</td>
                      <td className="py-2 pr-3">{record.fnd_nm || '-'}</td>
                      <td className="py-2 pr-3">{record.fnd_cod || '-'}</td>
                      <td className="py-2 pr-3">{record.tr_bpr}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-col gap-1">
                          {statusBadge(record)}
                          {record.status === 'issue' && record.issue_reason && (
                            <span className="text-xs text-red-600">{record.issue_reason}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : record.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {isExpanded ? '접기' : '상세보기'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <td colSpan={6} className="py-3 px-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs text-[#555]">
                            <div>
                              <div className="text-[#999]">운용사코드</div>
                              <div>{record.mgmt_com_cod || '-'}</div>
                            </div>
                            <div>
                              <div className="text-[#999]">운용사명</div>
                              <div>{record.mgmt_com_nm || '-'}</div>
                            </div>
                            <div>
                              <div className="text-[#999]">과표기준가</div>
                              <div>{record.tx_bpr}</div>
                            </div>
                            <div>
                              <div className="text-[#999]">해외비과세과표기준가</div>
                              <div>{record.fr_tax_free_bpr}</div>
                            </div>
                            <div>
                              <div className="text-[#999]">Full거래기준가</div>
                              <div>{record.full_tr_bpr}</div>
                            </div>
                            <div>
                              <div className="text-[#999]">소득세법</div>
                              <div>{record.income_tax_law || '-'}</div>
                            </div>
                            <div>
                              <div className="text-[#999]">통화구분</div>
                              <div>{record.currency_type || '-'}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {records.length === 0 && (
            <div className="py-8 text-center text-sm text-[#999]">데이터가 없습니다.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
