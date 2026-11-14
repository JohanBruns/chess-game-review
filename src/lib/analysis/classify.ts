import { Chess, type Move, type Square } from 'chess.js'
// Relative imports carry their .ts extension here: Node loads this module directly too
// (scripts/captureParityFixtures.ts), without a bundler to resolve them.
import type { EvalResult } from '../engine/uci.ts'
import { PIECE_VAL } from './see.ts'

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

export function evalToCp(r: EvalResult): number {
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

// chess.com's notion of an en-prise piece (verified against live Game Reviews, 2026-11): the
// opponent attacks it with a CHEAPER piece, or attacks it more often than it is defended.
// Deliberately not SEE: a recapture does not "un-sacrifice" a piece — 15.Bxh6 gxh6 16.Qg6+ …
// Qxh6 still gives a bishop for two pawns, which SEE (net 1 after the pawn on h6) waved off.
// The king only counts as an attacker of an undefended piece. `legalOnly` (the opponent is to
// move in `chess`) drops captures the rules forbid: 29...Bg3+ uncovers a check from the h8-rook,
// so fxg3 is illegal and the bishop is not en prise at all.
function isHanging(chess: Chess, square: Square, legalOnly: boolean): boolean {
  const piece = chess.get(square)
  if (!piece) return false
  const opp = piece.color === 'w' ? 'b' : 'w'
  const defenders = chess.attackers(square, piece.color)
  const attackers = chess.attackers(square, opp)
    .filter(from => defenders.length === 0 || chess.get(from)?.type !== 'k')
    .filter(from => !legalOnly || canCapture(chess, from, square))
  if (attackers.length === 0) return false
  const value = PIECE_VAL[piece.type] ?? 0
  if (attackers.some(from => (PIECE_VAL[chess.get(from)?.type ?? 'k'] ?? 0) < value)) return true
  return attackers.length > defenders.length
}

function canCapture(chess: Chess, from: Square, to: Square): boolean {
  try {
    chess.move({ from, to, promotion: 'q' })
    chess.undo()
    return true
  } catch {
    return false
  }
}

// The square of the piece this move offers — chess.com's "sacrifice" for Brilliant — or [] when
// it offers none. Only the moved piece counts: every verified Brilliant offers it, while
// abandoning another piece's defence (38...Qg5+, 15...Nxd5) never was one. It must be left en
// prise (isHanging), and is not a sacrifice when
//   - it just captured something at least as valuable (a trade), or
//   - the move takes the heat off another own piece worth at least as much: 19...Rxe6 removes
//     the knight forking the d8-rook, giving back the exchange rather than sacrificing a rook.
// Whether the opponent actually takes is irrelevant: 23.Nf6+ forks king and rook, and chess.com
// calls it Brilliant although the best reply ...Kf7 declines the knight. A piece that was already
// attacked before the move still counts (6.Nxf7 in the Fried Liver, the g5-knight was en prise).
export function sacrificeSquares(move: Move): Square[] {
  if (!move.color || !move.before || !move.after || move.piece === 'k' || move.piece === 'p') return []
  try {
    const after = new Chess(move.after)
    const value = PIECE_VAL[move.piece] ?? 0
    if (move.captured && (PIECE_VAL[move.captured] ?? 0) >= value) return []
    if (!isHanging(after, move.to, true)) return []
    const before = new Chess(move.before)
    for (const row of before.board()) {
      for (const sq of row) {
        if (!sq || sq.color !== move.color || sq.square === move.from || sq.type === 'k' || sq.type === 'p') continue
        if ((PIECE_VAL[sq.type] ?? 0) < value) continue
        if (isHanging(before, sq.square, false) && !isHanging(after, sq.square, true)) return []
      }
    }
    return [move.to]
  } catch {
    return []
  }
}

export function isSacrifice(move: Move): boolean {
  return sacrificeSquares(move).length > 0
}

// Material balance (pawn units, kings excluded) from `color`'s point of view.
function materialBalance(fen: string, color: 'w' | 'b'): number {
  let sum = 0
  for (const ch of fen.split(' ')[0]) {
    const value = PIECE_VAL[ch.toLowerCase()]
    if (value == null) continue
    sum += (ch === ch.toLowerCase() ? 'b' : 'w') === color ? value : -value
  }
  return sum
}

// Does the "sacrifice" pay for itself at once? Follows `replyPv` (the engine line in the position
// after the move) through the opponent's capture and the mover's answer: when the mover is not
// behind in material by then, it was a trade or a desperado — 39...Rxc2+ 40.Kxc2 Bxa1 41.Kb3
// wins the rook straight back, and chess.com does not call it Brilliant. Unless the opponent's
// next move takes another piece: then the mover has put in more than the offered piece and the
// combination is still running — 10...Bxh2+ 11.Kxh2 Bxf3 12.gxf3 is a bishop down again (the
// queen falls only later), and the same combination played 11...Rxd1 12.Rxd1 first is no less a
// sacrifice. Which of the two orders the engine line shows is arbitrary, so the verdict must not
// hang on it. A pawn taken there does not count: 10...Nf4 11.Nxf4 exf4 12.Bxf4 trades knights
// and drops a pawn. A reply that declines the offer leaves the sacrifice standing.
export function sacrificeRegained(move: Move, replyPv: string | null, sacSquares: Square[]): boolean {
  if (!replyPv || sacSquares.length === 0 || !move.color || !move.before || !move.after) return false
  try {
    const chess = new Chess(move.after)
    const [reply, answer, next] = replyPv.split(' ')
    const taken = chess.move(reply)
    if (!taken.captured || !sacSquares.includes(taken.to as Square)) return false
    if (answer) chess.move(answer)
    if (materialBalance(chess.fen(), move.color) < materialBalance(move.before, move.color)) return false
    const captured = next ? chess.move(next).captured : undefined
    return captured == null || captured === 'p'
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
}

const NEUTRAL_RATING_THRESHOLDS: RatingThresholds = { brilliantLossMax: 2, greatOnlyMoveGapMin: 30, greatNearBestLossMax: 1.5 }
const LENIENT_RATING_THRESHOLDS: RatingThresholds = { brilliantLossMax: 3, greatOnlyMoveGapMin: 25, greatNearBestLossMax: 2.5 }
const STRICT_RATING_THRESHOLDS: RatingThresholds = { brilliantLossMax: 1, greatOnlyMoveGapMin: 35, greatNearBestLossMax: 1.0 }

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

// Great — "only good move" branch: not awarded once the mover's win% before the move reaches
// this — everything wins there, so a big gap to the second-best line no longer marks a critical
// position.
const GREAT_ONLY_MOVE_WINPCT_MAX = 85

// No Brilliant when the second-best line still wins by this much (centipawns, mover's view):
// a sacrifice nobody needed. Mate-scored lines don't count — chess.com still awards 26.Rxf5
// with several mates on the board. Placed between the verified cases with room for engine
// noise on both sides: 32.Bxb7 (second-best around +7.0, no Brilliant) and 25...Rad8+
// (second-best around +5.5, Brilliant).
const BRILLIANT_WINNING_ANYWAY_CP = 620

// classifyMove's decision plus whether it can depend on the second-best line at all. The batch
// analysis only searches a second line where it matters (see probeSecondLine), so every read of
// secondBestCp below must sit behind a gate that also feeds `secondLineMatters`.
interface Verdict {
  classification: MoveClass
  secondLineMatters: boolean
}

// Optional params enable Brilliant/Great detection when full context is available.
// Callers that only have loss+isEngineBestMove (e.g. tests) get the standard 7-class result.
export function classifyMove(...args: Parameters<typeof judgeMove>): MoveClass {
  return judgeMove(...args).classification
}

function judgeMove(
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
  sacrificeRegained = false,
  opponentBlundered = false,
  isTrivialRecapture = false,
): Verdict {
  const winPctAfter = winPctBefore != null ? winPctBefore - loss : undefined
  const rt = ratingThresholds(playerRating)

  // Brilliant (chess.com rules, checked against live Game Reviews 2026-11): a piece sacrifice
  // (sacrificeSquares) + nearly best + you are NOT lost afterward (winPct >= 50)
  // + the sacrifice is not won straight back (sacrificeRegained, from the engine line)
  // + not a promotion (chess.com never marks one, even when the new queen is given up)
  // + the second-best line is not already winning comfortably (BRILLIANT_WINNING_ANYWAY_CP)
  // + no MORE valuable own piece hangs free at the same time (that would be a
  //   blunder that happens to also give up material, not a brilliancy).
  // Cheap numeric gates run first so the board scans only touch candidates.
  const brilliantButForSecondLine =
    !suppressBrilliant &&
    move != null && winPctBefore != null && winPctAfter != null &&
    loss <= rt.brilliantLossMax &&
    winPctAfter >= 50 &&
    !sacrificeRegained &&
    !move.promotion &&
    isSacrifice(move) &&
    !hasCostlierHangingPiece(move)
  // The two Great branches that compare the best move with the second-best line, up to that
  // comparison. The gap between the two can be at most the best line's own win%, so below a
  // branch's minimum gap the second line cannot matter.
  const greatBase = !isTrivialRecapture && isEngineBestMove && bestCp != null && winPctBefore != null
  const refutationOpen = greatBase && opponentBlundered && winPct(bestCp) >= REFUTATION_GAP_MIN
  const onlyMoveOpen =
    greatBase && winPctBefore < GREAT_ONLY_MOVE_WINPCT_MAX && winPct(bestCp) >= rt.greatOnlyMoveGapMin
  const secondLineMatters = brilliantButForSecondLine || refutationOpen || onlyMoveOpen
  const verdict = (classification: MoveClass): Verdict => ({ classification, secondLineMatters })

  if (
    brilliantButForSecondLine &&
    !(secondBestCp != null && secondBestCp >= BRILLIANT_WINNING_ANYWAY_CP && secondBestCp < 10000)
  ) return verdict('Brilliant')

  // Great — "refutation": the engine's best move immediately after the opponent blundered,
  // with a clear win%-gap to the second-best line. Unlike the "only good move" branch below,
  // this does NOT require the 2nd-best to be losing — chess.com awards Great for finding the
  // punishing move even when a calmer alternative would also keep an edge. Trivial recaptures
  // (just taking back what the opponent captured on the same square) are excluded.
  if (refutationOpen && secondBestCp != null) {
    const gap = winPct(bestCp) - winPct(secondBestCp)
    // Fire when the move is meaningfully the right one (gap >= REFUTATION_GAP_MIN) AND either
    // the position wasn't already trivially won, OR it is the uniquely critical continuation
    // even in a won position (very large gap — see REFUTATION_ONLY_MOVE_GAP).
    if (gap >= REFUTATION_GAP_MIN && (winPctBefore < 90 || gap >= REFUTATION_ONLY_MOVE_GAP)) {
      return verdict('Great')
    }
  }

  // Great: clearly best move where the 2nd-best alternative is a genuinely bad,
  // no-longer-favored outcome (winPct < 50) AND the gap is well past Blunder-scale
  // (>= 30 win%-points, vs. the existing >20-loss Blunder cutoff) — i.e. missing
  // this move would have been a serious, critical-position error, not just
  // "slightly less good while still comfortably winning either way".
  if (
    onlyMoveOpen && secondBestCp != null &&
    winPct(bestCp) - winPct(secondBestCp) >= rt.greatOnlyMoveGapMin &&
    winPct(secondBestCp) < 50
  ) return verdict('Great')

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
  ) return verdict('Great')

  if (isEngineBestMove) return verdict('Best')

  // Miss: a win is on the board now (winPctBefore >= 80) that wasn't there before the
  // opponent's last move (winPctPrior < 80 — i.e. freshly created by their mistake),
  // and you let it slip back down to equal/worse (winPctAfter <= 55).
  if (
    winPctBefore != null && winPctAfter != null &&
    winPctBefore >= MISS_WIN_AVAILABLE &&
    winPctAfter <= MISS_RESULT_CEILING &&
    (winPctPrior == null || winPctPrior < MISS_WIN_AVAILABLE)
  ) return verdict('Miss')

  if (loss <= 2) return verdict('Excellent')
  if (loss <= 5) return verdict('Good')
  if (loss <= 10) return verdict('Inaccuracy')
  if (loss <= 20) return verdict('Mistake')
  return verdict('Blunder')
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
  return runAnalyses(moves, evalResults, openingPly, whiteRating, blackRating, null)
}

// For the two-pass batch analysis (engine/twoPass.ts): classifies the game from first-pass
// results (best line only) and reports the plies whose class can depend on the second-best
// line of the position before the move — only those get a second-line search. Deliberately a
// superset of what buildMoveAnalyses will read: the book is ignored (it only ever replaces a
// class by Book) and so is the one-Brilliant-per-combination rule (the earlier Brilliant may
// still fall to its own second line). Which plies come out as Mistake/Miss/Blunder does not
// depend on any second line, so `analyses` is already final in that respect.
export function probeSecondLine(
  moves: Move[],
  firstPass: (EvalResult | null)[],
  whiteRating?: number,
  blackRating?: number,
): { analyses: MoveAnalysis[]; sensitivePlies: Set<number> } {
  const sensitivePlies = new Set<number>()
  const analyses = runAnalyses(moves, firstPass, 0, whiteRating, blackRating, sensitivePlies)
  return { analyses, sensitivePlies }
}

// `probe` = null: the real classification. Otherwise the probeSecondLine mode, which collects
// the plies whose verdict can depend on the second-best line.
function runAnalyses(
  moves: Move[],
  evalResults: (EvalResult | null)[],
  openingPly: number,
  whiteRating: number | undefined,
  blackRating: number | undefined,
  probe: Set<number> | null,
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

    // Does the engine line after the move (evalAfter.pv, opponent first) win the offered
    // material straight back? Then it was a trade, not a sacrifice.
    const sacSquares = sacrificeSquares(moves[i])
    const sacrificeIsRegained = sacrificeRegained(moves[i], evalAfter.pv, sacSquares)

    // Playing anything but a mate while one was on the board is a Miss for chess.com (27.Qxf7+
    // instead of 27.Qd8#), never a Brilliant — even though win% barely moves at +12.
    const missedMate = evalToCp(evalBefore) * (isWhite ? 1 : -1) >= 10000 &&
      evalToCp(evalAfter) * (isWhite ? 1 : -1) < 10000

    // Did the opponent just blunder? Drives the Great "refutation" branch. Reads the previous
    // ply's already-computed class (Book/Forced/skipped plies leave it undefined = no blunder).
    const prevClass = classByPly.get(i - 1)
    const opponentBlundered = prevClass === 'Mistake' || prevClass === 'Blunder'

    // Trivial recapture: this move and the opponent's previous move both capture on the same
    // square (just restoring material) — excluded from Great.
    const prevMove = i > 0 ? moves[i - 1] : undefined
    const isTrivialRecapture = !!(prevMove?.captured && moves[i].captured && prevMove.to === moves[i].to)

    const { classification, secondLineMatters } = judgeMove(
      loss,
      isEngineBestMove,
      moves[i],
      winPct(cpBefore),
      cpBefore,
      secondBestCpMover,
      winPctPrior,
      winPctAfterRaw,
      playerRating,
      (probe == null && classByPly.get(i - 2) === 'Brilliant') || missedMate,
      sacrificeIsRegained,
      opponentBlundered,
      isTrivialRecapture,
    )
    if (probe != null && secondLineMatters) probe.add(i)

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
