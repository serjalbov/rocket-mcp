import { describe, expect, it, vi } from 'vitest';

import {
  createSetImageFillHandler,
  MAX_IMAGE_DIMENSION,
  type SetImageFillResult,
} from '../../src/handlers/set-image-fill.js';

interface FakeRectangle {
  id: string;
  type: 'RECTANGLE';
  fills: unknown;
}

const IMAGE_BYTES = new Uint8Array([1, 2, 3]);

const makeFigma = (
  node: FakeRectangle | { id: string; type: string },
  size = { width: 1024, height: 768 },
): { figma: typeof figma; createImage: ReturnType<typeof vi.fn> } => {
  const createImage = vi.fn<
    () => { hash: string; getSizeAsync: () => Promise<{ width: number; height: number }> }
  >(() => ({
    hash: 'NEW_HASH',
    getSizeAsync: async () => size,
  }));
  return {
    createImage,
    figma: {
      createImage,
      getNodeByIdAsync: async (id: string) => (id === node.id ? node : null),
    } as unknown as typeof figma,
  };
};

describe('set_image_fill handler', () => {
  it('removes every existing IMAGE fill and preserves the topmost settings and stacking position', async () => {
    const solid = { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 }, opacity: 1 };
    const lowerImage = {
      type: 'IMAGE',
      imageHash: 'LOWER_HASH',
      scaleMode: 'FIT',
      opacity: 0.5,
    };
    const middleSolid = { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.3 };
    const upperImage = {
      type: 'IMAGE',
      imageHash: 'UPPER_HASH',
      scaleMode: 'CROP',
      imageTransform: [
        [1, 0, 0.2],
        [0, 1, 0.1],
      ],
      filters: { exposure: 0.2, contrast: -0.1 },
      opacity: 0.75,
      visible: true,
      blendMode: 'MULTIPLY',
    };
    const trailingSolid = { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.2 };
    const node: FakeRectangle = {
      id: '1:2',
      type: 'RECTANGLE',
      fills: [solid, lowerImage, middleSolid, upperImage, trailingSolid],
    };
    const { figma: f } = makeFigma(node);

    const result = (await createSetImageFillHandler(f)({
      nodeId: '1:2',
      bytes: IMAGE_BYTES,
    })) as SetImageFillResult;

    expect(node.fills).toEqual([
      solid,
      middleSolid,
      { ...upperImage, imageHash: 'NEW_HASH' },
      trailingSolid,
    ]);
    expect(result).toEqual({
      ok: true,
      nodeId: '1:2',
      mode: 'replace',
      imageFillIndex: 2,
      previousImageHash: 'UPPER_HASH',
      removedImageCount: 2,
      imageHash: 'NEW_HASH',
      width: 1024,
      height: 768,
    });
  });

  it('overrides scaleMode only when explicitly requested', async () => {
    const node: FakeRectangle = {
      id: '1:2',
      type: 'RECTANGLE',
      fills: [{ type: 'IMAGE', imageHash: 'OLD_HASH', scaleMode: 'CROP', opacity: 0.5 }],
    };
    const { figma: f } = makeFigma(node);
    await createSetImageFillHandler(f)({
      nodeId: '1:2',
      bytes: IMAGE_BYTES,
      scaleMode: 'FIT',
    });
    expect(node.fills).toEqual([
      { type: 'IMAGE', imageHash: 'NEW_HASH', scaleMode: 'FIT', opacity: 0.5 },
    ]);
  });

  it('adds a new IMAGE fill above existing paints when no IMAGE fill exists', async () => {
    const solid = { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } };
    const node: FakeRectangle = { id: '1:2', type: 'RECTANGLE', fills: [solid] };
    const { figma: f } = makeFigma(node);
    const result = (await createSetImageFillHandler(f)({
      nodeId: '1:2',
      bytes: IMAGE_BYTES,
      scaleMode: 'FILL',
    })) as SetImageFillResult;

    expect(node.fills).toEqual([
      solid,
      { type: 'IMAGE', imageHash: 'NEW_HASH', scaleMode: 'FILL' },
    ]);
    expect(result.imageFillIndex).toBe(1);
    expect(result.previousImageHash).toBeNull();
    expect(result.removedImageCount).toBe(0);
  });

  it('preserves every node-level property while replacing the image', async () => {
    const node = {
      id: '1:2',
      type: 'RECTANGLE' as const,
      fills: [{ type: 'IMAGE', imageHash: 'OLD_HASH', scaleMode: 'FILL' }],
      x: 7971,
      y: 3895,
      width: 274,
      height: 204,
      rotation: 0,
      opacity: 1,
      cornerRadius: 12,
      strokes: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
      effects: [{ type: 'DROP_SHADOW', radius: 8 }],
      constraints: { horizontal: 'MIN', vertical: 'MIN' },
      parent: { id: 'P:1', children: ['before', '1:2', 'after'] },
      locked: false,
      visible: true,
    };
    const before = {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      opacity: node.opacity,
      cornerRadius: node.cornerRadius,
      strokes: node.strokes,
      effects: node.effects,
      constraints: node.constraints,
      parent: node.parent,
      locked: node.locked,
      visible: node.visible,
    };
    const { figma: f } = makeFigma(node);
    await createSetImageFillHandler(f)({ nodeId: '1:2', bytes: IMAGE_BYTES });

    expect({
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      opacity: node.opacity,
      cornerRadius: node.cornerRadius,
      strokes: node.strokes,
      effects: node.effects,
      constraints: node.constraints,
      parent: node.parent,
      locked: node.locked,
      visible: node.visible,
    }).toEqual(before);
    expect(node.parent.children).toEqual(['before', '1:2', 'after']);
  });

  it('rejects mixed fills before creating an image or changing fills', async () => {
    const node: FakeRectangle = { id: '1:2', type: 'RECTANGLE', fills: Symbol('mixed') };
    const before = node.fills;
    const { figma: f, createImage } = makeFigma(node);

    await expect(
      createSetImageFillHandler(f)({ nodeId: '1:2', bytes: IMAGE_BYTES }),
    ).rejects.toThrow(/mixed fills/);
    expect(node.fills).toBe(before);
    expect(createImage).not.toHaveBeenCalled();
  });

  it('rejects non-rectangles, missing nodes, bad input, and oversized images without mutation', async () => {
    const frame = { id: 'F:1', type: 'FRAME' };
    const { figma: frameFigma } = makeFigma(frame);
    await expect(
      createSetImageFillHandler(frameFigma)({ nodeId: 'F:1', bytes: IMAGE_BYTES }),
    ).rejects.toThrow(/not a RECTANGLE/);
    await expect(
      createSetImageFillHandler(frameFigma)({ nodeId: 'missing', bytes: IMAGE_BYTES }),
    ).rejects.toThrow(/not a RECTANGLE/);
    await expect(createSetImageFillHandler(frameFigma)({ nodeId: 'F:1' })).rejects.toThrow(/bytes/);

    const node: FakeRectangle = {
      id: '1:2',
      type: 'RECTANGLE',
      fills: [{ type: 'IMAGE', imageHash: 'OLD', scaleMode: 'FILL' }],
    };
    const before = node.fills;
    const { figma: oversizedFigma } = makeFigma(node, {
      width: MAX_IMAGE_DIMENSION + 1,
      height: 100,
    });
    await expect(
      createSetImageFillHandler(oversizedFigma)({ nodeId: '1:2', bytes: IMAGE_BYTES }),
    ).rejects.toThrow(/maximum/);
    expect(node.fills).toBe(before);
  });
});
