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
  removedImageCount: number;
  imageHash: string;
  width: number;
  height: number;
}

/**
 * Reconcile a RECTANGLE to exactly one IMAGE paint. Every existing IMAGE paint is removed, while
 * the topmost one's settings and stacking position are carried to the replacement. Non-IMAGE paints
 * and every node-level property remain untouched. Validation completes before assigning `fills`.
 */
export const createSetImageFillHandler =
  (figmaCtx: typeof figma): SandboxToolHandler =>
  async params => {
    const p = (params ?? {}) as {
      nodeId?: unknown;
      bytes?: unknown;
      scaleMode?: unknown;
    };
    if (typeof p.nodeId !== 'string') {
      throw new TypeError('set_image_fill: nodeId must be a string');
    }
    if (!(p.bytes instanceof Uint8Array) || p.bytes.byteLength === 0) {
      throw new TypeError('set_image_fill: bytes must be a non-empty Uint8Array');
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

    const image = figmaCtx.createImage(p.bytes);
    const size = await image.getSizeAsync();
    if (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION) {
      throw new Error(
        `set_image_fill: image is ${size.width}×${size.height}; maximum is ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION}`,
      );
    }

    const topImageIndex = imageIndices.at(-1);
    const previous = topImageIndex === undefined ? null : (fills[topImageIndex] as ImagePaint);
    const retainedFills = fills.filter(paint => paint.type !== 'IMAGE');
    const imageFillIndex =
      topImageIndex === undefined
        ? retainedFills.length
        : fills.slice(0, topImageIndex).filter(paint => paint.type !== 'IMAGE').length;
    const replacement: ImagePaint =
      previous === null
        ? { type: 'IMAGE', imageHash: image.hash, scaleMode: scaleMode ?? 'FILL' }
        : { ...previous, imageHash: image.hash, ...(scaleMode !== undefined ? { scaleMode } : {}) };
    retainedFills.splice(imageFillIndex, 0, replacement);
    node.fills = retainedFills;
    const result: SetImageFillResult = {
      ok: true,
      nodeId: node.id,
      mode: previous === null ? 'add' : 'replace',
      imageFillIndex,
      previousImageHash: previous?.imageHash ?? null,
      removedImageCount: imageIndices.length,
      imageHash: image.hash,
      width: size.width,
      height: size.height,
    };
    return result;
  };
