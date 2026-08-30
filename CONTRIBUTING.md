# Contributing

Thank you for improving A11y Feedback MCP.

1. Open an issue describing the accessibility problem, expected evidence, and affected tool.
2. Create a focused branch.
3. Add or update tests before changing behavior.
4. Run `npm run check`, `npm test`, `npm run test:e2e`, and `npm run build`.
5. Update documentation when a tool contract, security default, or limitation changes.
6. Open a pull request with before/after audit output and any remaining manual checks.

Do not weaken a rule, hide an element, or add ARIA solely to make a test disappear. Prefer native semantics and prove corrections by rerunning the same rendered test.
