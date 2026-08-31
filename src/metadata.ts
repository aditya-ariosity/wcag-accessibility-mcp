import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as {
  name: string;
  version: string;
  description?: string;
};

export const SERVER_NAME = packageJson.name;
export const SERVER_VERSION = packageJson.version;
export const SERVER_DESCRIPTION = packageJson.description ?? "WCAG accessibility testing MCP.";
