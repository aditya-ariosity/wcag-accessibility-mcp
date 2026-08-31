# WCAG Accessibility MCP

## Tagline
WCAG accessibility audits for AI agents and generated UIs.

## Description
WCAG Accessibility MCP is an accessibility testing server for AI coding and design agents. It helps tools like Codex, Claude Code, and other MCP-compatible clients audit generated web interfaces before they are treated as complete.

It runs rendered HTML, URLs, or local HTML files through axe-core, maps findings to WCAG-focused guidance, checks color contrast, suggests passing color fixes, and exposes a complete WCAG A/AA/AAA checklist with automated-vs-manual coverage.

It is built for designers, developers, design engineers, AI product teams, and anyone using AI agents to create web UI.

## Setup Requirements
- Node.js 20 or newer (required): Needed to run the npm package.
- Chrome or Edge (recommended): Used for rendered page audits.
- `A11Y_MCP_BROWSER_PATH` (optional): Absolute path to Chrome/Chromium/Edge if auto-detection fails.
- `A11Y_MCP_ALLOWED_ROOT` (optional): Restricts local file audits to a specific project folder.
- `A11Y_MCP_ALLOW_PRIVATE` (optional): Allows localhost/private-network URL targets in trusted environments.
- `A11Y_MCP_ENABLE_FILE_AUDIT` (optional): Enables local file audits over HTTP only for trusted deployments.

## Category
Developer Tools

## Use Cases
Accessibility Testing, WCAG Audits, AI UI Review, Design QA, Contrast Checking, Generated UI Validation, Agentic Coding, Web Accessibility, Developer Handoff, CI/CD

## Features
- Audit live URLs, raw HTML, and local HTML files.
- Run axe-core accessibility checks inside Chromium.
- Support WCAG 2.0, 2.1, and 2.2 A/AA/AAA profiles.
- Check WCAG contrast ratios for foreground/background color pairs.
- Suggest mathematically passing contrast fixes.
- Return DOM evidence, selectors, computed styles, issue impact, and remediation guidance.
- Separate automated findings from manual WCAG checks.
- Provide a complete WCAG checklist for A, AA, and AAA standards.
- Work with Codex, Claude Code, and other MCP-compatible clients.
- Keep tools read-only so the MCP audits but does not silently edit projects.

## Getting Started
- "Audit this page at desktop and mobile sizes. Fix critical and serious accessibility issues, then rerun the audit."
- "Check whether this generated HTML passes WCAG 2.2 AA contrast and semantic accessibility checks."
- "Use the WCAG checklist to tell me which accessibility checks still require manual review."
- Tool: audit_url — Audits a rendered web page URL.
- Tool: audit_html — Audits supplied HTML before it is hosted.
- Tool: audit_file — Audits a local .html or .htm file inside an allowed project root.
- Tool: check_contrast — Calculates WCAG contrast for a color pair.
- Tool: suggest_contrast_fix — Suggests a passing foreground or background color.
- Tool: explain_issue — Explains an accessibility rule and how to fix it.
- Tool: get_wcag_checklist — Returns the complete WCAG requirement checklist with automated/manual coverage.

## Tags
mcp, model-context-protocol, accessibility, wcag, a11y, axe-core, ai-agents, codex, claude-code, web-accessibility, ui-audit, design-qa, contrast-checker, typescript, developer-tools

## Documentation URL
https://github.com/aditya-ariosity/wcag-accessibility-mcp#readme

## Health Check URL