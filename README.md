# WCAG Accessibility MCP

A WCAG accessibility testing MCP for AI agents, Codex, Claude Code, and automated UI audits.

WCAG Accessibility MCP gives AI coding and design agents a real accessibility feedback loop. It renders web interfaces in Chromium, runs axe-core, checks color contrast, maps findings to WCAG guidance, and returns structured evidence that an agent can use to fix accessibility issues before a UI is treated as complete.

It is designed for people building with AI: product designers, design engineers, frontend developers, AI product teams, and anyone using agents to generate or review web interfaces.

> This is an automated testing aid, not a WCAG certification service. It catches many common failures, but full accessibility review still requires human testing for keyboard behavior, focus order, screen readers, zoom, motion, content quality, and assistive-technology behavior.

## Why This Exists

AI-generated interfaces often look polished but fail basic accessibility checks: weak contrast, missing labels, broken semantic structure, poor ARIA usage, inaccessible forms, and hidden keyboard issues.

This MCP helps agents stop guessing. Instead of saying “follow WCAG,” it gives them testable feedback:

- what failed
- where it failed
- which element was affected
- which WCAG-related rule applies
- what needs to be fixed
- which checks still require manual review

## What It Can Do

| Tool | What it does |
|---|---|
| `audit_url` | Audits a rendered web page URL |
| `audit_html` | Audits supplied HTML before it is hosted |
| `audit_file` | Audits a local `.html` or `.htm` file inside an allowed project root |
| `check_contrast` | Calculates WCAG contrast for a foreground/background color pair |
| `suggest_contrast_fix` | Suggests a passing color adjustment |
| `explain_issue` | Explains an accessibility rule and how to fix it |
| `get_wcag_checklist` | Returns the complete WCAG checklist with automated/manual coverage |

## Standards Coverage

The server supports these profiles:

- `wcag2a`
- `wcag2aa`
- `wcag2aaa`
- `wcag21aa`
- `wcag21aaa`
- `wcag22aa`
- `wcag22aaa`
- `best-practice`

AA profiles include Level A and AA criteria. AAA profiles include Level A, AA, and AAA criteria.

The default profile is `wcag22aa`.

For WCAG 2.2:

- AA includes 55 required success criteria.
- AAA includes 86 required success criteria.

An automated axe mapping means partial automated coverage. It does not mean the whole WCAG success criterion has been fully tested.

## Install

Requirements:

- Node.js 20 or newer
- Chrome or Edge recommended
- Windows, macOS, or Linux

Install from npm:

```bash
npm install -g wcag-accessibility-mcp
```

Or run directly:

```bash
npx -y wcag-accessibility-mcp
```

If the server starts correctly, you should see:

```text
a11y-feedback-mcp is running over stdio
```

The startup message may still use the internal legacy name, but the published package and registry name are `wcag-accessibility-mcp`.

## Use With Claude Code

Add the MCP server:

```bash
claude mcp add --scope user wcag-accessibility -- npx -y wcag-accessibility-mcp
```

Check that it is connected:

```bash
claude mcp list
```

Test prompt:

```text
Use the wcag-accessibility MCP tool check_contrast. Check #999999 on #ffffff for WCAG AA normal text. Do not calculate manually.
```

Expected result:

```text
The contrast ratio is about 2.85:1, which fails WCAG AA for normal text.
```

## Use With Claude Desktop

Open the Claude desktop config file on Windows:

```powershell
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

Add this inside `mcpServers`:

```json
{
  "mcpServers": {
    "wcag-accessibility": {
      "command": "C:\\Program Files\\nodejs\\npx.cmd",
      "args": [
        "-y",
        "wcag-accessibility-mcp"
      ]
    }
  }
}
```

If you already have another MCP server, keep it and add `wcag-accessibility` as a second entry.

Then fully quit Claude Desktop and reopen it.

## Use With Codex

Add the MCP server:

```bash
codex mcp add wcag-accessibility -- npx -y wcag-accessibility-mcp
```

Test prompt:

```text
Use the wcag-accessibility MCP to check the contrast of #999999 on #ffffff at WCAG AA.
```

## Example Agent Prompts

```text
Audit this HTML for WCAG 2.2 AA issues. Prioritize critical and serious issues, explain each fix, then list what still needs manual review.
```

```text
Use wcag-accessibility to audit this local HTML file at desktop and mobile widths. Fix the accessibility issues in the code and rerun the audit.
```

```text
Check whether #FF3B12 on #F5F2EC passes WCAG AA for normal text. If it fails, suggest the nearest passing foreground color.
```

```text
Give me the WCAG 2.2 AAA checklist and separate automated checks from manual checks.
```

## Local Development

Clone the repository:

```bash
git clone https://github.com/aditya-ariosity/wcag-accessibility-mcp.git
cd wcag-accessibility-mcp
```

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run browser end-to-end tests:

```bash
npm run test:e2e
```

Start the stdio MCP server:

```bash
npm start
```

Start the optional HTTP transport:

```bash
npm run start:http
```

The local HTTP endpoint is:

```text
http://127.0.0.1:3000/mcp
```

Health check:

```text
http://127.0.0.1:3000/health
```

## Environment Variables

All environment variables are optional for normal local use.

| Variable | Default | Purpose |
|---|---|---|
| `A11Y_MCP_BROWSER_PATH` | Auto-detected | Absolute path to Chrome, Chromium, or Edge |
| `A11Y_MCP_ALLOWED_ROOT` | Current working directory | Restricts local file audits to a specific folder |
| `A11Y_MCP_ALLOW_PRIVATE` | `true` on stdio, `false` on HTTP | Allows localhost/private-network URL audits in trusted environments |
| `A11Y_MCP_ENABLE_FILE_AUDIT` | `false` on HTTP | Enables local file audits over HTTP in trusted deployments |
| `A11Y_MCP_BROWSER_CONCURRENCY` | `2` | Maximum concurrent Chromium audits |
| `A11Y_MCP_AUDIT_TIMEOUT_MS` | `25000` | Timeout for the audit phase |
| `A11Y_MCP_NO_SANDBOX` | `false` | Disables Chromium sandboxing only when the runtime requires it |
| `HOST` / `A11Y_MCP_HOST` | `127.0.0.1` | HTTP bind address |
| `A11Y_MCP_ALLOWED_HOSTS` | Localhost names | Allowed Host headers for HTTP mode |
| `A11Y_MCP_BODY_LIMIT` | `4mb` | HTTP JSON body limit |
| `PORT` | `3000` | HTTP transport port |

## Security Notes

The stdio server is meant to run locally with the same permissions as the agent using it.

The HTTP transport is a deployment building block, not a public hosted service by itself. Do not expose it directly to the public internet without authentication, TLS, rate limits, request-size limits, outbound network controls, and a low-privilege runtime.

By default:

- tools are read-only
- HTTP mode blocks private network URL targets
- local file audit over HTTP is disabled
- local file audit is restricted to the allowed root
- Chromium sandboxing remains enabled unless explicitly disabled

## Published Links

- GitHub: https://github.com/aditya-ariosity/wcag-accessibility-mcp
- npm: https://www.npmjs.com/package/wcag-accessibility-mcp
- MCP Registry name: `io.github.aditya-ariosity/wcag-accessibility`

## Current Scope

This project currently audits rendered web interfaces and HTML.

It does not yet inspect:

- native mobile apps
- PDFs
- canvas-only interfaces
- video captions
- raw screenshots without HTML
- raw Claude Design pixels

Future versions can add screenshot/OCR support, CI annotations, design-token integration, remote hosted transport, and deeper design-tool adapters.

## License

MIT
