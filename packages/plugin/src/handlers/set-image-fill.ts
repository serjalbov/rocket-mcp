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
      bytes?: unknown;
      mode?: unknown;
      imageFillIndex?: unknown;
      scaleMode?: unknown;
    };
    if (typeof p.nodeId !== 'string') {
      throw new TypeError('set_image_fill: nodeId must be a string');
    }
    if (!(p.bytes instanceof Uint8Array) || p.bytes.byteLength === 0) {
      throw new TypeError('set_image_fill: bytes must be a non-empty Uint8Array');
    }
    const mode: ImageFillMode = p.mode === undefined ? 'replace' : (p.mode as ImageFillMode);
    if (mode !== 'replace' && mode !== 'add') {
      throw new TypeError('set_image_fill: mode must be replace or add');
    }
    const requestedImageFillIndex = p.imageFillIndex;
    if (
      requestedImageFillIndex !== undefined &&
      (!Number.isInteger(requestedImageFillIndex) || (requestedImageFillIndex as number) < 0)
    ) {
      throw new TypeError('set_image_fill: imageFillIndex must be a non-negative integer');
    }
    if (mode === 'add' && requestedImageFillIndex !== undefined) {
      throw new TypeError('set_image_fill: imageFillIndex is only valid in replace mode');
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
    if (mode === 'replace' && requestedImageFillIndex === undefined && imageIndices.length > 1) {
      throw new Error(
        `set_image_fill: node ${p.nodeId} has ${imageIndices.length} IMAGE fills; provide imageFillIndex`,
      );
    }
    if (mode === 'replace' && requestedImageFillIndex === undefined && imageIndices.length !== 1) {
      throw new Error(`set_image_fill: node ${p.nodeId} has no IMAGE fill to replace`);
    }
    if (
      mode === 'replace' &&
      requestedImageFillIndex !== undefined &&
      fills[requestedImageFillIndex as number]?.type !== 'IMAGE'
    ) {
      throw new Error(
        `set_image_fill: fill ${requestedImageFillIndex as number} on node ${p.nodeId} is not an IMAGE fill`,
      );
    }
    if (mode === 'add' && imageIndices.length !== 0) {
      throw new Error(`set_image_fill: node ${p.nodeId} already has an IMAGE fill`);
    }

    const image = figmaCtx.createImage(p.bytes);
    const size = await image.getSizeAsync();
    if (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION) {
      throw new Error(
        `set_image_fill: image is ${size.width}×${size.height}; maximum is ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION}`,
      );
    }

    let imageFillIndex: number;
    let previousImageHash: string | null = null;
    if (mode === 'replace') {
      imageFillIndex =
        requestedImageFillIndex === undefined
          ? imageIndices[0]!
          : (requestedImageFillIndex as number);
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
