import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { htmlWithBaseUrl, resolveAuditFilePath, resolveAuditFileRoot, type AuditOptions, withAuditPage } from "./audit.js";
import { validateAuditUrl } from "./security.js";
import type { Viewport } from "./types.js";

const execFileAsync = promisify(execFile);

export type ScreenshotTarget =
  | { kind: "url"; url: string }
  | { kind: "html"; html: string; baseUrl?: string }
  | { kind: "file"; filePath: string };

export type ScreenshotInspectOptions = AuditOptions & {
  target: ScreenshotTarget;
  includeImage?: boolean;
  runOcr?: boolean;
  fullPage?: boolean;
};

export type ScreenshotOcrResult = {
  requested: boolean;
  available: boolean;
  engine?: string;
  text?: string;
  warning?: string;
};

export type ScreenshotInspectResult = {
  schemaVersion: "2.2";
  target: string;
  viewport: Viewport;
  screenshot: {
    mimeType: "image/png";
    byteLength: number;
    base64?: string;
  };
  ocr: ScreenshotOcrResult;
  notes: string[];
};

async function loadScreenshotTarget(page: Parameters<Parameters<typeof withAuditPage>[0]>[0], target: ScreenshotTarget): Promise<string> {
  if (target.kind === "url") {
    const url = await validateAuditUrl(target.url);
    await page.goto(url.href, { waitUntil: "networkidle2", timeout: 30_000 });
    return url.href;
  }

  if (target.kind === "html") {
    if (target.baseUrl) {
      const base = await validateAuditUrl(target.baseUrl);
      await page.setContent(htmlWithBaseUrl(target.html, base.href), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForNetworkIdle({ idleTime: 300, timeout: 5_000 }).catch(() => undefined);
      return base.href;
    }
    await page.setContent(target.html, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 5_000 }).catch(() => undefined);
    return "inline HTML";
  }

  const resolvedPath = await resolveAuditFilePath(target.filePath);
  const fileUrl = pathToFileURL(resolvedPath).href;
  await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 30_000 });
  return fileUrl;
}

async function runTesseract(image: Buffer, requested: boolean): Promise<ScreenshotOcrResult> {
  if (!requested) return { requested, available: false };

  const command = process.env.A11Y_MCP_OCR_COMMAND ?? "tesseract";
  const tempDir = await mkdtemp(join(tmpdir(), "a11y-ocr-"));
  const imagePath = join(tempDir, "screenshot.png");
  try {
    await writeFile(imagePath, image);
    const { stdout } = await execFileAsync(command, [imagePath, "stdout", "--psm", "6"], {
      timeout: 30_000,
      maxBuffer: 1_000_000,
    });
    return {
      requested,
      available: true,
      engine: command,
      text: stdout.trim().replace(/\s+\n/g, "\n").slice(0, 20_000),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      requested,
      available: false,
      warning: `OCR was requested but could not run. Install Tesseract or set A11Y_MCP_OCR_COMMAND. Details: ${message}`,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function inspectScreenshot(options: ScreenshotInspectOptions): Promise<ScreenshotInspectResult> {
  const viewport = options.viewport ?? { width: 1440, height: 900 };
  const allowedLocalFileRoot = options.target.kind === "file" ? await resolveAuditFileRoot() : undefined;
  return withAuditPage(async (page) => {
    await page.setViewport(viewport);
    const target = await loadScreenshotTarget(page, options.target);
    const screenshotBytes = await page.screenshot({
      type: "png",
      fullPage: options.fullPage ?? false,
    });
    const image = Buffer.from(screenshotBytes);
    const ocr = await runTesseract(image, options.runOcr ?? false);

    return {
      schemaVersion: "2.2",
      target,
      viewport,
      screenshot: {
        mimeType: "image/png",
        byteLength: image.byteLength,
        base64: options.includeImage ? image.toString("base64") : undefined,
      },
      ocr,
      notes: [
        "Screenshot inspection is visual evidence only. It does not replace DOM, keyboard, screen-reader, or WCAG conformance testing.",
        "OCR text can help find visible copy in images or canvas surfaces, but it is approximate and should be confirmed against semantic source when available.",
      ],
    };
  }, {
    guardNetwork: true,
    allowLocalFileSubresources: options.target.kind === "file"
      && process.env.A11Y_MCP_ALLOW_LOCAL_FILE_SUBRESOURCES === "true",
    allowedLocalFileRoot,
    signal: options.signal,
  });
}
