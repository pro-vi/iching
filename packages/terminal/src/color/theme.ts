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

// ── Bone ──────────────────────────────────────────────────
// Aged ivory. Oracle bone, archaeological calm.

export const THEME_BONE: Theme = {
  name: "bone",
  bg:          "#161310",
  primary:     "#DCCFB5",
  secondary:   "#A0907C",
  tertiary:    "#6C6050",
  accent:      "#C0A078",
  yangLine:    "#DCCFB5",
  yinLine:     "#DCCFB5",
  changingYang: "#D4B488",
  changingYin:  "#98A8A8",
  glow:        "#E8DBC0",
  selected:    "#D4B488",
  dimmed:      "#2C2418",
  border:      "#443A2E",
};

// ── Cinnabar ──────────────────────────────────────────────
// Seal-ink red on rice paper. Ritual, vivid.

export const THEME_CINNABAR: Theme = {
  name: "cinnabar",
  bg:          "#14100C",
  primary:     "#ECDDBC",
  secondary:   "#A89070",
  tertiary:    "#6A5A40",
  accent:      "#B83020",
  yangLine:    "#ECDDBC",
  yinLine:     "#ECDDBC",
  changingYang: "#D44A30",
  changingYin:  "#9CA8A0",
  glow:        "#F8E5B0",
  selected:    "#C84028",
  dimmed:      "#3A2418",
  border:      "#4E3424",
};

// ── Jade ──────────────────────────────────────────────────
// Cool stone. Contemplative green.

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

// ── River ─────────────────────────────────────────────────
// Cool water. Slow, deep blue.

export const THEME_RIVER: Theme = {
  name: "river",
  bg:          "#0A1218",
  primary:     "#C8D4DC",
  secondary:   "#7898A8",
  tertiary:    "#4E6878",
  accent:      "#5A98B8",
  yangLine:    "#C8D4DC",
  yinLine:     "#C8D4DC",
  changingYang: "#7AB0C8",
  changingYin:  "#A0B8C0",
  glow:        "#D8E8F0",
  selected:    "#7AB0C8",
  dimmed:      "#1A2228",
  border:      "#2C3A48",
};

// ── Registry ─────────────────────────────────────────────

export type ThemeName = "ink" | "bone" | "cinnabar" | "jade" | "river";

export const THEMES: Record<ThemeName, Theme> = {
  "ink": THEME_INK,
  "bone": THEME_BONE,
  "cinnabar": THEME_CINNABAR,
  "jade": THEME_JADE,
  "river": THEME_RIVER,
};

export const THEME_NAMES: ThemeName[] = ["ink", "bone", "cinnabar", "jade", "river"];

// ── Active theme ─────────────────────────────────────────
// Runtime-switchable. Defaults to bone.

let activeTheme: Theme = THEME_BONE;

export function getTheme(): Theme {
  return activeTheme;
}

export function setTheme(name: ThemeName): void {
  activeTheme = THEMES[name] ?? THEME_BONE;
}
