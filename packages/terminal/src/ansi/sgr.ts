// SGR (Select Graphic Rendition) sequences for color and style

import type { ColorSupport } from "../color/detect.ts";

const CSI = "\x1b[";

// Parse hex color "#RRGGBB" to [r, g, b]
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Convert RGB to nearest ANSI-256 color index
function rgbTo256(r: number, g: number, b: number): number {
  // Check if it's a grayscale (r ≈ g ≈ b)
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  // Map to 6x6x6 color cube (indices 16-231)
  const ri = Math.round(r / 255 * 5);
  const gi = Math.round(g / 255 * 5);
  const bi = Math.round(b / 255 * 5);
  return 16 + 36 * ri + 6 * gi + bi;
}

// Convert RGB to nearest ANSI-16 color index
function rgbTo16(r: number, g: number, b: number): number {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const base = brightness > 128 ? 90 : 30; // bright vs normal
  // Simple heuristic mapping
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 30 && brightness < 50) return base + 0; // black-ish
  if (max - min < 30) return base + 7; // white-ish
  if (r > g && r > b) return base + 1; // red
  if (g > r && g > b) return base + 2; // green
  if (b > r && b > g) return base + 4; // blue
  if (r > b) return base + 3; // yellow
  if (g > r) return base + 6; // cyan
  return base + 5; // magenta
}

/** Produce ANSI SGR sequence for foreground color */
export function fgColor(hex: string, support: ColorSupport): string {
  if (support === "none") return "";
  const [r, g, b] = hexToRgb(hex);
  if (support === "truecolor") return `${CSI}38;2;${r};${g};${b}m`;
  if (support === "256") return `${CSI}38;5;${rgbTo256(r, g, b)}m`;
  return `${CSI}${rgbTo16(r, g, b)}m`;
}

/** Produce ANSI SGR sequence for background color */
export function bgColor(hex: string, support: ColorSupport): string {
  if (support === "none") return "";
  const [r, g, b] = hexToRgb(hex);
  if (support === "truecolor") return `${CSI}48;2;${r};${g};${b}m`;
  if (support === "256") return `${CSI}48;5;${rgbTo256(r, g, b)}m`;
  // For 16-color bg, offset from fg by +10
  const fg16 = rgbTo16(r, g, b);
  const bg16 = fg16 >= 90 ? fg16 - 90 + 100 : fg16 + 10;
  return `${CSI}${bg16}m`;
}

/** Bold SGR */
export function boldStyle(): string {
  return `${CSI}1m`;
}

/** Dim SGR */
export function dimStyle(): string {
  return `${CSI}2m`;
}

/** Reset all styles */
export function resetStyle(): string {
  return `${CSI}0m`;
}
