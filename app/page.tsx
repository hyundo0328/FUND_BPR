import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { getDB } from '@/lib/db';
import { getTodayPriceStatus } from '@/lib/priceRecords';

const linkButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors text-sm px-4 py-2 bg-[#0a0a0a] hover:bg-[#333] text-white';

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
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge color="gray">업로드 전</Badge>
              <span className="text-sm text-[#333]">오늘 기준가 파일이 아직 업로드되지 않았습니다.</span>
            </div>
            <Link href="/price-uploads" className={linkButtonClass}>
              업로드하러 가기
            </Link>
          </div>
        )}

        {today.status === 'needs_review' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge color="yellow">확인 필요</Badge>
              <span className="text-sm text-[#333]">
                오늘 업로드된 파일에 확인이나 등록이 남은 항목이 있습니다.
              </span>
            </div>
            <div className="text-sm text-[#333]">
              정상 {today.counts.pending}건 · 이상 {today.counts.issue}건 · 등록완료 {today.counts.registered}건
            </div>
            <Link href={`/price-uploads/${today.upload.id}`} className={linkButtonClass}>
              확인하러 가기
            </Link>
          </div>
        )}

        {today.status === 'completed' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge color="green">완료</Badge>
              <span className="text-sm text-[#333]">오늘 기준가 등록이 모두 완료되었습니다.</span>
            </div>
            <div className="text-sm text-[#333]">
              정상 {today.counts.pending}건 · 이상 {today.counts.issue}건 · 등록완료 {today.counts.registered}건
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
