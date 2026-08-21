import { z } from 'zod';

import { readLocalImage } from './set-image-fill.js';
import type { ToolSpec } from './spec.js';

export const IMPORT_IMAGE_TOOL_NAME = 'import_image';

const inputSchema = z.object({
  filePath: z
    .string()
    .optional()
    .describe('Absolute path to a local PNG / JPG / GIF file (maximum 2 MiB)'),
  url: z.string().optional().describe('Image URL to fetch instead of a local file'),
  name: z.string().optional().describe('Optional name for the new rectangle'),
  parentId: z.string().optional().describe('Parent node id (default: current page)'),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional().describe('Override width (default: image width)'),
  height: z.number().optional().describe('Override height (default: image height)'),
  scaleMode: z.enum(['FILL', 'FIT', 'CROP', 'TILE']).optional(),
});

export const importImageTool: ToolSpec = {
  name: IMPORT_IMAGE_TOOL_NAME,
  description:
    'Import a raster image (PNG / JPG / GIF) and place it as a rectangle with an IMAGE fill. Provide ' +
    'an absolute local filePath or url. Local files are read server-side and transferred as native ' +
    'binary bytes. The rectangle defaults to the image size unless ' +
    'width/height are given. scaleMode is FILL / FIT / CROP / TILE (default FILL). For vector SVG ' +
    '(logos / icons) use import_svg instead. Returns { ok, nodeId, name, type }.',
  inputSchema,
  kind: 'write',
  serverOnlyArgs: ['filePath'],
  injectedArgs: ['bytes'],
};

export type ImportImageDispatcher = (toolName: string, args: unknown) => Promise<unknown>;

/** Resolve a local source to native bytes; URLs remain URL-only and never enter model context. */
export const handleImportImage = async (
  dispatch: ImportImageDispatcher,
  rawArgs: unknown,
  requestId: string,
): Promise<unknown> => {
  const args = inputSchema.parse(rawArgs);
  const hasFile = args.filePath !== undefined;
  const hasUrl = args.url !== undefined;
  if (hasFile === hasUrl) {
    throw new TypeError('import_image: provide exactly one of filePath or url');
  }
  const { filePath, ...pluginArgs } = args;
  if (filePath === undefined) {
    return dispatch(IMPORT_IMAGE_TOOL_NAME, { ...pluginArgs, requestId });
  }
  const image = await readLocalImage(filePath, IMPORT_IMAGE_TOOL_NAME);
  return dispatch(IMPORT_IMAGE_TOOL_NAME, { ...pluginArgs, bytes: image.bytes, requestId });
};
