// @iching/terminal — ANSI renderer, animation engine, scenes

// ANSI escape codes
export {
  cursorTo,
  cursorUp,
  cursorDown,
  cursorForward,
  cursorBack,
  cursorHome,
  hideCursor,
  showCursor,
  clearScreen,
  clearLine,
  clearToEndOfLine,
  altScreenOn,
  altScreenOff,
} from "./ansi/codes.ts";

// SGR color/style
export {
  fgColor,
  bgColor,
  boldStyle,
  dimStyle,
  resetStyle,
} from "./ansi/sgr.ts";

// Color detection
export { detectColorSupport, type ColorSupport } from "./color/detect.ts";

// Cinnabar palette (legacy direct access)
export {
  CINNABAR,
  CINNABAR_256,
  type CinnabarColor,
} from "./color/themes/cinnabar.ts";

// Theme system
export {
  getTheme,
  setTheme,
  THEMES,
  THEME_NAMES,
  type Theme,
  type ThemeName,
} from "./color/theme.ts";

// Render: cell, buffer, diff
export { type StyledCell, EMPTY_CELL, cellsEqual } from "./render/cell.ts";
export { CellBuffer } from "./render/buffer.ts";
export { DiffRenderer } from "./render/diff-render.ts";
export { centerBlock, writeBlockCentered } from "./render/rasterize.ts";

// Input
export { type KeyEvent, type ParseResult, parseKey, parseKeyWithLength, KeyParser } from "./input/key-parser.ts";
export { enableRawMode, readKeys } from "./input/raw-input.ts";

// Layout
export { stringWidth, centerPad } from "./layout/measure.ts";

// Session
export { TerminalSession } from "./session/terminal-session.ts";

// Clock
export { type Clock, RealClock, ManualClock } from "./clock.ts";

// Animation: easing
export { type EasingFn, linear, easeIn, easeOut, easeInOut } from "./animation/easing.ts";

// Animation: timeline DSL
export {
  type Step,
  seq,
  par,
  wait,
  call,
  tween,
  stepDuration,
} from "./animation/timeline.ts";

// Animation: runner
export { TimelineRunner } from "./animation/runner.ts";

// Animation: motion presets
export {
  type RitualTiming,
  type MotionPreset,
  getPreset,
} from "./animation/presets.ts";

// Animation: yarrow ritual timing
export {
  type RitualDetail,
  type YarrowTiming,
  getYarrowTiming,
} from "./animation/yarrow-presets.ts";

// Scene
export {
  type SceneContext,
  type SceneSignal,
  type Scene,
} from "./scene/types.ts";

export { runScene } from "./scene/loop.ts";

// Glyphs
export { GLYPHS, LINE_WIDTH, SPLIT_ARROW } from "./glyphs.ts";

// Scenes: casting ritual
export { CastScene, type CastGlyphInput } from "./scenes/cast/cast-scene.ts";
export { CastModel } from "./scenes/cast/model.ts";
export { renderCoins, coinSpinGlyph, coinLandGlyph } from "./scenes/cast/coin-renderer.ts";
export { renderLine, lineFrame } from "./scenes/cast/line-renderer.ts";
export { renderHexagram, anchorRow, LINE_ROW_OFFSETS } from "./scenes/cast/hexagram-renderer.ts";
export { renderTitle, renderBecomingTitle } from "./scenes/cast/reveal-renderer.ts";
export { renderMorph, morphFrame } from "./scenes/cast/morph-renderer.ts";
export { renderRightHexagram, renderRightMorph } from "./scenes/cast/right-hex-renderer.ts";
export { buildCastTimeline, type CastGlyphConfig } from "./scenes/cast/timeline-builder.ts";
export { renderLargeGlyph } from "./scenes/cast/glyph-renderer.ts";
export { canSplit, hexColOffset, MIN_SPLIT_WIDTH, SPLIT_OFFSET, ARROW_GAP } from "./scenes/cast/layout-calc.ts";

// Scenes: home menu
export { HomeScene, type HomeState } from "./scenes/home/home-scene.ts";
export { type TaijituStyle } from "./scenes/home/taijitu-render.ts";

// Scenes: intention
export { IntentionScene } from "./scenes/intention/intention-scene.ts";


// Scenes: journal (placeholder)
export { JournalScene } from "./scenes/journal/journal-scene.ts";

// Scenes: toss playground
export { TossScene } from "./scenes/toss/toss-scene.ts";

// Widgets
export { ScrollableRegion } from "./widgets/scrollable.ts";
export { TextInput } from "./widgets/text-input.ts";

// Scene router
export { SceneRouter, type SceneFactory } from "./scene/router.ts";

// Glyph animations
export type { GlyphAnimator, GlyphAnimStyle } from "./glyph-anim/types.ts";
export { createGlyphAnimator } from "./glyph-anim/factory.ts";
export { composeGlyph } from "./glyph-anim/compose.ts";
export { NoiseAnimator } from "./glyph-anim/noise.ts";
export { DotsAnimator } from "./glyph-anim/dots.ts";
export { RadialAnimator } from "./glyph-anim/radial.ts";
export { SandAnimator } from "./glyph-anim/sand.ts";
// Scenes: settings
export { SettingsScene, type SettingsValues } from "./scenes/settings/settings-scene.ts";

// Scenes: dictionary
export { BrowseScene } from "./scenes/dict/browse-scene.ts";
export { BrowseModel } from "./scenes/dict/browse-model.ts";
export { DetailScene, type DetailGlyphConfig } from "./scenes/dict/detail-scene.ts";
export { DetailModel } from "./scenes/dict/detail-model.ts";
export { wordWrap } from "./scenes/dict/word-wrap.ts";
