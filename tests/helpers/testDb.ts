import fs from 'fs';
import os from 'os';
import path from 'path';
import { vi } from 'vitest';

let originalCwd: string;
let tempDir: string;

export async function setupTestDb(): Promise<void> {
  originalCwd = process.cwd();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmc-test-'));
  fs.copyFileSync(path.join(originalCwd, 'schema.sql'), path.join(tempDir, 'schema.sql'));
  process.chdir(tempDir);
  vi.resetModules();
}

export function teardownTestDb(): void {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
}
