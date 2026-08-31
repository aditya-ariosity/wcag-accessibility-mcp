import type { ContrastSuggestion } from "./types.js";
import { CSS_NAMED_COLORS } from "./css-colors.js";

type Rgb = { r: number; g: number; b: number; a?: number };

const NAMED_COLORS: Record<string, Rgb> = Object.fromEntries(
  Object.entries(CSS_NAMED_COLORS).map(([name, rgb]) => [name, rgb]),
);
NAMED_COLORS.transparent = { r: 0, g: 0, b: 0, a: 0 };

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

function parseCssNumber(value: string, scale = 1): number {
  if (value.trim().toLowerCase() === "none") return 0;
  const number = Number.parseFloat(value);
  return Number.isFinite(number)
    ? (value.trim().endsWith("%") ? number / 100 * scale : number)
    : 0;
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

function linearToSrgb(value: number): number {
  const channel = value <= 0.0031308
    ? 12.92 * value
    : 1.055 * Math.pow(Math.max(0, value), 1 / 2.4) - 0.055;
  return clamp(channel * 255);
}

function xyzToRgb(x: number, y: number, z: number, alpha?: number): Rgb {
  return {
    r: linearToSrgb(3.2406 * x - 1.5372 * y - 0.4986 * z),
    g: linearToSrgb(-0.9689 * x + 1.8758 * y + 0.0415 * z),
    b: linearToSrgb(0.0557 * x - 0.204 * y + 1.057 * z),
    a: alpha,
  };
}

function labToRgb(lightness: number, a: number, b: number, alpha?: number): Rgb {
  const fy = (lightness + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const inverse = (value: number) => value ** 3 > epsilon
    ? value ** 3
    : (116 * value - 16) / kappa;
  const x50 = 0.96422 * inverse(fx);
  const y50 = 1.0 * inverse(fy);
  const z50 = 0.82521 * inverse(fz);
  // Bradford adaptation from the CSS Lab D50 white point to sRGB D65.
  const x = 1.0479298 * x50 + 0.0229468 * y50 - 0.0501922 * z50;
  const y = 0.0296278 * x50 + 0.9904345 * y50 - 0.0170738 * z50;
  const z = -0.009243 * x50 + 0.0150552 * y50 + 0.7518743 * z50;
  return xyzToRgb(x, y, z, alpha);
}

function oklabToRgb(lightness: number, a: number, b: number, alpha?: number): Rgb {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
}

function p3ToRgb(red: number, green: number, blue: number, alpha?: number): Rgb {
  const x = 0.4865709486 * red + 0.2656676937 * green + 0.1982172852 * blue;
  const y = 0.2289745641 * red + 0.6917385218 * green + 0.0792869141 * blue;
  const z = 0.0 * red + 0.0451133819 * green + 1.0439443689 * blue;
  return xyzToRgb(x, y, z, alpha);
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

  const lab = color.match(/^lab\((.+)\)$/i);
  if (lab) {
    const parts = functionParts(lab[1]);
    const slash = parts.indexOf("/");
    const channels = slash === -1 ? parts : parts.slice(0, slash);
    const alpha = slash === -1 ? undefined : parseAlpha(parts[slash + 1]);
    if (channels.length >= 3) {
      return labToRgb(
        parseCssNumber(channels[0], 100),
        parseCssNumber(channels[1], 125),
        parseCssNumber(channels[2], 125),
        alpha,
      );
    }
  }

  const lch = color.match(/^lch\((.+)\)$/i);
  if (lch) {
    const parts = functionParts(lch[1]);
    const slash = parts.indexOf("/");
    const channels = slash === -1 ? parts : parts.slice(0, slash);
    const alpha = slash === -1 ? undefined : parseAlpha(parts[slash + 1]);
    if (channels.length >= 3) {
      const chroma = parseCssNumber(channels[1], 150);
      const hue = parseHue(channels[2]) * Math.PI / 180;
      return labToRgb(
        parseCssNumber(channels[0], 100),
        chroma * Math.cos(hue),
        chroma * Math.sin(hue),
        alpha,
      );
    }
  }

  const oklab = color.match(/^oklab\((.+)\)$/i);
  if (oklab) {
    const parts = functionParts(oklab[1]);
    const slash = parts.indexOf("/");
    const channels = slash === -1 ? parts : parts.slice(0, slash);
    const alpha = slash === -1 ? undefined : parseAlpha(parts[slash + 1]);
    if (channels.length >= 3) {
      return oklabToRgb(
        parseCssNumber(channels[0], 1),
        parseCssNumber(channels[1], 0.4),
        parseCssNumber(channels[2], 0.4),
        alpha,
      );
    }
  }

  const oklch = color.match(/^oklch\((.+)\)$/i);
  if (oklch) {
    const parts = functionParts(oklch[1]);
    const slash = parts.indexOf("/");
    const channels = slash === -1 ? parts : parts.slice(0, slash);
    const alpha = slash === -1 ? undefined : parseAlpha(parts[slash + 1]);
    if (channels.length >= 3) {
      const chroma = parseCssNumber(channels[1], 0.4);
      const hue = parseHue(channels[2]) * Math.PI / 180;
      return oklabToRgb(
        parseCssNumber(channels[0], 1),
        chroma * Math.cos(hue),
        chroma * Math.sin(hue),
        alpha,
      );
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

  const p3 = color.match(/^color\(\s*display-p3\s+(.+)\)$/i);
  if (p3) {
    const parts = functionParts(p3[1]);
    const slash = parts.indexOf("/");
    const channels = slash === -1 ? parts : parts.slice(0, slash);
    const alpha = slash === -1 ? undefined : parseAlpha(parts[slash + 1]);
    if (channels.length >= 3) {
      return p3ToRgb(
        parseCssNumber(channels[0], 1),
        parseCssNumber(channels[1], 1),
        parseCssNumber(channels[2], 1),
        alpha,
      );
    }
  }

  throw new Error(`Unsupported color format: ${input}. Use a CSS color such as a named color, hex, rgb(), hsl(), lab(), lch(), oklch(), or color(display-p3 ...).`);
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
