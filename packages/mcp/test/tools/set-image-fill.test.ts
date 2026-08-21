import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  handleSetImageFill,
  MAX_IMAGE_BYTES,
  readLocalImage,
  SET_IMAGE_FILL_TOOL_NAME,
  setImageFillTool,
  type ToolDispatcher,
} from '../../src/tools/set-image-fill.js';
import { toToolDefinition } from '../tool-schema.js';

const dirs: string[] = [];
const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'set-image-fill-'));
  dirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(dirs.map(dir => rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
});

describe('set_image_fill — definition', () => {
  it('is a non-destructive write with a server-local filePath', () => {
    const definition = toToolDefinition(setImageFillTool);
    expect(definition.name).toBe(SET_IMAGE_FILL_TOOL_NAME);
    expect(setImageFillTool.kind).toBe('write');
    expect(setImageFillTool.destructive).toBeUndefined();
    expect(setImageFillTool.serverOnlyArgs).toEqual(['filePath']);
    expect(setImageFillTool.injectedArgs).toEqual(['data']);
    expect(definition.inputSchema).toMatchObject({
      type: 'object',
      required: ['nodeId', 'filePath'],
      properties: {
        nodeId: { type: 'string' },
        filePath: { type: 'string' },
        mode: { type: 'string', enum: ['replace', 'add'] },
        imageFillIndex: { type: 'integer', minimum: 0 },
        scaleMode: { type: 'string', enum: ['FILL', 'FIT', 'CROP', 'TILE'] },
      },
    });
  });
});

describe('readLocalImage', () => {
  it('accepts PNG / JPG / GIF by magic bytes', async () => {
    const dir = await makeDir();
    const fixtures = [
      ['image.png', [0x89, 0x50, 0x4e, 0x47]],
      ['image.jpg', [0xff, 0xd8, 0xff]],
      ['image.gif', [0x47, 0x49, 0x46, 0x38]],
    ] as const;
    for (const [name, bytes] of fixtures) {
      const path = join(dir, name);
      await writeFile(path, Buffer.from(bytes));
      await expect(readLocalImage(path)).resolves.toMatchObject({ absolutePath: path });
    }
  });

  it('rejects relative, missing, empty, unsupported, and oversized files', async () => {
    const dir = await makeDir();
    const empty = join(dir, 'empty.png');
    const text = join(dir, 'text.png');
    const huge = join(dir, 'huge.png');
    await writeFile(empty, Buffer.alloc(0));
    await writeFile(text, Buffer.from('not an image'));
    await writeFile(huge, Buffer.alloc(MAX_IMAGE_BYTES + 1, 0x89));

    await expect(readLocalImage('relative.png')).rejects.toThrow(/absolute path/);
    await expect(readLocalImage(join(dir, 'missing.png'))).rejects.toThrow(/not found/);
    await expect(readLocalImage(empty)).rejects.toThrow(/empty/);
    await expect(readLocalImage(text)).rejects.toThrow(/unsupported image format/);
    await expect(readLocalImage(huge)).rejects.toThrow(/maximum.*2 MiB/);
  });
});

describe('handleSetImageFill', () => {
  it('keeps filePath on the server and dispatches validated base64 bytes', async () => {
    const dir = await makeDir();
    const path = join(dir, 'product.png');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    await writeFile(path, bytes);
    const dispatch = vi.fn<ToolDispatcher>(async () => ({ ok: true, nodeId: '1:2' }));

    await expect(
      handleSetImageFill(
        dispatch,
        {
          nodeId: '1:2',
          filePath: path,
          mode: 'replace',
          imageFillIndex: 2,
          scaleMode: 'CROP',
        },
        'request-1',
      ),
    ).resolves.toEqual({ ok: true, nodeId: '1:2' });
    expect(dispatch).toHaveBeenCalledWith('set_image_fill', {
      nodeId: '1:2',
      data: bytes.toString('base64'),
      requestId: 'request-1',
      mode: 'replace',
      imageFillIndex: 2,
      scaleMode: 'CROP',
    });
  });

  it('does not dispatch when the local file fails validation', async () => {
    const dispatch = vi.fn<ToolDispatcher>();
    await expect(
      handleSetImageFill(dispatch, { nodeId: '1:2', filePath: '/missing.png' }, 'request-1'),
    ).rejects.toThrow(/not found/);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
