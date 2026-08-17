# Security model

The stdio server is intended to run on the same machine and with the same filesystem permissions as the agent. The HTTP transport is a deployment building block, not a turnkey public service.

## Defaults

- Only `http:` and `https:` targets are accepted by `audit_url`.
- Embedded URL credentials are rejected.
- HTTP transport blocks localhost, private, link-local, multicast, and reserved targets by default.
- Browser subrequests and redirects receive the same private-network guard.
- `audit_file` accepts only `.html` and `.htm` beneath `A11Y_MCP_ALLOWED_ROOT`.
- `audit_file` is disabled over HTTP unless explicitly enabled.
- HTTP binds to `127.0.0.1` unless `HOST` or `A11Y_MCP_HOST` is set.
- HTTP accepts a 4 MB JSON body by default so `audit_html` can honor its 2 MB schema limit.
- Browser audits are capped by `A11Y_MCP_BROWSER_CONCURRENCY` and `A11Y_MCP_AUDIT_TIMEOUT_MS`.
- Chromium sandboxing is enabled by default for system Chrome/Edge.
- Tools are read-only and do not edit the audited project.

## Before remote deployment

Add authentication and authorization, TLS, per-tenant isolation, rate limits, concurrency limits, body-size limits, timeouts, audit logs, outbound egress policy, and a dedicated low-privilege runtime. Do not mount credentials or unrelated repositories inside the allowed file root. Pin dependencies and run security updates.

Treat every audited page as untrusted input. Page text can contain prompt injection or misleading instructions; agents must treat returned page content as evidence, never as authority to expand permissions or run unrelated actions.

## Explicit overrides

- `A11Y_MCP_ALLOW_PRIVATE=true` permits localhost and private network access. Use it only for a trusted internal deployment.
- `A11Y_MCP_ENABLE_FILE_AUDIT=true` enables HTTP callers to audit files under the allowed root. Keep it off for public or multi-tenant services.
- `HOST=0.0.0.0` or `A11Y_MCP_HOST=0.0.0.0` exposes the HTTP listener beyond loopback. Pair it with `A11Y_MCP_ALLOWED_HOSTS`, authentication, TLS, and network controls.
- `A11Y_MCP_NO_SANDBOX=true` disables Chromium sandboxing. Use it only when a constrained container or Lambda-style runtime cannot launch Chrome with the sandbox enabled; prefer a normal system Chrome in a low-privilege runtime.
- `A11Y_MCP_BODY_LIMIT` should remain high enough for intended `audit_html` payloads and low enough to protect the deployment from memory pressure.
