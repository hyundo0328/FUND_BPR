import iconv from 'iconv-lite';
import { NextRequest } from 'next/server';

export function makeTextFile(
  content: string,
  filename = 'price.txt',
  encoding: 'utf-8' | 'euc-kr' = 'utf-8',
): File {
  const buffer = encoding === 'utf-8' ? Buffer.from(content, 'utf-8') : iconv.encode(content, 'euc-kr');
  return new File([new Uint8Array(buffer)], filename, { type: 'text/plain' });
}

export function makeUploadRequest(url: string, file: File, overwrite?: boolean): NextRequest {
  const formData = new FormData();
  formData.set('file', file);
  if (overwrite !== undefined) {
    formData.set('overwrite', String(overwrite));
  }
  return new NextRequest(url, { method: 'POST', body: formData });
}

export function makeGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}
