import { Chess, type Move } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'

export type MoveClass =
  | 'Book'
  | 'Brilliant'
  | 'Great'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Blunder'
  | 'Miss'
  | 'Forced'

export interface MoveAnalysis {
  moveIndex: number
  lossInWinPct: number
  classification: MoveClass
  accuracy: number
  winPctAfterRaw?: number   // mover-perspective post-move win%; feeds T5 volatility trajectory
}

export function moveAccuracy(lossInWinPct: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * lossInWinPct) - 3.1669
  return Math.min(100, Math.max(0, raw))
}

// Population standard deviation — used to weight per-move accuracy by local win% volatility.
function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// Lichess/chess.com-style game accuracy: mean of a volatility-weighted mean and a harmonic
// mean over the player's non-Book/non-Forced moves, instead of a plain arithmetic mean.
// The harmonic mean punishes a single big blunder among otherwise-strong moves; the
// volatility weighting gives more weight to accuracy in sharp (high win%-swing) positions.
export function playerAccuracy(
  analyses: MoveAnalysis[],
  player: 'white' | 'black',
): number | null {
  // White-perspective win% trajectory across every ply that has a post-move eval.
  // winPctAfterRaw is stored MOVER-perspective; convert to one (White) perspective so the
  // volatility window measures real swing, not the per-ply side flip.
  const trajectory = new Map<number, number>()
  for (const a of analyses) {
    if (a.winPctAfterRaw == null) continue
    trajectory.set(a.moveIndex, a.moveIndex % 2 === 0 ? a.winPctAfterRaw : 100 - a.winPctAfterRaw)
  }

  const playerMoves = analyses.filter(a =>
    (player === 'white' ? a.moveIndex % 2 === 0 : a.moveIndex % 2 !== 0) &&
    a.classification !== 'Book' && a.classification !== 'Forced',
  )
  if (playerMoves.length === 0) return null

  // (a) Volatility-weighted mean: weight each accuracy by local win% std-dev (±2 plies),
  //     floored at 0.5 so calm moves still count.
  let weightSum = 0
  let weightedAccSum = 0
  for (const a of playerMoves) {
    const window: number[] = []
    for (let d = -2; d <= 2; d++) {
      const v = trajectory.get(a.moveIndex + d)
      if (v != null) window.push(v)
    }
    const weight = Math.max(0.5, stdDev(window))
    weightSum += weight
    weightedAccSum += weight * a.accuracy
  }
  const weightedMean = weightedAccSum / weightSum

  // (b) Harmonic mean of the same accuracies (punishes the low outlier).
  const harmonicMean =
    playerMoves.length /
    playerMoves.reduce((s, a) => s + 1 / Math.max(a.accuracy, 1e-9), 0)

  return Math.min(100, Math.max(0, (weightedMean + harmonicMean) / 2))
}

export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

function evalToCp(r: EvalResult): number {
  if (r.cp !== null) return r.cp
  if (r.mate !== null) return r.mate > 0 ? 10000 : -10000
  return 0
}

// Miss thresholds, in winPct-points
const MISS_WIN_AVAILABLE = 80   // a win was on the board at winPctBefore
const MISS_RESULT_CEILING = 55  // and the played move let it slip to at/below this

// Piece values for sacrifice detection
const PIECE_VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

// A move is a sacrifice when material is given without immediate equal compensation.
// Two cases:
//   a) Direct exchange sacrifice: captured piece worth less than moving piece
//   b) Piece hangs on destination (non-pawn only — pawn advances to defended squares are normal play)
export function isSacrifice(move: Move): boolean {
  if (!move.piece || !move.color || !move.after) return false
  const pieceVal = PIECE_VAL[move.piece] ?? 0

  if (move.captured) {
    return (PIECE_VAL[move.captured] ?? 0) < pieceVal
  }

  if (pieceVal <= 1) return false  // pawn non-capture: skip
  try {
    const chess = new Chess(move.after)
    const oppColor = move.color === 'w' ? 'b' : 'w'
    // Genuinely hanging: opponent can take it AND the mover has nothing recapturing
    // there. If the mover's own side also defends the square, any "capture" is just
    // an even trade (e.g. a supported knight outpost) — not a sacrifice.
    return chess.isAttacked(move.to, oppColor) && !chess.isAttacked(move.to, move.color)
  } catch {
    return false
  }
}

