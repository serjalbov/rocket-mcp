# Rocket-MCP fork notes

## Origin

Rocket-MCP is a private Rocketpix fork of [Figwright](https://github.com/awdr74100/figwright), a
bidirectional Figma MCP agent by Roya.

- Upstream repository: `https://github.com/awdr74100/figwright`
- Upstream base: `ac5aa40` (`fix(election): recover from a leader that holds the port but stops answering`)
- License: MIT. The original `LICENSE` and attribution are preserved.

Rocket-MCP is not presented as a replacement for Figwright. It is a production extension for the
Rocketpix AI-Station workflow.

## Intentional differences

| Area                                 | Rocket-MCP change                                                                                                                                                                           | Why it exists                                                                                                                                                  | Upstream candidate                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Existing image fills                 | `set_image_fill` updates an existing Figma rectangle instead of creating a new rectangle. It removes every prior IMAGE fill, adds one new IMAGE fill, and leaves non-image fills untouched. | Lets an agent populate designer-prepared placeholders without changing their node identity, layout, or colour/gradient layers.                                 | Yes                                 |
| Image replacement details            | A replacement carries over the topmost previous image fill's crop, filters, opacity, visibility, blend mode, scale mode, and stack position unless a new display mode is requested.         | The visual behaviour of a prepared placeholder survives an image swap.                                                                                         | Yes                                 |
| Local image validation and transport | The MCP server accepts a local PNG, JPG, or GIF path, validates the file and dimensions, then streams image bytes directly; the legacy base64 transport was removed.                        | Keeps image-fill operations lighter, avoids oversized text payloads, and fails before the Figma document is changed.                                           | Yes                                 |
| Runtime identity                     | Development runtime and user-facing name are Rocket-MCP.                                                                                                                                    | Distinguishes the Rocketpix extension from the upstream tool in local production.                                                                              | No                                  |
| Text import                          | `import_text_stack` creates a plain text stack in one operation within a selected frame or section, or at supplied geometry in a text object's parent.                                      | Makes webpage-to-Figma import and pasted-text splitting deterministic: controlled width, wrapping, 20 px text, 40 px gaps, one ordinary group, no Auto Layout. | Not in its current opinionated form |
| Text markers                         | Text creation supports wrapping width and a simple whole-block Bold marker.                                                                                                                 | Allows unstyled imported content to remain readable before manual design work.                                                                                 | Possibly, if generalised            |

## Current upstream relationship

The local Git repository keeps `upstream` pointing to the original Figwright repository. It does not
yet have a Rocketpix GitHub remote or public release.

Before publishing Rocket-MCP:

1. Create and connect a Rocketpix-owned GitHub repository.
2. Make the first clean Rocket-MCP release without rewriting Figwright's prior changelog history.
3. Tell the upstream author about the fork with a concise summary and a link to the repository.
4. Consider separate upstream contributions only for the general-purpose image-fill improvements;
   keep Rocketpix workflow-specific tooling in this fork.

## Maintenance rule

When Rocket-MCP gains a meaningful behavioural difference from Figwright, add one row to the table
above. A row must state what changed, why it exists, and whether it belongs upstream. Do not list
routine refactors, generated files, test-only changes, or version bumps here.
