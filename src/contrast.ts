import type { ContrastSuggestion } from "./types.js";

type Rgb = { r: number; g: number; b: number; a?: number };

const NAMED_COLORS: Record<string, Rgb> = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

function clamp(value: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, value));
}

function parseAlpha(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) return clamp(Number.parseFloat(trimmed) / 100, 0, 1);
  return clamp(Number.parseFloat(trimmed), 0, 1);
}

function parseRgbChannel(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) return clamp((Number.parseFloat(trimmed) / 100) * 255);
  return clamp(Number.parseFloat(trimmed));
}

function parseHue(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith("turn")) return Number.parseFloat(trimmed) * 360;
  if (trimmed.endsWith("rad")) return Number.parseFloat(trimmed) * (180 / Math.PI);
  return Number.parseFloat(trimmed);
}

function parsePercent(value: string): number {
  return clamp(Number.parseFloat(value), 0, 100) / 100;
}

function hslToRgb(hue: number, saturation: number, lightness: number, alpha?: number): Rgb {
  const h = (((hue % 360) + 360) % 360) / 360;
  if (saturation === 0) {
    const gray = lightness * 255;
    return { r: gray, g: gray, b: gray, a: alpha };
  }

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (offset: number) => {
    let t = h + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: channel(1 / 3) * 255,
    g: channel(0) * 255,
    b: channel(-1 / 3) * 255,
    a: alpha,
  };
}

function functionParts(body: string): string[] {
  return body.includes(",")
    ? body.split(",").map((part) => part.trim())
    : body.replace("/", " / ").split(/\s+/).filter(Boolean);
}

