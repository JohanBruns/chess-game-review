import { Chess, type Square, type Color, type Move } from 'chess.js'
import { seeGain, PIECE_VAL } from './see'
import { getAttackArrows, type ArrowSquares } from './arrows'
import { winPct } from './classify'
import type { EvalResult } from '../engine/useEngine'
import type { BestPreview } from './review'

// Board coordinates a coach phrase points at when hovered: squares to tint + arrows to draw.
export interface ThemeHighlight {
  squares: Square[]
  arrows: ArrowSquares[]
}

export type ThemeKind =
  | 'allowsMate'
  | 'missedMate'
  | 'mateThreat'
  | 'missedWin'
  | 'hangingPiece'
  | 'fork'
  | 'attacksHigherValue'

export interface TacticalTheme {
  kind: ThemeKind
  // A lowercase clause meant to follow "… — " in a sentence, e.g. "it leaves the rook on a8 hanging".
  description: string
  highlight: ThemeHighlight
}

const PIECE_NAME: Record<string, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
}

// Highest → lowest coach priority. Mate facts dominate, then material (hanging), then
// initiative (fork, single attack). detectThemes returns at most the top two.
const PRIORITY: ThemeKind[] = [
  'allowsMate', 'missedMate', 'mateThreat', 'missedWin', 'hangingPiece', 'fork', 'attacksHigherValue',
]

const HANGING_MIN = 2   // pawn units the opponent must win on a square for it to count as "hanging"

// EvalResult stores cp/mate from White's perspective (see classify.ts). These convert to the
// perspective of the side that just moved, so a positive number always means "good for the mover".
function evalToCp(r: EvalResult): number {
  if (r.cp !== null) return r.cp
  if (r.mate !== null) return r.mate > 0 ? 10000 : -10000
  return 0
}
function moverCp(r: EvalResult, isWhite: boolean): number {
  return isWhite ? evalToCp(r) : -evalToCp(r)
}
function moverMate(r: EvalResult, isWhite: boolean): number | null {
  if (r.mate === null) return null
  return isWhite ? r.mate : -r.mate
}

// Board-fact detectors for a single played move, used to enrich the coach commentary with
// hoverable phrases. Pure geometry + the engine's eval numbers — no re-evaluation. `move` is the
// chess.js verbose move (carries before/after FENs); evalBefore/evalAfter are the engine evals of
// those positions; bestPreview is the engine's best move applied to `move.before`.
export function detectThemes(
  move: Move,
  evalBefore: EvalResult,
  evalAfter: EvalResult,
  bestPreview: BestPreview | null,
): TacticalTheme[] {
  if (!move.color || !move.after) return []
  const isWhite = move.color === 'w'
  const themes: TacticalTheme[] = []

  const mateBefore = moverMate(evalBefore, isWhite)   // move.before: mover to move
  const mateAfter = moverMate(evalAfter, isWhite)     // move.after: opponent to move
  const bestArrow: ArrowSquares | null = bestPreview
    ? { from: bestPreview.from, to: bestPreview.to }
    : null

  // allowsMate — the played move walks into a forced mate against the mover.
  if (mateAfter !== null && mateAfter < 0) {
    themes.push({
      kind: 'allowsMate',
      description: 'it allows a forced mate',
      highlight: { squares: kingSquare(move.after, move.color), arrows: [] },
    })
  }

  // missedMate — a forced mate was on the board before the move, and the move gave it up.
  if (mateBefore !== null && mateBefore > 0 && !(mateAfter !== null && mateAfter > 0)) {
    themes.push({
      kind: 'missedMate',
      description: bestPreview ? `${bestPreview.san} was checkmate` : 'a forced mate was missed',
      highlight: { squares: bestArrow ? [bestArrow.from, bestArrow.to] : [], arrows: bestArrow ? [bestArrow] : [] },
    })
  }

  // mateThreat — the played move sets up a forced mate for the mover; highlight the move itself.
  if (mateAfter !== null && mateAfter > 0 && move.from && move.to) {
    themes.push({
      kind: 'mateThreat',
      description: 'it sets up a forced mate',
      highlight: { squares: [], arrows: [{ from: move.from as Square, to: move.to as Square }] },
    })
  }

  // missedWin — no mate involved, but a clearly winning position slipped to roughly equal.
  const hasMateTheme = themes.some(t => t.kind === 'allowsMate' || t.kind === 'missedMate' || t.kind === 'mateThreat')
  if (!hasMateTheme && mateBefore === null) {
    const winBefore = winPct(moverCp(evalBefore, isWhite))
    const winAfter = winPct(moverCp(evalAfter, isWhite))
    if (winBefore >= 80 && winAfter <= 55) {
      themes.push({
        kind: 'missedWin',
        description: bestPreview ? `${bestPreview.san} was much stronger` : 'a winning move was missed',
        highlight: { squares: bestArrow ? [bestArrow.from, bestArrow.to] : [], arrows: bestArrow ? [bestArrow] : [] },
      })
    }
  }

  const hanging = biggestHangingPiece(move)
  if (hanging) themes.push(hanging)

  const attackTheme = forkOrAttack(move)
  if (attackTheme) themes.push(attackTheme)

  themes.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))
  return themes.slice(0, 2)
}

