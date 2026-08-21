import { z } from 'zod';

import { IMPORT_IMAGE_TOOL_NAME } from './import-image.js';
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
 * Resolve local image paths on the MCP server. Neither encoded data nor agent-supplied bytes are
 * accepted; only the resulting Uint8Array crosses to the plugin as a MessagePack `bin` value.
 */
export const handleBatch = async (
  dispatch: BatchDispatcher,
  rawArgs: unknown,
  requestId: string,
): Promise<unknown> => {
  const args = inputSchema.parse(rawArgs);
  const ops = await Promise.all(
    args.ops.map(async op => {
      if (op.tool !== SET_IMAGE_FILL_TOOL_NAME && op.tool !== IMPORT_IMAGE_TOOL_NAME) return op;
      const params = op.params ?? {};
      if ('data' in params || 'bytes' in params) {
        const source = op.tool === IMPORT_IMAGE_TOOL_NAME ? 'filePath or url' : 'filePath';
        throw new TypeError(
          `batch/${op.tool}: provide ${source}; encoded data and agent-supplied bytes are not allowed`,
        );
      }
      if (op.tool === IMPORT_IMAGE_TOOL_NAME && typeof params.url === 'string') {
        if ('filePath' in params) {
          throw new TypeError('batch/import_image: provide exactly one of filePath or url');
        }
        return op;
      }
      if (typeof params.filePath !== 'string') {
        throw new TypeError(`batch/${op.tool}: filePath must be an absolute path`);
      }
      const image = await readLocalImage(params.filePath, `batch/${op.tool}`);
      const pluginParams = { ...params };
      delete pluginParams.filePath;
      return { tool: op.tool, params: { ...pluginParams, bytes: image.bytes } };
    }),
  );
  return dispatch(BATCH_TOOL_NAME, { ops, requestId });
};
