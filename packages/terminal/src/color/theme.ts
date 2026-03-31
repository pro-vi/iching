// Theme — design token interface and preset themes

/** Semantic color tokens used across all renderers */
export interface Theme {
  name: string;

  // Core hierarchy
  bg:       string;  // background
  primary:  string;  // main text, settled content
  secondary: string; // forming content, secondary text
  tertiary: string;  // hints, dim prompts
  accent:   string;  // active/reveal moments

  // Hexagram-specific
  yangLine:     string;  // settled yang line
  yinLine:      string;  // settled yin line
  changingYang: string;  // old yang marker/pulse
  changingYin:  string;  // old yin marker/pulse
  glow:         string;  // peak brightness

  // UI
  selected:  string;  // selected/focused item
  dimmed:    string;  // very dim, almost invisible
  border:    string;  // separators, borders
}

// ── Temple Night ──────────────────────────────────────────
// Warm, earthy. Bone and gold on dark ink.

export const THEME_TEMPLE_NIGHT: Theme = {
  name: "temple-night",
  bg:          "#111318",
  primary:     "#E8DECE",
  secondary:   "#9E9489",
  tertiary:    "#6E665E",
  accent:      "#C89D4B",
  yangLine:    "#E8DECE",
  yinLine:     "#E8DECE",
  changingYang: "#C89D4B",
  changingYin:  "#A6B3BC",
  glow:        "#F6EFD8",
  selected:    "#E1B866",
  dimmed:      "#3A3630",
  border:      "#4A453E",
};

// ── Ink ───────────────────────────────────────────────────
// Pure monochrome. Yin and yang. Black and white.

export const THEME_INK: Theme = {
  name: "ink",
  bg:          "#0A0A0F",
  primary:     "#E0E0E0",
  secondary:   "#A0A0A0",
  tertiary:    "#606060",
  accent:      "#FFFFFF",
  yangLine:    "#E0E0E0",
  yinLine:     "#E0E0E0",
  changingYang: "#FFFFFF",
  changingYin:  "#B0B0B0",
  glow:        "#FFFFFF",
  selected:    "#FFFFFF",
  dimmed:      "#2A2A2A",
  border:      "#404040",
};

// ── Dawn ──────────────────────────────────────────────────
// Warm paper. Like reading by morning light.

export const THEME_DAWN: Theme = {
  name: "dawn",
  bg:          "#1A1612",
  primary:     "#D4C4A8",
  secondary:   "#A09080",
  tertiary:    "#6E6050",
  accent:      "#C8A060",
  yangLine:    "#D4C4A8",
  yinLine:     "#D4C4A8",
  changingYang: "#D4A850",
  changingYin:  "#90A0A8",
  glow:        "#EDE0C8",
  selected:    "#E0C080",
  dimmed:      "#302820",
  border:      "#483E30",
};

// ── Jade ──────────────────────────────────────────────────
// Cool, contemplative. Stone and water.

export const THEME_JADE: Theme = {
  name: "jade",
  bg:          "#0C1210",
  primary:     "#C0D0C8",
  secondary:   "#80A098",
  tertiary:    "#506860",
  accent:      "#88C0A0",
  yangLine:    "#C0D0C8",
  yinLine:     "#C0D0C8",
  changingYang: "#A0D8B8",
  changingYin:  "#7898A8",
  glow:        "#D8F0E0",
  selected:    "#A0D8B8",
  dimmed:      "#1A2820",
  border:      "#304840",
};

// ── Registry ─────────────────────────────────────────────

export type ThemeName = "temple-night" | "ink" | "dawn" | "jade";

export const THEMES: Record<ThemeName, Theme> = {
  "temple-night": THEME_TEMPLE_NIGHT,
  "ink": THEME_INK,
  "dawn": THEME_DAWN,
  "jade": THEME_JADE,
};

export const THEME_NAMES: ThemeName[] = ["temple-night", "ink", "dawn", "jade"];

// ── Active theme ─────────────────────────────────────────
// Runtime-switchable. Defaults to temple-night.

let activeTheme: Theme = THEME_TEMPLE_NIGHT;

export function getTheme(): Theme {
  return activeTheme;
}

export function setTheme(name: ThemeName): void {
  activeTheme = THEMES[name] ?? THEME_TEMPLE_NIGHT;
}
