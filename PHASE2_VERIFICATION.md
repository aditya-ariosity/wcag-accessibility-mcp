# Phase 2 verification

## Deterministic checks

- `npm run check` — TypeScript check passes.
- `npm test` — browser-independent unit suite passes (48 tests).
- `npm run build` — production TypeScript build passes.
- `npm run test:browser` — requires a provisioned Chrome/Edge executable; this workspace has no usable Chromium binary.

## Implemented surfaces

The stable seven tools retain their read-only contracts and emit versioned evidence/profile data. Matrix, comparison, screenshot/OCR, design snapshot, and browser diagnostics are implemented as experimental adapters requiring `A11Y_MCP_ENABLE_EXPERIMENTAL_TOOLS=true`. The CLI supports JSON, Markdown, SARIF, and baseline gates.

## Limitations

Automated results are not WCAG conformance claims. Manual keyboard, focus, screen-reader, zoom/reflow, motion, content, localization, and assistive-technology checks remain required. SARIF locations are conservative and do not invent source line mappings.
