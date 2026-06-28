import { useState } from 'react'

interface PgnInputProps {
  onLoad: (pgn: string) => void
  error: string | null
}

export function PgnInput({ onLoad, error }: PgnInputProps) {
  const [value, setValue] = useState('')

  return (
    <div className="p-4 flex flex-col gap-2">
      <textarea
        className="w-full h-28 resize-y bg-slate-800 text-slate-100 font-mono text-sm p-2 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
        placeholder="PGN hier einfügen…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      <div className="flex items-center gap-4">
        <button
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm disabled:opacity-40"
          disabled={value.trim() === ''}
          onClick={() => onLoad(value)}
        >
          Laden
        </button>
        {error && (
          <span className="text-red-400 text-sm">{error}</span>
        )}
      </div>
    </div>
  )
}
