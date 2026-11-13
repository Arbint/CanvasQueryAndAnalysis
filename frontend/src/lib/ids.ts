/**
 * Returns an id that is unique for the life of the page and across saved
 * sessions. Ids must not come from a module-level counter: a counter restarts
 * when its module is hot-reloaded (or when a saved session is loaded with ids
 * from an earlier page), handing out ids that already exist. Duplicate ids make
 * React keys collide and make edits to one item apply to another.
 */
export function uniqueId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID() // only in secure contexts (https or localhost)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${random}`
}
