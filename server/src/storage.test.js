import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { writeJson } from './storage.js';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('writeJson concurrency', () => {
  it('produces a parseable file under heavy concurrent writes', async () => {
    const file = path.join(tmpDir, 'metrics.json');
    // Big-ish payload so JSON.stringify + writeFile yield between writers,
    // maximising the chance of an interleaved write without the mutex.
    const writes = Array.from({ length: 50 }, (_, i) => {
      const payload = {};
      for (let k = 0; k < 500; k++) payload['k' + k] = { i, k, blob: 'x'.repeat(40) };
      return writeJson(file, payload);
    });
    await Promise.all(writes);
    const text = await fs.readFile(file, 'utf8');
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('serializes writers so the last awaited write is what lands on disk', async () => {
    const file = path.join(tmpDir, 'screens.json');
    await Promise.all([
      writeJson(file, { which: 'a' }),
      writeJson(file, { which: 'b' }),
      writeJson(file, { which: 'c' }),
    ]);
    const final = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(final).toEqual({ which: 'c' });
  });

  it('a failed write does not poison subsequent writes', async () => {
    const file = path.join(tmpDir, 'ok.json');
    const badDir = path.join(tmpDir, 'does-not-exist', 'nested.json');
    const failing = writeJson(badDir, { will: 'fail' });
    const succeeding = writeJson(file, { ok: true });
    await expect(failing).rejects.toBeDefined();
    await succeeding;
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ ok: true });
  });
});
