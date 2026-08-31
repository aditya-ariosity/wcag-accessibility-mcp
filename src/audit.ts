import { readFile, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import axe from "axe-core";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { executablePath } from "./browser.js";
import { createAuditRun, evidenceId } from "./evidence.js";
import { classifyDirection } from "./direction.js";
import { suggestContrastFix } from "./contrast.js";
import { remediationFor } from "./remediation.js";
import { allowsPrivateTargets, validateAuditUrl } from "./security.js";
import { coverageForStandard, profileFromRuleResults } from "./wcag.js";
import type {
  AuditIssue,
  AuditNode,
  AuditResult,
  AuditStandard,
  ElementContext,
  Viewport,
} from "./types.js";

type AxeNode = {
  target: unknown[];
  html: string;
  failureSummary?: string;
  any?: Array<{ data?: AxeContrastData }>;
};

type AxeContrastData = {
  fgColor?: string;
  bgColor?: string;
  contrastRatio?: number;
  fontSize?: string;
  fontWeight?: string | number;
};

type AxeRule = {
  id: string;
  impact: string | null;
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
};

type AxeResults = {
  testEngine: { name: string; version: string };
  violations: AxeRule[];
  incomplete: AxeRule[];
  passes: AxeRule[];
};

export type AuditOptions = {
  standard?: AuditStandard;
  viewport?: Viewport;
  maxIssues?: number;
  maxNodesPerIssue?: number;
  signal?: AbortSignal;
};

const STANDARD_TAGS: Record<AuditStandard, string[]> = {
  wcag2a: ["wcag2a"],
  wcag2aa: ["wcag2a", "wcag2aa"],
  wcag2aaa: ["wcag2a", "wcag2aa", "wcag2aaa"],
  wcag21aa: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  wcag21aaa: ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21a", "wcag21aa"],
  wcag22aa: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"],
  wcag22aaa: [
    "wcag2a",
    "wcag2aa",
    "wcag2aaa",
    "wcag21a",
    "wcag21aa",
    "wcag21aaa",
    "wcag22a",
    "wcag22aa",
    "wcag22aaa",
  ],
  "best-practice": [
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22a",
    "wcag22aa",
    "best-practice",
  ],
};

const AVAILABLE_AXE_TAGS = new Set(axe.getRules().flatMap((rule) => rule.tags));

export function axeTagsForStandard(standard: AuditStandard): string[] {
  return STANDARD_TAGS[standard].filter((tag) => AVAILABLE_AXE_TAGS.has(tag));
}

const BASE_BROWSER_ARGS = [
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-dev-shm-usage",
  "--disable-sync",
  "--metrics-recording-only",
  "--no-first-run",
  "--hide-scrollbars",
];

let activeBrowsers = 0;
const browserQueue: Array<() => void> = [];

function browserConcurrency(): number {
  const value = Number.parseInt(process.env.A11Y_MCP_BROWSER_CONCURRENCY ?? "2", 10);
  return Number.isFinite(value) && value > 0 ? value : 2;
}

async function acquireBrowserSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error("Accessibility audit cancelled before browser startup.");
  if (activeBrowsers < browserConcurrency()) {
    activeBrowsers += 1;
    return;
  }

  await new Promise<void>((resolveSlot, reject) => {
    const resume = () => {
      activeBrowsers += 1;
      resolveSlot();
    };
    const cancel = () => {
      const index = browserQueue.indexOf(resume);
      if (index >= 0) browserQueue.splice(index, 1);
      reject(new Error("Accessibility audit cancelled while waiting for a browser slot."));
    };
    browserQueue.push(resume);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

function releaseBrowserSlot(): void {
  activeBrowsers = Math.max(0, activeBrowsers - 1);
  const next = browserQueue.shift();
  if (next) next();
}

function auditTimeoutMs(): number {
  const value = Number.parseInt(process.env.A11Y_MCP_AUDIT_TIMEOUT_MS ?? "25000", 10);
  return Number.isFinite(value) && value >= 1000 ? value : 25_000;
}

async function withTimeout<T>(work: Promise<T>, label: string, onTimeout?: () => void): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`${label} exceeded ${auditTimeoutMs()}ms. Reduce page size or increase A11Y_MCP_AUDIT_TIMEOUT_MS.`));
    }, auditTimeoutMs());
  });

  try {
    return await Promise.race([work, timer]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function launchBrowser(): Promise<Browser> {
  const sandboxDisabled = process.env.A11Y_MCP_NO_SANDBOX === "true";
  return puppeteer.launch({
    args: sandboxDisabled
      ? [...BASE_BROWSER_ARGS, "--no-sandbox", "--disable-setuid-sandbox"]
      : BASE_BROWSER_ARGS,
    executablePath: await executablePath(),
    headless: true,
  });
}

async function installNetworkGuard(page: Page, options: { allowLocalFileSubresources?: boolean; allowedLocalFileRoot?: string } = {}): Promise<void> {
  if (allowsPrivateTargets()) return;
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    void (async () => {
      let allowed = false;
      try {
        const url = new URL(request.url());
        if (["data:", "blob:", "about:"].includes(url.protocol)) {
          allowed = true;
        } else if (url.protocol === "file:") {
          const localPath = resolve(fileURLToPath(url));
          const root = options.allowedLocalFileRoot ? resolve(options.allowedLocalFileRoot) : undefined;
          allowed = options.allowLocalFileSubresources === true
            && !!root
            && (localPath === root || localPath.startsWith(`${root}${sep}`));
        } else {
          await validateAuditUrl(url.href);
          allowed = true;
        }
      } catch {
        allowed = false;
      }

      if (request.isInterceptResolutionHandled()) return;
      if (allowed) await request.continue();
      else await request.abort("blockedbyclient");
    })().catch(() => undefined);
  });
}

