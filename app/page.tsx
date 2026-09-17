import Link from 'next/link';
import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, UploadCloud } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { getDB } from '@/lib/db';
import { getTodayPriceStatus } from '@/lib/priceRecords';
import type { PriceRecordStatusCounts } from '@/types';

const linkButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors text-sm px-4 py-2 bg-[#0a0a0a] hover:bg-[#333] text-white';

function StatusIcon({ tone, children }: { tone: 'neutral' | 'warning' | 'success'; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        tone === 'neutral' && 'bg-gray-100 text-gray-500',
        tone === 'warning' && 'bg-amber-50 text-amber-600',
        tone === 'success' && 'bg-green-50 text-green-600',
      )}
    >
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'danger' | 'success';
}) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#999]">{label}</div>
      <div
        className={clsx(
          'font-mono text-2xl font-semibold tabular-nums',
          tone === 'danger' && (value > 0 ? 'text-red-600' : 'text-[#0a0a0a]'),
          tone === 'success' && 'text-green-700',
          tone === 'neutral' && 'text-[#0a0a0a]',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function CountTiles({ counts }: { counts: PriceRecordStatusCounts }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
      <StatTile label="정상" value={counts.pending} tone="neutral" />
      <StatTile label="등록실패" value={counts.issue} tone="danger" />
      <StatTile label="등록완료" value={counts.registered} tone="success" />
    </div>
  );
}

export default function HomePage() {
  const db = getDB();
  const today = getTodayPriceStatus(db);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-[#0a0a0a] mb-2">오늘의 등록 현황</h1>
      <p className="text-sm text-[#555] mb-8">
        오늘 기준가 파일 업로드와 등록 상태를 한눈에 확인할 수 있습니다.
      </p>

      <Card>
        {today.status === 'not_uploaded' && (
          <div className="flex items-start gap-4">
            <StatusIcon tone="neutral">
              <UploadCloud className="h-5 w-5" />
            </StatusIcon>
            <div className="flex-1 space-y-3">
              <div>
                <div className="text-base font-semibold text-[#0a0a0a]">
                  오늘 기준가 파일이 아직 업로드되지 않았습니다
                </div>
                <div className="mt-0.5 text-sm text-[#999]">업로드 후 이상 여부를 확인하고 등록을 진행하세요.</div>
              </div>
              <Link href="/price-uploads" className={linkButtonClass}>
                업로드하러 가기
              </Link>
            </div>
          </div>
        )}

        {today.status === 'needs_review' && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <StatusIcon tone="warning">
                <AlertTriangle className="h-5 w-5" />
              </StatusIcon>
              <div>
                <div className="text-base font-semibold text-[#0a0a0a]">확인이나 등록이 남은 항목이 있습니다</div>
                <div className="mt-0.5 text-sm text-[#999]">등록실패 건을 확인한 뒤 등록을 진행하세요.</div>
              </div>
            </div>
            <CountTiles counts={today.counts} />
            <Link href={`/price-uploads/${today.upload.id}`} className={linkButtonClass}>
              확인하러 가기
            </Link>
          </div>
        )}

        {today.status === 'completed' && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <StatusIcon tone="success">
                <CheckCircle2 className="h-5 w-5" />
              </StatusIcon>
              <div className="text-base font-semibold text-[#0a0a0a]">오늘 기준가 등록이 모두 완료되었습니다</div>
            </div>
            <CountTiles counts={today.counts} />
          </div>
        )}
      </Card>
    </div>
  );
}
