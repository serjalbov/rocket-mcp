import { z } from 'zod';

import type { ToolSpec } from './spec.js';

export const IMPORT_TEXT_STACK_TOOL_NAME = 'import_text_stack';

export const importTextStackTool: ToolSpec = {
  name: IMPORT_TEXT_STACK_TOOL_NAME,
  description:
    'Import source text blocks into one selected Figma FRAME or SECTION as a plain vertical stack. ' +
    'The plugin uses the supplied width or parent width, creates 20 px text that wraps and grows ' +
    'downward, leaves 40 px gaps, and returns one ordinary group. Optional x/y preserve an ' +
    'existing text block position. No Auto Layout or post-import verification.',
  inputSchema: z.object({
    parentId: z.string().describe('Figma container that receives the text stack'),
    blocks: z
      .array(z.object({ characters: z.string(), bold: z.boolean().optional() }))
      .min(1)
      .describe('Source text blocks in their original order; bold is a simple whole-block marker'),
    name: z.string().optional().describe('Optional name for the resulting ordinary Figma group'),
    x: z.number().finite().optional().describe('Optional horizontal position inside the parent'),
    y: z.number().finite().optional().describe('Optional vertical position inside the parent'),
    width: z
      .number()
      .positive()
      .finite()
      .optional()
      .describe('Optional text-stack width; defaults to the parent width'),
  }),
  kind: 'write',
};
