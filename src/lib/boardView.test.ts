import { describe, it, expect } from 'vitest'
import { deriveBoardView, type BoardViewInput } from './boardView'
import type { EvalResult } from './engine/uci'

function evalOf(partial: Partial<EvalResult>): EvalResult {
  return {
    cp: null, mate: null, bestMoveSan: null, pv: null,
    secondBestCp: null, secondBestMoveSan: null, thirdBestCp: null, thirdBestMoveSan: null,
    ...partial,
  }
}

const AFTER = evalOf({ cp: 120 })
const BEFORE = evalOf({ cp: 30 })
const LIVE = evalOf({ cp: -50 })
const retryDrop = () => true
const playDrop = () => true
const puzzleDrop = () => true

function base(overrides: Partial<BoardViewInput> = {}): BoardViewInput {
  return {
    currentFen: 'CURRENT',
    lastMove: { from: 'e2', to: 'e4' },
    classification: 'Mistake',
    bestMoveArrow: { from: 'd2', to: 'd4' },
    evalAfter: AFTER,
    evalBefore: BEFORE,
    liveEval: null,
    retry: null,
    review: { sub: 'idle', bestPreview: null, lineSteps: [], explainStep: 0 },
    extraArrows: [{ from: 'a1', to: 'a8', color: 'orange' }],
    extraSquares: { e4: 'orange' },
    onRetryDrop: retryDrop,
    playout: null,
    puzzle: null,
    ...overrides,
  }
}

const BEST_PREVIEW = { san: 'd4', fen: 'BEST', from: 'd2', to: 'd4' } as const
const LINE = [
  { san: 'd4', fen: 'STEP0', from: 'd2', to: 'd4', captured: false },
  { san: 'd5', fen: 'STEP1', from: 'd7', to: 'd5', captured: false },
] as const

