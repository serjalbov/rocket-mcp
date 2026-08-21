import { describe, expect, it } from 'vitest';

import { binaryPayload } from '../../src/tools/binary-payload.js';

describe('binaryPayload', () => {
  it('returns the plugin bytes as a Buffer', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(binaryPayload({ bytes })).toEqual(Buffer.from(bytes));
  });

  it('reports nothing exported for null bytes', () => {
    expect(binaryPayload({ bytes: null })).toBeNull();
  });

  it('keeps zero-length bytes distinct from nothing exported', () => {
    // A blank-but-real export (an empty frame) must still land a file rather than a null path.
    const empty = binaryPayload({ bytes: new Uint8Array(0) });
    expect(empty).not.toBeNull();
    expect(empty?.byteLength).toBe(0);
  });
});