export function parseColor(input: string): Rgb {
  const color = input.trim().toLowerCase();
  if (NAMED_COLORS[color]) return NAMED_COLORS[color];

  const shortHex = color.match(/^#([0-9a-f]{3})$/i);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split("").map((value) => Number.parseInt(value + value, 16));
    return { r, g, b };
  }

  const shortHexAlpha = color.match(/^#([0-9a-f]{4})$/i);
  if (shortHexAlpha) {
    const [r, g, b, a] = shortHexAlpha[1].split("").map((value) => Number.parseInt(value + value, 16));
    return { r, g, b, a: a / 255 };
  }

  const fullHex = color.match(/^#([0-9a-f]{6})$/i);
  if (fullHex) {
    return {
      r: Number.parseInt(fullHex[1].slice(0, 2), 16),
      g: Number.parseInt(fullHex[1].slice(2, 4), 16),
      b: Number.parseInt(fullHex[1].slice(4, 6), 16),
    };
  }

  const fullHexAlpha = color.match(/^#([0-9a-f]{8})$/i);
  if (fullHexAlpha) {
    return {
      r: Number.parseInt(fullHexAlpha[1].slice(0, 2), 16),
      g: Number.parseInt(fullHexAlpha[1].slice(2, 4), 16),
      b: Number.parseInt(fullHexAlpha[1].slice(4, 6), 16),
      a: Number.parseInt(fullHexAlpha[1].slice(6, 8), 16) / 255,
    };
  }

  const rgb = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgb) {
    return {
      r: clamp(Number(rgb[1])),
      g: clamp(Number(rgb[2])),
      b: clamp(Number(rgb[3])),
      a: rgb[4] === undefined ? 1 : clamp(Number(rgb[4]), 0, 1),
    };
  }

  const rgbModern = color.match(/^rgba?\((.+)\)$/i);
  if (rgbModern) {
    const parts = functionParts(rgbModern[1]);
    const slash = parts.indexOf("/");
    const channels = slash === -1 ? parts : parts.slice(0, slash);
    const alpha = slash === -1 ? undefined : parseAlpha(parts[slash + 1]);
    if (channels.length >= 3) {
      return {
        r: parseRgbChannel(channels[0]),
        g: parseRgbChannel(channels[1]),
        b: parseRgbChannel(channels[2]),
        a: alpha,
      };
    }
  }

  const hsl = color.match(/^hsla?\((.+)\)$/i);
  if (hsl) {
    const parts = functionParts(hsl[1]);
    const slash = parts.indexOf("/");
    const channels = slash === -1 ? parts : parts.slice(0, slash);
    const alpha = slash === -1 ? undefined : parseAlpha(parts[slash + 1]);
    if (channels.length >= 3) {
      return hslToRgb(parseHue(channels[0]), parsePercent(channels[1]), parsePercent(channels[2]), alpha);
    }
  }

  const srgb = color.match(/^color\(\s*srgb\s+(.+)\)$/i);
  if (srgb) {
    const parts = functionParts(srgb[1]);
    const slash = parts.indexOf("/");
    const channels = slash === -1 ? parts : parts.slice(0, slash);
    const alpha = slash === -1 ? undefined : parseAlpha(parts[slash + 1]);
    if (channels.length >= 3) {
      return {
        r: parseRgbChannel(channels[0].endsWith("%") ? channels[0] : `${Number.parseFloat(channels[0]) * 100}%`),
        g: parseRgbChannel(channels[1].endsWith("%") ? channels[1] : `${Number.parseFloat(channels[1]) * 100}%`),
        b: parseRgbChannel(channels[2].endsWith("%") ? channels[2] : `${Number.parseFloat(channels[2]) * 100}%`),
        a: alpha,
      };
    }
  }

  throw new Error(`Unsupported color format: ${input}. Use a CSS sRGB color such as a named color, hex, rgb(), hsl(), or color(srgb ...).`);
}

function channelToLinear(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number {
  const { r, g, b, a = 1 } = parseColor(color);
  if (a < 1) {
    throw new Error("A translucent color needs an opaque background before its luminance can be calculated.");
  }
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundRgb = parseColor(foreground);
  const backgroundRgb = parseColor(background);
  const backgroundAlpha = backgroundRgb.a ?? 1;
  if (backgroundAlpha < 1) {
    throw new Error("The background must be opaque. Composite it over its real underlying color first.");
  }

  const foregroundAlpha = foregroundRgb.a ?? 1;
  const compositedForeground = foregroundAlpha < 1
    ? rgbToHex({
      r: foregroundRgb.r * foregroundAlpha + backgroundRgb.r * (1 - foregroundAlpha),
      g: foregroundRgb.g * foregroundAlpha + backgroundRgb.g * (1 - foregroundAlpha),
      b: foregroundRgb.b * foregroundAlpha + backgroundRgb.b * (1 - foregroundAlpha),
    })
    : foreground;
  const foregroundLum = relativeLuminance(compositedForeground);
  const backgroundLum = relativeLuminance(background);
  const lighter = Math.max(foregroundLum, backgroundLum);
  const darker = Math.min(foregroundLum, backgroundLum);
  return (lighter + 0.05) / (darker + 0.05);
}

export function requiredContrast(
  level: "AA" | "AAA",
  fontSizePx: number,
  fontWeight: number,
): number {
  const isLarge = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  if (level === "AAA") {
    return isLarge ? 4.5 : 7;
  }
  return isLarge ? 3 : 4.5;
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((value) => Math.round(clamp(value)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

function closestPassingColor(
  color: string,
  fixedColor: string,
  requiredRatio: number,
): { color: string; amount: number } | undefined {
  const source = parseColor(color);
  const candidates = [
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
  ];

  let best: { color: string; amount: number } | undefined;

  for (const destination of candidates) {
    let low = 0;
    let high = 1;
    let passing: string | undefined;

    for (let iteration = 0; iteration < 24; iteration += 1) {
      const amount = (low + high) / 2;
      const candidate = rgbToHex(mix(source, destination, amount));
      if (contrastRatio(candidate, fixedColor) >= requiredRatio) {
        passing = candidate;
        high = amount;
      } else {
        low = amount;
      }
    }

    if (passing && (!best || high < best.amount)) {
      best = { color: passing, amount: high };
    }
  }

  return best;
}

export function suggestContrastFix(options: {
  foreground: string;
  background: string;
  level?: "AA" | "AAA";
  fontSizePx?: number;
  fontWeight?: number;
  adjust?: "foreground" | "background" | "either";
}): ContrastSuggestion {
  const {
    foreground,
    background,
    level = "AA",
    fontSizePx = 16,
    fontWeight = 400,
    adjust = "foreground",
  } = options;
  const currentRatio = contrastRatio(foreground, background);
  const requiredRatio = requiredContrast(level, fontSizePx, fontWeight);
  const result: ContrastSuggestion = {
    foreground,
    background,
    currentRatio: Number(currentRatio.toFixed(2)),
    requiredRatio,
  };

  if (currentRatio >= requiredRatio) {
    return result;
  }

  const foregroundFix = adjust !== "background"
    ? closestPassingColor(foreground, background, requiredRatio)
    : undefined;
  const backgroundFix = adjust !== "foreground"
    ? closestPassingColor(background, foreground, requiredRatio)
    : undefined;

  const useForeground = foregroundFix && (!backgroundFix || foregroundFix.amount <= backgroundFix.amount);
  if (useForeground && foregroundFix) {
    result.suggestedForeground = foregroundFix.color;
    result.suggestedRatio = Number(contrastRatio(foregroundFix.color, background).toFixed(2));
  } else if (backgroundFix) {
    result.suggestedBackground = backgroundFix.color;
    result.suggestedRatio = Number(contrastRatio(foreground, backgroundFix.color).toFixed(2));
  }

  return result;
}
