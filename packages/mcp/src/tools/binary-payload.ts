/**
 * Reading native export bytes off a plugin reply. MessagePack carries Uint8Array as `bin`, so the
 * payload remains binary from the Figma sandbox to the MCP server.
 */

/** A reply carrying export bytes one way or the other. */
export interface BinaryCarrier {
  bytes: Uint8Array | null;
}

/** The payload as a Node Buffer, or null when nothing was exported. */
export const binaryPayload = (carrier: BinaryCarrier): Buffer | null => {
  return carrier.bytes === null ? null : Buffer.from(carrier.bytes);
};
