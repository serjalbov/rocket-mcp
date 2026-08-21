import { z } from 'zod';

import { readLocalImage, SET_IMAGE_FILL_TOOL_NAME } from './set-image-fill.js';
import type { ToolSpec } from './spec.js';

export const BATCH_TOOL_NAME = 'batch';

const inputSchema = z.object({
  ops: z
    .array(
      z.object({
        tool: z.string().describe('An invertible write tool name'),
        // Free-form: each tool validates its own params (and, post-McpServer, the inner tool's spec).
        params: z.record(z.string(), z.unknown()).optional().describe("The tool's parameters"),
      }),
    )
    .min(1)
    .describe('Ordered write ops applied atomically'),
});

/**
 * Apply several invertible write ops atomically. The plugin validates every op's target first, then
 * applies them in order; if any op fails it rolls the already-applied ops back and the call
 * rejects. Only invertible writes are accepted (property mutations + create/clone/import_image) —
 * destructive ops (delete_*, ungroup, …) can't be restored and are rejected, so the all-or-nothing
 * guarantee holds.
 */
export const batchTool: ToolSpec = {
  name: BATCH_TOOL_NAME,
  description:
    'Apply multiple invertible write ops atomically (all-or-nothing with rollback). ops is an ordered ' +
    'list of { tool, params } where tool is an invertible write (e.g. set_fills, rename_node, ' +
    'move_nodes, create_frame). A nested set_image_fill takes a server-local filePath; the server ' +
    'loads it as native binary bytes before dispatch. Destructive ops (delete_*, ungroup_nodes, …) are rejected. ' +
    'Returns { ok, results } with one result per op in order.',
  inputSchema,
  kind: 'write',
};

export type BatchDispatcher = (toolName: string, args: unknown) => Promise<unknown>;

/**
 * Resolve every nested set_image_fill filePath on the MCP server. Neither raw bytes nor legacy
 * base64 are accepted from the agent; only the resulting Uint8Array crosses to the plugin as a
 * MessagePack `bin` value.
 */
export const handleBatch = async (
  dispatch: BatchDispatcher,
  rawArgs: unknown,
  requestId: string,
): Promise<unknown> => {
  const args = inputSchema.parse(rawArgs);
  const ops = await Promise.all(
    args.ops.map(async op => {
      if (op.tool !== SET_IMAGE_FILL_TOOL_NAME) return op;
      const params = op.params ?? {};
      if ('data' in params || 'bytes' in params) {
        throw new TypeError(
          'batch/set_image_fill: provide filePath; base64 data and agent-supplied bytes are not allowed',
        );
      }
      if (typeof params.filePath !== 'string') {
        throw new TypeError('batch/set_image_fill: filePath must be an absolute path');
      }
      const image = await readLocalImage(params.filePath);
      const pluginParams = { ...params };
      delete pluginParams.filePath;
      return { tool: op.tool, params: { ...pluginParams, bytes: image.bytes } };
    }),
  );
  return dispatch(BATCH_TOOL_NAME, { ops, requestId });
};
