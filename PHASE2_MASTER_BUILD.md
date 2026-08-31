# WCAG Accessibility MCP — Phase 2 master build (historical surface plan)

> **Superseded for the current build.** This document describes the later matrix, screenshot, and design-surface work. The active implementation contract is `PHASE2_CORE_BUILD.md`, which must be completed before enabling those tools by default.

Repository source of truth: `https://github.com/aditya-ariosity/wcag-accessibility-mcp`

Baseline inspected: `main` at `e237179`, package and registry version `0.1.6`.

## Phase 2 outcome

Turn the current single-target audit server into a trustworthy accessibility regression system for Codex, Claude Code, Claude Design implementation workflows, and CI.

Phase 2 must preserve the project's existing boundary:

- audits are read-only;
- agents may apply fixes, but the MCP never edits audited projects;
- automated results never claim WCAG conformance;
- browser evidence and manual-test requirements remain distinct;
- public HTTP use is not implied by the existence of the HTTP transport.

## What Phase 1 already provides

- Seven read-only MCP tools: `audit_url`, `audit_html`, `audit_file`, `check_contrast`, `suggest_contrast_fix`, `explain_issue`, and `get_wcag_checklist`.
- Chromium rendering through `puppeteer-core` and `@sparticuz/chromium`.
- axe-core rule execution for WCAG 2.0, 2.1, and 2.2 profiles.
- Complete A/AA/AAA criterion catalogs with automated-partial versus manual labels.
- Structured element evidence: selector, HTML snippet, text, computed foreground/background, font data, and bounds.
- Simple contrast correction candidates.
- stdio and stateless Streamable HTTP transports.
- URL, file-containment, request-size, host-header, timeout, and concurrency controls.

## Mandatory stabilization gate

Complete this before adding new Phase 2 tools.

### 1. Remove identity and version drift

Use one source of truth for package/server identity and version. The inspected repository currently publishes `0.1.6`, while runtime metadata still contains `0.1.0` and the legacy name `a11y-feedback-mcp`.

Fix all of the following:

- `src/server.ts`: MCP server name and version.
- `src/http.ts`: health response, startup log, and service name.
- `src/index.ts`: failure log prefix.
- `README.md`: expected startup output and legacy-name explanation.
- `docs/codex.md`, `docs/claude-code-and-design.md`, and the bundled skill.
- `CHANGELOG.md`: document every published release or consolidate the maintenance releases accurately.

Do not hardcode the package version independently in multiple runtime files. Add a small internal metadata module or a build-safe package-metadata import and test it.

### 2. Make test categories truthful

The default `npm test` command excludes `tests/audit.e2e.ts`, but `tests/deployment-regression.test.ts` still launches Chromium in five tests. Therefore the default suite is not actually browser-free.

Split the suite explicitly:

- `test:unit`: no browser required.
- `test:browser`: all Chromium-dependent integration and E2E tests.
- `test`: runs unit tests and browser tests when a browser is available, with a clear documented policy.
- `test:ci`: deterministic command used by GitHub Actions.

Do not silently mark missing-browser failures as passes. If a job intentionally skips browser tests, state that in the job name and output.

Add coverage for:

- server name/version in MCP initialization;
- `/health` name/version;
- npm executable startup identity;
- every advertised tool's input validation and read-only annotations;
- packaged tarball smoke start.

### 3. Make browser provisioning deterministic

Preserve installed Chrome/Edge auto-detection and `A11Y_MCP_BROWSER_PATH`.

Add a diagnostic function that returns:

- selected browser source: configured, system, or bundled;
- resolved executable path without exposing unrelated environment data;
- actionable failure guidance;
- whether sandbox disabling was explicitly requested.

Test the selection logic without launching a browser. Keep real launch tests in the browser suite.

## Phase 2.1 — Audit matrix and regression engine

This is the first new capability milestone.

### New tool: `audit_matrix`

Audit one target across multiple named viewports in one call.

Supported targets:

- exactly one of `url`, `html`, or `filePath`;
- optional `baseUrl` only for HTML;
- two to eight named viewports;
- existing WCAG profile, issue limit, and node limit options.

Default viewports when none are supplied:

- `desktop`: 1440 x 900;
- `mobile`: 390 x 844.

Return:

- individual `AuditResult` objects for every viewport;
- aggregate totals;
- findings grouped by a deterministic fingerprint;
- viewports affected by each fingerprint;
- findings unique to one viewport;
- criteria and manual checks that apply to the selected profile;
- explicit truncation metadata when issue or node limits affect returned evidence.

Do not add violation counts from multiple viewports and present the sum as unique issues. Report both occurrence count and unique fingerprint count.

### Finding fingerprint

Create a versioned, deterministic fingerprint from stable evidence:

