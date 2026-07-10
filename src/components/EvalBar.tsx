import { winPct } from '../lib/analysis/classify'
import type { EvalResult } from '../lib/engine/useEngine'

function evalToCp(r: EvalResult): number {
  if (r.cp !== null) return r.cp
  if (r.mate !== null) return r.mate > 0 ? 10000 : -10000
  return 0
}

function formatLabel(r: EvalResult): string {
  if (r.mate !== null) return r.mate > 0 ? `+M${r.mate}` : `-M${-r.mate}`
  if (r.cp !== null) {
    if (r.cp >= 10000) return '+M'
    if (r.cp <= -10000) return '-M'
    const p = r.cp / 100
    return p > 0 ? `+${p.toFixed(1)}` : p.toFixed(1)
  }
  return '0.0'
}

// chess.com's eval bar tracks the board: White's (light) portion sits at the bottom in the
// normal view but flips to the top when the board is viewed from Black's side. The eval number
// rides the outer edge of whichever side is leading, always contrasting with that side's fill.
export function EvalBar({
  evalResult,
  orientation = 'white',
}: {
  evalResult: EvalResult | null
  orientation?: 'white' | 'black'
}) {
  const pct = evalResult ? winPct(evalToCp(evalResult)) : 50 // White's win-%
  const label = evalResult ? formatLabel(evalResult) : null

  const whiteAtBottom = orientation === 'white'
  const whiteBar = <div className="bg-cc-text w-full transition-all duration-300" style={{ height: `${pct}%` }} />
  const darkBar = <div className="bg-cc-bg-dark w-full transition-all duration-300" style={{ height: `${100 - pct}%` }} />

  const whiteLeads = pct >= 50
  // Label sits on the leading side's outer edge; that edge is the bottom when the leading side is
  // rendered at the bottom (white leading + white-at-bottom, or black leading + white-at-top).
  const labelAtBottom = whiteLeads === whiteAtBottom

  return (
    <div className="relative flex flex-col w-[22px] self-stretch overflow-hidden rounded-[3px] select-none">
      {whiteAtBottom ? (
        <>
          {darkBar}
          {whiteBar}
        </>
      ) : (
        <>
          {whiteBar}
          {darkBar}
        </>
      )}
      {label && (
        <span
          className="absolute left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold tabular-nums pointer-events-none"
          style={{
            top: labelAtBottom ? undefined : '2px',
            bottom: labelAtBottom ? '2px' : undefined,
            color: whiteLeads ? '#262421' : '#e9e9e8',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
