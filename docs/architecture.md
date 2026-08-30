# Architecture and product specification

## Product hypothesis

For people using coding or design agents to create web interfaces, deterministic runtime accessibility checks will reduce preventable violations by inserting evidence and verification into the generation loop. We should continue if teams fix more critical and serious issues before review without increasing false confidence; we should change course if automated “passes” replace manual accessibility work or correction suggestions repeatedly damage brand and state consistency.

## Why an MCP server

A skill can tell an agent to check contrast. It cannot inspect the currently rendered DOM, execute a standards engine, or calculate a verified correction. MCP supplies those live tools. The companion skill supplies the workflow: when to call them, how to prioritize, and when a human must take over.

## Components

| Component | Responsibility |
|---|---|
| MCP server | Validated tool contracts, read-only annotations, stdio/HTTP transport |
| Browser runner | Render URL, HTML, or allowed local file at a specified viewport |
| axe-core | Deterministic automated rule evaluation and rule metadata |
| Evidence mapper | Selectors, DOM snippets, styles, text, bounds, impact, WCAG tags |
| Contrast engine | WCAG luminance/ratio math and passing color candidates |
| WCAG catalog | Complete 2.0/2.1/2.2 A/AA/AAA criterion sets, W3C references, and partial-automation labels |
| Agent skill | Audit → prioritize → fix → re-audit → manual-check workflow |

## Capability and risk model

| Task | System role | Failure mode | Consequence | Control |
|---|---|---|---|---|
| Detect rule failures | Deterministic evaluator | False negative or incomplete rule | Barrier survives | Explicit incomplete list and manual checklist |
| Prioritize findings | Evidence provider | Impact is treated as business priority | Wrong work order | Agent considers reach, task criticality, and frequency |
| Suggest a color | Calculation | Passing color harms brand or another state | Design regression | Proposal only; prefer token-level edit; test all states |
| Apply a correction | Connected agent, not this server | Agent edits too broadly | Product regression | Smallest scoped change, diff review, rerun tests |
| Audit a URL | Browser tool | SSRF or hostile page content | Data/network exposure | Scheme checks, private-target guard on HTTP, treat page as untrusted |
| Audit a file | Browser tool | Reads unintended server file | Data exposure | HTML-only, allowed root, disabled over HTTP by default |

## Interaction lifecycle

1. Agent identifies the target and the real user task.
2. Agent audits at relevant desktop and mobile viewports.
3. Server returns grouped findings and element-level evidence.
4. Agent prioritizes critical/serious barriers and repeated token/component defects.
5. Agent proposes or applies the smallest semantic correction.
6. Agent reruns the same audit and relevant product tests.
7. Agent reports incomplete checks as named human tasks.

## State and failure model

| State | Server behavior | Agent recovery |
|---|---|---|
| Browser missing | Clear executable-path error | Set `A11Y_MCP_BROWSER_PATH` or install Chrome |
| Page timeout | Tool error without mutation | Verify URL, start dev server, retry |
| Private URL blocked | Explain HTTP safety setting | Use trusted stdio or explicitly configure private access |
| Complex/gradient contrast | Finding without invented color | Inspect layers and test the composited pair manually |
| Selector unavailable | Preserve axe target/HTML evidence | Locate from DOM snippet or component source |
| Incomplete rule | List as manual review | Run relevant keyboard/AT/content test |
| Agent fix fails | Original evidence remains | Revert or revise code and rerun audit |

## Acceptance criteria for v0.1

- Codex and Claude Code can list and call all seven tools over stdio.
- URL, raw HTML, and allowed local HTML produce structured axe results.
- Each returned violation includes rule metadata and affected DOM evidence.
- Simple opaque contrast failures can include a passing color candidate.
- The server never writes to audited projects.
- HTTP mode blocks private targets and local files by default.
- Automated results always state that they do not prove conformance.
- WCAG 2.2 AA exposes all 55 required A/AA criteria and WCAG 2.2 AAA exposes all 86 required A/AA/AAA criteria.
- Unit/protocol tests and an opt-in browser end-to-end test are included.

## Evaluation plan

Build a benchmark of representative agent-generated pages: landing page, dashboard, form, modal, navigation, table, and AI chat. Seed known failures across contrast, names, labels, landmarks, headings, focus, and responsive states. Measure detection recall for axe-covered rules, correction success after re-audit, regressions introduced, time-to-fix, and false-confidence language. Human accessibility practitioners should define release thresholds after the baseline—not before evidence exists.
