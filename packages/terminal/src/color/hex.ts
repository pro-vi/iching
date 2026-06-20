// Parse a "#RRGGBB" (or "RRGGBB") hex color into its [r, g, b] byte components.
// Shared by ansi/sgr (quantization) and color/lerp (interpolation) so they agree
// on how a hex string decomposes.
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
