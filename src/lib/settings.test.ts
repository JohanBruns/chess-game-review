import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, mergeSettings } from './settings'

describe('mergeSettings', () => {
  it('returns defaults for non-object input', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(mergeSettings('nonsense')).toEqual(DEFAULT_SETTINGS)
    expect(mergeSettings(42)).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid overrides', () => {
    const merged = mergeSettings({ showBestMoveArrow: false, reviewAs: 'black', depth: 18 })
    expect(merged.showBestMoveArrow).toBe(false)
    expect(merged.reviewAs).toBe('black')
    expect(merged.depth).toBe(18)
    // Untouched keys still get their defaults (forward-compat with a partial/old payload).
    expect(merged.coachEnabled).toBe(DEFAULT_SETTINGS.coachEnabled)
  })

  it('ignores unknown keys', () => {
    const merged = mergeSettings({ someFutureKey: true, coachEnabled: false })
    expect(merged.coachEnabled).toBe(false)
    expect((merged as unknown as Record<string, unknown>).someFutureKey).toBeUndefined()
  })

  it('drops invalid enum values, falling back to defaults', () => {
    const merged = mergeSettings({ reviewAs: 'purple', depth: 99 })
    expect(merged.reviewAs).toBe(DEFAULT_SETTINGS.reviewAs)
    expect(merged.depth).toBe(DEFAULT_SETTINGS.depth)
  })

  it('drops invalid boolean types, falling back to defaults', () => {
    const merged = mergeSettings({ showBoardBadges: 'yes', soundEnabled: 1 })
    expect(merged.showBoardBadges).toBe(DEFAULT_SETTINGS.showBoardBadges)
    expect(merged.soundEnabled).toBe(DEFAULT_SETTINGS.soundEnabled)
  })

  it('round-trips a full valid settings object unchanged', () => {
    const custom: typeof DEFAULT_SETTINGS = {
      showBestMoveArrow: false,
      showBoardBadges: false,
      showThreatArrow: true,
      showEngineLines: true,
      coachEnabled: false,
      soundEnabled: false,
      autoplay: true,
      reviewAs: 'white',
      depth: 12,
    }
    expect(mergeSettings(custom)).toEqual(custom)
  })
})
