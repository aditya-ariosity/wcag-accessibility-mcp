# Phase 2 — Evidence Core and Regression Build

This is the active Phase 2 contract for `wcag-accessibility-mcp`.

## Complete scope

- Versioned audit evidence envelopes with run IDs, evidence sources, target paths, and explicit criterion outcomes.
- WCAG 2.2 A/AA/AAA profile evaluation that never treats partial automation as conformance.
- Correct shadow-DOM and same-origin iframe evidence resolution.
- Secure URL, HTML, and allowed-root local-file auditing with cancellation and bounded concurrency.
- CSS Color 4 contrast parsing and mathematical suggestions.
- RTL, LTR, mixed-direction, and document-language evidence.
- Multi-viewport matrix audits, deterministic finding fingerprints, and baseline comparison gates.
- Browser-independent JSON, Markdown, and SARIF report formatting through the CLI.
- Experimental screenshot/OCR and design-node adapters, explicitly gated until their evidence quality is validated.

## Deferred product surfaces

Native Figma plugin integration, direct Claude Design inspection, persistence, journeys, mobile-native auditing, PDF auditing, visual scoring, and automatic source edits remain later adapters. They must consume the same evidence model rather than create parallel verdict systems.

## Verification

`npm run check`, `npm test`, and `npm run build` are the deterministic checks. Browser tests require a provisioned Chrome/Edge executable and are run with `npm run test:browser`.
