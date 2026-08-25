import { describe, expect, it, vi } from 'vitest';

import { createImportTextStackHandler } from '../../src/handlers/import-text-stack.js';

const makeText = (id: string) => ({
  id,
  name: `Text ${id}`,
  type: 'TEXT',
  fontName: { family: 'Inter', style: 'Regular' },
  characters: '',
  fontSize: 12,
  x: 0,
  y: 0,
  width: 120,
  height: 24,
  textAutoResize: 'WIDTH_AND_HEIGHT',
  resize: vi.fn<(width: number, height: number) => void>(function (this: { width: number }, width) {
    this.width = width;
  }),
  remove: vi.fn<() => void>(),
});

describe('import_text_stack handler', () => {
  it('creates a wrapped, 40 px-spaced group inside the selected parent in one call', async () => {
    const texts = [makeText('2:1'), makeText('2:2')];
    const parent = { width: 600, appendChild: vi.fn<(node: unknown) => void>() };
    const group = { id: '2:3', name: 'Group', type: 'GROUP' };
    const figmaCtx = {
      createText: vi.fn<() => ReturnType<typeof makeText>>(() => texts.shift()!),
      loadFontAsync: vi.fn<(font: FontName) => Promise<void>>(async () => {}),
      getNodeByIdAsync: vi.fn<(id: string) => Promise<typeof parent>>(async () => parent),
      group: vi.fn<() => typeof group>(() => group),
    } as unknown as typeof figma;
    const handler = createImportTextStackHandler(figmaCtx);

    const result = await handler({
      parentId: '1:1',
      blocks: [
        { characters: 'Heading', bold: true },
        { characters: 'Body text', bold: false },
      ],
      name: 'TXT import',
    });

    expect(parent.appendChild).toHaveBeenCalledTimes(2);
    expect(figmaCtx.group).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      groupId: '2:3',
      groupName: 'TXT import',
      textNodeIds: ['2:1', '2:2'],
      count: 2,
      width: 600,
      height: 88,
    });
  });
});
