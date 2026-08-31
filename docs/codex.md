# Codex setup

## 1. Build the server

In PowerShell:

```powershell
cd "C:\full\path\to\wcag-accessibility-mcp"
npm install
npm run build
```

Confirm that `dist\index.js` exists.

## 2. Register it

```powershell
codex mcp add wcag-accessibility -- node "C:\full\path\to\wcag-accessibility-mcp\dist\index.js"
```

Use a normal Windows path for the command. If you edit TOML manually, escape backslashes as shown in the README.

For local projects, set the allowed root in `~/.codex/config.toml`:

```toml
[mcp_servers.wcag_accessibility.env]
A11Y_MCP_ALLOWED_ROOT = "C:\\Users\\YourName\\Projects"
```

## 3. Verify it

```powershell
codex mcp list
```

Restart Codex after changing MCP configuration. Ask Codex: “List the accessibility tools you can use.” You should see the tools documented in the README.

## 4. Use the feedback loop

```text
Run the local app, audit the main page at 1440×900 and 390×844, and group findings by root component or token. Fix critical and serious issues first. After every code change, rerun the same audits and existing tests. Do not call the result WCAG compliant; list the remaining keyboard, focus, zoom, screen-reader, motion, and content checks.
```

## Troubleshooting

- **Browser not found:** set `A11Y_MCP_BROWSER_PATH` to Chrome, for example `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- **File outside allowed root:** widen `A11Y_MCP_ALLOWED_ROOT` only to the project-parent folder you trust.
- **Local URL unavailable:** start the development server first. Stdio mode allows localhost by default.
- **Startup timeout:** increase `startup_timeout_sec` to 30 or 60.
- **No contrast finding:** gradients, images, transparency, pseudo-elements, and some states may require a targeted manual check.
