import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useGame } from './hooks/useGame'
import { useEngine } from './lib/engine/useEngine'
import { GamePicker } from './components/GamePicker'
import { BoardPanel } from './components/BoardPanel'
import { NavControls } from './components/NavControls'
import { MoveList } from './components/MoveList'
import { EvalPanel } from './components/EvalPanel'
import { EvalGraph } from './components/EvalGraph'
import { buildMoveAnalyses, playerAccuracy, findKeyMoments } from './lib/analysis/classify'
import { detectOpening } from './lib/analysis/openings'
import { OpeningBadge } from './components/OpeningBadge'
import { EvalBar } from './components/EvalBar'
import { useCoaching } from './hooks/useCoaching'
import { CoachingPanel } from './components/CoachingPanel'
import { ClassLegend } from './components/ClassLegend'

function App() {
  const {
    currentFen,
    fens,
    moves,
    currentPly,
    error,
    isLoaded,
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
    return buildMoveAnalyses(moves, evalResults, openingPly)
  }, [moves, evalResults, openingPly])

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

  const { explanation, isLoading: coachingLoading, error: coachingError, apiKey, saveApiKey, explainMove, reset: resetCoaching } = useCoaching()

  const prevPlyRef = useRef<number>(currentPly)
  useEffect(() => {
    if (prevPlyRef.current !== currentPly) {
      prevPlyRef.current = currentPly
      resetCoaching()
    }
  }, [currentPly, resetCoaching])

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
    moveAnalyses[currentPly - 1]?.classification !== 'Book'

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

  useEffect(() => {
    const pgn = new URLSearchParams(window.location.search).get('pgn')
    if (pgn) handleLoadPgn(pgn)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs once on mount

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goToNext() }
      else if (e.key === 'Home') { e.preventDefault(); goToFirst() }
      else if (e.key === 'End') { e.preventDefault(); goToLast() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goToFirst, goToPrev, goToNext, goToLast])

  return (
    <div className="h-screen bg-cc-bg text-cc-text flex flex-col overflow-hidden">
      <GamePicker onLoad={handleLoadPgn} error={error} />

      <div className="flex flex-1 min-h-0">
        {/* ── Left: Board — width matches board+evalbar+padding exactly (no middle gap) ── */}
        <div className="shrink-0 flex flex-col p-3 gap-2" style={{ width: 'calc(100vh - 64px)' }}>
          <div className="flex flex-row items-stretch" style={{ height: 'calc(100vh - 128px)' }}>
            <EvalBar evalResult={evalResults[currentPly] ?? result} />
            <div className="aspect-square h-full">
              <BoardPanel
                fen={currentFen}
                lastMoveTo={currentPly > 0 ? moves[currentPly - 1].to : undefined}
                classification={currentPly > 0 ? moveAnalyses?.[currentPly - 1]?.classification : undefined}
              />
            </div>
          </div>
          <NavControls
            onFirst={goToFirst}
            onPrev={goToPrev}
            onNext={goToNext}
            onLast={goToLast}
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
              onEvaluate={handleEvaluate}
              onAnalyzeGame={handleAnalyzeGame}
            />
          </div>
          <MoveList
            moves={moves}
            currentPly={currentPly}
            onSelectPly={goToPly}
            moveAnalyses={moveAnalyses}
            keyMoments={keyMoments}
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
          <ClassLegend />
          <div className="shrink-0 border-t border-cc-border">
            <CoachingPanel
              apiKey={apiKey}
              onSaveApiKey={saveApiKey}
              canExplain={canExplain}
              onExplain={handleExplain}
              explanation={explanation}
              isLoading={coachingLoading}
              error={coachingError}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
