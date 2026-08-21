import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoots = [
  join(repoRoot, 'packages/shared/src'),
  join(repoRoot, 'packages/mcp/src'),
  join(repoRoot, 'packages/plugin/src'),
  join(repoRoot, 'packages/plugin/ui'),
];

const sourceFiles = (): string[] =>
  sourceRoots.flatMap(root =>
    readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter(entry => entry.endsWith('.ts'))
      .map(entry => join(root, entry)),
  );

describe('binary image transport architecture', () => {
  it('forbids base64 codecs inside Rocket-MCP except the MCP image-content boundary', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      const codecCalls =
        source.match(/base64Encode|base64Decode|toString\(['"]base64['"]\)/g) ?? [];
      for (const call of codecCalls) offenders.push(`${relative(repoRoot, file)}: ${call}`);
    }
    expect(offenders).toEqual(["packages/mcp/src/tools/get-screenshot.ts: toString('base64')"]);
  });

  it('documents the sole remaining conversion as the MCP visual-content boundary', () => {
    const source = readFileSync(join(repoRoot, 'packages/mcp/src/tools/get-screenshot.ts'), 'utf8');
    expect(source).toContain('MCP image content requires a base64 data string');
    expect(source.match(/toString\(['"]base64['"]\)/g)).toHaveLength(1);
  });
});
