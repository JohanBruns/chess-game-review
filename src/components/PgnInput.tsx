import { useState } from 'react'

interface PgnInputProps {
  onLoad: (pgn: string) => void
  error: string | null
}

export function PgnInput({ onLoad, error }: PgnInputProps) {
  const [value, setValue] = useState('')

  return (
    <div className="flex gap-2 items-start px-3 py-2 border-b border-slate-700 bg-slate-800/40 shrink-0">
      <textarea
        className="flex-1 h-12 resize-none bg-slate-800 text-slate-100 font-mono text-xs p-2 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
        placeholder="PGN hier einfügen…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      <div className="flex flex-col gap-1 shrink-0">
        <button
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm disabled:opacity-40 whitespace-nowrap"
          disabled={value.trim() === ''}
          onClick={() => onLoad(value)}
        >
          Laden
        </button>
        {error && (
          <span className="text-red-400 text-[11px] leading-tight max-w-[220px]">{error}</span>
        )}
      </div>
    </div>
  )
}
