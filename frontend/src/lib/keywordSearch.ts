/**
 * Keyword search for pick lists: every whitespace-separated keyword must
 * appear (ignoring case) in at least one of the item's fields. An empty
 * query matches everything.
 */
export function matchesKeywords(query: string, ...fields: (string | null | undefined)[]): boolean {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (keywords.length === 0) return true
  const text = fields.filter(Boolean).join('\n').toLowerCase()
  return keywords.every((k) => text.includes(k))
}
