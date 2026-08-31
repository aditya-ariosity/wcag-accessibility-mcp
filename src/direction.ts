export type TextDirection = "ltr" | "rtl" | "mixed" | "unknown";

export function classifyDirection(values: Array<string | null | undefined>): TextDirection {
  const directions = new Set(values.map((value) => value?.trim().toLowerCase()).filter((value): value is string => value === "ltr" || value === "rtl"));
  if (directions.size > 1) return "mixed";
  if (directions.has("rtl")) return "rtl";
  if (directions.has("ltr")) return "ltr";
  return "unknown";
}
