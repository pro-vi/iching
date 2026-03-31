// Word-wrap utility for terminal text, handles both Latin and CJK

import { stringWidth } from "../../layout/measure.ts";

/** Wrap text to fit within maxWidth, breaking at spaces or between CJK chars */
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

      // If the word fits on the current line, append it
      if (currentLine.length === 0) {
        if (wordWidth <= maxWidth) {
          currentLine = word;
          currentWidth = wordWidth;
        } else {
          // Word exceeds maxWidth — break it character by character
          breakLongWord(word, maxWidth, lines);
          currentLine = "";
          currentWidth = 0;
          // The last partial line from breakLongWord is already pushed
          // Check if there's a remainder to continue with
          continue;
        }
      } else if (currentWidth + 1 + wordWidth <= maxWidth) {
        currentLine += " " + word;
        currentWidth += 1 + wordWidth;
      } else {
        lines.push(currentLine);
        if (wordWidth <= maxWidth) {
          currentLine = word;
          currentWidth = wordWidth;
        } else {
          breakLongWord(word, maxWidth, lines);
          currentLine = "";
          currentWidth = 0;
        }
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/** Break a word that exceeds maxWidth into multiple lines */
function breakLongWord(word: string, maxWidth: number, lines: string[]): void {
  let current = "";
  let currentWidth = 0;

  for (const ch of word) {
    const w = stringWidth(ch);
    if (currentWidth + w > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
      currentWidth = w;
    } else {
      current += ch;
      currentWidth += w;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }
}
