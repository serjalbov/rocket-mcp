# Security Policy

Rocket-MCP is currently a private working repository and has no public release channel.

## Reporting a vulnerability

Please do not describe a security issue in a public GitHub issue. If you have access to this
repository, use GitHub's private security advisory flow when it is available, or contact the
repository owner privately through GitHub.

Please include:

- a clear description of the issue;
- steps to reproduce it;
- the affected MCP server or Figma plugin behaviour;
- the Rocket-MCP commit or version you tested.

## Current support status

Only the current `main` branch is maintained. There are no published Rocket-MCP releases yet.

## Local security model

Rocket-MCP runs locally. The MCP server is launched by an MCP client and communicates with the Figma
development plugin through a relay bound to `127.0.0.1`. It does not operate a Rocket-MCP cloud
service or send telemetry.

The Figma plugin can act only on the Figma file open in the active Figma application, subject to the
permissions of Figma's Plugin API. Export and image operations write only to paths supplied to them
by the agent.

## Scope

Report issues that could let untrusted input, a web page, a Figma file, or an agent instruction cross
the local boundaries described above. Vulnerabilities in Figma, an MCP client, or third-party
dependencies should also be reported to their respective maintainers.

Rocket-MCP is based on Figwright; upstream issues that also affect the original project may be
reported to [Figwright](https://github.com/awdr74100/figwright) as well.
