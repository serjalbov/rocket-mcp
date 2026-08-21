import type { SandboxToolHandler } from '../dispatcher.js';

const SCALE_MODES = ['FILL', 'FIT', 'CROP', 'TILE'] as const;
type ScaleMode = (typeof SCALE_MODES)[number];
type ImageFillMode = 'replace' | 'add';

export const MAX_IMAGE_DIMENSION = 4096;

export interface SetImageFillResult {
  ok: true;
  nodeId: string;
  mode: ImageFillMode;
  imageFillIndex: number;
  previousImageHash: string | null;
  imageHash: string;
  width: number;
  height: number;
}

/**
 * Replace or add one IMAGE paint while leaving the RECTANGLE itself and every unrelated paint
 * untouched. Validation completes before assigning `fills`, so every rejected call is read-only.
 */
export const createSetImageFillHandler =
  (figmaCtx: typeof figma): SandboxToolHandler =>
  async params => {
    const p = (params ?? {}) as {
      nodeId?: unknown;
      data?: unknown;
      mode?: unknown;
      scaleMode?: unknown;
    };
    if (typeof p.nodeId !== 'string') {
      throw new TypeError('set_image_fill: nodeId must be a string');
    }
    if (typeof p.data !== 'string' || p.data.length === 0) {
      throw new TypeError('set_image_fill: data must be non-empty base64 image bytes');
    }
    const mode: ImageFillMode = p.mode === undefined ? 'replace' : (p.mode as ImageFillMode);
    if (mode !== 'replace' && mode !== 'add') {
      throw new TypeError('set_image_fill: mode must be replace or add');
    }
    const scaleMode = p.scaleMode as ScaleMode | undefined;
    if (scaleMode !== undefined && !SCALE_MODES.includes(scaleMode)) {
      throw new TypeError('set_image_fill: scaleMode must be FILL, FIT, CROP, or TILE');
    }

    const node = await figmaCtx.getNodeByIdAsync(p.nodeId);
    if (node === null || node.type !== 'RECTANGLE') {
      throw new Error(`set_image_fill: node ${p.nodeId} is not a RECTANGLE`);
    }
    if (!Array.isArray(node.fills)) {
      throw new Error(`set_image_fill: node ${p.nodeId} has mixed fills`);
    }

    const fills = [...node.fills];
    const imageIndices = fills.flatMap((paint, index) => (paint.type === 'IMAGE' ? [index] : []));
    if (imageIndices.length > 1) {
      throw new Error(
        `set_image_fill: node ${p.nodeId} has ${imageIndices.length} IMAGE fills; multiple IMAGE fills are not supported`,
      );
    }
    if (mode === 'replace' && imageIndices.length !== 1) {
      throw new Error(`set_image_fill: node ${p.nodeId} has no IMAGE fill to replace`);
    }
    if (mode === 'add' && imageIndices.length !== 0) {
      throw new Error(`set_image_fill: node ${p.nodeId} already has an IMAGE fill`);
    }

    const image = figmaCtx.createImage(figmaCtx.base64Decode(p.data));
    const size = await image.getSizeAsync();
    if (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION) {
      throw new Error(
        `set_image_fill: image is ${size.width}×${size.height}; maximum is ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION}`,
      );
    }

    let imageFillIndex: number;
    let previousImageHash: string | null = null;
    if (mode === 'replace') {
      imageFillIndex = imageIndices[0]!;
      const previous = fills[imageFillIndex] as ImagePaint;
      previousImageHash = previous.imageHash;
      fills[imageFillIndex] = {
        ...previous,
        imageHash: image.hash,
        ...(scaleMode !== undefined ? { scaleMode } : {}),
      };
    } else {
      imageFillIndex = fills.length;
      fills.push({ type: 'IMAGE', imageHash: image.hash, scaleMode: scaleMode ?? 'FILL' });
    }

    node.fills = fills;
    const result: SetImageFillResult = {
      ok: true,
      nodeId: node.id,
      mode,
      imageFillIndex,
      previousImageHash,
      imageHash: image.hash,
      width: size.width,
      height: size.height,
    };
    return result;
  };
