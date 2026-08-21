import type { CreateResult } from '@figwright/shared';

import type { SandboxToolHandler } from '../dispatcher.js';
import { placeNode } from './place.js';

const SCALE_MODES = ['FILL', 'FIT', 'CROP', 'TILE'] as const;
type ScaleMode = (typeof SCALE_MODES)[number];

/**
 * Import an image and place it as a rectangle with an IMAGE fill. Source is either native `bytes`
 * or a `url` fetched via createImageAsync (the plugin manifest allows it). The rectangle defaults
 * to the image's intrinsic size unless width/height are given.
 */
export const createImportImageHandler =
  (figmaCtx: typeof figma): SandboxToolHandler =>
  async params => {
    const p = (params ?? {}) as {
      bytes?: unknown;
      url?: unknown;
      name?: unknown;
      parentId?: unknown;
      x?: unknown;
      y?: unknown;
      width?: unknown;
      height?: unknown;
      scaleMode?: unknown;
    };
    const hasBytes = p.bytes instanceof Uint8Array && p.bytes.byteLength > 0;
    const hasUrl = typeof p.url === 'string';
    if (hasBytes === hasUrl) {
      throw new TypeError('import_image: provide exactly one of non-empty bytes or url');
    }
    const scaleMode: ScaleMode = SCALE_MODES.includes(p.scaleMode as ScaleMode)
      ? (p.scaleMode as ScaleMode)
      : 'FILL';

    const image = hasBytes
      ? figmaCtx.createImage(p.bytes as Uint8Array)
      : await figmaCtx.createImageAsync(p.url as string);
    const size = await image.getSizeAsync();

    const rect = figmaCtx.createRectangle();
    if (typeof p.name === 'string') rect.name = p.name;
    rect.resize(
      typeof p.width === 'number' ? p.width : size.width,
      typeof p.height === 'number' ? p.height : size.height,
    );
    if (typeof p.x === 'number') rect.x = p.x;
    if (typeof p.y === 'number') rect.y = p.y;
    rect.fills = [{ type: 'IMAGE', scaleMode, imageHash: image.hash }];

    await placeNode(figmaCtx, rect, p.parentId, 'import_image');

    const result: CreateResult = { ok: true, nodeId: rect.id, name: rect.name, type: rect.type };
    return result;
  };
