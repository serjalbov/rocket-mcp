# Rocket-MCP — working guide

Rocket-MCP is a Rocketpix fork of [Figwright](https://github.com/awdr74100/figwright). It connects
an MCP server to a Figma plugin through a local relay, allowing an AI agent to read and edit the
open Figma file without the official Figma MCP.

This file is the working guide for people and AI agents changing this repository. For the exact
relationship with the upstream project and the maintained difference log, read [FORK.md](./FORK.md).

## Architecture

The project has three parts:

- `packages/mcp` — the local Node MCP server. An MCP client launches it; it exposes the tools and
  owns the relay connection.
- `packages/plugin` — the Figma development plugin. Its Vue panel and Figma sandbox execute the
  actual Figma API calls.
- `packages/shared` — the shared schemas and local wire protocol used by both halves.

The server and the plugin communicate locally through a WebSocket relay on `127.0.0.1:3055`. The
server runs the built `dist` files, not TypeScript source.

## Repository layout

```text
packages/
  mcp/      # MCP server and tool definitions
  plugin/   # Figma plugin UI and Figma API handlers
  shared/   # shared schemas and protocol
skills/     # upstream Figwright skills retained as reference
test/       # cross-package tests
FORK.md     # Rocket-MCP changes relative to Figwright
```

## Rocket-MCP behaviour that must be preserved

### Image fills

`set_image_fill` is the core Rocket-MCP addition. It fills an existing `RECTANGLE` rather than
creating a replacement rectangle.

- Keep the original node and its non-image properties intact.
- Remove all old IMAGE fills and leave solid and gradient fills untouched.
- Preserve the topmost old image fill's visual settings when replacing it.
- Accept only a local absolute PNG, JPG, or GIF path. Validate it before changing Figma.
- Keep image payloads binary; do not reintroduce large base64 text transport.

### Text import

`import_text_stack` is deliberately one operation, not a sequence planned by the model. It creates
separate 20 px text objects inside a selected frame or section, or at supplied coordinates in a text
object's parent. It wraps them to the supplied or container width, spaces them by 40 px, and groups
them without Auto Layout.

Do not turn this into a layout generator or add rereads, measurement passes, or decorative work. Its
job is fast, plain content transfer before a designer arranges the result.

## Commands

Run from the repository root:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test
```

For a source change in `packages/mcp` or `packages/shared`, run `pnpm build` and restart the MCP
connection before testing. For a plugin change, build the plugin and re-import or reload the Figma
development plugin so Figma receives the new bundle.

## Change workflow

1. Read the relevant tool definition, MCP handler, and Figma plugin handler before changing a
   behaviour.
2. Keep changes narrow. Prefer one deterministic plugin operation over many agent-driven steps.
3. Add or update focused tests for a changed behaviour.
4. Run the checks proportionate to the change; run `pnpm build` whenever shipped code changes.
5. Add a row to `FORK.md` only for a meaningful behavioural difference from Figwright. State what
   changed, why, and whether it could be offered upstream.

## Release status

Rocket-MCP is private and has no independent public release or npm package yet. Do not publish,
retag, or change the inherited Figwright changelog as part of ordinary work. A future public release
will receive its own release process and notes.