function targetPathFromTarget(target: unknown[]): string[] | undefined {
  const first = target[0];
  if (Array.isArray(first)) {
    const path = first.filter((value): value is string => typeof value === "string");
    return path.length ? path : undefined;
  }
  const selector = target.find((value): value is string => typeof value === "string");
  return selector ? [selector] : undefined;
}

function normalizedTarget(target: unknown[]): string[] {
  return target.map((value) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(String).join(" ");
    return String(value);
  });
}

async function elementContext(page: Page, targetPath: string[] | undefined): Promise<ElementContext | undefined> {
  if (!targetPath?.length) return undefined;

  try {
    return await page.evaluate((path) => {
      let root: Document | Element | ShadowRoot = document;
      let element: Element | null = null;
      for (const selector of path) {
        element = root.querySelector(selector);
        if (!element) return undefined;
        if (selector !== path.at(-1)) {
          root = (element as HTMLIFrameElement).contentDocument
            ?? (element as HTMLElement).shadowRoot
            ?? element;
        }
      }
      if (!element) return undefined;

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      let backgroundColor: string | undefined = style.backgroundColor;
      let backgroundImage = style.backgroundImage;
      let ancestor = element.parentElement;

      while (
        ancestor
        && backgroundImage === "none"
        && (
          backgroundColor === "transparent"
          || backgroundColor === "rgba(0, 0, 0, 0)"
          || /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(backgroundColor ?? "")
        )
      ) {
        const ancestorStyle = window.getComputedStyle(ancestor);
        backgroundColor = ancestorStyle.backgroundColor;
        backgroundImage = ancestorStyle.backgroundImage;
        ancestor = ancestor.parentElement;
      }

      if (
        backgroundImage !== "none"
        || backgroundColor === "transparent"
        || backgroundColor === "rgba(0, 0, 0, 0)"
        || /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(backgroundColor ?? "")
      ) {
        backgroundColor = undefined;
      }

      const numericWeight = Number.parseInt(style.fontWeight, 10);
      return {
        text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 240) || undefined,
        color: style.color,
        backgroundColor,
        fontSizePx: Number.parseFloat(style.fontSize) || undefined,
        fontWeight: Number.isFinite(numericWeight) ? numericWeight : style.fontWeight === "bold" ? 700 : 400,
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    }, targetPath);
  } catch (error) {
    console.warn(`Could not read computed context for target path "${targetPath.join(" -> ")}":`, error);
    return undefined;
  }
}

