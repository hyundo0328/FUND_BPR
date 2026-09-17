import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { getTodayPriceStatus, getUploadDetail, normalizePriceRecordQuery, queryPriceRecords } from '@/lib/priceRecords';

const handler = createMcpHandler((server) => {
  server.registerTool(
    'list_price_records',
    {
      title: '기준가 데이터 목록 조회하기',
      description: '등록된 기준가 데이터 목록을 조건에 맞게 조회한다.',
      inputSchema: z.object({
        date: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        fnd_cod: z.string().optional(),
        fnd_nm: z.string().optional(),
        sort: z.string().optional(),
        order: z.string().optional(),
        page: z.string().optional(),
        page_size: z.string().optional(),
      }),
    },
    async ({ date, from, to, fnd_cod, fnd_nm, sort, order, page, page_size }) => {
      const db = getDB();
      const query = normalizePriceRecordQuery({
        date: date ?? null,
        from: from ?? null,
        to: to ?? null,
        fnd_cod: fnd_cod ?? null,
        fnd_nm: fnd_nm ?? null,
        sort: sort ?? null,
        order: order ?? null,
        page: page ?? null,
        page_size: page_size ?? null,
      });
      const result = queryPriceRecords(db, query);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    'get_upload_detail',
    {
      title: '업로드된 기준가 상세 보기',
      description: '특정 업로드 건의 상세 정보와 그 안의 기준가 데이터를 조회한다.',
      inputSchema: z.object({
        upload_id: z.string(),
      }),
    },
    async ({ upload_id }) => {
      const uploadId = Number(upload_id);

      if (!Number.isInteger(uploadId)) {
        return { content: [{ type: 'text', text: '올바르지 않은 업로드 ID입니다.' }] };
      }

      const db = getDB();
      const detail = getUploadDetail(db, uploadId);

      if (!detail) {
        return { content: [{ type: 'text', text: '업로드 내역을 찾을 수 없습니다.' }] };
      }

      return { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] };
    },
  );

  server.registerTool(
    'get_today_price_status',
    {
      title: '오늘의 기준가 등록 현황 보기',
      description: '오늘 기준가 파일이 업로드되었는지, 등록이 얼마나 진행되었는지 조회한다.',
      inputSchema: z.object({}),
    },
    async () => {
      const db = getDB();
      const today = getTodayPriceStatus(db);
      return { content: [{ type: 'text', text: JSON.stringify(today, null, 2) }] };
    },
  );
});

export { handler as GET, handler as POST };
