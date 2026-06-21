// ANSI control prefixes. CSI (the Control Sequence Introducer, ESC + '[')
// begins every cursor/screen/SGR escape this package emits, so the two ansi
// modules share one definition rather than each spelling the bytes.
const ESC = "\x1b";
export const CSI = `${ESC}[`;
