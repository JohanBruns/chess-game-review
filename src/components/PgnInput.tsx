import { useState } from 'react'

interface PgnInputProps {
  onLoad: (pgn: string) => void
  error: string | null
}

export function PgnInput({ onLoad, error }: PgnInputProps) {
  const [value, setValue] = useState('')

  return (
    <div className="flex gap-2 items-start px-3 py-2 border-b border-cc-border bg-cc-panel/40 shrink-0">
      <textarea
        className="flex-1 h-12 resize-none bg-cc-panel text-cc-text font-mono text-xs p-2 rounded border border-cc-border focus:outline-none focus:border-cc-green"
        placeholder="Paste PGN here…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      <div className="flex flex-col gap-1 shrink-0">
        <button
          className="px-3 py-1.5 bg-cc-green hover:bg-cc-green-hover text-white rounded font-medium text-sm disabled:opacity-40 whitespace-nowrap"
          disabled={value.trim() === ''}
          onClick={() => onLoad(value)}
        >
          Load
        </button>
        {error && (
          <span className="text-cc-red text-[11px] leading-tight max-w-[220px]">{error}</span>
        )}
      </div>
    </div>
  )
}