function axeFontWeight(value: string | number | undefined, fallback: number | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (value === "bold") return 700;
  if (value) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function contrastSuggestionForNode(
  node: AxeNode,
  context: ElementContext | undefined,
  contrastLevel: "AA" | "AAA",
) {
  const axeData = node.any?.find((check) => check.data?.fgColor && check.data.bgColor)?.data;
  if (axeData?.fgColor && axeData.bgColor && typeof axeData.contrastRatio === "number" && axeData.contrastRatio > 0) {
    return suggestContrastFix({
      foreground: axeData.fgColor,
      background: axeData.bgColor,
      level: contrastLevel,
      fontSizePx: axeData.fontSize ? Number.parseFloat(axeData.fontSize) : context?.fontSizePx,
      fontWeight: axeFontWeight(axeData.fontWeight, context?.fontWeight),
      adjust: "foreground",
    });
  }

  if (context?.color && context.backgroundColor) {
    return suggestContrastFix({
      foreground: context.color,
      background: context.backgroundColor,
      level: contrastLevel,
      fontSizePx: context.fontSizePx,
      fontWeight: context.fontWeight,
      adjust: "foreground",
    });
  }

  return undefined;
}

function wcagCriterionFromTag(tag: string): string | undefined {
  const match = tag.match(/^wcag(\d{3,4})$/);
  if (!match) return undefined;
  const digits = match[1];
  return digits.length === 3
    ? `${digits[0]}.${digits[1]}.${digits[2]}`
    : `${digits[0]}.${digits[1]}.${digits.slice(2)}`;
}

function wcagLevelTags(tags: string[]): string[] {
  return tags.filter((tag) => /^wcag2\d?a{1,3}$/.test(tag));
}

async function transformNode(
  page: Page,
  ruleId: string,
  node: AxeNode,
  contrastLevel: "AA" | "AAA",
  runId: string,
): Promise<AuditNode> {
  const target = normalizedTarget(node.target);
  const targetPath = targetPathFromTarget(node.target);
  const context = await elementContext(page, targetPath);
  const transformed: AuditNode = {
    target,
    targetPath,
    evidence: targetPath?.length
      ? [{
        id: evidenceId(runId, ruleId, targetPath),
        source: "dom",
        quality: "authoritative",
        subject: { kind: "element", id: targetPath.join(" > "), locator: targetPath },
        capturedAt: new Date().toISOString(),
      }]
      : undefined,
    html: node.html,
    failureSummary: node.failureSummary,
    context,
  };

  if (["color-contrast", "color-contrast-enhanced"].includes(ruleId)) {
    try {
      transformed.contrastSuggestion = contrastSuggestionForNode(node, context, contrastLevel);
    } catch {
      // Complex backgrounds, gradients, and alpha blending require manual review.
    }
  }

  return transformed;
}

async function transformIssue(
  page: Page,
  rule: AxeRule,
  maxNodes: number,
  contrastLevel: "AA" | "AAA",
  runId: string,
): Promise<AuditIssue> {
  return {
    id: rule.id,
    impact: rule.impact,
    title: rule.help,
    description: rule.description,
    helpUrl: rule.helpUrl,
    wcagTags: rule.tags.map(wcagCriterionFromTag).filter((tag): tag is string => Boolean(tag)),
    wcagCriteria: rule.tags.map(wcagCriterionFromTag).filter((tag): tag is string => Boolean(tag)),
    wcagLevels: wcagLevelTags(rule.tags),
    standardsTags: rule.tags.filter((tag) => !tag.startsWith("cat.")),
    remediation: remediationFor(rule.id),
    nodes: await Promise.all(
      rule.nodes.slice(0, maxNodes).map((node) => transformNode(page, rule.id, node, contrastLevel, runId)),
    ),
  };
}

async function runAxe(page: Page, standard: AuditStandard): Promise<AxeResults> {
  for (const frame of page.frames()) {
    try {
      await frame.addScriptTag({ content: axe.source });
    } catch {
      // Cross-origin frames may reject script injection. Their findings remain explicitly incomplete.
    }
  }
  return page.evaluate(async (tags) => {
    const axeRuntime = (globalThis as typeof globalThis & {
      axe: { run: (context: Document, options: unknown) => Promise<unknown> };
    }).axe;
    return axeRuntime.run(document, {
      runOnly: { type: "tag", values: tags },
      iframes: true,
      resultTypes: ["violations", "incomplete", "passes"],
    });
  }, axeTagsForStandard(standard)) as Promise<AxeResults>;
}

export function htmlWithBaseUrl(html: string, baseHref: string): string {
  const baseTag = `<base href="${baseHref.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">`;
  const doctypeMatch = html.match(/^\s*(<!doctype\s+html\s*>)/i);
  const doctype = doctypeMatch?.[1] ?? "";
  const remainder = doctypeMatch ? html.slice(doctypeMatch[0].length) : html;

  if (/<head\b[^>]*>/i.test(remainder)) {
    return `${doctype}${remainder.replace(/(<head\b[^>]*>)/i, `$1${baseTag}`)}`;
  }
  if (/<html\b[^>]*>/i.test(remainder)) {
    return `${doctype}${remainder.replace(/(<html\b[^>]*>)/i, `$1<head>${baseTag}</head>`)}`;
  }
  return `${doctype}<head>${baseTag}</head>${remainder}`;
}

async function auditPage(page: Page, target: string, options: AuditOptions): Promise<AuditResult> {
  const standard = options.standard ?? "wcag22aa";
  const viewport = options.viewport ?? { width: 1440, height: 900 };
  const maxIssues = options.maxIssues ?? 50;
  const maxNodesPerIssue = options.maxNodesPerIssue ?? 10;
  const contrastLevel = standard.endsWith("aaa") ? "AAA" : "AA";
  const runId = randomUUID();
  const run = createAuditRun({
    runId,
    source: "dom",
    target,
    standard,
    viewport,
    state: "default",
    startedAt: new Date().toISOString(),
  });
  await page.setViewport(viewport);

  if (options.signal?.aborted) throw new Error("Accessibility audit cancelled.");
  const results = await withTimeout(runAxe(page, standard), "Accessibility audit", () => {
    void page.close().catch(() => undefined);
  });
  const selectedViolations = results.violations.slice(0, maxIssues);
  const issues = await withTimeout(
    Promise.all(selectedViolations.map((rule) => transformIssue(page, rule, maxNodesPerIssue, contrastLevel, runId))),
    "Accessibility evidence mapping",
    () => {
      void page.close().catch(() => undefined);
    },
  );
  const byImpact = results.violations.reduce<Record<string, number>>((counts, rule) => {
    const impact = rule.impact ?? "unknown";
    counts[impact] = (counts[impact] ?? 0) + 1;
    return counts;
  }, {});
  const profile = profileFromRuleResults(standard, {
    violations: results.violations.map((rule) => rule.id),
    incomplete: results.incomplete.map((rule) => rule.id),
    passes: results.passes.map((rule) => rule.id),
  });
  const locale = await page.evaluate(() => ({
    language: document.documentElement.getAttribute("lang") || undefined,
    directions: [document.documentElement.getAttribute("dir"), ...Array.from(document.querySelectorAll("[dir]"), (node) => node.getAttribute("dir"))],
  })).then(({ language, directions }) => ({ language, direction: classifyDirection(directions) }));

  return {
    schemaVersion: run.schemaVersion,
    runId: run.runId,
    evidenceSource: "dom",
    state: run.state,
    locale,
    evidence: issues.flatMap((issue) => issue.nodes.flatMap((node) => node.evidence ?? [])),
    criterionEvaluations: profile.criteria.map((criterion) => ({
      criterionId: criterion.id,
      level: criterion.level,
      outcome: criterion.outcome,
      automated: criterion.automated,
      evidenceIds: issues
        .filter((issue) => issue.wcagCriteria.includes(criterion.id))
        .flatMap((issue) => issue.nodes.flatMap((node) => (node.evidence ?? []).map((evidence) => evidence.id))),
      limitations: criterion.outcome === "untested"
        ? [criterion.automated ? "No applicable automated result was returned for this criterion." : "Manual evaluation is required."]
        : [],
    })),
    engine: `${results.testEngine.name} ${results.testEngine.version}`,
    standard,
    testedAt: new Date().toISOString(),
    target,
    viewport,
    profile: {
      requested: profile.requested,
      highestFullyVerifiedLevel: profile.highestFullyVerifiedLevel,
      blockers: profile.blockers,
      counts: profile.counts,
      criteria: profile.criteria,
    },
    summary: {
      violationCount: results.violations.length,
      affectedNodeCount: results.violations.reduce((total, rule) => total + rule.nodes.length, 0),
      incompleteCount: results.incomplete.length,
      passesCount: results.passes.length,
      byImpact,
    },
    coverage: coverageForStandard(standard),
    issues,
    incomplete: results.incomplete.map((rule) => ({
      id: rule.id,
      impact: rule.impact,
      title: rule.help,
      description: rule.description,
      helpUrl: rule.helpUrl,
      affectedNodeCount: rule.nodes.length,
    })),
    notes: [
      "Automated checks find many common failures but do not prove WCAG conformance.",
      "The coverage summary distinguishes criteria with partial automated rules from criteria that still require manual evaluation; use get_wcag_checklist for the full requirement set.",
      "Items marked incomplete require human review, including keyboard, focus, screen-reader, zoom, motion, and content checks.",
      "Suggested colors are mathematical candidates; confirm them against the design system and all interactive states before applying.",
      "Profile status is an evidence summary, not a conformance claim; unresolved manual criteria block a verified level.",
      "APCA, when supplied by a future adapter, is supplemental perceptual guidance and does not determine WCAG 2.x A/AA/AAA status.",
    ],
  };
}

async function withBrowser<T>(
  work: (page: Page) => Promise<T>,
  options: { guardNetwork?: boolean; allowLocalFileSubresources?: boolean; allowedLocalFileRoot?: string; signal?: AbortSignal } = {},
): Promise<T> {
  await acquireBrowserSlot(options.signal);
  let browser: Browser | undefined;
  let page: Page | undefined;
  const abort = () => {
    void page?.close().catch(() => undefined);
    void browser?.close().catch(() => undefined);
  };
  try {
    if (options.signal?.aborted) throw new Error("Accessibility audit cancelled before browser launch.");
    browser = await launchBrowser();
    page = await browser.newPage();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.guardNetwork !== false) await installNetworkGuard(page, options);
    return await work(page);
  } finally {
    options.signal?.removeEventListener("abort", abort);
    await browser?.close();
    releaseBrowserSlot();
  }
}

