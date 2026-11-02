import { useState } from 'react'

interface PgnInputProps {
  onLoad: (pgn: string) => void
  error: string | null
}

export function PgnInput({ onLoad, error }: PgnInputProps) {
  const [value, setValue] = useState('')

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <textarea
        className="h-24 resize-none bg-black/20 text-white font-mono text-xs p-2 rounded-[5px] border border-white/10 placeholder:text-white/40 focus:outline-none focus:border-cc-green"
        placeholder="Paste PGN here…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      <div className="flex flex-col gap-1">
        <button
          className="cc-btn-primary h-10 rounded-[5px] text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
          disabled={value.trim() === ''}
          onClick={() => onLoad(value)}
        >
          Load
        </button>
        {error && (
          <span className="text-cc-red text-[11px] leading-tight">{error}</span>
        )}
      </div>
    </div>
  )
}
