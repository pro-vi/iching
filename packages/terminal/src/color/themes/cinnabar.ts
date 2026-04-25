// Cinnabar palette — seal-ink red on rice paper

/** Truecolor hex values */
export const CINNABAR = {
  ash:        "#6A5A40",   // scaffolding, breath, dim prompts
  stone:      "#A89070",   // forming lines
  bone:       "#ECDDBC",   // settled lines, main text (paper)
  gold:       "#B83020",   // active/reveal accent (cinnabar/seal red)
  brightGold: "#D44A30",   // peak pulse
  moon:       "#9CA8A0",   // old yin accent
  vermilion:  "#A82A1C",   // rare title accent (deeper)
  jade:       "#7FA08A",   // old yin (brief 2)
  cinnabar:   "#C84028",   // old yang (brief 2)
  mist:       "#6B6052",   // forming coins
  glow:       "#F8E5B0",   // peak brightness
  ink:        "#14100C",   // background (warm dark)
} as const;

/** ANSI-256 fallback indices */
export const CINNABAR_256 = {
  ash:        130,   // dark amber
  stone:      137,   // tan
  bone:       223,   // light amber
  gold:       124,   // dark red
  brightGold: 160,   // bright red
  moon:       108,   // sage gray-green
  vermilion:  88,    // deep red
  jade:       108,   // sage green
  cinnabar:   160,   // bright red
  mist:       240,   // gray
  glow:       222,   // pale gold
  ink:        233,   // near-black
} as const;

export type CinnabarColor = keyof typeof CINNABAR;
