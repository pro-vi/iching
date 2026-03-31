// Simple word-wrap utility for terminal text

import { stringWidth } from "../../layout/measure.ts";

/** Wrap text to fit within maxWidth, breaking at spaces */
export function wordWrap(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [];
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const para of paragraphs) {
    if (para.length === 0) {
      lines.push("");
      continue;
    }

    const words = para.split(/\s+/);
    let currentLine = "";
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = stringWidth(word);
      if (currentLine.length === 0) {
        currentLine = word;
        currentWidth = wordWidth;
      } else if (currentWidth + 1 + wordWidth <= maxWidth) {
        currentLine += " " + word;
        currentWidth += 1 + wordWidth;
      } else {
        lines.push(currentLine);
        currentLine = word;
        currentWidth = wordWidth;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines;
}
