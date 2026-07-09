import { useEffect } from 'react'
import type { ReviewSettings } from '../lib/settings'

interface SettingsMenuProps {
  open: boolean
  onClose: () => void
  settings: ReviewSettings
  onChange: (patch: Partial<ReviewSettings>) => void
}

const TOGGLES: { key: keyof ReviewSettings; label: string }[] = [
  { key: 'showBestMoveArrow', label: 'Best move arrow' },
  { key: 'showBoardBadges', label: 'Board badges' },
  { key: 'showThreatArrow', label: 'Threat arrow' },
  { key: 'showEngineLines', label: 'Engine lines' },
  { key: 'coachEnabled', label: 'Coach' },
  { key: 'soundEnabled', label: 'Sound' },
  { key: 'autoplay', label: 'Autoplay (Review)' },
]

// chess.com-style gear settings modal: persisted toggles (via useSettings/localStorage) for the
// dead-feature wiring this phase turns on (engine lines, threat arrow) plus the review-as/depth
// selectors. Reuses ThemePicker's overlay-modal shell rather than a small popover — this repo has
// no existing popover primitive and the toggle count doesn't fit comfortably in one anyway.
export function SettingsMenu({ open, onClose, settings, onChange }: SettingsMenuProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-lg border border-cc-border bg-cc-panel shadow-2xl"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-cc-border bg-cc-panel">
          <h2 className="font-heading text-sm font-semibold text-cc-text">Settings</h2>
          <button
            className="px-2 py-1 rounded text-cc-text-dim hover:bg-cc-surface hover:text-cc-text text-sm"
            onClick={onClose}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <section className="space-y-1.5">
            {TOGGLES.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 px-1 py-1 rounded hover:bg-cc-surface/60 cursor-pointer"
              >
                <span className="text-sm text-cc-text">{label}</span>
                <input
                  type="checkbox"
                  checked={settings[key] as boolean}
                  onChange={e => onChange({ [key]: e.target.checked })}
                  className="accent-cc-green w-4 h-4"
                />
              </label>
            ))}
          </section>

          <section className="space-y-1.5 pt-2 border-t border-cc-border/60">
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-sm text-cc-text">Review as</span>
              <select
                value={settings.reviewAs}
                onChange={e => onChange({ reviewAs: e.target.value as ReviewSettings['reviewAs'] })}
                className="bg-cc-surface text-cc-text text-sm rounded px-2 py-1 border border-cc-border"
              >
                <option value="both">Both</option>
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-sm text-cc-text">Analysis depth</span>
              <select
                value={settings.depth}
                onChange={e => onChange({ depth: Number(e.target.value) as ReviewSettings['depth'] })}
                className="bg-cc-surface text-cc-text text-sm rounded px-2 py-1 border border-cc-border"
              >
                <option value={12}>12</option>
                <option value={15}>15</option>
                <option value={18}>18</option>
              </select>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
