import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useGame } from './hooks/useGame'
import { useEngine } from './lib/engine/useEngine'
import { GamePicker } from './components/GamePicker'
import { BoardPanel } from './components/BoardPanel'
import { NavControls } from './components/NavControls'
import { MoveList } from './components/MoveList'
import { EvalPanel } from './components/EvalPanel'
import { EvalGraph } from './components/EvalGraph'
import { buildMoveAnalyses, playerAccuracy, phaseAccuracy, findKeyMoments } from './lib/analysis/classify'
import { getBestMoveArrow, getAttackArrows, getThreatArrow } from './lib/analysis/arrows'
import { getEngineLines } from './lib/analysis/lines'
import { EngineLines } from './components/EngineLines'
import { attemptMove, isBestMove } from './lib/analysis/retry'
import { detectOpening } from './lib/analysis/openings'
import { OpeningBadge } from './components/OpeningBadge'
import { EvalBar } from './components/EvalBar'
import { useCoaching } from './hooks/useCoaching'
import { CoachingPanel } from './components/CoachingPanel'
import { ClassLegend } from './components/ClassLegend'
import { RetryPanel } from './components/RetryPanel'

function App() {
  const {
    currentFen,
    fens,
    moves,
    currentPly,
    error,
    isLoaded,
    whiteElo,
    blackElo,
    canGoPrev,
    canGoNext,
    loadPgn,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    goToPly,
  } = useGame()

  const {
    isReady,
    isEvaluating,
    isAnalyzing,
    result,
    evalResults,
    analysisProgress,
    error: engineError,
    evaluate,
    analyzeGame,
    clearAnalysis,
  } = useEngine()

  const autoEvalRef = useRef(false)
  // Tracks which ply was last auto-evaluated to prevent re-triggering when isEvaluating flips
  const autoEvalPlyRef = useRef<number>(-1)

  useEffect(() => {
    if (!autoEvalRef.current) return
    if (!isReady || !isLoaded || isAnalyzing || isEvaluating) return
    if (autoEvalPlyRef.current === currentPly) return   // already evaluated this ply
    autoEvalPlyRef.current = currentPly
    evaluate(currentFen)
  }, [currentPly, currentFen, isReady, isLoaded, isAnalyzing, isEvaluating, evaluate])

  const handleEvaluate = useCallback(() => {
    autoEvalRef.current = true
    autoEvalPlyRef.current = currentPly   // prevent effect from double-evaluating on first click
    evaluate(currentFen)
  }, [evaluate, currentFen, currentPly])

  const openingResult = useMemo(
    () => (fens.length > 0 ? detectOpening(fens) : null),
    [fens],
  )
  const openingPly = openingResult?.fenPly ?? 0

  const moveAnalyses = useMemo(() => {
    if (evalResults.length === 0) return null
    return buildMoveAnalyses(moves, evalResults, openingPly, whiteElo, blackElo)
  }, [moves, evalResults, openingPly, whiteElo, blackElo])

  const keyMoments = useMemo(
    () => (moveAnalyses ? findKeyMoments(moveAnalyses) : new Set<number>()),
    [moveAnalyses],
  )
  const keyMomentPlies = useMemo(() => [...keyMoments].map(i => i + 1), [keyMoments])

  const whiteAccuracy = useMemo(
    () => (moveAnalyses ? playerAccuracy(moveAnalyses, 'white') : null),
    [moveAnalyses],
  )
  const blackAccuracy = useMemo(
    () => (moveAnalyses ? playerAccuracy(moveAnalyses, 'black') : null),
    [moveAnalyses],
  )
  const whitePhaseAccuracy = useMemo(
    () => (moveAnalyses ? phaseAccuracy(moveAnalyses, 'white') : null),
    [moveAnalyses],
  )
  const blackPhaseAccuracy = useMemo(
    () => (moveAnalyses ? phaseAccuracy(moveAnalyses, 'black') : null),
    [moveAnalyses],
  )

  const { explanation, isLoading: coachingLoading, error: coachingError, apiKey, saveApiKey, explainMove, reset: resetCoaching } = useCoaching()

  const [showBestMoveArrow, setShowBestMoveArrow] = useState(false)
  const [showThreatArrow, setShowThreatArrow] = useState(false)
  const [showEngineLines, setShowEngineLines] = useState(false)
  const [hoveredLineSan, setHoveredLineSan] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const handleFlip = useCallback(() => setOrientation(o => (o === 'white' ? 'black' : 'white')), [])

  // Retry-at-key-moments. retryMoveIndex is the 0-based moveIndex being retried (fens[moveIndex]
  // is the position BEFORE that move — the position the user tries an alternative from).
  // trialFen overlays the board with the user's attempted position; useGame's currentPly/fens
  // are never mutated by a retry attempt.
  const [retryMoveIndex, setRetryMoveIndex] = useState<number | null>(null)
  const [trialFen, setTrialFen] = useState<string | null>(null)
  const [attemptResult, setAttemptResult] = useState<{ san: string; isCorrect: boolean | null } | null>(null)

  const prevPlyRef = useRef<number>(currentPly)
  useEffect(() => {
    if (prevPlyRef.current !== currentPly) {
      prevPlyRef.current = currentPly
      resetCoaching()
      setShowBestMoveArrow(false)
      setShowThreatArrow(false)
      setShowEngineLines(false)
      setHoveredLineSan(null)
      // Don't clear retry state when the ply change IS the retry entry itself (handleRetry
      // sets retryMoveIndex and calls goToPly in the same batch, so they land together here).
      // Any other navigation (Prev/Next/jump) changes currentPly without retryMoveIndex
      // following it, which is exactly when retry mode should end.
      if (currentPly !== retryMoveIndex) {
        setRetryMoveIndex(null)
        setTrialFen(null)
        setAttemptResult(null)
      }
    }
  }, [currentPly, resetCoaching, retryMoveIndex])

  // Green suggestion arrow — only meaningful when the played move differs from the engine's best.
  const bestMoveArrow = useMemo(() => {
    if (!showBestMoveArrow || currentPly === 0) return undefined
    const bestMoveSan = evalResults[currentPly - 1]?.bestMoveSan
    if (!bestMoveSan || bestMoveSan === moves[currentPly - 1].san) return undefined
    return getBestMoveArrow(fens[currentPly - 1], bestMoveSan) ?? undefined
  }, [showBestMoveArrow, currentPly, evalResults, moves, fens])

  // Red threat arrow — the engine's best move in the CURRENT position (side-to-move's
  // strongest reply). Meaningful at ply 0 too, so no currentPly > 0 gate.
  const threatArrow = useMemo(() => {
    if (!showThreatArrow) return undefined
    const threatSan = evalResults[currentPly]?.bestMoveSan
    return getThreatArrow(currentFen, threatSan ?? null) ?? undefined
  }, [showThreatArrow, currentPly, evalResults, currentFen])

  // T7c engine-lines panel: the current position's top-3 MultiPV candidates (chess.com's
  // analysis-mode "Number of Lines"), best first. Uses evalResults[currentPly] when the
  // full game has been analyzed, falling back to the single-position `result` otherwise.
  const engineLines = useMemo(
    () => getEngineLines(evalResults[currentPly] ?? result),
    [evalResults, currentPly, result],
  )

  // Single green arrow for whichever line is hovered (or the best line by default) — chess.com
  // never draws more than one candidate arrow simultaneously, see IMPLEMENTATION_PLAN.md T7c.
  const candidateArrow = useMemo(() => {
    if (!showEngineLines) return undefined
    const san = hoveredLineSan ?? engineLines[0]?.san
    if (!san) return undefined
    return getBestMoveArrow(currentFen, san) ?? undefined
  }, [showEngineLines, hoveredLineSan, engineLines, currentFen])

  // Attack/attacked-by arrows — pure board geometry, always shown for the current move.
  const attackArrows = useMemo(() => {
    if (currentPly === 0) return undefined
    const move = moves[currentPly - 1]
    return getAttackArrows(currentFen, move.to, move.color)
  }, [currentPly, moves, currentFen])

  // Retry-at-key-moments: reveals the engine's best move once an attempt has been made,
  // reusing getBestMoveArrow exactly as the normal-mode bestMoveArrow above does.
  const retryRevealArrow = useMemo(() => {
    if (retryMoveIndex === null || attemptResult === null) return undefined
    const bestSan = evalResults[retryMoveIndex]?.bestMoveSan
    if (!bestSan) return undefined
    return getBestMoveArrow(fens[retryMoveIndex], bestSan) ?? undefined
  }, [retryMoveIndex, attemptResult, evalResults, fens])

  const handleRetry = useCallback((moveIndex: number) => {
    setRetryMoveIndex(moveIndex)
    setTrialFen(null)
    setAttemptResult(null)
    goToPly(moveIndex)
  }, [goToPly])

  const handleTrialDrop = useCallback((from: string, to: string): boolean => {
    if (retryMoveIndex === null) return false
    const result = attemptMove(currentFen, from, to)
    if (!result) return false
    const bestSan = evalResults[retryMoveIndex]?.bestMoveSan ?? null
    setTrialFen(result.fenAfter)
    setAttemptResult({ san: result.san, isCorrect: isBestMove(result.san, bestSan) })
    return true
  }, [retryMoveIndex, currentFen, evalResults])

  const handleRetryAgain = useCallback(() => {
    setTrialFen(null)
    setAttemptResult(null)
  }, [])

  const handleExitRetry = useCallback(() => {
    setRetryMoveIndex(null)
    setTrialFen(null)
    setAttemptResult(null)
  }, [])

  // Sound effects
  const captureAudioRef = useRef<HTMLAudioElement | null>(null)
  const moveAudioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    captureAudioRef.current = new Audio('/sounds/capture.mp3')
    moveAudioRef.current = new Audio('/sounds/move-self.mp3')
  }, [])
  const soundPlyRef = useRef(currentPly)
  useEffect(() => {
    const prev = soundPlyRef.current
    soundPlyRef.current = currentPly
    if (currentPly !== prev + 1 || currentPly === 0) return
    const move = moves[currentPly - 1]
    const audio = move.captured ? captureAudioRef.current : moveAudioRef.current
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}) }
  }, [currentPly, moves])

  const canExplain =
    currentPly > 0 &&
    evalResults[currentPly - 1] != null &&
    evalResults[currentPly] != null &&
    moveAnalyses != null &&
    moveAnalyses[currentPly - 1]?.classification !== 'Book' &&
    moveAnalyses[currentPly - 1]?.classification !== 'Forced'

  const canShowBestMove = currentPly > 0 && evalResults[currentPly - 1]?.bestMoveSan != null
  const canShowThreat = evalResults[currentPly]?.bestMoveSan != null
  const canShowLines = (evalResults[currentPly] ?? result)?.bestMoveSan != null

  const handleToggleBestMoveArrow = useCallback(() => {
    setShowBestMoveArrow(v => !v)
  }, [])

  const handleToggleThreatArrow = useCallback(() => {
    setShowThreatArrow(v => !v)
  }, [])

  const handleToggleEngineLines = useCallback(() => {
    setShowEngineLines(v => !v)
  }, [])

  const handleExplain = useCallback(() => {
    if (!canExplain || !moveAnalyses) return
    explainMove({
      fenBefore: fens[currentPly - 1],
      sanPlayed: moves[currentPly - 1].san,
      evalBefore: evalResults[currentPly - 1]!,
      evalAfter: evalResults[currentPly]!,
      analysis: moveAnalyses[currentPly - 1],
    })
  }, [canExplain, moveAnalyses, fens, moves, evalResults, currentPly, explainMove])

  const handleAnalyzeGame = useCallback(
    () => analyzeGame(fens),
    [analyzeGame, fens],
  )

  const handleLoadPgn = useCallback((pgn: string) => {
    clearAnalysis()
    loadPgn(pgn)
  }, [clearAnalysis, loadPgn])

  const [initialUsername, setInitialUsername] = useState<string | null>(null)
  const [autoFetch, setAutoFetch] = useState(false)
  const urlParamsHandledRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pgn = params.get('pgn')
    const username = params.get('username')

    if (!urlParamsHandledRef.current && pgn) {
      urlParamsHandledRef.current = true
      handleLoadPgn(pgn)
    } else if (!urlParamsHandledRef.current && username) {
      urlParamsHandledRef.current = true
      setInitialUsername(username)
      setAutoFetch(params.get('autofetch') === '1')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs once on mount

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goToNext() }
      else if (e.key === 'Home') { e.preventDefault(); goToFirst() }
      else if (e.key === 'End') { e.preventDefault(); goToLast() }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goToFirst, goToPrev, goToNext, goToLast, handleFlip])

  return (
    <div className="h-screen bg-cc-bg text-cc-text flex flex-col overflow-hidden">
      <GamePicker
        onLoad={handleLoadPgn}
        error={error}
        initialUsername={initialUsername}
        autoFetch={autoFetch}
      />

      <div className="flex flex-1 min-h-0">
        {/* ── Left: Board — width matches board+evalbar+padding exactly (no middle gap) ── */}
        <div className="shrink-0 flex flex-col p-3 gap-2" style={{ width: 'calc(100vh - 64px)' }}>
          <div className="flex flex-row items-stretch" style={{ height: 'calc(100vh - 128px)' }}>
            <EvalBar evalResult={evalResults[currentPly] ?? result} />
            <div className="aspect-square h-full">
              <BoardPanel
                fen={trialFen ?? currentFen}
                lastMoveFrom={retryMoveIndex === null && currentPly > 0 ? moves[currentPly - 1].from : undefined}
                lastMoveTo={retryMoveIndex === null && currentPly > 0 ? moves[currentPly - 1].to : undefined}
                classification={retryMoveIndex === null ? moveAnalyses?.[currentPly - 1]?.classification : undefined}
                bestMoveArrow={retryMoveIndex !== null ? retryRevealArrow : bestMoveArrow}
                attackArrows={attackArrows}
                threatArrow={threatArrow}
                candidateArrow={candidateArrow}
                orientation={orientation}
                interactive={retryMoveIndex !== null && trialFen === null}
                onPieceDrop={handleTrialDrop}
              />
            </div>
          </div>
          <NavControls
            onFirst={goToFirst}
            onPrev={goToPrev}
            onNext={goToNext}
            onLast={goToLast}
            onFlip={handleFlip}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            isLoaded={isLoaded}
          />
        </div>

        {/* ── Right: Sidebar — fills remaining width ── */}
        <div className="flex-1 min-w-0 border-l border-cc-border flex flex-col overflow-hidden">
          <OpeningBadge opening={openingResult?.opening ?? null} />
          <div className="shrink-0 px-2 py-2 border-b border-cc-border/60">
            <EvalPanel
              isReady={isReady}
              isEvaluating={isEvaluating}
              isAnalyzing={isAnalyzing}
              analysisProgress={analysisProgress}
              result={result}
              error={engineError}
              isGameLoaded={isLoaded}
              whiteAccuracy={whiteAccuracy}
              blackAccuracy={blackAccuracy}
              whitePhaseAccuracy={whitePhaseAccuracy}
              blackPhaseAccuracy={blackPhaseAccuracy}
              onEvaluate={handleEvaluate}
              onAnalyzeGame={handleAnalyzeGame}
            />
          </div>
          {showEngineLines && engineLines.length > 0 && (
            <div className="shrink-0 px-2 pb-2">
              <EngineLines lines={engineLines} onHoverLine={setHoveredLineSan} />
            </div>
          )}
          <MoveList
            moves={moves}
            currentPly={currentPly}
            onSelectPly={goToPly}
            moveAnalyses={moveAnalyses}
            keyMoments={keyMoments}
            onRetry={handleRetry}
          />
          {evalResults.length > 0 && (
            <div className="shrink-0 border-t border-cc-border">
              <EvalGraph
                evalResults={evalResults}
                currentPly={currentPly}
                onSelectPly={goToPly}
                keyMomentPlies={keyMomentPlies}
              />
            </div>
          )}
          <ClassLegend moveAnalyses={moveAnalyses} />
          {retryMoveIndex !== null && moveAnalyses?.[retryMoveIndex] && (
            <div className="shrink-0 border-t border-cc-border p-2">
              <RetryPanel
                originalSan={moves[retryMoveIndex].san}
                originalClassification={moveAnalyses[retryMoveIndex].classification}
                attempt={attemptResult}
                onRetryAgain={handleRetryAgain}
                onExit={handleExitRetry}
              />
            </div>
          )}
          <div className="shrink-0 border-t border-cc-border">
            <CoachingPanel
              apiKey={apiKey}
              onSaveApiKey={saveApiKey}
              canExplain={canExplain}
              onExplain={handleExplain}
              explanation={explanation}
              isLoading={coachingLoading}
              error={coachingError}
              canShowBestMove={canShowBestMove}
              showBestMoveArrow={showBestMoveArrow}
              onToggleBestMoveArrow={handleToggleBestMoveArrow}
              canShowThreat={canShowThreat}
              showThreatArrow={showThreatArrow}
              onToggleThreatArrow={handleToggleThreatArrow}
              canShowLines={canShowLines}
              showEngineLines={showEngineLines}
              onToggleEngineLines={handleToggleEngineLines}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
