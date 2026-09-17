import { describe, expect, it } from 'vitest';
import { evaluatePriceRecordStatus } from '@/lib/priceRecords';

describe('evaluatePriceRecordStatus', () => {
  it('값이 하나라도 없으면 issue를 반환한다', () => {
    const result = evaluatePriceRecordStatus('', 'fund', '1000', 1000);
    expect(result).toEqual({ status: 'issue', issue_reason: '값 없음' });
  });

  it('거래기준가가 0 이하이면 issue를 반환한다', () => {
    const result = evaluatePriceRecordStatus('F001', 'fund', '0', 0);
    expect(result).toEqual({ status: 'issue', issue_reason: '거래기준가 값 이상' });
  });

  it('모든 값이 유효하면 pending을 반환한다', () => {
    const result = evaluatePriceRecordStatus('F001', 'fund', '1000', 1000);
    expect(result).toEqual({ status: 'pending', issue_reason: null });
  });
});
