import { formatClock } from '../lib/analysis/clocks'
import { usePlayerAvatar } from '../hooks/usePlayerAvatar'
import { IconClock, PawnAvatar } from './icons'

interface PlayerBarProps {
  name: string
  elo?: number
  // Static "as of the current ply" reading (see remainingClockSeconds) — chess.com's Game
  // Review doesn't tick a live countdown, it just shows the clock as it stood at that point.
  clockSeconds: number | null
  side: 'white' | 'black'
  // This side is to move in the shown position — chess.com marks that clock with a clock icon
  // and fades the other one.
  active: boolean
  // Position shown on the board; the captured-pieces row is derived from its material.
  fen: string
  piecesBasePath: string
}

const PIECE_ORDER = ['p', 'n', 'b', 'r', 'q'] as const
const START_COUNT: Record<(typeof PIECE_ORDER)[number], number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }
const PIECE_VALUE: Record<(typeof PIECE_ORDER)[number], number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }

function countPieces(fen: string) {
  const board = fen.split(' ')[0]
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } }
  for (const ch of board) {
    const lower = ch.toLowerCase() as (typeof PIECE_ORDER)[number]
    if (!(lower in START_COUNT)) continue
    counts[ch === lower ? 'b' : 'w'][lower]++
  }
  return counts
}

// Pieces this side has taken off the board (the opponent's missing material, in chess.com's
// pawn→queen order) and this side's material lead in pawns (0 when not ahead).
function capturedFor(fen: string, side: 'white' | 'black') {
  const counts = countPieces(fen)
  const own = side === 'white' ? counts.w : counts.b
  const opp = side === 'white' ? counts.b : counts.w
  const captured = PIECE_ORDER.flatMap(t =>
    Array.from({ length: Math.max(0, START_COUNT[t] - opp[t]) }, () => t),
  )
  const material = (c: typeof own) => PIECE_ORDER.reduce((s, t) => s + c[t] * PIECE_VALUE[t], 0)
  return { captured, lead: Math.max(0, material(own) - material(opp)) }
}

// Opponent-above / self-below strip framing the board, measured against chess.com's Game Review
// (1440x900): 40px tall, 40px avatar, bold 14px name + dimmed rating on the first line, captured
// pieces on the second, and a 135x40 clock box (white side light, black side dark) on the right
// (106px wide on phones).
export function PlayerBar({ name, elo, clockSeconds, side, active, fen, piecesBasePath }: PlayerBarProps) {
  const avatar = usePlayerAvatar(name)
  const { captured, lead } = capturedFor(fen, side)
  // The captured pieces are the OPPONENT's color.
  const capturedColor = side === 'white' ? 'b' : 'w'

  return (
    <div className="h-10 flex items-center gap-2.5 min-w-0">
      <div className="w-10 h-10 shrink-0 rounded-[3px] overflow-hidden">
        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <PawnAvatar />}
      </div>
      <div className="flex-1 min-w-0 h-10 flex flex-col justify-start pt-0.5">
        <div className="flex items-baseline gap-1 text-sm leading-4 truncate">
          <span className="font-semibold text-white truncate">{name}</span>
          {elo != null && <span className="text-white/72">({elo})</span>}
        </div>
        <div className="h-5 flex items-center">
          {captured.map((t, i) => (
            <img
              key={i}
              src={`${piecesBasePath}/${capturedColor}${t}.png`}
              alt=""
              className={`w-[18px] h-[18px] ${i > 0 && captured[i - 1] === t ? '-ml-2.5' : i > 0 ? 'ml-0.5' : ''}`}
            />
          ))}
          {lead > 0 && <span className="ml-1 text-xs text-white/50">+{lead}</span>}
        </div>
      </div>
      {clockSeconds != null && (
        <div
          className={`shrink-0 w-[106px] md:w-[135px] h-10 rounded-[3px] flex items-center justify-end ${
            side === 'white' ? 'bg-white text-[#262421]' : 'bg-[#262421] text-white'
          } ${active ? '' : 'opacity-50'}`}
        >
          {active && <IconClock size={24} className="mr-auto ml-1.5" />}
          <span className="px-2.5 text-2xl tabular-nums">{formatClock(clockSeconds)}</span>
        </div>
      )}
    </div>
  )
}
