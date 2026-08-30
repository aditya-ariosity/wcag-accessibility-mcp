import axe from "axe-core";
import type { AuditStandard } from "./types.js";

export type WcagLevel = "A" | "AA" | "AAA";
export type WcagVersion = "2.0" | "2.1" | "2.2";
export type WcagPrinciple = "perceivable" | "operable" | "understandable" | "robust";

type CriterionSource = {
  id: string;
  title: string;
  level: WcagLevel;
  introducedIn?: WcagVersion;
  removedIn?: WcagVersion;
};

export type WcagCriterion = CriterionSource & {
  principle: WcagPrinciple;
  version: WcagVersion;
  profileVersion: WcagVersion;
  reference: string;
  axeRuleIds: string[];
  evaluation: "automated-partial" | "manual";
  testMethod: string;
};

const CRITERIA: CriterionSource[] = [
  { id: "1.1.1", title: "Non-text Content", level: "A" },
  { id: "1.2.1", title: "Audio-only and Video-only (Prerecorded)", level: "A" },
  { id: "1.2.2", title: "Captions (Prerecorded)", level: "A" },
  { id: "1.2.3", title: "Audio Description or Media Alternative (Prerecorded)", level: "A" },
  { id: "1.2.4", title: "Captions (Live)", level: "AA" },
  { id: "1.2.5", title: "Audio Description (Prerecorded)", level: "AA" },
  { id: "1.2.6", title: "Sign Language (Prerecorded)", level: "AAA" },
  { id: "1.2.7", title: "Extended Audio Description (Prerecorded)", level: "AAA" },
  { id: "1.2.8", title: "Media Alternative (Prerecorded)", level: "AAA" },
  { id: "1.2.9", title: "Audio-only (Live)", level: "AAA" },
  { id: "1.3.1", title: "Info and Relationships", level: "A" },
  { id: "1.3.2", title: "Meaningful Sequence", level: "A" },
  { id: "1.3.3", title: "Sensory Characteristics", level: "A" },
  { id: "1.3.4", title: "Orientation", level: "AA", introducedIn: "2.1" },
  { id: "1.3.5", title: "Identify Input Purpose", level: "AA", introducedIn: "2.1" },
  { id: "1.3.6", title: "Identify Purpose", level: "AAA", introducedIn: "2.1" },
  { id: "1.4.1", title: "Use of Color", level: "A" },
  { id: "1.4.2", title: "Audio Control", level: "A" },
  { id: "1.4.3", title: "Contrast (Minimum)", level: "AA" },
  { id: "1.4.4", title: "Resize Text", level: "AA" },
  { id: "1.4.5", title: "Images of Text", level: "AA" },
  { id: "1.4.6", title: "Contrast (Enhanced)", level: "AAA" },
  { id: "1.4.7", title: "Low or No Background Audio", level: "AAA" },
  { id: "1.4.8", title: "Visual Presentation", level: "AAA" },
  { id: "1.4.9", title: "Images of Text (No Exception)", level: "AAA" },
  { id: "1.4.10", title: "Reflow", level: "AA", introducedIn: "2.1" },
  { id: "1.4.11", title: "Non-text Contrast", level: "AA", introducedIn: "2.1" },
  { id: "1.4.12", title: "Text Spacing", level: "AA", introducedIn: "2.1" },
  { id: "1.4.13", title: "Content on Hover or Focus", level: "AA", introducedIn: "2.1" },
  { id: "2.1.1", title: "Keyboard", level: "A" },
  { id: "2.1.2", title: "No Keyboard Trap", level: "A" },
  { id: "2.1.3", title: "Keyboard (No Exception)", level: "AAA" },
  { id: "2.1.4", title: "Character Key Shortcuts", level: "A", introducedIn: "2.1" },
  { id: "2.2.1", title: "Timing Adjustable", level: "A" },
  { id: "2.2.2", title: "Pause, Stop, Hide", level: "A" },
  { id: "2.2.3", title: "No Timing", level: "AAA" },
  { id: "2.2.4", title: "Interruptions", level: "AAA" },
  { id: "2.2.5", title: "Re-authenticating", level: "AAA" },
  { id: "2.2.6", title: "Timeouts", level: "AAA", introducedIn: "2.1" },
  { id: "2.3.1", title: "Three Flashes or Below Threshold", level: "A" },
  { id: "2.3.2", title: "Three Flashes", level: "AAA" },
  { id: "2.3.3", title: "Animation from Interactions", level: "AAA", introducedIn: "2.1" },
  { id: "2.4.1", title: "Bypass Blocks", level: "A" },
  { id: "2.4.2", title: "Page Titled", level: "A" },
  { id: "2.4.3", title: "Focus Order", level: "A" },
  { id: "2.4.4", title: "Link Purpose (In Context)", level: "A" },
  { id: "2.4.5", title: "Multiple Ways", level: "AA" },
  { id: "2.4.6", title: "Headings and Labels", level: "AA" },
  { id: "2.4.7", title: "Focus Visible", level: "AA" },
  { id: "2.4.8", title: "Location", level: "AAA" },
  { id: "2.4.9", title: "Link Purpose (Link Only)", level: "AAA" },
  { id: "2.4.10", title: "Section Headings", level: "AAA" },
  { id: "2.4.11", title: "Focus Not Obscured (Minimum)", level: "AA", introducedIn: "2.2" },
  { id: "2.4.12", title: "Focus Not Obscured (Enhanced)", level: "AAA", introducedIn: "2.2" },
  { id: "2.4.13", title: "Focus Appearance", level: "AAA", introducedIn: "2.2" },
  { id: "2.5.1", title: "Pointer Gestures", level: "A", introducedIn: "2.1" },
  { id: "2.5.2", title: "Pointer Cancellation", level: "A", introducedIn: "2.1" },
  { id: "2.5.3", title: "Label in Name", level: "A", introducedIn: "2.1" },
  { id: "2.5.4", title: "Motion Actuation", level: "A", introducedIn: "2.1" },
  { id: "2.5.5", title: "Target Size (Enhanced)", level: "AAA", introducedIn: "2.1" },
  { id: "2.5.6", title: "Concurrent Input Mechanisms", level: "AAA", introducedIn: "2.1" },
  { id: "2.5.7", title: "Dragging Movements", level: "AA", introducedIn: "2.2" },
  { id: "2.5.8", title: "Target Size (Minimum)", level: "AA", introducedIn: "2.2" },
  { id: "3.1.1", title: "Language of Page", level: "A" },
  { id: "3.1.2", title: "Language of Parts", level: "AA" },
  { id: "3.1.3", title: "Unusual Words", level: "AAA" },
  { id: "3.1.4", title: "Abbreviations", level: "AAA" },
  { id: "3.1.5", title: "Reading Level", level: "AAA" },
  { id: "3.1.6", title: "Pronunciation", level: "AAA" },
  { id: "3.2.1", title: "On Focus", level: "A" },
  { id: "3.2.2", title: "On Input", level: "A" },
  { id: "3.2.3", title: "Consistent Navigation", level: "AA" },
  { id: "3.2.4", title: "Consistent Identification", level: "AA" },
  { id: "3.2.5", title: "Change on Request", level: "AAA" },
  { id: "3.2.6", title: "Consistent Help", level: "A", introducedIn: "2.2" },
  { id: "3.3.1", title: "Error Identification", level: "A" },
  { id: "3.3.2", title: "Labels or Instructions", level: "A" },
  { id: "3.3.3", title: "Error Suggestion", level: "AA" },
  { id: "3.3.4", title: "Error Prevention (Legal, Financial, Data)", level: "AA" },
  { id: "3.3.5", title: "Help", level: "AAA" },
  { id: "3.3.6", title: "Error Prevention (All)", level: "AAA" },
  { id: "3.3.7", title: "Redundant Entry", level: "A", introducedIn: "2.2" },
  { id: "3.3.8", title: "Accessible Authentication (Minimum)", level: "AA", introducedIn: "2.2" },
  { id: "3.3.9", title: "Accessible Authentication (Enhanced)", level: "AAA", introducedIn: "2.2" },
  { id: "4.1.1", title: "Parsing", level: "A", removedIn: "2.2" },
  { id: "4.1.2", title: "Name, Role, Value", level: "A" },
  { id: "4.1.3", title: "Status Messages", level: "AA", introducedIn: "2.1" },
];

