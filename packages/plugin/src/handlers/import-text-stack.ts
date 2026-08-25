import type { SandboxToolHandler } from '../dispatcher.js';

type TextBlock = { characters: string; bold: boolean };

const loadTextFont = async (
  figmaCtx: typeof figma,
  text: TextNode,
  bold: boolean,
): Promise<void> => {
  await figmaCtx.loadFontAsync(text.fontName as FontName);
  if (!bold) return;

  const current = text.fontName as FontName;
  const preferred = { family: current.family, style: 'Bold' };
  try {
    await figmaCtx.loadFontAsync(preferred);
    text.fontName = preferred;
  } catch {
    const fallback = { family: 'Inter', style: 'Bold' };
    await figmaCtx.loadFontAsync(fallback);
    text.fontName = fallback;
  }
};

/**
 * Create an unstyled source-text stack in one Figma operation.
 *
 * This is deliberately separate from create_text: txtimport needs the plugin, not the LLM, to own
 * the parent width, wrapping, vertical positions, and final group. That keeps a long import to one
 * MCP call and makes its geometry deterministic.
 */
export const createImportTextStackHandler =
  (figmaCtx: typeof figma): SandboxToolHandler =>
  async params => {
    const p = (params ?? {}) as { parentId?: unknown; blocks?: unknown; name?: unknown };
    if (typeof p.parentId !== 'string') {
      throw new TypeError('import_text_stack: parentId must be a string');
    }
    if (!Array.isArray(p.blocks) || p.blocks.length === 0) {
      throw new TypeError('import_text_stack: blocks must be a non-empty array');
    }
    const blocks: TextBlock[] = p.blocks.map((block, index) => {
      if (
        block === null ||
        typeof block !== 'object' ||
        typeof (block as { characters?: unknown }).characters !== 'string' ||
        ((block as { bold?: unknown }).bold !== undefined &&
          typeof (block as { bold?: unknown }).bold !== 'boolean')
      ) {
        throw new TypeError(`import_text_stack: block ${index + 1} is invalid`);
      }
      return {
        characters: (block as { characters: string }).characters,
        bold: (block as { bold?: boolean }).bold === true,
      };
    });

    const parent = await figmaCtx.getNodeByIdAsync(p.parentId);
    if (parent === null || !('appendChild' in parent) || !('width' in parent)) {
      throw new Error(
        `import_text_stack: parent ${p.parentId} not found or cannot contain children`,
      );
    }
    const container = parent as BaseNode & ChildrenMixin & { width: number };
    if (!Number.isFinite(container.width) || container.width <= 0) {
      throw new Error('import_text_stack: parent must have a positive width');
    }

    const nodes: TextNode[] = [];
    let y = 0;
    for (const block of blocks) {
      const text = figmaCtx.createText();
      // eslint-disable-next-line no-await-in-loop -- Figma text nodes must stay in source order.
      await loadTextFont(figmaCtx, text, block.bold);
      text.characters = block.characters;
      text.fontSize = 20;
      text.textAutoResize = 'HEIGHT';
      text.resize(container.width, text.height);
      container.appendChild(text);
      text.x = 0;
      text.y = y;
      nodes.push(text);
      y += text.height + 40;
    }

    const group = figmaCtx.group(nodes, container);
    if (typeof p.name === 'string') group.name = p.name;

    return {
      ok: true,
      groupId: group.id,
      groupName: group.name,
      textNodeIds: nodes.map(node => node.id),
      count: nodes.length,
      width: container.width,
      height: Math.max(0, y - 40),
    };
  };
