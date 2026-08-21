import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleBatch, type BatchDispatcher } from '../../src/tools/batch.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
});

describe('handleBatch', () => {
  it('resolves nested set_image_fill file paths to native bytes server-side', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'batch-image-fill-'));
    dirs.push(dir);
    const filePath = join(dir, 'thumb.jpg');
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
    await writeFile(filePath, bytes);
    const dispatch = vi.fn<BatchDispatcher>(async () => ({ ok: true }));

    await handleBatch(
      dispatch,
      {
        ops: [
          {
            tool: 'set_image_fill',
            params: { nodeId: '1:2', filePath, imageFillIndex: 2 },
          },
        ],
      },
      'request-1',
    );

    expect(dispatch).toHaveBeenCalledWith('batch', {
      requestId: 'request-1',
      ops: [
        {
          tool: 'set_image_fill',
          params: { nodeId: '1:2', imageFillIndex: 2, bytes },
        },
      ],
    });
  });

  it('rejects base64 and agent-supplied bytes before dispatch', async () => {
    const dispatch = vi.fn<BatchDispatcher>();
    for (const params of [
      { nodeId: '1:2', data: 'base64' },
      { nodeId: '1:2', bytes: new Uint8Array([1]) },
    ]) {
      await expect(
        handleBatch(dispatch, { ops: [{ tool: 'set_image_fill', params }] }, 'request-1'),
      ).rejects.toThrow(/not allowed/);
    }
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('resolves nested import_image files and leaves URL imports byte-free', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'batch-import-image-'));
    dirs.push(dir);
    const filePath = join(dir, 'photo.jpg');
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 7, 8, 9]);
    await writeFile(filePath, bytes);
    const dispatch = vi.fn<BatchDispatcher>(async () => ({ ok: true }));

    await handleBatch(
      dispatch,
      {
        ops: [
          { tool: 'import_image', params: { filePath, name: 'Local' } },
          {
            tool: 'import_image',
            params: { url: 'https://example.com/photo.jpg', name: 'Remote' },
          },
        ],
      },
      'request-2',
    );

    expect(dispatch).toHaveBeenCalledWith('batch', {
      requestId: 'request-2',
      ops: [
        { tool: 'import_image', params: { name: 'Local', bytes } },
        {
          tool: 'import_image',
          params: { url: 'https://example.com/photo.jpg', name: 'Remote' },
        },
      ],
    });
  });
});
