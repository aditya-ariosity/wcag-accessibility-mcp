# W3C WAI coverage model

W3C WAI is a family of standards and evaluation resources, not a single automated checklist. This project uses each part according to its real scope.

| WAI standard/resource | What it governs | v0.1 relationship |
|---|---|---|
| WCAG 2.0, 2.1, 2.2 | Accessibility of web content and applications | Explicit A/AA/AAA profiles; complete criterion catalog; partial automated and manual coverage labels |
| WAI-ARIA 1.2 | Roles, states, properties, and accessibility semantics | axe ARIA rules plus native-HTML-first remediation; browser/assistive-technology verification remains manual |
| ACT Rules Format/rules | Transparent automated, semi-automated, and manual conformance-test rules | axe standards tags are preserved in audit metadata where axe exposes them; future versions can add direct ACT rule IDs and EARL output |
| WCAG-EM | Methodology for evaluating complete sites/products | Referenced as the path for scoped human conformance evaluation; not replaced by this server |
| ATAG 2.0 | Accessibility of authoring tools and their support for accessible output | Relevant when evaluating the AI design/coding product itself; not claimed by a page-level runtime audit |
| UAAG 2.0 | Accessibility of browsers, media players, and user agents | Outside the content-audit target |
| EARL | Machine-readable evaluation reports | Planned export format; current MCP structured output is not presented as EARL |
| WCAG 3 | Early draft for future guidance | Monitored only; not a conformance target |

## Conformance profiles

- WCAG 2.2 AA requires all Level A and Level AA success criteria: 55 criteria in the catalog.
- WCAG 2.2 AAA requires all Level A, AA, and AAA success criteria: 86 criteria in the catalog.
- W3C advises against making whole-site AAA a general policy because some content cannot satisfy every AAA criterion. Use AAA deliberately and report progress per criterion where full conformance is not feasible.

## What an automated mapping means

`automated-partial` means axe has one or more rules tagged to that success criterion. It does not mean the complete criterion is automatically testable. For example, markup can reveal that an image lacks an `alt` attribute, but a person must determine whether supplied alternative text is equivalent and appropriate.

`manual` means the current engine has no axe rule mapping for the criterion. The checklist still returns a W3C reference and a practical test family so the agent cannot silently omit it.
