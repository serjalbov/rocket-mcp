import type { CreateResult } from '@figwright/shared';

import type { SandboxToolHandler } from '../dispatcher.js';
import { placeNode } from './place.js';

export const createCreateTextHandler =
  (figmaCtx: typeof figma): SandboxToolHandler =>
  async params => {
    const p = (params ?? {}) as {
      parentId?: unknown;
      characters?: unknown;
      x?: unknown;
      y?: unknown;
      fontSize?: unknown;
      width?: unknown;
      bold?: unknown;
    };
    if (typeof p.characters !== 'string') {
      throw new TypeError('create_text: characters must be a string');
    }
    if (
      p.width !== undefined &&
      (typeof p.width !== 'number' || !Number.isFinite(p.width) || p.width <= 0)
    ) {
      throw new TypeError('create_text: width must be a positive finite number');
    }
    if (p.bold !== undefined && typeof p.bold !== 'boolean') {
      throw new TypeError('create_text: bold must be a boolean');
    }

    const text = figmaCtx.createText();
    await figmaCtx.loadFontAsync(text.fontName as FontName); // default font must be loaded first
    text.characters = p.characters;
    if (typeof p.fontSize === 'number') text.fontSize = p.fontSize;
    if (p.bold === true) {
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
    }
    if (typeof p.width === 'number') {
      text.textAutoResize = 'HEIGHT';
      text.resize(p.width, text.height);
    }
    if (typeof p.x === 'number') text.x = p.x;
    if (typeof p.y === 'number') text.y = p.y;

    await placeNode(figmaCtx, text, p.parentId, 'create_text');

    const result: CreateResult = {
      ok: true,
      nodeId: text.id,
      name: text.name,
      type: text.type,
      width: text.width,
      height: text.height,
    };
    return result;
  };