const VERSION_ORDER: Record<WcagVersion, number> = { "2.0": 20, "2.1": 21, "2.2": 22 };
const LEVEL_ORDER: Record<WcagLevel, number> = { A: 1, AA: 2, AAA: 3 };
const PRINCIPLES: Record<string, WcagPrinciple> = {
  "1": "perceivable",
  "2": "operable",
  "3": "understandable",
  "4": "robust",
};

export function standardVersion(standard: AuditStandard): WcagVersion {
  if (standard.startsWith("wcag22") || standard === "best-practice") return "2.2";
  if (standard.startsWith("wcag21")) return "2.1";
  return "2.0";
}

export function standardLevel(standard: AuditStandard): WcagLevel {
  if (standard.endsWith("aaa")) return "AAA";
  if (standard.endsWith("aa") || standard === "best-practice") return "AA";
  return "A";
}

function testMethodFor(criterion: CriterionSource): string {
  const prefix = criterion.id.split(".").slice(0, 2).join(".");
  const methods: Record<string, string> = {
    "1.1": "Inspect text alternatives and confirm they communicate the same purpose and information.",
    "1.2": "Review media alternatives, captions, descriptions, transcripts, and synchronization with a human evaluator.",
    "1.3": "Inspect semantics and reading order, then verify reflow, orientation, and programmatic purpose where applicable.",
    "1.4": "Measure colors and states, then test zoom, reflow, spacing, audio, hover/focus content, and images of text.",
    "2.1": "Complete every task with keyboard alone; check shortcuts, traps, order, and recovery.",
    "2.2": "Exercise time limits, moving content, interruptions, sessions, and data preservation.",
    "2.3": "Measure flashing and verify interaction-triggered animation can be disabled.",
    "2.4": "Navigate full page sets and states; verify bypass, titles, focus, labels, location, and link purpose.",
    "2.5": "Test touch, mouse, stylus, motion, dragging, cancellation, accessible names, and target dimensions.",
    "3.1": "Review language metadata, wording, definitions, reading level, abbreviations, and pronunciation support.",
    "3.2": "Exercise repeated components and context changes across the complete process or page set.",
    "3.3": "Submit invalid, repeated, sensitive, and authentication data; verify guidance, recovery, and prevention.",
    "4.1": "Inspect semantics and test names, roles, values, states, and status messages with accessibility APIs.",
  };
  return methods[prefix] ?? "Evaluate the success criterion using the linked W3C test guidance.";
}

