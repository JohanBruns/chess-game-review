import { useState } from 'react'

interface CoachingPanelProps {
  apiKey: string
  onSaveApiKey: (key: string) => void
  canExplain: boolean
  onExplain: () => void
  explanation: string | null
  isLoading: boolean
  error: string | null
  canShowBestMove: boolean
  showBestMoveArrow: boolean
  onToggleBestMoveArrow: () => void
}

export function CoachingPanel({
  apiKey,
  onSaveApiKey,
  canExplain,
  onExplain,
  explanation,
  isLoading,
  error,
  canShowBestMove,
  showBestMoveArrow,
  onToggleBestMoveArrow,
}: CoachingPanelProps) {
  const [draft, setDraft] = useState('')

  return (
    <div className="bg-cc-panel rounded p-3 text-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-cc-text-dim font-semibold text-xs uppercase tracking-wide">Coaching</div>
        <button
          onClick={onToggleBestMoveArrow}
          disabled={!canShowBestMove}
          aria-pressed={showBestMoveArrow}
          className={`px-3 py-1 rounded text-xs disabled:opacity-40 transition-colors ${
            showBestMoveArrow
              ? 'bg-cc-green text-white hover:bg-cc-green-hover'
              : 'bg-cc-surface text-cc-text-dim hover:bg-cc-surface-hover'
          }`}
        >
          Best
        </button>
      </div>

      {apiKey === '' ? (
        <form
          className="flex gap-2"
          onSubmit={e => { e.preventDefault(); onSaveApiKey(draft.trim()); setDraft('') }}
        >
          <input
            type="password"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Anthropic API key"
            className="flex-1 bg-cc-surface text-cc-text text-xs rounded px-2 py-1 outline-none border border-cc-border focus:border-cc-green"
          />
          <button
            type="submit"
            disabled={draft.trim() === ''}
            className="px-2 py-1 rounded bg-cc-green text-white text-xs disabled:opacity-50"
          >
            Save
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={onExplain}
            disabled={!canExplain || isLoading}
            className="px-3 py-1 rounded bg-cc-green text-white text-xs disabled:opacity-40 hover:bg-cc-green-hover transition-colors"
          >
            {isLoading ? 'Loading…' : 'Explain Move'}
          </button>
          <button
            onClick={() => onSaveApiKey('')}
            className="text-cc-text-faint text-xs hover:text-cc-text-dim"
            title="Remove API key"
          >
            ✕
          </button>
        </div>
      )}

      {isLoading && (
        <div className="text-cc-text-dim text-xs animate-pulse">Coach is thinking…</div>
      )}

      {explanation && !isLoading && (
        <div className="bg-cc-surface rounded p-2 text-cc-text text-xs leading-relaxed">
          {explanation}
        </div>
      )}

      {error && !isLoading && (
        <div className="text-cc-red text-xs">{error}</div>
      )}
    </div>
  )
}
