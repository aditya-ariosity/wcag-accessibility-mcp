# Changelog

## Unreleased

- Added `audit_matrix` to audit one target across named viewports and group findings by deterministic fingerprints.
- Added `compare_audits` to compare baseline and candidate audit results without rerunning a browser.
- Added `browser_diagnostics` for browser setup inspection without launching Chromium.
- Added `inspect_screenshot` to capture screenshot evidence and optionally run local OCR.
- Added `inspect_design_snapshot` to inspect exported Figma, Claude Design, or generic design-node payloads before implementation.
- Centralized runtime server name and version on package metadata.
- Split tests into `test:unit`, `test:browser`, and `test:ci` so browser requirements are explicit.
- Updated README, Codex, Claude, and bundled skill documentation for the `wcag-accessibility-mcp` identity.

## 0.1.6 — 2026-08-30

- Updated MCP Registry metadata to the latest npm package version.
- Kept npm, GitHub, and registry package identity aligned.

## 0.1.5 — 2026-08-30

- Fixed the npm executable mapping for `npx -y wcag-accessibility-mcp`.
- Updated the stdio startup message to use the public package name.
- Rewrote public setup documentation for npm, Claude, Codex, and local development.

## 0.1.1 - 0.1.4 — 2026-08-30

- Renamed the public package and repository identity to `wcag-accessibility-mcp`.
- Added MCP Registry metadata for `io.github.aditya-ariosity/wcag-accessibility`.
- Updated package metadata, repository links, homepage, and npm publication details.

## 0.1.0 — 2026-08-17

- Added stdio and stateless Streamable HTTP MCP transports.
- Added rendered URL, raw HTML, and restricted local-file audits with axe-core.
- Added WCAG contrast calculation and passing color suggestions.
- Added element evidence, remediation guidance, incomplete-check reporting, and a reusable fix-loop prompt.
- Added private-network and local-file protections for HTTP deployments.
- Added Codex, Claude Code, and Claude Design bridge documentation.
- Added a validated companion accessibility-feedback agent skill.
- Added explicit WCAG 2.0/2.1/2.2 AAA profiles, enhanced contrast analysis, and a complete criterion checklist with partial-automation labels.
