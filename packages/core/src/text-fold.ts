/**
 * Fold text to a search-comparable key: Unicode NFD, drop combining marks
 * (diacritics), then lowercase. The hexagram search and the journal filter both
 * fold this way, so they agree on exactly what counts as a match.
 */
export function foldForSearch(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
