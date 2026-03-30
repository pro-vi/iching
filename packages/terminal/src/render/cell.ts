// StyledCell — the atomic unit of the terminal rendering grid

export type StyledCell = {
  char: string;     // single character (or space)
  fg?: string;      // hex color "#C8A96B"
  bg?: string;      // hex color
  bold?: boolean;
  dim?: boolean;
};

/** Default empty cell */
export const EMPTY_CELL: StyledCell = { char: " " };

/** Compare two cells for equality */
export function cellsEqual(a: StyledCell, b: StyledCell): boolean {
  return (
    a.char === b.char &&
    a.fg === b.fg &&
    a.bg === b.bg &&
    (a.bold ?? false) === (b.bold ?? false) &&
    (a.dim ?? false) === (b.dim ?? false)
  );
}
