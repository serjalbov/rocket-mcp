import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ExportVideoResult, VideoExport } from '@figwright/shared';
import { afterEach, describe, expect, it } from 'vitest';

import {
  EXPORT_VIDEO_TOOL_NAME,
  exportVideoTool,
  handleExportVideo,
  type ToolDispatcher,
  writeExportedVideo,
} from '../../src/tools/export-video.js';
import { toToolDefinition } from '../tool-schema.js';

const exportVideoToolDefinition = toToolDefinition(exportVideoTool);

const dirs: string[] = [];
const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'export-video-'));
  dirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(dirs.map(d => rm(d, { recursive: true, force: true })));
  dirs.length = 0;
});

describe('export_video — definition', () => {
  it('requires nodeId + format + outPath and declares the format enum', () => {
    expect(exportVideoToolDefinition.name).toBe(EXPORT_VIDEO_TOOL_NAME);
    expect(exportVideoToolDefinition.inputSchema).toMatchObject({
      type: 'object',
      required: ['nodeId', 'format', 'outPath'],
      properties: {
        nodeId: { type: 'string' },
        format: { enum: ['MP4', 'GIF', 'WEBM'] },
        outPath: { type: 'string' },
      },
    });
  });
});

describe('writeExportedVideo', () => {
  it('writes the bytes to outPath, creating missing parent dirs', async () => {
    const base = await makeDir();
    const path = join(base, 'nested', 'clip.mp4');
    const bytes = new Uint8Array([0, 0, 0]);
    const video: VideoExport = { nodeId: '2:3', format: 'MP4', bytes };
    const result = await writeExportedVideo(path, video);

    expect(result).toEqual({ nodeId: '2:3', format: 'MP4', path });
    expect(new Uint8Array(await readFile(path))).toEqual(bytes);
  });

  it('returns path null with the reason and writes nothing when bytes is null', async () => {
    const dir = await makeDir();
    const path = join(dir, 'x.gif');
    const result = await writeExportedVideo(path, {
      nodeId: '9:9',
      format: 'GIF',
      bytes: null,
      reason: 'no-top-level-frame',
    });
    expect(result).toEqual({
      nodeId: '9:9',
      format: 'GIF',
      path: null,
      reason: 'no-top-level-frame',
    });
    await expect(readFile(path)).rejects.toThrow(/ENOENT/);
  });

  it("carries Figma's own error message through on a failed export", async () => {
    const dir = await makeDir();
    const path = join(dir, 'y.mp4');
    const result = await writeExportedVideo(path, {
      nodeId: '4:4',
      format: 'MP4',
      bytes: null,
      reason: 'failed',
      error: 'The frame has no animation to export',
    });
    expect(result).toEqual({
      nodeId: '4:4',
      format: 'MP4',
      path: null,
      reason: 'failed',
      error: 'The frame has no animation to export',
    });
    await expect(readFile(path)).rejects.toThrow(/ENOENT/);
  });
});

describe('handleExportVideo', () => {
  it('dispatches export_video with the plugin args (outPath stripped) and writes the file', async () => {
    const dir = await makeDir();
    const path = join(dir, 'out.mp4');
    let dispatched: { tool: string; args: unknown } | null = null;
    const dispatch: ToolDispatcher = async (tool, args) => {
      dispatched = { tool, args };
      return {
        nodeId: '5:5',
        format: 'MP4',
        bytes: new Uint8Array([0, 0, 0]),
      } satisfies VideoExport;
    };

    const result = (await handleExportVideo(dispatch, {
      nodeId: '5:5',
      format: 'MP4',
      outPath: path,
    })) as ExportVideoResult;

    expect(dispatched).toEqual({
      tool: 'export_video',
      args: { nodeId: '5:5', format: 'MP4' },
    });
    expect(result).toEqual({ nodeId: '5:5', format: 'MP4', path });
    expect(new Uint8Array(await readFile(path))).toEqual(new Uint8Array([0, 0, 0]));
  });

  it('writes raw bytes when the plugin answers the binary request', async () => {
    const dir = await makeDir();
    const path = join(dir, 'bin.mp4');
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18]);
    const dispatch: ToolDispatcher = async () =>
      ({ nodeId: '5:5', format: 'MP4', bytes }) satisfies VideoExport;

    const result = (await handleExportVideo(dispatch, {
      nodeId: '5:5',
      format: 'MP4',
      outPath: path,
    })) as ExportVideoResult;

    expect(result).toEqual({ nodeId: '5:5', format: 'MP4', path });
    expect(new Uint8Array(await readFile(path))).toEqual(bytes);
  });

  it('forwards fps / quality / constraint to the plugin export', async () => {
    const dir = await makeDir();
    let forwarded: unknown = null;
    const dispatch: ToolDispatcher = async (_tool, args) => {
      forwarded = args;
      return {
        nodeId: '3:21',
        format: 'WEBM',
        bytes: new Uint8Array([0]),
      } satisfies VideoExport;
    };
    await handleExportVideo(dispatch, {
      nodeId: '3:21',
      format: 'WEBM',
      fps: 30,
      quality: 'HIGH',
      constraint: { type: 'SCALE', value: 2 },
      outPath: join(dir, 'frame.webm'),
    });
    expect(forwarded).toEqual({
      nodeId: '3:21',
      format: 'WEBM',
      fps: 30,
      quality: 'HIGH',
      constraint: { type: 'SCALE', value: 2 },
    });
  });

  it('rejects input missing outPath', async () => {
    const dispatch: ToolDispatcher = async () =>
      ({ nodeId: '0:1', format: 'MP4', bytes: null }) satisfies VideoExport;
    await expect(handleExportVideo(dispatch, { nodeId: '0:1', format: 'MP4' })).rejects.toThrow(
      /outPath/,
    );
  });
});
