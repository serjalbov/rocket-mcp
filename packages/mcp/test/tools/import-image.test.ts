import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  handleImportImage,
  IMPORT_IMAGE_TOOL_NAME,
  importImageTool,
  type ImportImageDispatcher,
} from '../../src/tools/import-image.js';
import { toToolDefinition } from '../tool-schema.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
});

describe('import_image', () => {
  it('exposes filePath rather than encoded image data', () => {
    const definition = toToolDefinition(importImageTool);
    expect(definition.name).toBe(IMPORT_IMAGE_TOOL_NAME);
    expect(importImageTool.serverOnlyArgs).toEqual(['filePath']);
    expect(importImageTool.injectedArgs).toEqual(['bytes']);
    expect(definition.inputSchema).toMatchObject({
      properties: { filePath: { type: 'string' }, url: { type: 'string' } },
    });
    expect(definition.inputSchema.properties).not.toHaveProperty('data');
    expect(definition.inputSchema.properties).not.toHaveProperty('bytes');
  });

  it('loads a local file as native bytes before dispatch', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'import-image-'));
    dirs.push(dir);
    const filePath = join(dir, 'photo.jpg');
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
    await writeFile(filePath, bytes);
    const dispatch = vi.fn<ImportImageDispatcher>(async () => ({ ok: true }));

    await handleImportImage(dispatch, { filePath, name: 'Photo', scaleMode: 'CROP' }, 'request-1');

    expect(dispatch).toHaveBeenCalledWith('import_image', {
      name: 'Photo',
      scaleMode: 'CROP',
      bytes,
      requestId: 'request-1',
    });
  });

  it('keeps URL imports URL-only and requires exactly one source', async () => {
    const dispatch = vi.fn<ImportImageDispatcher>(async () => ({ ok: true }));
    await handleImportImage(dispatch, { url: 'https://example.com/photo.jpg' }, 'request-2');
    expect(dispatch).toHaveBeenCalledWith('import_image', {
      url: 'https://example.com/photo.jpg',
      requestId: 'request-2',
    });
    await expect(handleImportImage(dispatch, {}, 'request-3')).rejects.toThrow(/exactly one/);
    await expect(
      handleImportImage(
        dispatch,
        { filePath: '/tmp/photo.jpg', url: 'https://example.com/photo.jpg' },
        'request-4',
      ),
    ).rejects.toThrow(/exactly one/);
  });

  it('attributes local-file errors to import_image', async () => {
    const dispatch = vi.fn<ImportImageDispatcher>(async () => ({ ok: true }));
    await expect(
      handleImportImage(dispatch, { filePath: 'relative.jpg' }, 'request-5'),
    ).rejects.toThrow(/^import_image:/);
  });
});