describe('deriveBoardView', () => {
  it('shows the current position with its tint, best-move arrow and stored eval', () => {
    const v = deriveBoardView(base())
    expect(v.fen).toBe('CURRENT')
    expect(v.classification).toBe('Mistake')
    expect([v.lastMoveFrom, v.lastMoveTo]).toEqual(['e2', 'e4'])
    expect(v.arrow).toEqual({ from: 'd2', to: 'd4' })
    expect(v.evalResult).toBe(AFTER)
    expect(v.reviewEval).toBe(AFTER)
    expect(v.interactive).toBe(false)
    expect(v.extraArrows).toHaveLength(1)
  })

  it('falls back to the live eval before the batch analysis exists', () => {
    expect(deriveBoardView(base({ evalAfter: null, liveEval: LIVE })).evalResult).toBe(LIVE)
  })

  it('best preview shows the engine move with the pre-move eval', () => {
    const v = deriveBoardView(base({
      review: { sub: 'best', bestPreview: { ...BEST_PREVIEW }, lineSteps: [], explainStep: 0 },
    }))
    expect(v.fen).toBe('BEST')
    expect(v.classification).toBe('Best')
    expect(v.arrow).toEqual({ from: 'd2', to: 'd4' })
    expect(v.evalResult).toBe(BEFORE)
    expect(v.reviewEval).toBe(BEFORE)
  })

  it('explain steps through the line, following the live eval once it arrives', () => {
    const review = { sub: 'explain' as const, bestPreview: null, lineSteps: [...LINE], explainStep: 1 }
    const pending = deriveBoardView(base({ review }))
    expect(pending.fen).toBe('STEP1')
    expect(pending.arrow).toBeUndefined()
    expect(pending.evalResult).toBe(BEFORE) // no live score yet → pre-move eval
    expect(deriveBoardView(base({ review, liveEval: LIVE })).evalResult).toBe(LIVE)
  })

  it('explain steps a forced-mate fallback down along the line', () => {
    const v = deriveBoardView(base({
      evalBefore: evalOf({ mate: 2 }),
      review: { sub: 'explain', bestPreview: null, lineSteps: [...LINE], explainStep: 1 },
    }))
    expect(v.evalResult?.mate).toBeLessThan(2)
  })

  it('retry hides the played move, accepts drops, then badges and reveals', () => {
    const waiting = deriveBoardView(base({ retry: { trialFen: null, attempt: null } }))
    expect(waiting.classification).toBeUndefined()
    expect(waiting.lastMoveFrom).toBeUndefined()
    expect(waiting.arrow).toBeUndefined()
    expect(waiting.interactive).toBe(true)
    expect(waiting.onDrop).toBe(retryDrop)

    const tried = deriveBoardView(base({
      retry: { trialFen: 'TRIAL', revealArrow: { from: 'g1', to: 'f3' }, attempt: { to: 'e5', isCorrect: false } },
    }))
    expect(tried.fen).toBe('TRIAL')
    expect(tried.interactive).toBe(false)
    expect(tried.arrow).toEqual({ from: 'g1', to: 'f3' })
    expect(tried.resultBadge).toEqual({ square: 'e5', correct: false })
  })

  it('retry wins over a review preview', () => {
    const v = deriveBoardView(base({
      retry: { trialFen: null, attempt: null },
      review: { sub: 'best', bestPreview: { ...BEST_PREVIEW }, lineSteps: [], explainStep: 0 },
    }))
    expect(v.fen).toBe('CURRENT')
    expect(v.classification).toBeUndefined()
  })

  it('play-out takes the board over, but the review eval stays for the coach badge', () => {
    const v = deriveBoardView(base({
      liveEval: LIVE,
      retry: { trialFen: null, attempt: null },
      playout: { fen: 'PLAY', lastMove: { from: 'c7', to: 'c5' }, isUserTurn: true, onDrop: playDrop },
    }))
    expect(v.fen).toBe('PLAY')
    expect([v.lastMoveFrom, v.lastMoveTo]).toEqual(['c7', 'c5'])
    expect(v.classification).toBeUndefined()
    expect(v.arrow).toBeUndefined()
    expect(v.evalResult).toBe(LIVE)
    expect(v.reviewEval).toBe(AFTER)
    expect(v.onDrop).toBe(playDrop)
    expect(v.extraArrows).toBeUndefined()
    expect(v.extraSquares).toBeUndefined()
  })

  it('puzzle shows the start position, then the attempt, then the revealed solution', () => {
    const puzzle = {
      fenBefore: 'PUZZLE', evalBefore: BEFORE, attempt: null, revealed: false,
      bestPreview: { ...BEST_PREVIEW }, onDrop: puzzleDrop,
    }
    const start = deriveBoardView(base({ puzzle }))
    expect(start.fen).toBe('PUZZLE')
    expect(start.interactive).toBe(true)
    expect(start.arrow).toBeUndefined()
    expect(start.evalResult).toBe(BEFORE)
    expect(start.onDrop).toBe(puzzleDrop)

    const attempted = deriveBoardView(base({ puzzle: { ...puzzle, attempt: { fen: 'TRY', to: 'h5', correct: true } } }))
    expect(attempted.fen).toBe('TRY')
    expect(attempted.interactive).toBe(false)
    expect(attempted.resultBadge).toEqual({ square: 'h5', correct: true })

    const revealed = deriveBoardView(base({ puzzle: { ...puzzle, revealed: true } }))
    expect(revealed.fen).toBe('BEST')
    expect(revealed.arrow).toEqual({ from: 'd2', to: 'd4' })
    expect(revealed.interactive).toBe(false)
  })

  it('play-out wins over a puzzle', () => {
    const v = deriveBoardView(base({
      playout: { fen: 'PLAY', lastMove: null, isUserTurn: false, onDrop: playDrop },
      puzzle: {
        fenBefore: 'PUZZLE', evalBefore: null, attempt: null, revealed: false, bestPreview: null, onDrop: puzzleDrop,
      },
    }))
    expect(v.fen).toBe('PLAY')
    expect(v.interactive).toBe(false)
  })
})
