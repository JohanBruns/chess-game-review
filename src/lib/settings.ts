export interface ReviewSettings {
  showBestMoveArrow: boolean
  showBoardBadges: boolean
  showThreatArrow: boolean
  showEngineLines: boolean
  coachEnabled: boolean
  soundEnabled: boolean
  autoplay: boolean
  reviewAs: 'white' | 'black' | 'both'
  depth: 12 | 15 | 18
}

export const DEFAULT_SETTINGS: ReviewSettings = {
  showBestMoveArrow: true,
  showBoardBadges: true,
  showThreatArrow: false,
  showEngineLines: false,
  coachEnabled: true,
  soundEnabled: true,
  autoplay: false,
  reviewAs: 'both',
  depth: 15,
}

const BOOLEAN_KEYS = [
  'showBestMoveArrow',
  'showBoardBadges',
  'showThreatArrow',
  'showEngineLines',
  'coachEnabled',
  'soundEnabled',
  'autoplay',
] as const satisfies readonly (keyof ReviewSettings)[]

// Merges a possibly-partial/possibly-corrupt parsed object (e.g. from localStorage, hand-edited
// or written by an older build) with the defaults. Unknown keys are dropped, invalid types/enum
// values fall back to their default instead of propagating garbage into the app.
export function mergeSettings(partial: unknown): ReviewSettings {
  const merged: ReviewSettings = { ...DEFAULT_SETTINGS }
  if (typeof partial !== 'object' || partial === null) return merged
  const p = partial as Record<string, unknown>

  for (const key of BOOLEAN_KEYS) {
    if (typeof p[key] === 'boolean') merged[key] = p[key] as boolean
  }
  if (p.reviewAs === 'white' || p.reviewAs === 'black' || p.reviewAs === 'both') {
    merged.reviewAs = p.reviewAs
  }
  if (p.depth === 12 || p.depth === 15 || p.depth === 18) {
    merged.depth = p.depth
  }
  return merged
}
