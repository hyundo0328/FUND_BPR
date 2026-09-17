'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'confirm-overwrite';

type UploadResult = {
  uploadId: number;
  count: number;
};

export default function PriceUploadsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setResult(null);

    if (selected && !selected.name.toLowerCase().endsWith('.txt')) {
      setFile(null);
      setStatus('error');
      setMessage('txt 파일만 선택할 수 있습니다.');
      e.target.value = '';
      return;
    }

    setFile(selected);
    setStatus('idle');
    setMessage('');
  }

  async function upload(overwrite: boolean) {
    if (!file) return;

    setStatus('uploading');
    setMessage('');

    const body = new FormData();
    body.append('file', file);

    const url = overwrite ? '/api/price-uploads?overwrite=true' : '/api/price-uploads';
    const res = await fetch(url, { method: 'POST', body });
    const data = await res.json();

    if (res.status === 409) {
      setStatus('confirm-overwrite');
      setMessage(data.error);
      return;
    }

    if (!res.ok) {
      setStatus('error');
      setMessage(data.error ?? '업로드 중 오류가 발생했습니다.');
      return;
    }

    setStatus('success');
    setResult({ uploadId: data.uploadId, count: data.count });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-[#0a0a0a] mb-2">기준가 파일 업로드</h1>
      <p className="text-sm text-[#555] mb-8">
        펀드 평가사로부터 받은 기준가 txt 파일을 선택해서 업로드하세요.
      </p>

      <Card>
        <div className="space-y-4">
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            className="text-sm text-[#333] file:mr-3 file:rounded-md file:border-0 file:bg-[#0a0a0a] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white file:cursor-pointer"
          />

          {file && (
            <div className="text-xs text-[#999]">선택된 파일: {file.name}</div>
          )}

          {status === 'confirm-overwrite' && (
            <div className="space-y-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
              <div className="text-sm text-yellow-800">{message}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => upload(true)}>
                  덮어쓰기
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setStatus('idle')}>
                  취소
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && <div className="text-sm text-red-600">{message}</div>}

          {status === 'success' && result && (
            <div className="space-y-2 rounded-md border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <Badge color="green">완료</Badge>
                <span>기준가 데이터 {result.count}건을 업로드했습니다.</span>
              </div>
              <Link
                href={`/price-uploads/${result.uploadId}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                확인 및 등록 화면으로 이동 →
              </Link>
            </div>
          )}

          <Button
            onClick={() => upload(false)}
            disabled={!file || status === 'uploading' || status === 'confirm-overwrite'}
          >
            {status === 'uploading' ? '업로드 중...' : '업로드'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
