import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, mergeSettings, type ReviewSettings } from '../lib/settings'

const SETTINGS_KEY = 'gr.settings'

function readSettings(): ReviewSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) return mergeSettings(JSON.parse(stored))
  } catch {
    // localStorage unavailable (private mode / SSR) or corrupt JSON — fall through to defaults.
  }
  return { ...DEFAULT_SETTINGS }
}

export interface UseSettingsResult {
  settings: ReviewSettings
  updateSettings: (patch: Partial<ReviewSettings>) => void
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<ReviewSettings>(readSettings)

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* ignore */ }
  }, [settings])

  const updateSettings = useCallback((patch: Partial<ReviewSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
  }, [])

  return { settings, updateSettings }
}
