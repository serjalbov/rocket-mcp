import { z } from 'zod';

import type { ToolSpec } from './spec.js';

export const CREATE_TEXT_TOOL_NAME = 'create_text';

export const createTextTool: ToolSpec = {
  name: CREATE_TEXT_TOOL_NAME,
  description:
    'Create a new TEXT node with the given characters (default font loaded automatically), ' +
    'optionally sized/positioned and appended to a parent (default: current page). Pass fontSize ' +
    'here when a size is needed. width makes the text wrap and grow vertically; bold creates a ' +
    'simple Bold marker at creation. Use set_text_properties only for advanced typography explicitly ' +
    'requested after creation. To change the text of an existing node use set_text. Returns ' +
    '{ ok, nodeId, name, type, width, height }.',
  inputSchema: z.object({
    characters: z.string().describe('Text content'),
    parentId: z.string().optional().describe('Container node id; omit for current page'),
    x: z.number().optional().describe('X position in the parent'),
    y: z.number().optional().describe('Y position in the parent'),
    fontSize: z.number().optional().describe('Font size in px'),
    width: z
      .number()
      .positive()
      .optional()
      .describe('Fixed text box width in px; text wraps and grows vertically'),
    bold: z.boolean().optional().describe('Create the entire text node as a Bold marker'),
  }),
  kind: 'write',
};
