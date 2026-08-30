import { existsSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import chromium from "@sparticuz/chromium";
import axe from "axe-core";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { suggestContrastFix } from "./contrast.js";
import { remediationFor } from "./remediation.js";
import { allowsPrivateTargets, validateAuditUrl } from "./security.js";
import { coverageForStandard } from "./wcag.js";
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

async function acquireBrowserSlot(): Promise<void> {
  if (activeBrowsers < browserConcurrency()) {
    activeBrowsers += 1;
    return;
  }

  await new Promise<void>((resolveSlot) => {
    browserQueue.push(() => {
      activeBrowsers += 1;
      resolveSlot();
    });
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

async function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} exceeded ${auditTimeoutMs()}ms. Reduce page size or increase A11Y_MCP_AUDIT_TIMEOUT_MS.`));
    }, auditTimeoutMs());
  });

  try {
    return await Promise.race([work, timer]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function candidateBrowserPaths(): string[] {
  const home = homedir();
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const localAppData = process.env.LOCALAPPDATA;

  return [
    process.env.A11Y_MCP_BROWSER_PATH,
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    `${home}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    programFiles && `${programFiles}/Google/Chrome/Application/chrome.exe`,
    programFilesX86 && `${programFilesX86}/Google/Chrome/Application/chrome.exe`,
    localAppData && `${localAppData}/Google/Chrome/Application/chrome.exe`,
    programFiles && `${programFiles}/Microsoft/Edge/Application/msedge.exe`,
  ].filter((value): value is string => Boolean(value));
}

async function executablePath(): Promise<string> {
  const local = candidateBrowserPaths().find((path) => existsSync(path));
  if (local) return local;
  return chromium.executablePath();
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

async function installNetworkGuard(page: Page): Promise<void> {
  if (allowsPrivateTargets()) return;
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    void (async () => {
      let allowed = false;
      try {
        const url = new URL(request.url());
        if (["data:", "blob:", "about:"].includes(url.protocol)) {
          allowed = true;
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

function selectorFromTarget(target: unknown[]): string | undefined {
  const first = target[0];
  if (typeof first === "string") return first;
  if (Array.isArray(first)) {
    const nested = first.find((value) => typeof value === "string");
    return typeof nested === "string" ? nested : undefined;
  }
  return undefined;
}

function normalizedTarget(target: unknown[]): string[] {
  return target.map((value) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(String).join(" ");
    return String(value);
  });
}

async function elementContext(page: Page, selector: string | undefined): Promise<ElementContext | undefined> {
  if (!selector) return undefined;

  try {
    return await page.evaluate((query) => {
      const element = document.querySelector(query);
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
    }, selector);
  } catch (error) {
    console.warn(`Could not read computed context for selector "${selector}":`, error);
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
): Promise<AuditNode> {
  const target = normalizedTarget(node.target);
  const context = await elementContext(page, selectorFromTarget(node.target));
  const transformed: AuditNode = {
    target,
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
      rule.nodes.slice(0, maxNodes).map((node) => transformNode(page, rule.id, node, contrastLevel)),
    ),
  };
}

async function runAxe(page: Page, standard: AuditStandard): Promise<AxeResults> {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async (tags) => {
    const axeRuntime = (globalThis as typeof globalThis & {
      axe: { run: (context: Document, options: unknown) => Promise<unknown> };
    }).axe;
    return axeRuntime.run(document, {
      runOnly: { type: "tag", values: tags },
      resultTypes: ["violations", "incomplete", "passes"],
    });
  }, STANDARD_TAGS[standard]) as Promise<AxeResults>;
}

async function auditPage(page: Page, target: string, options: AuditOptions): Promise<AuditResult> {
  const standard = options.standard ?? "wcag22aa";
  const viewport = options.viewport ?? { width: 1440, height: 900 };
  const maxIssues = options.maxIssues ?? 50;
  const maxNodesPerIssue = options.maxNodesPerIssue ?? 10;
  const contrastLevel = standard.endsWith("aaa") ? "AAA" : "AA";
  await page.setViewport(viewport);

  const results = await withTimeout(runAxe(page, standard), "Accessibility audit");
  const selectedViolations = results.violations.slice(0, maxIssues);
  const issues = await withTimeout(
    Promise.all(selectedViolations.map((rule) => transformIssue(page, rule, maxNodesPerIssue, contrastLevel))),
    "Accessibility evidence mapping",
  );
  const byImpact = results.violations.reduce<Record<string, number>>((counts, rule) => {
    const impact = rule.impact ?? "unknown";
    counts[impact] = (counts[impact] ?? 0) + 1;
    return counts;
  }, {});

  return {
    engine: `${results.testEngine.name} ${results.testEngine.version}`,
    standard,
    testedAt: new Date().toISOString(),
    target,
    viewport,
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
    ],
  };
}

async function withBrowser<T>(
  work: (page: Page) => Promise<T>,
  options: { guardNetwork?: boolean } = {},
): Promise<T> {
  await acquireBrowserSlot();
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    if (options.guardNetwork !== false) await installNetworkGuard(page);
    return await work(page);
  } finally {
    await browser?.close();
    releaseBrowserSlot();
  }
}

export async function auditUrl(urlInput: string, options: AuditOptions = {}): Promise<AuditResult> {
  const url = await validateAuditUrl(urlInput);
  return withBrowser(async (page) => {
    const viewport = options.viewport ?? { width: 1440, height: 900 };
    await page.setViewport(viewport);
    await page.goto(url.href, { waitUntil: "networkidle2", timeout: 30_000 });
    return auditPage(page, url.href, options);
  });
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
      await page.setContent(`<base href="${base.href.replaceAll('"', '&quot;')}">${html}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
    } else {
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });
    }
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 5_000 }).catch(() => undefined);
    return auditPage(page, options.baseUrl ?? "inline HTML", options);
  });
}

export async function auditFile(filePath: string, options: AuditOptions = {}): Promise<AuditResult> {
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
  return withBrowser(async (page) => {
    const viewport = options.viewport ?? { width: 1440, height: 900 };
    await page.setViewport(viewport);
    const fileUrl = pathToFileURL(resolvedPath).href;
    await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 30_000 });
    return auditPage(page, fileUrl, options);
  }, { guardNetwork: false });
}