- axe rule ID;
- normalized target path;
- normalized relevant HTML signature;
- optional page/target identity.

Do not include volatile values such as timestamps, absolute temporary paths, viewport dimensions, random IDs, text counters, or bounding-box coordinates.

Return `fingerprintVersion` so the strategy can evolve without corrupting stored baselines.

### New tool: `compare_audits`

Compare a baseline result or matrix with a candidate result or matrix without rerunning a browser.

Return:

- `new` findings;
- `resolved` findings;
- `persisting` findings;
- impact changes;
- affected-viewport changes;
- baseline and candidate summary deltas;
- regression-gate result.

The gate must be configurable, with safe defaults:

- fail on new `critical` or `serious` findings;
- do not fail merely because an existing finding persists;
- never translate the gate into a WCAG compliance claim.

Reject incompatible or malformed baseline schemas with a useful error. Include `schemaVersion` in every Phase 2 report.

## Phase 2.2 — CI and report interoperability

After Phase 2.1 is stable:

- add a CLI entry point that audits a URL or file and writes JSON;
- add baseline comparison and process exit codes;
- add SARIF 2.1.0 export suitable for GitHub code scanning where a source location can be supported honestly;
- add Markdown summary export for pull-request comments;
- add an EARL-aligned export only after mapping semantics are verified; do not label ordinary structured JSON as EARL;
- provide a minimal GitHub Actions example with a locally started preview server.

The MCP remains read-only. CLI report files are explicit user-requested outputs and must never be written during normal MCP audit calls.

## Phase 2.3 — Root-cause and design-token evidence

Add evidence that helps an agent decide whether a defect is a token, shared component, template, or isolated instance.

Start with observations, not guesses:

- repeated computed foreground/background pairs;
- repeated selectors and DOM signatures;
- CSS custom-property names visible in matched rules;
- matched stylesheet URL and rule location when the browser exposes it safely;
- occurrence and viewport reach.

Return `rootCauseCandidates` with confidence and evidence. Never claim that a token or component is the cause without traceable evidence.

Do not auto-edit tokens. A passing color suggestion remains a proposal and must be checked across states and themes.

## Deferred until the regression core is proven

- raw screenshot OCR;
- direct Figma or Claude Design canvas inspection;
- native mobile auditing;
- PDF auditing;
- public hosted multi-tenant service;
- visual accessibility scoring;
- automatic source edits.

Screenshot capture may later be added as evidence attached to a known DOM finding. OCR should not be used to replace semantic browser inspection.

## Architecture requirements

- Keep browser execution separate from MCP registration.
- Extract pure fingerprint, aggregation, comparison, and report-format functions into testable modules.
- Do not make a tool handler depend directly on another tool handler.
- Reuse the existing `AuditResult`; introduce versioned Phase 2 report types without breaking the seven Phase 1 tools.
- Add MCP `outputSchema` for new tools and, where practical, backfill it for existing structured outputs.
- Bound matrix size, input size, concurrency, evidence volume, and total duration.
- Propagate abort signals through queued and active matrix audits.
- Close every page/browser on success, failure, timeout, and cancellation.
- Preserve private-network and local-file boundaries for every target variant.

## Tests and fixtures

Add deterministic fixtures for:

- a defect present at all viewports;
- a mobile-only defect;
- a desktop-only defect;
- the same rule on two distinct components;
- a resolved finding;
- a new serious finding;
- impact and viewport changes;
- truncated evidence;
- malformed and incompatible baselines;
- cancellation while queued and while active;
- URL, HTML, and file matrix targets;
- an attempted file-root escape;
- private-network redirects in HTTP mode.

Minimum acceptance:

- TypeScript check and build pass.
- Unit suite is browser-independent and passes.
- Browser suite passes on Windows, macOS, and Linux CI with an explicitly provisioned browser.
- All existing Phase 1 contract tests remain green.
- Matrix fingerprints are stable across two identical runs.
- Comparison results are order-independent.
- A new serious finding fails the default gate; a resolved finding does not.
- No test or implementation claims automated conformance.

## Phase 2.1 deliverables

1. Stabilization fixes and migration notes.
2. Versioned Phase 2 schemas and types.
3. Pure fingerprint, aggregate, and comparison modules.
4. `audit_matrix` and `compare_audits` MCP tools.
5. Browser-independent unit tests plus browser integration tests.
6. Updated architecture, README, client examples, bundled skill, and changelog.
7. `PHASE2_VERIFICATION.md` containing exact commands, environments tested, results, limitations, and deferred items.

## Definition of done

Phase 2.1 is complete only when an agent can audit the same interface at desktop and mobile, preserve a baseline, compare a later result, identify new versus resolved barriers with stable evidence, and enforce a serious-regression gate—without the MCP modifying project files or overstating WCAG coverage.