// After the move (opponent to move), the mover's most valuable piece the opponent can win
// material on via the full capture sequence (SEE). The arrow points from the cheapest attacker.
function biggestHangingPiece(move: Move): TacticalTheme | null {
  if (!move.after || !move.color) return null
  try {
    const chess = new Chess(move.after)
    const opp: Color = move.color === 'w' ? 'b' : 'w'
    let best: { sq: Square; gain: number; type: string } | null = null
    for (const row of chess.board()) {
      for (const p of row) {
        if (!p || p.color !== move.color || p.type === 'k') continue
        const gain = seeGain(move.after, p.square)
        if (gain >= HANGING_MIN && (!best || gain > best.gain)) best = { sq: p.square, gain, type: p.type }
      }
    }
    if (!best) return null
    let from: Square | null = null
    let cheapest = Infinity
    for (const a of chess.attackers(best.sq, opp)) {
      const ap = chess.get(a)
      const v = ap ? PIECE_VAL[ap.type] ?? 0 : 0
      if (v < cheapest) { cheapest = v; from = a }
    }
    return {
      kind: 'hangingPiece',
      description: `it leaves the ${PIECE_NAME[best.type]} on ${best.sq} hanging`,
      highlight: { squares: [best.sq], arrows: from ? [{ from, to: best.sq }] : [] },
    }
  } catch {
    return null
  }
}

// The just-moved piece attacks two winnable targets (a fork), or a single undefended
// higher-value piece (a threat). "Winnable" = a bigger piece, or the enemy king (a check).
function forkOrAttack(move: Move): TacticalTheme | null {
  if (!move.after || !move.to || !move.piece || !move.color) return null
  try {
    const chess = new Chess(move.after)
    const opp: Color = move.color === 'w' ? 'b' : 'w'
    const movedVal = PIECE_VAL[move.piece] ?? 0
    const to = move.to as Square
    const { attacks } = getAttackArrows(move.after, to, move.color)

    const forkTargets: Square[] = []
    for (const s of attacks) {
      const p = chess.get(s)
      if (!p) continue
      if (p.type === 'k' || (PIECE_VAL[p.type] ?? 0) > movedVal) forkTargets.push(s)
    }
    if (forkTargets.length >= 2) {
      return {
        kind: 'fork',
        description: `it forks ${listTargets(chess, forkTargets)}`,
        highlight: { squares: [to, ...forkTargets], arrows: forkTargets.map(t => ({ from: to, to: t })) },
      }
    }

    let bestTarget: { sq: Square; type: string; val: number } | null = null
    for (const s of attacks) {
      const p = chess.get(s)
      if (!p || p.type === 'k') continue
      const val = PIECE_VAL[p.type] ?? 0
      if (val > movedVal && chess.attackers(s, opp).length === 0 && (!bestTarget || val > bestTarget.val)) {
        bestTarget = { sq: s, type: p.type, val }
      }
    }
    if (bestTarget) {
      return {
        kind: 'attacksHigherValue',
        description: `it attacks the ${PIECE_NAME[bestTarget.type]} on ${bestTarget.sq}`,
        highlight: { squares: [bestTarget.sq], arrows: [{ from: to, to: bestTarget.sq }] },
      }
    }
    return null
  } catch {
    return null
  }
}

function listTargets(chess: Chess, squares: Square[]): string {
  const names = squares.map(s => PIECE_NAME[chess.get(s)!.type])
  if (names.length === 2) return `the ${names[0]} and ${names[1]}`
  return `${names.length} pieces`
}

function kingSquare(fen: string, color: Color): Square[] {
  try {
    const chess = new Chess(fen)
    for (const row of chess.board()) {
      for (const p of row) {
        if (p && p.type === 'k' && p.color === color) return [p.square]
      }
    }
  } catch {
    // fall through
  }
  return []
}
