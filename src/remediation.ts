const REMEDIATION: Record<string, string[]> = {
  "color-contrast": [
    "Change the foreground or background color to meet the required WCAG contrast ratio.",
    "Retest text in every state, including hover, focus, disabled, visited, and selected.",
    "Prefer design-token changes when the failing color is reused across components.",
  ],
  "button-name": [
    "Give the button an accessible name using visible text, aria-label, or aria-labelledby.",
    "Ensure the name describes the action rather than the icon appearance.",
  ],
  "link-name": [
    "Provide descriptive link text or an accessible name that identifies the destination.",
    "Avoid repeated ambiguous labels such as 'click here' or 'learn more' without context.",
  ],
  "image-alt": [
    "Add concise alt text when the image communicates information.",
    "Use alt=\"\" for decorative images so assistive technology can ignore them.",
  ],
  label: [
    "Associate every form control with a visible label using for/id, nesting, or aria-labelledby.",
    "Do not rely on placeholder text as the only label.",
  ],
  "html-has-lang": [
    "Set the document language on the html element, for example <html lang=\"en\">.",
  ],
  "document-title": [
    "Add a concise, unique document title that identifies the page and product context.",
  ],
  "heading-order": [
    "Use heading levels to represent document structure without skipping levels for styling.",
    "Change visual styling through CSS rather than choosing an incorrect heading level.",
  ],
  "landmark-one-main": [
    "Wrap the page's primary content in one main landmark.",
    "Use unique labels when multiple landmarks of the same type are necessary.",
  ],
  "focus-order-semantics": [
    "Keep keyboard focus order aligned with the visual and semantic reading order.",
    "Avoid positive tabindex values; correct the DOM order instead.",
  ],
  "target-size": [
    "Increase the interactive target or spacing so it meets the applicable WCAG target-size requirement.",
  ],
  "frame-title": [
    "Give every iframe a concise title that identifies its content or purpose.",
    "If the iframe is decorative or hidden, remove it from the accessibility tree and verify it is not focusable.",
  ],
  "select-name": [
    "Associate the select element with a visible label using for/id, nesting, or aria-labelledby.",
    "Use aria-label only when a visible label is genuinely unavailable.",
  ],
  list: [
    "Use ul, ol, and li elements only for real lists, and keep list items as direct children.",
    "If the content is not a list, use neutral containers instead of list semantics.",
  ],
  region: [
    "Place all meaningful page content inside landmarks such as header, nav, main, aside, or footer.",
    "Use a single main landmark for the primary content and label repeated landmark types.",
  ],
  bypass: [
    "Add a skip link or equivalent bypass mechanism before repeated navigation.",
    "Ensure the target receives focus and places keyboard users at the main content.",
  ],
  "empty-heading": [
    "Remove empty heading elements or give them meaningful text.",
    "Do not use headings as spacing hooks; style a neutral element instead.",
  ],
  "nested-interactive": [
    "Do not place buttons, links, inputs, or other focusable controls inside another interactive control.",
    "Split the controls into siblings and give each one a clear accessible name.",
  ],
  "meta-viewport": [
    "Allow users to zoom by removing user-scalable=no and maximum-scale restrictions.",
    "Verify the layout remains usable at 200% and 400% zoom.",
  ],
  marquee: [
    "Replace marquee or auto-moving content with a controllable pattern.",
    "Provide pause, stop, or hide controls when motion is necessary.",
  ],
  tabindex: [
    "Avoid positive tabindex values.",
    "Use semantic elements and DOM order so keyboard focus follows the visual and task order.",
  ],
  "scrollable-region-focusable": [
    "Make scrollable regions keyboard-focusable when keyboard users need to scroll them.",
    "Give the region a useful label when its purpose is not obvious from surrounding content.",
  ],
};

export function remediationFor(ruleId: string): string[] {
  if (REMEDIATION[ruleId]) {
    return REMEDIATION[ruleId];
  }

  if (ruleId.startsWith("aria-")) {
    return [
      "Use native HTML semantics where possible.",
      "When ARIA is necessary, ensure the role, state, property, and referenced IDs are valid and consistent.",
      "Test the corrected control with keyboard and screen-reader interaction.",
    ];
  }

  return [
    "Open the linked rule guidance and correct the underlying semantic or interaction issue.",
    "Retest the affected element and nearby states after making the change.",
  ];
}
