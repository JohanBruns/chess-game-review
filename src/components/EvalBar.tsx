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

export function EvalBar({ evalResult }: { evalResult: EvalResult | null }) {
  const pct = evalResult ? winPct(evalToCp(evalResult)) : 50
  const label = evalResult ? formatLabel(evalResult) : null

  return (
    <div className="relative flex flex-col w-10 self-stretch overflow-hidden rounded-l select-none">
      <div
        className="bg-cc-bg-dark w-full transition-all duration-300"
        style={{ height: `${100 - pct}%` }}
      />
      <div
        className="bg-cc-text w-full transition-all duration-300"
        style={{ height: `${pct}%` }}
      />
      {label && (
        <span
          className="absolute left-1/2 -translate-x-1/2 text-xs font-mono font-bold pointer-events-none"
          style={{ top: pct < 15 ? '2px' : undefined, bottom: pct >= 15 ? '2px' : undefined, color: pct > 50 ? '#262421' : '#e9e9e8' }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
