// Lantern palette — warm flame-and-paper, the core color language

/** Truecolor hex values */
export const LANTERN = {
  ash:        "#6E5840",   // scaffolding, breath, dim prompts
  stone:      "#A89072",   // forming lines
  bone:       "#EBD9B2",   // settled lines, main text (paper lit from within)
  gold:       "#D88A3C",   // active/reveal accent (flame)
  brightGold: "#F0AC54",   // peak pulse
  moon:       "#9CA8A0",   // old yin accent
  vermilion:  "#B05540",   // rare title accent
  jade:       "#7FA08A",   // old yin (brief 2)
  cinnabar:   "#C66838",   // old yang (brief 2)
  mist:       "#6B6052",   // forming coins
  glow:       "#FFE5B0",   // peak brightness
  ink:        "#15110B",   // background (warm dark)
} as const;

/** ANSI-256 fallback indices */
export const LANTERN_256 = {
  ash:        130,   // dark amber
  stone:      137,   // tan
  bone:       223,   // light amber
  gold:       172,   // dark orange
  brightGold: 215,   // light orange
  moon:       108,   // sage gray-green
  vermilion:  131,   // dark red-brown
  jade:       108,   // sage green
  cinnabar:   166,   // bright orange
  mist:       240,   // gray
  glow:       222,   // pale gold
  ink:        233,   // near-black
} as const;

export type LanternColor = keyof typeof LANTERN;
