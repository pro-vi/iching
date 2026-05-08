// Unicode glyph constants for the casting ritual

export const GLYPHS = {
  coinIdle: "\u25CC",
  coinSpin: ["\u25F4", "\u25F7", "\u25F6", "\u25F5"], // quarter-circle rotation
  coinHeads: "\u25CF", // value 3
  coinTails: "\u25CB", // value 2

  // Yang line center-outward (15 cells)
  yangFrames: [
    "       \u2501       ",
    "      \u2501\u2501\u2501      ",
    "    \u2501\u2501\u2501\u2501\u2501\u2501\u2501    ",
    "   \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501   ",
    "  \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501  ",
    " \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501 ",
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
  ],

  // Yin line center-outward with gap preserved
  yinFrames: [
    "     \u2501   \u2501     ",
    "    \u2501\u2501   \u2501\u2501    ",
    "   \u2501\u2501\u2501   \u2501\u2501\u2501   ",
    "  \u2501\u2501\u2501\u2501   \u2501\u2501\u2501\u2501  ",
    " \u2501\u2501\u2501\u2501\u2501   \u2501\u2501\u2501\u2501\u2501 ",
    "\u2501\u2501\u2501\u2501\u2501\u2501   \u2501\u2501\u2501\u2501\u2501\u2501",
  ],

  changingYangToYin: [
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501 \u2501\u2501\u2501\u2501\u2501\u2501\u2501",
    "\u2501\u2501\u2501\u2501\u2501\u2501   \u2501\u2501\u2501\u2501\u2501\u2501",
  ],
  changingYinToYang: [
    "\u2501\u2501\u2501\u2501\u2501\u2501   \u2501\u2501\u2501\u2501\u2501\u2501",
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501 \u2501\u2501\u2501\u2501\u2501\u2501\u2501",
    "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
  ],

  changingMarkerYang: "\u25CB", // old yang gutter
  changingMarkerYin: "\u00D7", // old yin gutter

  yangFinal: "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
  yinFinal: "\u2501\u2501\u2501\u2501\u2501\u2501   \u2501\u2501\u2501\u2501\u2501\u2501",

  // Settled changing-line finals with inline mark (used by TossScene / inline markStyle)
  yangChangingFinal: "\u2501\u2501\u2501\u2501\u2501\u2501 \u25cf \u2501\u2501\u2501\u2501\u2501\u2501", // \u2501\u2501\u2501\u2501\u2501\u2501 \u25cf \u2501\u2501\u2501\u2501\u2501\u2501
  yinChangingFinal:  "\u2501\u2501\u2501\u2501\u2501\u2501 \u25cb \u2501\u2501\u2501\u2501\u2501\u2501", // \u2501\u2501\u2501\u2501\u2501\u2501 \u25cb \u2501\u2501\u2501\u2501\u2501\u2501
} as const;

/** Width of a hexagram line in characters */
export const LINE_WIDTH = 15;

/** Arrow glyph shown between primary and becoming hexagrams in side-by-side layout */
export const SPLIT_ARROW = "\u21D2"; // ⇒
