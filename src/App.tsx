import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useGame } from './hooks/useGame'
import { useEngine } from './lib/engine/useEngine'
import { GamePicker } from './components/GamePicker'
import { BoardPanel } from './components/BoardPanel'
import { NavControls } from './components/NavControls'
import { MoveList } from './components/MoveList'
import { EvalPanel } from './components/EvalPanel'
import { EvalGraph } from './components/EvalGraph'
import { buildMoveAnalyses, playerAccuracy, findKeyMoments } from './lib/analysis/classify'
import { getBestMoveArrow, getAttackArrows, getThreatArrow } from './lib/analysis/arrows'
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

  const [showBestMoveArrow, setShowBestMoveArrow] = useState(false)
  const [showThreatArrow, setShowThreatArrow] = useState(false)

  const prevPlyRef = useRef<number>(currentPly)
  useEffect(() => {
    if (prevPlyRef.current !== currentPly) {
      prevPlyRef.current = currentPly
      resetCoaching()
      setShowBestMoveArrow(false)
      setShowThreatArrow(false)
    }
  }, [currentPly, resetCoaching])

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

  // Attack/attacked-by arrows — pure board geometry, always shown for the current move.
  const attackArrows = useMemo(() => {
    if (currentPly === 0) return undefined
    const move = moves[currentPly - 1]
    return getAttackArrows(currentFen, move.to, move.color)
  }, [currentPly, moves, currentFen])

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

  const handleToggleBestMoveArrow = useCallback(() => {
    setShowBestMoveArrow(v => !v)
  }, [])

  const handleToggleThreatArrow = useCallback(() => {
    setShowThreatArrow(v => !v)
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
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goToFirst, goToPrev, goToNext, goToLast])

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
                fen={currentFen}
                lastMoveFrom={currentPly > 0 ? moves[currentPly - 1].from : undefined}
                lastMoveTo={currentPly > 0 ? moves[currentPly - 1].to : undefined}
                classification={currentPly > 0 ? moveAnalyses?.[currentPly - 1]?.classification : undefined}
                bestMoveArrow={bestMoveArrow}
                attackArrows={attackArrows}
                threatArrow={threatArrow}
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
          <ClassLegend moveAnalyses={moveAnalyses} />
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
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
