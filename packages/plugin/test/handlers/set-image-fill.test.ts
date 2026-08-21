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
      base64Decode: vi.fn<(data: string) => Uint8Array>(() => new Uint8Array([1, 2, 3])),
      createImage,
      getNodeByIdAsync: async (id: string) => (id === node.id ? node : null),
    } as unknown as typeof figma,
  };
};

describe('set_image_fill handler', () => {
  it('replaces only the existing IMAGE hash and preserves all paint settings and other fills', async () => {
    const solid = { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 }, opacity: 1 };
    const oldImage = {
      type: 'IMAGE',
      imageHash: 'OLD_HASH',
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
    const node: FakeRectangle = { id: '1:2', type: 'RECTANGLE', fills: [solid, oldImage] };
    const { figma: f } = makeFigma(node);

    const result = (await createSetImageFillHandler(f)({
      nodeId: '1:2',
      data: 'cG5n',
    })) as SetImageFillResult;

    expect(node.fills).toEqual([solid, { ...oldImage, imageHash: 'NEW_HASH' }]);
    expect(result).toEqual({
      ok: true,
      nodeId: '1:2',
      mode: 'replace',
      imageFillIndex: 1,
      previousImageHash: 'OLD_HASH',
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
      data: 'cG5n',
      scaleMode: 'FIT',
    });
    expect(node.fills).toEqual([
      { type: 'IMAGE', imageHash: 'NEW_HASH', scaleMode: 'FIT', opacity: 0.5 },
    ]);
  });

  it('adds a new IMAGE fill above existing paints only in add mode', async () => {
    const solid = { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } };
    const node: FakeRectangle = { id: '1:2', type: 'RECTANGLE', fills: [solid] };
    const { figma: f } = makeFigma(node);
    const result = (await createSetImageFillHandler(f)({
      nodeId: '1:2',
      data: 'cG5n',
      mode: 'add',
      scaleMode: 'FILL',
    })) as SetImageFillResult;

    expect(node.fills).toEqual([
      solid,
      { type: 'IMAGE', imageHash: 'NEW_HASH', scaleMode: 'FILL' },
    ]);
    expect(result.imageFillIndex).toBe(1);
    expect(result.previousImageHash).toBeNull();
  });

  it('rejects ambiguous fill states before creating an image or changing fills', async () => {
    const cases: Array<{ fills: unknown; mode?: 'replace' | 'add'; error: RegExp }> = [
      { fills: [], error: /no IMAGE fill/ },
      {
        fills: [
          { type: 'IMAGE', imageHash: 'A', scaleMode: 'FILL' },
          { type: 'IMAGE', imageHash: 'B', scaleMode: 'FIT' },
        ],
        error: /multiple IMAGE fills/,
      },
      {
        fills: [{ type: 'IMAGE', imageHash: 'A', scaleMode: 'FILL' }],
        mode: 'add',
        error: /already has an IMAGE fill/,
      },
      { fills: Symbol('mixed'), error: /mixed fills/ },
    ];

    for (const item of cases) {
      const node: FakeRectangle = { id: '1:2', type: 'RECTANGLE', fills: item.fills };
      const before = node.fills;
      const { figma: f, createImage } = makeFigma(node);
      await expect(
        createSetImageFillHandler(f)({
          nodeId: '1:2',
          data: 'cG5n',
          ...(item.mode !== undefined ? { mode: item.mode } : {}),
        }),
      ).rejects.toThrow(item.error);
      expect(node.fills).toBe(before);
      expect(createImage).not.toHaveBeenCalled();
    }
  });

  it('rejects non-rectangles, missing nodes, bad input, and oversized images without mutation', async () => {
    const frame = { id: 'F:1', type: 'FRAME' };
    const { figma: frameFigma } = makeFigma(frame);
    await expect(
      createSetImageFillHandler(frameFigma)({ nodeId: 'F:1', data: 'cG5n' }),
    ).rejects.toThrow(/not a RECTANGLE/);
    await expect(
      createSetImageFillHandler(frameFigma)({ nodeId: 'missing', data: 'cG5n' }),
    ).rejects.toThrow(/not a RECTANGLE/);
    await expect(createSetImageFillHandler(frameFigma)({ nodeId: 'F:1' })).rejects.toThrow(/data/);

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
      createSetImageFillHandler(oversizedFigma)({ nodeId: '1:2', data: 'cG5n' }),
    ).rejects.toThrow(/maximum/);
    expect(node.fills).toBe(before);
  });
});