function appliesToVersion(criterion: CriterionSource, version: WcagVersion): boolean {
  const introduced = VERSION_ORDER[criterion.introducedIn ?? "2.0"];
  const requested = VERSION_ORDER[version];
  const removed = criterion.removedIn ? VERSION_ORDER[criterion.removedIn] : Number.POSITIVE_INFINITY;
  return introduced <= requested && requested < removed;
}

export function getWcagChecklist(
  standard: AuditStandard,
  filters: { principle?: WcagPrinciple; evaluation?: "automated-partial" | "manual" } = {},
): WcagCriterion[] {
  const version = standardVersion(standard);
  const level = standardLevel(standard);
  const axeRules = axe.getRules();

  return CRITERIA
    .filter((criterion) => appliesToVersion(criterion, version))
    .filter((criterion) => LEVEL_ORDER[criterion.level] <= LEVEL_ORDER[level])
    .map((criterion): WcagCriterion => {
      const tag = `wcag${criterion.id.replaceAll(".", "")}`;
      const axeRuleIds = axeRules
        .filter((rule) => rule.tags.includes(tag))
        .map((rule) => rule.ruleId)
        .sort();
      const principle = PRINCIPLES[criterion.id[0]];
      const referenceVersion = version === "2.0" ? "WCAG21" : version === "2.1" ? "WCAG21" : "WCAG22";
      return {
        ...criterion,
        principle,
        version: criterion.introducedIn ?? "2.0",
        profileVersion: version,
        reference: `https://www.w3.org/TR/${referenceVersion}/#${criterion.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        axeRuleIds,
        evaluation: axeRuleIds.length ? "automated-partial" : "manual",
        testMethod: testMethodFor(criterion),
      };
    })
    .filter((criterion) => !filters.principle || criterion.principle === filters.principle)
    .filter((criterion) => !filters.evaluation || criterion.evaluation === filters.evaluation);
}

export function coverageForStandard(standard: AuditStandard): {
  requiredCriteriaCount: number;
  criteriaWithAutomatedRules: number;
  criteriaRequiringManualReview: number;
  catalogSource: string;
} {
  const criteria = getWcagChecklist(standard);
  const automatedPartial = criteria.filter((criterion) => criterion.evaluation === "automated-partial").length;
  return {
    requiredCriteriaCount: criteria.length,
    criteriaWithAutomatedRules: automatedPartial,
    criteriaRequiringManualReview: criteria.length - automatedPartial,
    catalogSource: "https://www.w3.org/WAI/WCAG22/wcag.json",
  };
}
