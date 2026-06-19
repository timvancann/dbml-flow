/** Remove the token at index i from a whitespace-separated selector string. */
export function removeTokenAt(selector: string, index: number): string {
  const tokens = selector.trim().split(/\s+/);
  return tokens.filter((_, j) => j !== index).join(' ');
}
