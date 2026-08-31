# Claude Code and Claude Design setup

## Claude Code

Build the project, then register its stdio command:

```powershell
cd "C:\full\path\to\wcag-accessibility-mcp"
npm install
npm run build
claude mcp add --scope user wcag-accessibility -- node "C:\full\path\to\wcag-accessibility-mcp\dist\index.js"
claude mcp list
```

`--scope user` makes the server available across your Claude Code projects. Use project scope instead when collaborators should receive repository-owned configuration.

## Claude Design bridge

Claude Design exposes its own MCP connection for Claude Code. Add it separately:

```powershell
claude mcp add --scope user --transport http claude-design https://api.anthropic.com/v1/design/mcp
```

Then run `/design-login` inside Claude Code.

With both servers connected, the workflow is:

1. Create or update the design through Claude Design.
2. Export or implement the design as HTML/CSS, or open its development preview URL.
3. Call `audit_html`, `audit_file`, or `audit_url` through this server.
4. Use selector, DOM, computed-style, and contrast evidence to correct the source or tokens.
5. Push the approved correction back through the Claude Design workflow.
6. Re-audit at desktop and mobile sizes.

This is the dependable integration point today. A raw design canvas is not the same as a rendered semantic interface: it does not expose final HTML roles, names, focus order, keyboard behavior, or browser-composited colors. The tool therefore does not pretend to certify canvas pixels. A future design adapter can add layer/token inspection while keeping browser verification as the final gate.

## Suggested Claude prompt

```text
Use Claude Design to create the interface, then use wcag-accessibility to audit the rendered implementation at 1440×900 and 390×844. Correct critical and serious failures first, prefer shared token or component fixes when evidence repeats, and rerun the audit after each batch. Keep incomplete automated checks in a manual accessibility checklist.
```
