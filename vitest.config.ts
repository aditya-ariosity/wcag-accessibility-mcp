import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.e2e.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
