import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceDot,
  Tooltip,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { EvalResult } from '../lib/engine/useEngine'

interface EvalGraphProps {
  evalResults: (EvalResult | null)[]
  currentPly: number
  onSelectPly: (ply: number) => void
  keyMomentPlies?: number[]
}

type DataPoint = { ply: number; cp: number | null }

function clampEval(r: EvalResult): number {
  if (r.cp !== null) return Math.max(-1000, Math.min(1000, r.cp))
  if (r.mate !== null) return r.mate > 0 ? 1000 : -1000
  return 0
}

function formatPawns(cp: number): string {
  const p = cp / 100
  return p > 0 ? `+${p.toFixed(1)}` : p.toFixed(1)
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as DataPoint
  if (d.cp === null) return null
  const evalStr = d.cp >= 1000 ? '+M' : d.cp <= -1000 ? '-M' : formatPawns(d.cp)
  const moveNum = Math.ceil(d.ply / 2)
  const side = d.ply % 2 === 1 ? 'W' : 'S'
  return (
    <div
      style={{
        background: '#1e293b',
        color: '#f1f5f9',
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 4,
        border: '1px solid #475569',
      }}
    >
      {moveNum > 0 ? `${moveNum}${side}: ` : 'Start: '}
      {evalStr}
    </div>
  )
}

export function EvalGraph({ evalResults, currentPly, onSelectPly, keyMomentPlies }: EvalGraphProps) {
  if (evalResults.length === 0) return null

  const data: DataPoint[] = evalResults.map((r, ply) => ({
    ply,
    cp: r !== null ? clampEval(r) : null,
  }))

  const handleClick = (payload: unknown) => {
    if (
      payload !== null &&
      typeof payload === 'object' &&
      'activePayload' in payload &&
      Array.isArray((payload as { activePayload: unknown[] }).activePayload) &&
      (payload as { activePayload: Array<{ payload: DataPoint }> }).activePayload[0]?.payload
        ?.ply !== undefined
    ) {
      onSelectPly(
        (payload as { activePayload: Array<{ payload: DataPoint }> }).activePayload[0].payload.ply,
      )
    }
  }

  return (
    <div style={{ width: '100%', height: 110 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            <linearGradient id="evalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e2e8f0" stopOpacity={0.9} />
              <stop offset="50%" stopColor="#e2e8f0" stopOpacity={0.25} />
              <stop offset="50%" stopColor="#0f172a" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#0f172a" stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="ply"
            interval={0}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={(ply: number) =>
              ply > 0 && ply % 10 === 0 ? String(Math.round(ply / 2)) : ''
            }
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            height={16}
          />
          <YAxis
            domain={[-1000, 1000]}
            ticks={[-1000, -500, 0, 500, 1000]}
            tickFormatter={(v: number) => (v / 100).toFixed(0)}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
          <ReferenceLine
            x={currentPly}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="3 3"
          />
          <Tooltip content={<CustomTooltip />} />
          {keyMomentPlies?.map(ply => (
            <ReferenceDot
              key={ply}
              x={ply}
              y={data[ply]?.cp ?? 0}
              r={4}
              fill="#ef4444"
              stroke="none"
            />
          ))}
          <Area
            type="monotone"
            dataKey="cp"
            stroke="#94a3b8"
            strokeWidth={1.5}
            fill="url(#evalGradient)"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
