import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

import { z } from 'zod';

import { detectImageFormat } from './save-image-fills.js';
import type { ToolSpec } from './spec.js';

export const SET_IMAGE_FILL_TOOL_NAME = 'set_image_fill';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const inputSchema = z.object({
  nodeId: z.string().describe('Existing Figma RECTANGLE node id'),
  filePath: z.string().describe('Absolute path to a local PNG / JPG / GIF file (maximum 2 MiB)'),
  scaleMode: z
    .enum(['FILL', 'FIT', 'CROP', 'TILE'])
    .optional()
    .describe('Optional display mode override; replace preserves the current mode when omitted'),
});

export const setImageFillTool: ToolSpec = {
  name: SET_IMAGE_FILL_TOOL_NAME,
  description:
    'Set a local raster image on an existing RECTANGLE without replacing the node. filePath must ' +
    'point to a PNG / JPG / GIF no larger than 2 MiB. It leaves the RECTANGLE itself and all ' +
    'non-IMAGE fills untouched, removes every existing IMAGE fill, then adds exactly one new IMAGE ' +
    'fill. When an IMAGE fill already exists, the topmost one supplies its crop, filters, opacity, ' +
    'visibility, blend mode, scale mode, and stacking position; scaleMode overrides its scale mode. ' +
    'Returns the same nodeId plus the changed fill index and intrinsic image size.',
  inputSchema,
  kind: 'write',
  // filePath stays on the MCP server. The plugin receives native bytes through msgpack `bin`.
  serverOnlyArgs: ['filePath'],
  injectedArgs: ['bytes'],
};

export interface LocalImagePayload {
  absolutePath: string;
  bytes: Buffer;
  format: 'PNG' | 'JPG' | 'GIF';
}

/** Read and validate the local image before any request reaches Figma. */
export const readLocalImage = async (
  filePath: string,
  operation = SET_IMAGE_FILL_TOOL_NAME,
): Promise<LocalImagePayload> => {
  if (!isAbsolute(filePath)) {
    throw new TypeError(`${operation}: filePath must be an absolute path`);
  }
  const absolutePath = resolve(filePath);
  const info = await stat(absolutePath).catch(() => null);
  if (info === null || !info.isFile()) {
    throw new Error(`${operation}: file not found or not a regular file: ${absolutePath}`);
  }
  if (info.size === 0) throw new Error(`${operation}: image file is empty`);
  if (info.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `${operation}: image is ${info.size} bytes; maximum is ${MAX_IMAGE_BYTES} bytes (2 MiB)`,
    );
  }

  const bytes = await readFile(absolutePath);
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `${operation}: image is ${bytes.length} bytes; maximum is ${MAX_IMAGE_BYTES} bytes (2 MiB)`,
    );
  }
  const detected = detectImageFormat(bytes).format;
  if (detected !== 'PNG' && detected !== 'JPG' && detected !== 'GIF') {
    throw new TypeError(`${operation}: unsupported image format; use PNG, JPG, or GIF`);
  }
  return { absolutePath, bytes, format: detected };
};

export type ToolDispatcher = (toolName: string, args: unknown) => Promise<unknown>;

/** Read the server-local file, then dispatch validated native bytes to the Figma plugin. */
export const handleSetImageFill = async (
  dispatch: ToolDispatcher,
  rawArgs: unknown,
  requestId: string,
): Promise<unknown> => {
  const args = inputSchema.parse(rawArgs);
  const image = await readLocalImage(args.filePath);
  return dispatch(SET_IMAGE_FILL_TOOL_NAME, {
    nodeId: args.nodeId,
    bytes: image.bytes,
    requestId,
    ...(args.scaleMode !== undefined ? { scaleMode: args.scaleMode } : {}),
  });
};
