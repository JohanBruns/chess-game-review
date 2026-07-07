import { Chess, type Move, type Square } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'
import { seeGain, PIECE_VAL } from './see'

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

export type GamePhase = 'opening' | 'middlegame' | 'endgame'

export interface MoveAnalysis {
  moveIndex: number
  lossInWinPct: number
  classification: MoveClass
  accuracy: number
  winPctAfterRaw?: number   // mover-perspective post-move win%; feeds T5 volatility trajectory
  phase?: GamePhase         // T7: opening/middlegame/endgame split, for phaseAccuracy
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

// Shared core of the Lichess/chess.com-style aggregation: mean of a volatility-weighted mean
// and a harmonic mean over a given set of moves, instead of a plain arithmetic mean. The
// harmonic mean punishes a single big blunder among otherwise-strong moves; the volatility
// weighting gives more weight to accuracy in sharp (high win%-swing) positions. `trajectory`
// is the full-game White-perspective win% map (see playerAccuracy) so the ±2-ply volatility
// window can see across whatever slice `playerMoves` is (e.g. a single game phase).
function aggregate(trajectory: Map<number, number>, playerMoves: MoveAnalysis[]): number | null {
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

// White-perspective win% trajectory across every ply that has a post-move eval.
// winPctAfterRaw is stored MOVER-perspective; convert to one (White) perspective so the
// volatility window measures real swing, not the per-ply side flip.
function buildTrajectory(analyses: MoveAnalysis[]): Map<number, number> {
  const trajectory = new Map<number, number>()
  for (const a of analyses) {
    if (a.winPctAfterRaw == null) continue
    trajectory.set(a.moveIndex, a.moveIndex % 2 === 0 ? a.winPctAfterRaw : 100 - a.winPctAfterRaw)
  }
  return trajectory
}

export function playerAccuracy(
  analyses: MoveAnalysis[],
  player: 'white' | 'black',
): number | null {
  const trajectory = buildTrajectory(analyses)
  const playerMoves = analyses.filter(a =>
    (player === 'white' ? a.moveIndex % 2 === 0 : a.moveIndex % 2 !== 0) &&
    a.classification !== 'Book' && a.classification !== 'Forced',
  )
  return aggregate(trajectory, playerMoves)
}

// T7: same aggregation as playerAccuracy, split into opening/middlegame/endgame using each
// move's `phase` (set by buildMoveAnalyses). Book/Forced stay excluded, consistent with the
// overall accuracy number. A phase with no qualifying moves (e.g. a short game with no
// endgame) reports `null` for that phase.
export function phaseAccuracy(
  analyses: MoveAnalysis[],
  player: 'white' | 'black',
): { opening: number | null; middlegame: number | null; endgame: number | null } {
  const trajectory = buildTrajectory(analyses)
  const isPlayerMove = (a: MoveAnalysis) =>
    (player === 'white' ? a.moveIndex % 2 === 0 : a.moveIndex % 2 !== 0) &&
    a.classification !== 'Book' && a.classification !== 'Forced'

  const forPhase = (phase: GamePhase) =>
    aggregate(trajectory, analyses.filter(a => isPlayerMove(a) && a.phase === phase))

  return {
    opening: forPhase('opening'),
    middlegame: forPhase('middlegame'),
    endgame: forPhase('endgame'),
  }
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

// T7 game-phase thresholds
const OPENING_MIN_PLIES = 20          // opening phase runs at least to move 10 regardless of book length
const ENDGAME_NONPAWN_MATERIAL = 20   // both sides combined, kings excluded; starting value is 62

// Sum of non-pawn, non-king material (both sides) from a FEN's piece-placement field —
// used as a simple, sticky endgame trigger. No Chess() instantiation needed.
function nonPawnMaterial(fen: string): number {
  const placement = fen.split(' ')[0]
  let sum = 0
  for (const ch of placement) {
    const lower = ch.toLowerCase()
    if (lower === 'n' || lower === 'b' || lower === 'r' || lower === 'q') sum += PIECE_VAL[lower]
  }
  return sum
}

// A move is a sacrifice when it leaves material en prise without equal compensation,
// measured by real Static Exchange Evaluation instead of an attacked/defended flag.
// After the move (opponent to move) every own non-king square is checked for what the
// opponent could net there via the full capture sequence (seeGain). Two refinements:
//   - For the moved piece's own square on a capture, the captured piece's value is
//     immediate compensation and is subtracted (QxR that can be recaptured is a
//     4-point sac; QxR with no recapture is just a win, not a sacrifice).
//   - A piece that was already SEE-hanging before the move was lost anyway — giving it up
//     is not a fresh sacrifice, UNLESS this move gives up LESS than it was already losing
//     (e.g. grabbing a pawn on the way down), which is a genuine, smaller sacrifice.
// `seeThreshold` is the minimum net material given up (2 = exchange-scale, 3 = a
// full piece) — rating-scaled by the caller via RatingThresholds.sacrificeSeeMin.
export function sacrificeSquares(move: Move, seeThreshold = 3): Square[] {
  if (!move.piece || !move.color || !move.after) return []
  const squares: Square[] = []
  try {
    const after = new Chess(move.after)
    const capturedVal = move.captured ? (PIECE_VAL[move.captured] ?? 0) : 0
    for (const row of after.board()) {
      for (const sq of row) {
        if (!sq || sq.color !== move.color || sq.type === 'k') continue
        const gain = seeGain(move.after, sq.square)
        const netSac = sq.square === move.to ? gain - capturedVal : gain
        if (netSac < seeThreshold) continue
        // The piece now on move.to sat on move.from before the move; everything
        // else is on its original square. (Castling maps the rook imprecisely —
        // its before-square was empty, harmlessly counting it as not-hanging.)
        const beforeSquare = sq.square === move.to ? move.from : sq.square
        // Skip only a piece that was already losing >= threshold AND that this move does not
        // improve on (netSac >= what it was already losing). A piece hanging for its full value
        // that instead grabs material on the way down (netSac < hangingValue) is still a real,
        // if cheaper, sacrifice — e.g. 6.Nxf7 in the Fried Liver: Ng5 was en prise to ...Qxg5
        // for 3, but Nxf7 gives it up for only 2 net while winning a pawn and the attack.
        const hangingValue = hangingBeforeValue(move, beforeSquare)
        if (hangingValue >= seeThreshold && netSac >= hangingValue) continue
        squares.push(sq.square)
      }
    }
  } catch {
    return []
  }
  return squares
}

export function isSacrifice(move: Move, seeThreshold = 3): boolean {
  return sacrificeSquares(move, seeThreshold).length > 0
}

// PV-confirmation of a sacrifice: from the position AFTER the move (fenAfterMove), does the
// opponent's engine-best reply actually CAPTURE on one of the sacrificed squares? A real
// sacrifice offers material the opponent grabs; a false SEE positive (e.g. a queen that only
// looks hanging because of a tactic) is one the engine's best reply simply declines. Returns
// undefined when it cannot be decided (no reply SAN), so the caller treats it as "not disproven".
export function replyCapturesSacSquare(
  fenAfterMove: string,
  replySan: string | null,
  sacSquares: Square[],
): boolean | undefined {
  if (!replySan || sacSquares.length === 0) return undefined
  try {
    const chess = new Chess(fenAfterMove)
    const m = chess.move(replySan)
    return m.captured != null && sacSquares.includes(m.to as Square)
  } catch {
    return undefined
  }
}

// How much material (pawn units) was this own piece already SEE-losing on `square` in the
// position BEFORE the move? Measured by flipping the side to move in move.before (legal
// whenever the mover was not in check: with the mover to move, the opponent's king cannot be
// in check either) and running SEE. 0 = not hanging. If the mover WAS in check, fall back to
// a coarse attacked-and-undefended test yielding the piece's full value (or 0).
function hangingBeforeValue(move: Move, square: Square): number {
  if (!move.before) return 0
  try {
    const before = new Chess(move.before)
    if (!before.isCheck()) {
      const parts = move.before.split(' ')
      parts[1] = parts[1] === 'w' ? 'b' : 'w'
      parts[3] = '-' // en-passant target is meaningless for the flipped side
      return seeGain(parts.join(' '), square)
    }
    const opp = move.color === 'w' ? 'b' : 'w'
    const piece = before.get(square)
    if (!piece || piece.color !== move.color) return 0
    return before.isAttacked(square, opp) && !before.isAttacked(square, move.color)
      ? (PIECE_VAL[piece.type] ?? 0)
      : 0
  } catch {
    return 0
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

// T4 optional rating-awareness: Brilliant/Great thresholds loosen for weaker players
// (below RATING_LENIENT_MAX) and tighten for stronger ones (above RATING_STRICT_MIN).
// Three tiers rather than a continuous curve — matches the spec's "slightly loosen/tighten"
// framing and stays simple to test. Missing rating (or a rating inside the neutral band)
// behaves exactly like before this feature existed.
const RATING_LENIENT_MAX = 1600
const RATING_STRICT_MIN = 2000

interface RatingThresholds {
  brilliantLossMax: number       // Brilliant gate, normally `loss <= 2`
  greatOnlyMoveGapMin: number    // Great "only good move" branch, normally gap >= 30 win%
  greatNearBestLossMax: number   // Great swing branches' isNearBest, normally `loss <= 1.5`
  sacrificeSeeMin: number        // min net material (pawn units) for isSacrifice: 2 = exchange-scale, 3 = full piece
}

const NEUTRAL_RATING_THRESHOLDS: RatingThresholds = { brilliantLossMax: 2, greatOnlyMoveGapMin: 30, greatNearBestLossMax: 1.5, sacrificeSeeMin: 3 }
const LENIENT_RATING_THRESHOLDS: RatingThresholds = { brilliantLossMax: 3, greatOnlyMoveGapMin: 25, greatNearBestLossMax: 2.5, sacrificeSeeMin: 2 }
const STRICT_RATING_THRESHOLDS: RatingThresholds = { brilliantLossMax: 1, greatOnlyMoveGapMin: 35, greatNearBestLossMax: 1.0, sacrificeSeeMin: 3 }

function ratingThresholds(rating?: number): RatingThresholds {
  if (rating == null) return NEUTRAL_RATING_THRESHOLDS
  if (rating < RATING_LENIENT_MAX) return LENIENT_RATING_THRESHOLDS
  if (rating > RATING_STRICT_MIN) return STRICT_RATING_THRESHOLDS
  return NEUTRAL_RATING_THRESHOLDS
}

// Great — "refutation" branch: the minimum win%-gap (mover perspective) between the engine's
// best move and its second-best line for a best-move-right-after-an-opponent-blunder to earn
// Great. Lower than the "only good move" gap because chess.com rewards finding the refutation
// even when the 2nd-best alternative is still playable; kept above ordinary recapture noise.
const REFUTATION_GAP_MIN = 15

// Escape hatch for the winPctBefore < 90 cap below: even in an already-won position, the
// engine-best move right after a blunder is still Great when it is the UNIQUELY critical
// continuation — the second-best line throws away at least this much win% (e.g. 22.Rxf7
// starting a forced mate, where the only alternative roughly halves the evaluation).
const REFUTATION_ONLY_MOVE_GAP = 50

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
  playerRating?: number,
  suppressBrilliant = false,
  sacrificeConfirmed?: boolean,
  opponentBlundered = false,
  isTrivialRecapture = false,
): MoveClass {
  const winPctAfter = winPctBefore != null ? winPctBefore - loss : undefined
  const rt = ratingThresholds(playerRating)

  // Brilliant: sacrifice (SEE-based) + nearly best + the sacrifice is REAL
  // + you are NOT lost afterward (winPct >= 50 = at least equal)
  // + no MORE valuable own piece hangs free at the same time (that would be a
  //   blunder that happens to also give up material, not a brilliancy).
  // "The sacrifice is real" is decided by PV-confirmation: the opponent's engine-best reply
  // actually captures the offered material (sacrificeConfirmed). A false SEE positive — a
  // piece that only looks hanging because taking it runs into a tactic — is one the engine
  // declines, so sacrificeConfirmed === false vetoes it. undefined (can't tell, e.g. the
  // move gives mate so there is no reply) does NOT veto. This replaced the old
  // second-best-cp heuristic, which both over-fired (declined "sacs") and under-fired
  // (blocked genuine sacs merely because the position was already somewhat winning).
  // Cheap numeric gates run first so the SEE board scan only touches candidates.
  if (
    !suppressBrilliant &&
    move != null && winPctBefore != null && winPctAfter != null &&
    loss <= rt.brilliantLossMax &&
    winPctAfter >= 50 &&
    sacrificeConfirmed !== false &&
    isSacrifice(move, rt.sacrificeSeeMin) &&
    !hasCostlierHangingPiece(move)
  ) return 'Brilliant'

  // Great — "refutation": the engine's best move immediately after the opponent blundered,
  // with a clear win%-gap to the second-best line. Unlike the "only good move" branch below,
  // this does NOT require the 2nd-best to be losing — chess.com awards Great for finding the
  // punishing move even when a calmer alternative would also keep an edge. Trivial recaptures
  // (just taking back what the opponent captured on the same square) are excluded.
  if (
    !isTrivialRecapture &&
    isEngineBestMove && opponentBlundered &&
    bestCp != null && secondBestCp != null &&
    winPctBefore != null
  ) {
    const gap = winPct(bestCp) - winPct(secondBestCp)
    // Fire when the move is meaningfully the right one (gap >= REFUTATION_GAP_MIN) AND either
    // the position wasn't already trivially won, OR it is the uniquely critical continuation
    // even in a won position (very large gap — see REFUTATION_ONLY_MOVE_GAP).
    if (gap >= REFUTATION_GAP_MIN && (winPctBefore < 90 || gap >= REFUTATION_ONLY_MOVE_GAP)) {
      return 'Great'
    }
  }

  // Great: clearly best move where the 2nd-best alternative is a genuinely bad,
  // no-longer-favored outcome (winPct < 50) AND the gap is well past Blunder-scale
  // (>= 30 win%-points, vs. the existing >20-loss Blunder cutoff) — i.e. missing
  // this move would have been a serious, critical-position error, not just
  // "slightly less good while still comfortably winning either way".
  if (
    !isTrivialRecapture &&
    isEngineBestMove &&
    bestCp != null && secondBestCp != null &&
    winPctBefore != null && winPctBefore < 85 &&
    winPct(bestCp) - winPct(secondBestCp) >= rt.greatOnlyMoveGapMin &&
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
  const isNearBest = loss <= rt.greatNearBestLossMax
  if (
    !isTrivialRecapture &&
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
  whiteRating?: number,
  blackRating?: number,
): MoveAnalysis[] {
  const analyses: MoveAnalysis[] = []
  // Classification per ply, for the one-Brilliant-per-combination rule: consecutive
  // sacrifices of the same combination get a single Brilliant (chess.com behavior),
  // so a move whose previous own move (ply i-2) was Brilliant skips the Brilliant branch.
  const classByPly = new Map<number, MoveClass>()
  // Opening phase runs at least to move 10, even if the opening-DB match (openingPly) is
  // shorter — otherwise "opening" would coincide exactly with the Book moves, which
  // playerAccuracy/phaseAccuracy exclude, making opening accuracy structurally always null.
  const openingEndPly = Math.max(openingPly, OPENING_MIN_PLIES)
  let endgameStarted = false

  for (let i = 0; i < moves.length; i++) {
    // Sticky: once material drops to the endgame threshold it stays "endgame" even if a
    // later ply's FEN is unavailable. Evaluated for every move (including skipped/Book ones)
    // so the phase boundary doesn't depend on which plies got engine evals.
    if (!endgameStarted && moves[i].after && nonPawnMaterial(moves[i].after) <= ENDGAME_NONPAWN_MATERIAL) {
      endgameStarted = true
    }
    const phase: GamePhase = i < openingEndPly ? 'opening' : endgameStarted ? 'endgame' : 'middlegame'

    const isBook = i < openingPly

    // Forced = only-legal-move: no skill signal, never promoted to Brilliant/Great. Book takes
    // priority over Forced (original ordering), so this is only checked outside the book.
    if (!isBook && isForcedMove(moves[i])) {
      analyses.push({ moveIndex: i, lossInWinPct: 0, classification: 'Forced', accuracy: 100, phase })
      continue
    }
    const evalBefore = evalResults[i]
    const evalAfter = evalResults[i + 1]
    if (!evalBefore || !evalAfter) {
      // No engine eval for this ply: a book move still gets its Book label; otherwise skip
      // (unchanged behavior — a mid-game ply without an eval can't be classified).
      if (isBook) analyses.push({ moveIndex: i, lossInWinPct: 0, classification: 'Book', accuracy: 100, phase })
      continue
    }

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
    const playerRating = isWhite ? whiteRating : blackRating

    // PV-confirmation of a sacrifice: does the opponent's engine-best reply (evalAfter) actually
    // capture the offered material? Undefined when there's nothing to sacrifice or no reply SAN.
    const afterFen = moves[i].after
    const sacSquares = sacrificeSquares(moves[i], ratingThresholds(playerRating).sacrificeSeeMin)
    const sacrificeConfirmed = afterFen && sacSquares.length > 0
      ? replyCapturesSacSquare(afterFen, evalAfter.bestMoveSan, sacSquares)
      : undefined

    // Did the opponent just blunder? Drives the Great "refutation" branch. Reads the previous
    // ply's already-computed class (Book/Forced/skipped plies leave it undefined = no blunder).
    const prevClass = classByPly.get(i - 1)
    const opponentBlundered = prevClass === 'Mistake' || prevClass === 'Blunder'

    // Trivial recapture: this move and the opponent's previous move both capture on the same
    // square (just restoring material) — excluded from Great.
    const prevMove = i > 0 ? moves[i - 1] : undefined
    const isTrivialRecapture = !!(prevMove?.captured && moves[i].captured && prevMove.to === moves[i].to)

    const classification = classifyMove(
      loss,
      isEngineBestMove,
      moves[i],
      winPct(cpBefore),
      cpBefore,
      secondBestCpMover,
      winPctPrior,
      winPctAfterRaw,
      playerRating,
      classByPly.get(i - 2) === 'Brilliant',
      sacrificeConfirmed,
      opponentBlundered,
      isTrivialRecapture,
    )

    // Book override: inside opening theory keep the Book label UNLESS the move is a genuine
    // Brilliant/Great — chess.com awards those even for known theory (e.g. 6.Nxf7 Fried Liver).
    if (isBook && classification !== 'Brilliant' && classification !== 'Great') {
      analyses.push({ moveIndex: i, lossInWinPct: 0, classification: 'Book', accuracy: 100, phase })
      classByPly.set(i, 'Book')
      continue
    }

    classByPly.set(i, classification)

    analyses.push({
      moveIndex: i,
      lossInWinPct: loss,
      classification,
      accuracy: moveAccuracy(loss),
      winPctAfterRaw,
      phase,
    })
  }

  return analyses
}