export async function withAuditPage<T>(
  work: (page: Page) => Promise<T>,
  options: { guardNetwork?: boolean; allowLocalFileSubresources?: boolean; allowedLocalFileRoot?: string; signal?: AbortSignal } = {},
): Promise<T> {
  return withBrowser(work, options);
}

export async function resolveAuditFilePath(filePath: string): Promise<string> {
  if (process.env.A11Y_MCP_TRANSPORT === "http" && process.env.A11Y_MCP_ENABLE_FILE_AUDIT !== "true") {
    throw new Error("audit_file is disabled for HTTP transport. Set A11Y_MCP_ENABLE_FILE_AUDIT=true only for a trusted deployment.");
  }
  const resolvedPath = await realpath(resolve(filePath));
  const allowedRoot = await realpath(resolve(process.env.A11Y_MCP_ALLOWED_ROOT ?? process.cwd()));
  if (resolvedPath !== allowedRoot && !resolvedPath.startsWith(`${allowedRoot}${sep}`)) {
    throw new Error(`File is outside the allowed root: ${allowedRoot}`);
  }
  if (!resolvedPath.toLowerCase().endsWith(".html") && !resolvedPath.toLowerCase().endsWith(".htm")) {
    throw new Error("audit_file accepts only .html or .htm files.");
  }

  await readFile(resolvedPath, "utf8");
  return resolvedPath;
}

