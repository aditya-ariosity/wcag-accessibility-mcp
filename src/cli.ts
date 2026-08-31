#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { auditFile, auditUrl } from "./audit.js";
import { compareAudits } from "./matrix.js";
import { toMarkdownReport, toSarifReport } from "./reports.js";

const args = process.argv.slice(2);
const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const target = value("--url") ?? value("--file");
if (!target) { console.error("Usage: wcag-accessibility-audit (--url URL | --file path) [--format json|md|sarif] [--out path] [--baseline path]"); process.exit(2); }
const result = value("--url") ? await auditUrl(target) : await auditFile(target);
let output: unknown = result;
const baselinePath = value("--baseline");
if (baselinePath) output = compareAudits(JSON.parse(await readFile(baselinePath, "utf8")), result);
const format = value("--format") ?? "json";
const rendered = format === "md" ? toMarkdownReport(output as any) : format === "sarif" ? JSON.stringify(toSarifReport(output as any), null, 2) : JSON.stringify(output, null, 2);
const out = value("--out");
if (out) await writeFile(out, rendered); else console.log(rendered);
if (baselinePath && !(output as any).gate.passed) process.exitCode = 1;
