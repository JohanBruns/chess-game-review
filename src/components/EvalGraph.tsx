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
import type { MoveAnalysis, MoveClass } from '../lib/analysis/classify'
import { classColor } from '../lib/analysis/classColors'

interface EvalGraphProps {
  evalResults: (EvalResult | null)[]
  currentPly: number
  onSelectPly: (ply: number) => void
  moveAnalyses?: MoveAnalysis[] | null
}

type DataPoint = { ply: number; cp: number | null }

// Only genuine highlights get a marker dot: the standout good moves (Brilliant, Great) and the
// serious mistakes (Blunder, Miss). Routine classes (Best/Excellent/Good/Inaccuracy/Mistake) are
// intentionally left off so the bar surfaces just the turning points.
const DOT_CLASSES = new Set<MoveClass>(['Brilliant', 'Great', 'Blunder', 'Miss'])

const EVAL_CLAMP = 1000

function clampEval(r: EvalResult): number {
  if (r.cp !== null) return Math.max(-EVAL_CLAMP, Math.min(EVAL_CLAMP, r.cp))
  if (r.mate !== null) return r.mate > 0 ? EVAL_CLAMP : -EVAL_CLAMP
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
  const evalStr = d.cp >= EVAL_CLAMP ? '+M' : d.cp <= -EVAL_CLAMP ? '-M' : formatPawns(d.cp)
  const moveNum = Math.ceil(d.ply / 2)
  const side = d.ply % 2 === 1 ? 'W' : 'S'
  return (
    <div
      style={{
        background: '#1e1c1a',
        color: '#e9e9e8',
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 4,
        border: '1px solid #4a4744',
      }}
    >
      {moveNum > 0 ? `${moveNum}${side}: ` : 'Start: '}
      {evalStr}
    </div>
  )
}

export function EvalGraph({ evalResults, currentPly, onSelectPly, moveAnalyses }: EvalGraphProps) {
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

  // A dot per noteworthy move, drawn at the eval REACHED by that move (fen index moveIndex+1),
  // colored by its classification. moveIndex is 0-based; the post-move eval lives at ply+1.
  const dots = (moveAnalyses ?? [])
    .filter(a => DOT_CLASSES.has(a.classification) && data[a.moveIndex + 1]?.cp != null)
    .map(a => ({ ply: a.moveIndex + 1, cp: data[a.moveIndex + 1]!.cp as number, cls: a.classification }))

  return (
    <div
      style={{
        width: '100%',
        height: 112,
        background: '#262421',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 6, right: 6, left: 6, bottom: 6 }}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          {/* White's share of the bar = the area from the eval curve DOWN to the bottom (like
              the vertical eval bar with White at the bottom); the dark container shows through
              above the curve (Black's share). Higher eval → the white area rises. */}
          <XAxis dataKey="ply" interval={0} hide />
          <YAxis domain={[-EVAL_CLAMP, EVAL_CLAMP]} hide />
          <ReferenceLine y={0} stroke="#5b5854" strokeWidth={1} />
          <ReferenceLine x={currentPly} stroke="#81b64c" strokeWidth={2} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6b6864', strokeWidth: 1 }} />
          <defs>
            {/* Subtle vertical fade on White's territory — solid near the eval curve, softening
                towards the bottom edge, instead of one flat fill opacity. */}
            <linearGradient id="evalAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e9e9e8" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#e9e9e8" stopOpacity={0.75} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="cp"
            baseValue={-EVAL_CLAMP}
            stroke="#c9c9c6"
            strokeWidth={1.25}
            fill="url(#evalAreaFill)"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {dots.map(d => (
            <ReferenceDot
              key={d.ply}
              x={d.ply}
              y={d.cp}
              r={3.4}
              fill={classColor(d.cls)}
              stroke="#1b1a18"
              strokeWidth={0.75}
              isFront
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
