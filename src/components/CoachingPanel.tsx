import { useState } from 'react'

interface CoachingPanelProps {
  apiKey: string
  onSaveApiKey: (key: string) => void
  canExplain: boolean
  onExplain: () => void
  explanation: string | null
  isLoading: boolean
  error: string | null
}

export function CoachingPanel({
  apiKey,
  onSaveApiKey,
  canExplain,
  onExplain,
  explanation,
  isLoading,
  error,
}: CoachingPanelProps) {
  const [draft, setDraft] = useState('')

  return (
    <div className="bg-slate-800 rounded p-3 text-sm flex flex-col gap-2">
      <div className="text-slate-400 font-semibold text-xs uppercase tracking-wide">Coaching</div>

      {apiKey === '' ? (
        <form
          className="flex gap-2"
          onSubmit={e => { e.preventDefault(); onSaveApiKey(draft.trim()); setDraft('') }}
        >
          <input
            type="password"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Anthropic API-Key"
            className="flex-1 bg-slate-700 text-slate-100 text-xs rounded px-2 py-1 outline-none border border-slate-600 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={draft.trim() === ''}
            className="px-2 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50"
          >
            Speichern
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={onExplain}
            disabled={!canExplain || isLoading}
            className="px-3 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-40 hover:bg-blue-500 transition-colors"
          >
            {isLoading ? 'Lädt…' : 'Zug erklären'}
          </button>
          <button
            onClick={() => onSaveApiKey('')}
            className="text-slate-500 text-xs hover:text-slate-300"
            title="API-Key entfernen"
          >
            ✕
          </button>
        </div>
      )}

      {isLoading && (
        <div className="text-slate-400 text-xs animate-pulse">Trainer denkt nach…</div>
      )}

      {explanation && !isLoading && (
        <div className="bg-slate-700 rounded p-2 text-slate-200 text-xs leading-relaxed">
          {explanation}
        </div>
      )}

      {error && !isLoading && (
        <div className="text-red-400 text-xs">{error}</div>
      )}
    </div>
  )
}