// After the move: does an OWN piece more valuable than the one just committed hang
// free (attacked + undefended)? If so, the move is a blunder that happens to also give
// up material — not a brilliancy. Excludes the just-moved piece's own square (already
// covered by the sacrifice check itself).
function hasCostlierHangingPiece(move: Move): boolean {
  if (!move.after || !move.piece || !move.color) return false
  const committedVal = PIECE_VAL[move.piece] ?? 0
  try {
    const chess = new Chess(move.after)
    const opp = move.color === 'w' ? 'b' : 'w'
    for (const row of chess.board()) {
      for (const sq of row) {
        if (!sq || sq.color !== move.color || sq.square === move.to) continue
        if ((PIECE_VAL[sq.type] ?? 0) <= committedVal) continue
        if (chess.isAttacked(sq.square, opp) && !chess.isAttacked(sq.square, move.color)) return true
      }
    }
    return false
  } catch {
    return false
  }
}

// A move is Forced when it was the only legal move in the position — no skill signal,
// so it's classified separately and excluded from accuracy (same treatment as Book).
function isForcedMove(move: Move): boolean {
  if (!move.before) return false
  try {
    return new Chess(move.before).moves().length === 1
  } catch {
    return false
  }
}

// Optional params enable Brilliant/Great detection when full context is available.
// Callers that only have loss+isEngineBestMove (e.g. tests) get the standard 7-class result.
export function classifyMove(
  loss: number,
  isEngineBestMove: boolean,
  move?: Move,
  winPctBefore?: number,
  bestCp?: number | null,
  secondBestCp?: number | null,
  winPctPrior?: number,
  winPctAfterRaw?: number,
): MoveClass {
  const winPctAfter = winPctBefore != null ? winPctBefore - loss : undefined

  // Brilliant: sacrifice + nearly best + position not already trivially won
  // + you are NOT lost afterward (winPct >= 50 = at least equal)
  // + no MORE valuable own piece hangs free at the same time (that would be a
  //   blunder that happens to also give up material, not a brilliancy).
  if (
    move != null && winPctBefore != null && winPctAfter != null &&
    loss <= 2 && winPctBefore < 90 &&
    winPctAfter >= 50 &&
    isSacrifice(move) &&
    !hasCostlierHangingPiece(move)
  ) return 'Brilliant'

  // Great: clearly best move where the 2nd-best alternative is a genuinely bad,
  // no-longer-favored outcome (winPct < 50) AND the gap is well past Blunder-scale
  // (>= 30 win%-points, vs. the existing >20-loss Blunder cutoff) — i.e. missing
  // this move would have been a serious, critical-position error, not just
  // "slightly less good while still comfortably winning either way".
  if (
    isEngineBestMove &&
    bestCp != null && secondBestCp != null &&
    winPctBefore != null && winPctBefore < 85 &&
    winPct(bestCp) - winPct(secondBestCp) >= 30 &&
    winPct(secondBestCp) < 50
  ) return 'Great'

  // Great — swing branches: a near-best move (not necessarily THE top engine move)
  // that turns a lost position equal, or an equal position clearly winning.
  // NOTE: this needs the actual post-move winPct (winPctAfterRaw), NOT the
  // `winPctBefore - loss` reconstruction above. `loss` is clamped to >=0 by the
  // caller, so that reconstruction can never exceed winPctBefore — it would make
  // these branches permanently unreachable (loss-clamping erases exactly the
  // engine-search "swing" jump this is meant to detect, e.g. a sac whose point
  // the engine only sees once it's on the board).
  const isNearBest = loss <= 1.5
  if (
    isNearBest && winPctBefore != null && winPctAfterRaw != null &&
    (
      (winPctBefore < 50 && winPctAfterRaw >= 50) ||    // lost -> equal
      (winPctBefore <= 55 && winPctAfterRaw >= 75)      // equal -> winning
    )
  ) return 'Great'

  if (isEngineBestMove) return 'Best'

  // Miss: a win is on the board now (winPctBefore >= 80) that wasn't there before the
  // opponent's last move (winPctPrior < 80 — i.e. freshly created by their mistake),
  // and you let it slip back down to equal/worse (winPctAfter <= 55).
  if (
    winPctBefore != null && winPctAfter != null &&
    winPctBefore >= MISS_WIN_AVAILABLE &&
    winPctAfter <= MISS_RESULT_CEILING &&
    (winPctPrior == null || winPctPrior < MISS_WIN_AVAILABLE)
  ) return 'Miss'

  if (loss <= 2) return 'Excellent'
  if (loss <= 5) return 'Good'
  if (loss <= 10) return 'Inaccuracy'
  if (loss <= 20) return 'Mistake'
  return 'Blunder'
}

