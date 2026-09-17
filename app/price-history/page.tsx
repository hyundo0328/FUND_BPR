import { getDB } from '@/lib/db';
import { normalizePriceRecordQuery, queryPriceRecords } from '@/lib/priceRecords';
import { PriceHistoryView } from './PriceHistoryView';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function PriceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const query = normalizePriceRecordQuery({
    date: firstValue(params.date),
    from: firstValue(params.from),
    to: firstValue(params.to),
    fnd_cod: firstValue(params.fnd_cod),
    fnd_nm: firstValue(params.fnd_nm),
    sort: firstValue(params.sort),
    order: firstValue(params.order),
    page: firstValue(params.page),
    page_size: firstValue(params.page_size),
  });

  const db = getDB();
  const result = queryPriceRecords(db, query);

  return <PriceHistoryView result={result} query={query} />;
}
