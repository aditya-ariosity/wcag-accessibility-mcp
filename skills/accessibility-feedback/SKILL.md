---
name: accessibility-feedback
description: Audit and correct accessibility problems in rendered web interfaces using the a11y-feedback MCP tools. Use when an agent creates, changes, reviews, or verifies HTML/CSS/UI code; when asked about WCAG, contrast, labels, semantics, keyboard access, focus, screen readers, responsive accessibility, or accessibility regressions; or before calling an AI-generated interface complete. Run evidence-led audits, make scoped corrections, rerun the same tests, and preserve manual checks instead of claiming automated conformance.
---

# Accessibility Feedback

Use the connected `a11y-feedback` MCP server to turn accessibility from a prompt reminder into a measured correction loop.

## Capability boundary

The server can render web interfaces, run automated axe rules, calculate contrast, expose affected selectors and DOM, and suggest simple passing colors. It cannot prove WCAG conformance or replace keyboard, screen-reader, zoom, reflow, motion, cognitive, and content testing.

All server tools are read-only. Code changes belong to the agent's normal edit workflow and must follow the user's authorization, diff review, and project tests.

## Audit loop

1. Identify the target, critical user task, relevant routes/states, and supported breakpoints.
2. Start the application if needed.
3. Call `audit_url`, `audit_file`, or `audit_html` at one wide and one narrow viewport. Default to 1440×900 and 390×844 when the product has no defined breakpoints.
4. Call `get_wcag_checklist` for the selected conformance profile. Use `wcag22aa` by default; use `wcag22aaa` only when the user or product requirement explicitly asks for enhanced coverage.
5. Read the structured results. Preserve rule ID, impact, selector, HTML snippet, computed context, W3C criterion, coverage status, and reference link.
6. Group repeated failures by root cause: token, shared component, content pattern, page template, or one-off instance.
7. Prioritize blockers to the critical task, then critical/serious impact, then high-reach repeated defects. Axe impact is evidence, not the entire product priority.
8. Inspect source before editing. Apply the smallest semantic, component, or token-level fix that addresses the root cause.
9. Rerun the same viewport and state. Run existing project tests.
10. Report resolved findings, unresolved automated findings, all required manual criteria, regressions, and named manual tests.

## Contrast correction

- Use `check_contrast` for an exact foreground/background pair.
- Use `suggest_contrast_fix` for a mathematical candidate.
- For AAA, verify 7:1 for normal text and 4.5:1 for large text; do not reuse AA's 4.5:1 and 3:1 thresholds.
- Prefer changing a semantic design token when the failing pair repeats.
- Check normal, hover, focus, active, selected, visited, disabled, error, success, and inverse themes.
- Do not apply a suggested hex value blindly when the background is a gradient, image, overlay, transparency stack, or video.
- Preserve brand intent by comparing foreground and background options, then verify the chosen pair again.

## Semantic correction rules

- Prefer native elements before ARIA.
- Preserve visible labels and programmatic names.
- Keep DOM, reading, focus, and visual order aligned.
- Make keyboard focus visible and unobscured.
- Keep headings and landmarks structural, not styling shortcuts.
- Do not “fix” an inaccessible control by hiding it from assistive technology.
- Do not remove zoom, focus outlines, or keyboard behavior to silence a test.

Use `explain_issue` when a rule is unfamiliar, then inspect the linked rule guidance.

## Human checks that remain

Create manual tasks appropriate to the interface. At minimum consider:

- full keyboard navigation, focus order, focus visibility, traps, and focus return;
- screen-reader names, roles, states, announcements, reading order, and dynamic updates;
- 200% zoom, 400% zoom/reflow, text spacing, orientation, and narrow screens;
- hover/focus content, drag alternatives, target size, gestures, and timing;
- reduced motion, autoplay, flashing, audio, captions, and transcripts;
- error prevention, instructions, plain language, localization, and cognitive load;
- high contrast/forced colors, dark mode, and disabled/selected states.

## Required report

Return:

1. target, states, viewports, standard, and engine;
2. baseline violation groups and affected-node count;
3. fixes made, tied to rule IDs and source locations;
4. re-audit result and any regression;
5. unresolved findings and why;
6. manual test checklist;
7. the limitation: automated testing does not prove WCAG conformance.

Never use “fully accessible,” “WCAG compliant,” or a numeric compliance score unless a qualified human audit with an agreed scope supports that claim. W3C notes that whole-site Level AAA is not an appropriate general policy for some content; report AAA progress criterion by criterion when full conformance is not feasible.