export function findKeyMoments(analyses: MoveAnalysis[], n = 5): Set<number> {
  const sorted = [...analyses]
    .filter(a => a.classification !== 'Book')
    .sort((a, b) => b.lossInWinPct - a.lossInWinPct)
  return new Set(sorted.slice(0, n).map(a => a.moveIndex))
}

export function buildMoveAnalyses(
  moves: Move[],
  evalResults: (EvalResult | null)[],
  openingPly = 0,
): MoveAnalysis[] {
  const analyses: MoveAnalysis[] = []

  for (let i = 0; i < moves.length; i++) {
    if (i < openingPly) {
      analyses.push({ moveIndex: i, lossInWinPct: 0, classification: 'Book', accuracy: 100 })
      continue
    }
    if (isForcedMove(moves[i])) {
      analyses.push({ moveIndex: i, lossInWinPct: 0, classification: 'Forced', accuracy: 100 })
      continue
    }
    const evalBefore = evalResults[i]
    const evalAfter = evalResults[i + 1]
    if (!evalBefore || !evalAfter) continue

    const isWhite = i % 2 === 0
    const cpBefore = isWhite ? evalToCp(evalBefore) : -evalToCp(evalBefore)
    const cpAfter  = isWhite ? evalToCp(evalAfter)  : -evalToCp(evalAfter)

    const loss = Math.max(0, winPct(cpBefore) - winPct(cpAfter))
    // Unclamped, unlike `loss` above — needed for the Great swing branches, which must
    // see genuine post-move improvement (e.g. a search-depth "swing" after a sacrifice)
    // rather than the loss-clamped reconstruction that can never exceed winPctBefore.
    const winPctAfterRaw = winPct(cpAfter)
    const isEngineBestMove =
      evalBefore.bestMoveSan !== null && moves[i].san === evalBefore.bestMoveSan

    // Convert secondBestCp from White-perspective (stored in EvalResult) to mover's perspective
    const secondBestCpMover =
      evalBefore.secondBestCp !== null
        ? (isWhite ? evalBefore.secondBestCp : -evalBefore.secondBestCp)
        : null

    // Mover's winPct in the position before the opponent's previous move — used to detect
    // whether the opponent just handed over a fresh win (for Miss classification).
    const prevEval = i > 0 ? evalResults[i - 1] : null
    const cpPrior = prevEval
      ? (isWhite ? evalToCp(prevEval) : -evalToCp(prevEval))
      : null
    const winPctPrior = cpPrior != null ? winPct(cpPrior) : undefined

    analyses.push({
      moveIndex: i,
      lossInWinPct: loss,
      classification: classifyMove(
        loss,
        isEngineBestMove,
        moves[i],
        winPct(cpBefore),
        cpBefore,
        secondBestCpMover,
        winPctPrior,
        winPctAfterRaw,
      ),
      accuracy: moveAccuracy(loss),
      winPctAfterRaw,
    })
  }

  return analyses
}
