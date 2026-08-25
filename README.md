<div align="center">
  <img src="./.github/assets/rocket-mcp-logo-dark.svg#gh-dark-mode-only" alt="Rocket-MCP" width="620">
</div>

# Rocket-MCP

Rocket-MCP is a Rocketpix fork of [Figwright](https://github.com/awdr74100/figwright), built for
AI-Station: a practical Figma production workflow where an AI agent can read a design file and make
precise changes to it.

It keeps the broad read/write Figma foundation of Figwright, then adds a small set of production
operations that our workflow needs to be reliable, lightweight, and predictable.

## What Rocket-MCP adds

### 1. Replace image fills without replacing the design object

Figwright can import an image as a new rectangle. Rocket-MCP adds `set_image_fill`, which puts a
local PNG, JPG, or GIF into an **existing Figma rectangle**.

- The rectangle keeps its identity, position, dimensions, effects, constraints, and prototype links.
- Every previous IMAGE fill is removed, so old image data never accumulates in the file.
- Solid-colour and gradient fills remain untouched.
- When replacing an image, its crop, blend mode, opacity, visibility, filters, and stack position are
  preserved unless a new display mode is explicitly requested.

This is the key operation behind designer-prepared image placeholders. For example, a designer can
lay out product cards before the product images exist, then ask an agent to generate or select the
right images and fill every prepared card in one workflow. There is no separate manual cycle of
generating assets, downloading them, and placing them into Figma one by one.

### 2. A lighter image pipeline

Rocket-MCP reads an image from a local file path, validates it before Figma is changed, and passes the
image as native binary data instead of a large base64 text payload.

- Only regular local PNG, JPG, and GIF files are accepted.
- The file size is limited to 2 MiB and image dimensions to 4096 × 4096 px.
- Binary transfer keeps image operations smaller and avoids flooding an agent's context with encoded
  image data.

### 3. Deterministic webpage-to-Figma text import

`import_text_stack` places a list of source text blocks into a selected Figma frame or section in one
operation.

- Each source block becomes its own text object.
- Text wraps to the width of the selected container.
- The stack uses 20 px text, 40 px vertical gaps, and one ordinary Figma group.
- It does not create Auto Layout, repeatedly inspect the canvas, or run hundreds of separate editing
  actions.
- A whole source block that is visually emphasised can be marked Bold as a simple editorial marker.

Use it when a client has supplied content in a browser prototype, a webpage, or another rough source
document and that content needs to reach Figma before design work begins. Instead of copying and
pasting every block by hand, the agent transfers the source structure as a simple editable stack.
This is intentionally a content-transfer tool, not a layout generator: the designer decides the final
composition afterwards.

### 4. A dedicated Rocket-MCP runtime identity

The local development runtime and visible plugin identity are named Rocket-MCP, so the production
extension is clearly distinct from the original Figwright installation.

## What remains Figwright

Rocket-MCP inherits Figwright's Figma MCP architecture: a local MCP server, a Figma plugin, and a
local relay that let AI agents read and edit a canvas. Its wider Figma read/write toolset remains the
work of the upstream project.

Rocket-MCP is not presented as a replacement for Figwright. It is a focused production extension for
Rocketpix. The complete, maintained record of differences—including which changes may be useful
upstream—is in [FORK.md](./FORK.md).

## Status

Rocket-MCP is currently a private working repository. It is used and developed inside Rocketpix
AI-Station. Before a public release, the project will receive its own installation guide, examples,
and release notes.

## License and attribution

Rocket-MCP is based on Figwright by Roya and preserves the original [MIT License](./LICENSE).
Figwright remains available at [github.com/awdr74100/figwright](https://github.com/awdr74100/figwright).
