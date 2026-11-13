// Semester filter presets, kept in this browser's local storage so they
// survive reloads. Nothing is written to Canvas.

export interface PresetTerm {
  id: string
  name: string
}

export interface TermPreset {
  id: string
  name: string
  terms: PresetTerm[]
}

const STORAGE_KEY = 'canvas-query.semester-presets'

export function loadTermPresets(): TermPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as TermPreset[]) : []
  } catch {
    return []
  }
}

export function saveTermPresets(presets: TermPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // Storage unavailable (private window, quota): presets last for this page only.
  }
}

export function newPresetId(): string {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Resolves a preset's terms to the term ids of the current account. Terms are
 * matched by name first, since ids can differ between accounts, then by id.
 */
export function resolvePresetTermIds(preset: TermPreset, available: PresetTerm[]): string[] {
  const ids = preset.terms
    .map((term) =>
      available.find((t) => t.name === term.name)?.id ??
      available.find((t) => t.id === term.id)?.id,
    )
    .filter((id): id is string => Boolean(id))
  return [...new Set(ids)]
}
