// Temple Night palette — the core color language for the I Ching CLI

/** Truecolor hex values */
export const TEMPLE_NIGHT = {
  ash:        "#6E665E",   // scaffolding, breath, dim prompts
  stone:      "#9E9489",   // forming lines
  bone:       "#E8DECE",   // settled lines, main text
  gold:       "#C89D4B",   // active/reveal accent
  brightGold: "#E1B866",   // peak pulse
  moon:       "#A6B3BC",   // old yin accent
  vermilion:  "#A65A4D",   // rare title accent
  jade:       "#7FA08A",   // old yin (brief 2)
  cinnabar:   "#B96A4A",   // old yang (brief 2)
  mist:       "#6B6F76",   // forming coins
  glow:       "#F6EFD8",   // peak brightness
  ink:        "#111318",   // background (alt screen only)
} as const;

/** ANSI-256 fallback indices for each Temple Night color */
export const TEMPLE_NIGHT_256 = {
  ash:        243,   // gray
  stone:      246,   // lighter gray
  bone:       253,   // near-white warm
  gold:       178,   // dark goldenrod
  brightGold: 179,   // light goldenrod
  moon:       110,   // steel blue
  vermilion:  131,   // dark red-brown
  jade:       108,   // sage green
  cinnabar:   173,   // dark orange
  mist:       243,   // gray
  glow:       230,   // cornsilk
  ink:        233,   // near-black
} as const;

export type TempleNightColor = keyof typeof TEMPLE_NIGHT;