export async function resolveAuditFileRoot(): Promise<string> {
  return realpath(resolve(process.env.A11Y_MCP_ALLOWED_ROOT ?? process.cwd()));
}

export async function auditUrl(urlInput: string, options: AuditOptions = {}): Promise<AuditResult> {
  const url = await validateAuditUrl(urlInput);
  return withBrowser(async (page) => {
    const viewport = options.viewport ?? { width: 1440, height: 900 };
    await page.setViewport(viewport);
    await page.goto(url.href, { waitUntil: "networkidle2", timeout: 30_000 });
    return auditPage(page, url.href, options);
  }, { signal: options.signal });
}

export async function auditHtml(
  html: string,
  options: AuditOptions & { baseUrl?: string } = {},
): Promise<AuditResult> {
  return withBrowser(async (page) => {
    const viewport = options.viewport ?? { width: 1440, height: 900 };
    await page.setViewport(viewport);
    if (options.baseUrl) {
      const base = await validateAuditUrl(options.baseUrl);
      await page.setContent(htmlWithBaseUrl(html, base.href), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
    } else {
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });
    }
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 5_000 }).catch(() => undefined);
    return auditPage(page, options.baseUrl ?? "inline HTML", options);
  }, { signal: options.signal });
}

export async function auditFile(filePath: string, options: AuditOptions = {}): Promise<AuditResult> {
  const resolvedPath = await resolveAuditFilePath(filePath);
  const allowedLocalFileRoot = await resolveAuditFileRoot();
  return withBrowser(async (page) => {
    const viewport = options.viewport ?? { width: 1440, height: 900 };
    await page.setViewport(viewport);
    const fileUrl = pathToFileURL(resolvedPath).href;
    await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 30_000 });
    return auditPage(page, fileUrl, options);
  }, {
    guardNetwork: true,
    allowLocalFileSubresources: process.env.A11Y_MCP_ALLOW_LOCAL_FILE_SUBRESOURCES === "true",
    allowedLocalFileRoot,
    signal: options.signal,
  });
}
