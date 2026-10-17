import type { MoveClass } from './analysis/classify'
import type { BestPreview, LineStep } from './analysis/review'
import { explainStepMate } from './analysis/review'
import type { EvalResult } from './engine/uci'

// What the board column shows (position, last-move tint, arrows, eval bar, interactivity),
// derived from whichever mode currently owns the board. Precedence, highest first:
//   1. Practice-from-here play-out   2. Puzzle drill
//   3. Retry-at-key-moments          4. Guided-review best/explain previews
//   5. The plain current position
// Pure — App.tsx feeds it hook state and renders the result; see boardView.test.ts.

export interface SquarePair {
  from: string
  to: string
}

export interface ColoredArrow extends SquarePair {
  color: string
}

export type DropHandler = (from: string, to: string) => boolean

export interface BoardViewInput {
  currentFen: string
  // The move that led to currentFen (null at the start position).
  lastMove: SquarePair | null
  // Its classification, when analyzed.
  classification?: MoveClass
  // Green "you should have played this" arrow for the move that led here.
  bestMoveArrow?: SquarePair
  // Stored batch evals of the current position and the one before it.
  evalAfter: EvalResult | null
  evalBefore: EvalResult | null
  // Live result of the primary worker's latest single search (explain / play-out).
  liveEval: EvalResult | null
  // Retry-at-key-moments, when active. trialFen = position after the user's attempt.
  retry: {
    trialFen: string | null
    revealArrow?: SquarePair
    attempt: { to: string; isCorrect: boolean | null } | null
  } | null
  review: {
    sub: 'idle' | 'explain' | 'best'
    bestPreview: BestPreview | null
    lineSteps: LineStep[]
    explainStep: number
  }
  // Coach / threat / engine-line overlays of the review chapter.
  extraArrows?: ColoredArrow[]
  extraSquares?: Record<string, string>
  onRetryDrop: DropHandler
  // Practice-from-here, when active (fen known).
  playout: { fen: string; lastMove: SquarePair | null; isUserTurn: boolean; onDrop: DropHandler } | null
  // Puzzle drill, when active (a puzzle is current).
  puzzle: {
    fenBefore: string
    evalBefore: EvalResult | null
    attempt: { fen: string; to: string; correct: boolean } | null
    revealed: boolean
    bestPreview: BestPreview | null
    onDrop: DropHandler
  } | null
}

export interface BoardView {
  fen: string
  classification?: MoveClass
  lastMoveFrom?: string
  lastMoveTo?: string
  arrow?: SquarePair
  // What the eval bar shows.
  evalResult: EvalResult | null
  // The guided-review eval (before the play-out/puzzle takeovers) — feeds the coach bubble's
  // badge so badge and eval bar come from one source while the review chapter is visible.
  reviewEval: EvalResult | null
  interactive: boolean
  onDrop?: DropHandler
  resultBadge?: { square: string; correct: boolean }
  extraArrows?: ColoredArrow[]
  extraSquares?: Record<string, string>
}

export function deriveBoardView(input: BoardViewInput): BoardView {
  const { retry, review } = input

  // 5 + 3: the current position, or retry mode (which hides the played move's tint/badge and
  // reveals the engine's best move once an attempt was made).
  const view: BoardView = {
    fen: retry?.trialFen ?? input.currentFen,
    classification: retry ? undefined : input.classification,
    lastMoveFrom: retry ? undefined : input.lastMove?.from,
    lastMoveTo: retry ? undefined : input.lastMove?.to,
    arrow: retry ? retry.revealArrow : input.bestMoveArrow,
    // Defaults to the main line's eval. The best/explain branches below override it so the
    // eval bar stays in sync with the previewed position instead of the post-move eval.
    evalResult: input.evalAfter ?? input.liveEval,
    reviewEval: null,
    interactive: retry != null && retry.trialFen === null,
    onDrop: input.onRetryDrop,
    resultBadge: retry?.attempt && retry.attempt.isCorrect !== null
      ? { square: retry.attempt.to, correct: retry.attempt.isCorrect }
      : undefined,
    extraArrows: input.extraArrows,
    extraSquares: input.extraSquares,
  }

  // 4: guided-review previews (only when not retrying).
  const step = review.lineSteps[review.explainStep]
  if (!retry && review.sub === 'best' && review.bestPreview) {
    const p = review.bestPreview
    view.fen = p.fen
    view.classification = 'Best'
    view.lastMoveFrom = p.from
    view.lastMoveTo = p.to
    view.arrow = { from: p.from, to: p.to }
    // A best move is best play, so the pre-move eval is exactly what it reaches.
    view.evalResult = input.evalBefore ?? input.liveEval
  } else if (!retry && review.sub === 'explain' && step) {
    view.fen = step.fen
    view.classification = 'Book'
    view.lastMoveFrom = step.from
    view.lastMoveTo = step.to
    view.arrow = undefined
    // Follows the live evaluation of the shown PV position (the explain handlers start that
    // search). Until its first score arrives, fall back to the pre-move eval, with a forced-mate
    // count stepped down along the line so a mate PV doesn't look frozen either.
    const pre = input.evalBefore
    const fallback = pre && pre.mate !== null
      ? { ...pre, mate: explainStepMate(pre.mate, review.lineSteps.length, review.explainStep) }
      : pre
    view.evalResult = input.liveEval ?? fallback
  }
  view.reviewEval = view.evalResult

  // 1 + 2: practice / puzzle take the whole board over; the review overlays are suppressed.
  if (input.playout) {
    const p = input.playout
    view.fen = p.fen
    view.lastMoveFrom = p.lastMove?.from
    view.lastMoveTo = p.lastMove?.to
    view.classification = undefined
    view.arrow = undefined
    view.evalResult = input.liveEval ?? view.evalResult // live eval from the play-out search
    view.interactive = p.isUserTurn
    view.onDrop = p.onDrop
    view.resultBadge = undefined
    view.extraArrows = undefined
    view.extraSquares = undefined
  } else if (input.puzzle) {
    const z = input.puzzle
    const shown = z.revealed ? z.bestPreview : null
    view.fen = z.attempt?.fen ?? shown?.fen ?? z.fenBefore
    view.classification = undefined
    view.lastMoveFrom = shown?.from
    view.lastMoveTo = shown?.to
    view.arrow = shown ? { from: shown.from, to: shown.to } : undefined
    view.evalResult = z.evalBefore
    view.interactive = z.attempt === null && !z.revealed
    view.onDrop = z.onDrop
    view.resultBadge = z.attempt ? { square: z.attempt.to, correct: z.attempt.correct } : undefined
    view.extraArrows = undefined
    view.extraSquares = undefined
  }

  return view
}
