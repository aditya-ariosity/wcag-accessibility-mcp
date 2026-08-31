import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import chromium from "@sparticuz/chromium";

export type BrowserSource = "configured" | "system" | "bundled";

export type BrowserDiagnostic = {
  source: BrowserSource;
  executablePath?: string;
  sandboxDisabled: boolean;
  guidance?: string;
};

export function candidateBrowserPaths(): Array<{ source: BrowserSource; path: string | undefined }> {
  const home = homedir();
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const localAppData = process.env.LOCALAPPDATA;

  return [
    { source: "configured", path: process.env.A11Y_MCP_BROWSER_PATH },
    { source: "system", path: "/usr/bin/google-chrome-stable" },
    { source: "system", path: "/usr/bin/google-chrome" },
    { source: "system", path: "/usr/bin/chromium" },
    { source: "system", path: "/usr/bin/chromium-browser" },
    { source: "system", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
    { source: "system", path: `${home}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` },
    { source: "system", path: programFiles && `${programFiles}/Google/Chrome/Application/chrome.exe` },
    { source: "system", path: programFilesX86 && `${programFilesX86}/Google/Chrome/Application/chrome.exe` },
    { source: "system", path: localAppData && `${localAppData}/Google/Chrome/Application/chrome.exe` },
    { source: "system", path: programFiles && `${programFiles}/Microsoft/Edge/Application/msedge.exe` },
  ];
}

function usableExecutable(path: string | undefined): path is string {
  if (!path || !existsSync(path)) return false;
  try {
    return statSync(path).isFile() && statSync(path).size > 0;
  } catch {
    return false;
  }
}

export async function resolveBrowserDiagnostic(): Promise<BrowserDiagnostic> {
  const sandboxDisabled = process.env.A11Y_MCP_NO_SANDBOX === "true";
  const local = candidateBrowserPaths().find((candidate) => usableExecutable(candidate.path));
  if (local?.path) {
    return { source: local.source, executablePath: local.path, sandboxDisabled };
  }

  try {
    const bundledPath = await chromium.executablePath();
    return usableExecutable(bundledPath)
      ? { source: "bundled", executablePath: bundledPath, sandboxDisabled }
      : {
        source: "bundled",
        sandboxDisabled,
        guidance: `Bundled Chromium resolved to an unusable executable (${bundledPath}). Install Chrome/Chromium or set A11Y_MCP_BROWSER_PATH to a browser executable.`,
      };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      source: "bundled",
      sandboxDisabled,
      guidance: `Bundled Chromium could not be resolved: ${reason}. Install Chrome/Chromium or set A11Y_MCP_BROWSER_PATH to a browser executable.`,
    };
  }
}

export async function executablePath(): Promise<string> {
  const diagnostic = await resolveBrowserDiagnostic();
  if (!diagnostic.executablePath) {
    throw new Error(diagnostic.guidance ?? "No browser executable was found. Install Chrome/Chromium or set A11Y_MCP_BROWSER_PATH.");
  }
  return diagnostic.executablePath;
}
