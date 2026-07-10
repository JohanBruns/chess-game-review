import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useGame } from './hooks/useGame'
import { useEngine } from './lib/engine/useEngine'
import { GamePicker } from './components/GamePicker'
import { BoardPanel } from './components/BoardPanel'
import { PlayerBar } from './components/PlayerBar'
import { NavControls } from './components/NavControls'
import { BoardToolbar } from './components/BoardToolbar'
import { MoveList } from './components/MoveList'
import { EvalPanel } from './components/EvalPanel'
import { EvalGraph } from './components/EvalGraph'
import { buildMoveAnalyses, findKeyMoments } from './lib/analysis/classify'
import { remainingClockSeconds } from './lib/analysis/clocks'
import type { MoveClass } from './lib/analysis/classify'
import { buildGameSummary } from './lib/analysis/summary'
import { getBestMoveArrow, getThreatArrow } from './lib/analysis/arrows'
import { getEngineLines } from './lib/analysis/lines'
import {
  reviewHeadlineParts,
  formatEvalBadge,
  buildLineSteps,
  buildBestPreview,
  explainStepMate,
} from './lib/analysis/review'
import type { HeadlineParts } from './lib/analysis/review'
import { detectThemes, type ThemeHighlight } from './lib/analysis/tactics'
import { buildCommentary } from './lib/analysis/commentary'
import { attemptMove, isBestMove } from './lib/analysis/retry'
import { extractPuzzles } from './lib/analysis/puzzles'
import { detectOpening } from './lib/analysis/openings'
import { OpeningBadge } from './components/OpeningBadge'
import { EvalBar } from './components/EvalBar'
import { ReviewView } from './components/ReviewView'
import { SummaryView } from './components/SummaryView'
import { RetryPanel } from './components/RetryPanel'
import { PlayoutPanel } from './components/PlayoutPanel'
import { PuzzlePanel } from './components/PuzzlePanel'
import { ThemePicker } from './components/ThemePicker'
import { SettingsMenu } from './components/SettingsMenu'
import { useTheme } from './hooks/useTheme'
import { useSettings } from './hooks/useSettings'
import { usePlayout } from './hooks/usePlayout'
import { usePuzzles } from './hooks/usePuzzles'
import { exportBoardImage, downloadBlob } from './lib/boardImage'

// Coach tactical-theme highlight colors (Phase 4) — orange, distinct from the green best-move
// arrow so both can show at once. Square tint is translucent so the piece stays legible.
const THEME_ARROW_COLOR = '#e2903f'
const THEME_SQUARE_COLOR = 'rgba(226, 144, 63, 0.45)'
// Threat arrow (settings.showThreatArrow) — matches --color-cc-red so it reads as a warning,
// distinct from the green best-move arrow and the orange coach-theme arrows.
const THREAT_ARROW_COLOR = '#e5533d'
// Engine-lines hover candidate arrow (settings.showEngineLines) — a third, neutral color so it
// never gets confused with the best-move or threat arrows when several show at once.
const CANDIDATE_ARROW_COLOR = '#4f9fe8'
// How often "Next" auto-advances while settings.autoplay is on, in the guided Review chapter.
const AUTOPLAY_INTERVAL_MS = 1500

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
    whiteName,
    blackName,
    canGoPrev,
    canGoNext,
    loadPgn,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    goToPly,
    pgn,
    moveTimeSeconds,
    clocks,
    timeControl,
  } = useGame()

  const {
    isReady,
    isAnalyzing,
    result,
    evalResults,
    analysisProgress,
    error: engineError,
    analyzeGame,
    clearAnalysis,
    requestPlayMove,
  } = useEngine()

  // Phase 8 — "Practice from here" (play the current position out vs. Stockfish) and "Puzzles"
  // (drill your own mistakes). Both take over the board and sidebar while active; see the board
  // view overrides and sidebar branch below.
  const playout = usePlayout(requestPlayMove)
  const puzzles = usePuzzles()

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

  // Phase 8: puzzles drilled from this game's Mistake/Miss/Blunder plies that have a unique best
  // reply. Drives the "Puzzles (n)" button in the summary and the puzzle session.
  const puzzleList = useMemo(
    () => (moveAnalyses ? extractPuzzles(moves, fens, evalResults, moveAnalyses) : []),
    [moveAnalyses, moves, fens, evalResults],
  )

  // Persisted app settings (gear menu) + the menu's open state.
  const { settings, updateSettings } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // reviewAs filters which side's ⚡ retry markers show in the move list — 'both' (default)
  // shows every key moment, 'white'/'black' only that side's (moveIndex parity: even = White,
  // matching classify.ts's playerAccuracy split).
  const visibleKeyMoments = useMemo(() => {
    if (settings.reviewAs === 'both') return keyMoments
    const wantWhite = settings.reviewAs === 'white'
    return new Set([...keyMoments].filter(idx => (idx % 2 === 0) === wantWhite))
  }, [keyMoments, settings.reviewAs])

  const whiteSummary = useMemo(
    () => buildGameSummary(moveAnalyses ?? [], 'white', blackElo),
    [moveAnalyses, blackElo],
  )
  const blackSummary = useMemo(
    () => buildGameSummary(moveAnalyses ?? [], 'black', whiteElo),
    [moveAnalyses, whiteElo],
  )

  // Sidebar chapter: 'setup' (loading/analyzing, today's move-list stack), 'summary' (chess.com's
  // post-analysis Game Review card — replaces the stack entirely), 'review' (guided-review
  // chapter, reached via the Summary view's "Start Review" button; currently a placeholder that
  // reuses the move-list stack until Phase 3 builds the real guided walkthrough). The chapters
  // replace each other rather than coexisting — see the two-chapter sidebar plan.
  const [sidebarView, setSidebarView] = useState<'setup' | 'summary' | 'review'>('setup')
  const wasAnalyzingRef = useRef(false)
  useEffect(() => {
    if (wasAnalyzingRef.current && !isAnalyzing && engineError == null) setSidebarView('summary')
    wasAnalyzingRef.current = isAnalyzing
  }, [isAnalyzing, engineError])

  // Guided review sub-mode: idle (default per-move view), explain (steps through the
  // engine's PV on the board), best (previews the engine's best move on the board).
  const [reviewSub, setReviewSub] = useState<'idle' | 'explain' | 'best'>('idle')
  const [explainStep, setExplainStep] = useState(0)
  // Coach tactical-theme highlight (Phase 4): a phrase hovered in the coach bubble previews its
  // squares/arrows on the board; clicking pins it. Hover wins over pin while both are set.
  const [hoveredHighlight, setHoveredHighlight] = useState<ThemeHighlight | null>(null)
  const [pinnedHighlight, setPinnedHighlight] = useState<ThemeHighlight | null>(null)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const handleFlip = useCallback(() => setOrientation(o => (o === 'white' ? 'black' : 'white')), [])
  const handleToggleAutoplay = useCallback(
    () => updateSettings({ autoplay: !settings.autoplay }),
    [updateSettings, settings.autoplay],
  )
  // PlayerBar placement: opponent above the board, the oriented (self) side below — flips
  // together with the board itself.
  const bottomSide = orientation
  const topSide: 'white' | 'black' = orientation === 'white' ? 'black' : 'white'
  // reviewAs also sets the default board orientation ('both' behaves like 'white'). Adjusted
  // during render (the same "reset on prop change" pattern as the prevPly block below) rather
  // than an effect, so a settings change never leaves a stale-orientation frame on screen.
  const [prevReviewAs, setPrevReviewAs] = useState(settings.reviewAs)
  if (prevReviewAs !== settings.reviewAs) {
    setPrevReviewAs(settings.reviewAs)
    setOrientation(settings.reviewAs === 'black' ? 'black' : 'white')
  }

  // Board & piece appearance (persisted in localStorage) + the picker modal's open state.
  const { boardTheme, pieceTheme, setBoardId, setPieceId } = useTheme()
  const [themeOpen, setThemeOpen] = useState(false)

  // Retry-at-key-moments. retryMoveIndex is the 0-based moveIndex being retried (fens[moveIndex]
  // is the position BEFORE that move — the position the user tries an alternative from).
  // trialFen overlays the board with the user's attempted position; useGame's currentPly/fens
  // are never mutated by a retry attempt.
  const [retryMoveIndex, setRetryMoveIndex] = useState<number | null>(null)
  const [trialFen, setTrialFen] = useState<string | null>(null)
  const [attemptResult, setAttemptResult] = useState<{ san: string; to: string; isCorrect: boolean | null } | null>(null)

  // Engine-lines hover (settings.showEngineLines): which candidate SAN is currently hovered in
  // the EngineLines panel, drawn as a board arrow via engineLineArrow below.
  const [hoveredLineSan, setHoveredLineSan] = useState<string | null>(null)

  // Reset transient review/retry state whenever navigation moves to a different ply. Done in
  // render (React's "adjust state on change" pattern) rather than an effect, so children never
  // observe a frame of stale sub-mode state after a jump.
  const [prevPly, setPrevPly] = useState(currentPly)
  if (prevPly !== currentPly) {
    setPrevPly(currentPly)
    setReviewSub('idle')
    setExplainStep(0)
    // A different move is now selected — its themes differ, so drop any hovered/pinned highlight.
    setHoveredHighlight(null)
    setPinnedHighlight(null)
    // The candidate moves shown by EngineLines are specific to the previous ply too.
    setHoveredLineSan(null)
    // Don't clear retry state when the ply change IS the retry entry itself (handleRetry sets
    // retryMoveIndex and calls goToPly in the same batch, so they land together here). Any other
    // navigation (Prev/Next/jump) changes currentPly without retryMoveIndex following it, which
    // is exactly when retry mode should end.
    if (currentPly !== retryMoveIndex) {
      setRetryMoveIndex(null)
      setTrialFen(null)
      setAttemptResult(null)
    }
  }

  // Green suggestion arrow — shown automatically (chess.com-style) whenever the played move
  // differs from the engine's best move. Only meaningful in the idle sub-mode.
  const bestMoveArrow = useMemo(() => {
    if (!settings.showBestMoveArrow || currentPly === 0) return undefined
    const bestMoveSan = evalResults[currentPly - 1]?.bestMoveSan
    if (!bestMoveSan || bestMoveSan === moves[currentPly - 1].san) return undefined
    return getBestMoveArrow(fens[currentPly - 1], bestMoveSan) ?? undefined
  }, [settings.showBestMoveArrow, currentPly, evalResults, moves, fens])

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
    setAttemptResult({ san: result.san, to, isCorrect: isBestMove(result.san, bestSan) })
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
  const playMoveSound = useCallback((captured: boolean) => {
    if (!settings.soundEnabled) return
    const audio = captured ? captureAudioRef.current : moveAudioRef.current
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}) }
  }, [settings.soundEnabled])
  const soundPlyRef = useRef(currentPly)
  useEffect(() => {
    const prev = soundPlyRef.current
    soundPlyRef.current = currentPly
    // Play on any change to a real ply (forward, backward, or a jump) — not just a clean
    // +1 step. currentPly === 0 (start position) and no-op changes stay silent.
    if (currentPly === prev || currentPly === 0) return
    const move = moves[currentPly - 1]
    if (!move) return
    playMoveSound(!!move.captured)
  }, [currentPly, moves, playMoveSound])

  // Guided review derivations. analysis/bestSan/playedSan describe the move that was just
  // played (ply currentPly, i.e. moves[currentPly - 1]); bestPreview/lineSteps preview what
  // the engine recommends from that same position.
  const analysis = moveAnalyses?.[currentPly - 1] ?? null
  const bestSan = currentPly > 0 ? evalResults[currentPly - 1]?.bestMoveSan ?? null : null
  const playedSan = currentPly > 0 ? moves[currentPly - 1].san : null
  const isEnginesBest = bestSan != null && playedSan === bestSan

  const bestPreview = useMemo(
    () => (currentPly > 0 ? buildBestPreview(fens[currentPly - 1], bestSan) : null),
    [currentPly, fens, bestSan],
  )
  const lineSteps = useMemo(
    () => (currentPly > 0 ? buildLineSteps(fens[currentPly - 1], evalResults[currentPly - 1]?.pv ?? null) : []),
    [currentPly, fens, evalResults],
  )

  // Explain-mode counterpart of the soundPlyRef effect above: stepping through the engine
  // line moves explainStep (not currentPly), so it needs its own sound trigger. Also fires
  // on entering explain mode, since the board jumps to the line's first move right then.
  const soundExplainRef = useRef<{ sub: string; step: number }>({ sub: reviewSub, step: explainStep })
  useEffect(() => {
    const prev = soundExplainRef.current
    soundExplainRef.current = { sub: reviewSub, step: explainStep }
    if (reviewSub !== 'explain') return
    if (prev.sub === 'explain' && prev.step === explainStep) return
    const step = lineSteps[explainStep]
    if (!step) return
    playMoveSound(step.captured)
  }, [reviewSub, explainStep, lineSteps, playMoveSound])

  const reviewActive = moveAnalyses != null && currentPly > 0 && evalResults[currentPly - 1] != null
  const canBest =
    reviewSub === 'idle' &&
    analysis != null &&
    analysis.classification !== 'Book' &&
    analysis.classification !== 'Forced' &&
    bestSan != null &&
    !isEnginesBest
  const canExplain = lineSteps.length > 0

  // Structured headline (SAN / connective words / classification word) for idle and best modes,
  // so the coach bubble can color+bold just the SAN and classification word. Explain mode's
  // "Explaining X" text doesn't fit that shape, so it stays a plain string.
  const headlineParts: HeadlineParts | null =
    reviewSub === 'idle'
      ? playedSan != null && analysis != null
        ? reviewHeadlineParts(playedSan, analysis.classification, isEnginesBest)
        : null
      : reviewSub === 'best'
        ? bestSan != null
          ? reviewHeadlineParts(bestSan, 'Best', true)
          : null
        : null

  const reviewHeadlineText = reviewSub === 'explain' && bestSan != null ? `Explaining ${bestSan}` : ''

  const reviewEvalBadge = formatEvalBadge(
    reviewSub === 'idle' ? evalResults[currentPly] ?? null : evalResults[currentPly - 1] ?? null,
  )

  // Class icon shown in the guided-review coach bubble: the played move's classification while
  // idle, forced to 'Best' while previewing the best move. (Explain mode ignores it — the
  // bubble shows a lightbulb there.)
  const coachClass: MoveClass | null =
    reviewSub === 'best' ? 'Best' : analysis?.classification ?? null

  // Phase 4 coach commentary: detect tactical themes for the played move, then build hoverable
  // comment tokens. Only meaningful for the idle review sub-mode (explaining the move just played).
  const themes = useMemo(() => {
    if (currentPly === 0) return []
    const move = moves[currentPly - 1]
    const evalBefore = evalResults[currentPly - 1]
    const evalAfter = evalResults[currentPly]
    if (!move || !evalBefore || !evalAfter) return []
    return detectThemes(move, evalBefore, evalAfter, bestPreview)
  }, [currentPly, moves, evalResults, bestPreview])

  const commentary = useMemo(() => {
    if (playedSan == null || analysis == null) return null
    return buildCommentary({ classification: analysis.classification, themes })
  }, [playedSan, analysis, themes])

  // The theme highlight actually drawn on the board (hover preview beats a pin), and its board
  // props. Gated to the idle review chapter — the best/explain sub-modes show their own board view.
  const activeHighlight = hoveredHighlight ?? pinnedHighlight
  const showThemeHighlight = sidebarView === 'review' && reviewSub === 'idle'
  const handlePinHighlight = useCallback(
    (h: ThemeHighlight) => setPinnedHighlight(prev => (prev === h ? null : h)),
    [],
  )

  // Threat arrow (settings.showThreatArrow) — the engine's best reply from the position that
  // resulted after the played move, i.e. the standing threat. Like the theme highlights, only
  // meaningful while the board shows the real current position (reviewSub 'idle') — the
  // best/explain sub-modes preview a different fen and would otherwise get a misaligned arrow.
  const threatArrow = useMemo(() => {
    if (!settings.showThreatArrow || reviewSub !== 'idle' || currentPly === 0) return undefined
    const bestSan = evalResults[currentPly]?.bestMoveSan
    if (!bestSan) return undefined
    const arrow = getThreatArrow(currentFen, bestSan)
    return arrow ? { from: arrow.from, to: arrow.to, color: THREAT_ARROW_COLOR } : undefined
  }, [settings.showThreatArrow, reviewSub, currentPly, evalResults, currentFen])

  // EngineLines hover (settings.showEngineLines) — same "only while showing the real position"
  // constraint as threatArrow above.
  const engineLineArrow = useMemo(() => {
    if (!settings.showEngineLines || reviewSub !== 'idle' || hoveredLineSan == null) return undefined
    const arrow = getBestMoveArrow(currentFen, hoveredLineSan)
    return arrow ? { from: arrow.from, to: arrow.to, color: CANDIDATE_ARROW_COLOR } : undefined
  }, [settings.showEngineLines, reviewSub, hoveredLineSan, currentFen])

  const extraArrows = useMemo(() => {
    const arrows: { from: string; to: string; color: string }[] = []
    if (showThemeHighlight && activeHighlight) {
      for (const a of activeHighlight.arrows) arrows.push({ from: a.from, to: a.to, color: THEME_ARROW_COLOR })
    }
    if (threatArrow) arrows.push(threatArrow)
    if (engineLineArrow) arrows.push(engineLineArrow)
    return arrows.length > 0 ? arrows : undefined
  }, [showThemeHighlight, activeHighlight, threatArrow, engineLineArrow])
  const extraSquareHighlights = useMemo(() => {
    if (!showThemeHighlight || !activeHighlight || activeHighlight.squares.length === 0) return undefined
    const map: Record<string, string> = {}
    for (const sq of activeHighlight.squares) map[sq] = THEME_SQUARE_COLOR
    return map
  }, [showThemeHighlight, activeHighlight])

  // Engine's candidate moves for the current position (settings.showEngineLines) — feeds
  // EvalPanel's EngineLines panel in the 'setup' chapter.
  const currentEngineLines = useMemo(() => {
    if (!settings.showEngineLines) return []
    return getEngineLines(evalResults[currentPly] ?? result)
  }, [settings.showEngineLines, evalResults, currentPly, result])

  const handleExplain = useCallback(() => {
    setReviewSub('explain')
    setExplainStep(0)
  }, [])

  const handleBest = useCallback(() => {
    setReviewSub('best')
  }, [])

  const handleLinePrev = useCallback(() => {
    setExplainStep(s => Math.max(0, s - 1))
  }, [])

  const handleLineNext = useCallback(() => {
    setExplainStep(s => Math.min(lineSteps.length - 1, s + 1))
  }, [lineSteps.length])

  const handleGotIt = useCallback(() => {
    setReviewSub('idle')
  }, [])

  const handleResume = useCallback(() => {
    setReviewSub('idle')
  }, [])

  const handleAnalyzeGame = useCallback(
    () => analyzeGame(fens, settings.depth),
    [analyzeGame, fens, settings.depth],
  )

  // reviewingSide comes from GamePicker when a chess.com username's game is selected (it knows
  // which color that username played) — orients the board with the reviewed player at the
  // bottom instead of always defaulting to White. Manual PGN paste has no username to derive
  // this from, so it's omitted there and orientation falls back to today's reviewAs-driven default.
  const handleLoadPgn = useCallback((newPgn: string, reviewingSide?: 'white' | 'black') => {
    clearAnalysis()
    loadPgn(newPgn)
    setSidebarView('setup')
    if (reviewingSide) setOrientation(reviewingSide)
  }, [clearAnalysis, loadPgn])

  // Share/Export (Phase 7). "Copied!" is a brief self-clearing confirmation, same idea as the
  // retry feedback elsewhere — no toast library for one string.
  const [linkCopied, setLinkCopied] = useState(false)
  const handleCopyLink = useCallback(() => {
    if (!pgn) return
    const url = `${window.location.origin}${window.location.pathname}?pgn=${encodeURIComponent(pgn)}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    }).catch(() => {})
  }, [pgn])

  const handleExportImage = useCallback(() => {
    exportBoardImage({
      fen: currentFen,
      boardImageUrl: boardTheme.url,
      piecesBasePath: pieceTheme.basePath,
      orientation,
    }).then(blob => {
      if (blob) downloadBlob(blob, 'game-review-position.png')
    }).catch(() => {})
  }, [currentFen, boardTheme.url, pieceTheme.basePath, orientation])

  // Start Review = chess.com's guided walkthrough. It jumps to the first move (ply 1) so the
  // coach starts commenting from move 1, exactly like chess.com (reference Screenshot_21 opens
  // on "e4 is a book move"), then steps forward one move per "Next".
  const handleStartReview = useCallback(() => {
    if (moves.length > 0) goToPly(1)
    setSidebarView('review')
  }, [goToPly, moves.length])
  // Leaving the review chapter drops any best/explain preview so the summary board shows the
  // real position at the current ply, not a frozen engine-line preview.
  const handleBackToSummary = useCallback(() => {
    setReviewSub('idle')
    setExplainStep(0)
    setSidebarView('summary')
  }, [])

  // Phase 8 entry points. Both clear any in-progress retry so the board is free to be taken over.
  const handleStartPractice = useCallback(() => {
    setRetryMoveIndex(null)
    setTrialFen(null)
    setAttemptResult(null)
    setReviewSub('idle')
    playout.start(currentFen)
  }, [playout, currentFen])
  const handleStartPuzzles = useCallback(() => {
    setRetryMoveIndex(null)
    setTrialFen(null)
    setAttemptResult(null)
    puzzles.start(puzzleList)
  }, [puzzles, puzzleList])

  // Best-move preview for a revealed puzzle solution (position after bestSan + its arrow).
  const currentPuzzle = puzzles.current
  const puzzleBestPreview = useMemo(
    () => (currentPuzzle ? buildBestPreview(currentPuzzle.fenBefore, currentPuzzle.bestSan) : null),
    [currentPuzzle],
  )

  // Autoplay (settings.autoplay): steps "Next" on a timer while idling in the guided Review
  // chapter. Re-armed on every currentPly change (auto or manual), which both keeps a steady
  // cadence and means a manual nav click pushes the next auto-step back a full interval instead
  // of firing immediately after it.
  useEffect(() => {
    if (!settings.autoplay || sidebarView !== 'review' || reviewSub !== 'idle' || !canGoNext) return
    const id = setTimeout(() => goToNext(), AUTOPLAY_INTERVAL_MS)
    return () => clearTimeout(id)
  }, [settings.autoplay, sidebarView, reviewSub, canGoNext, goToNext, currentPly])

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
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      // Practice / puzzle modes own the board — main-line keyboard nav is disabled so the arrow
      // keys don't desync useGame's ply from the position shown during a practice game.
      if (playout.active || puzzles.active) return
      // In the guided "explain" walk, arrows step through the engine line (same as the
      // ReviewPanel ◀/▶ buttons) instead of navigating the main line — they only move
      // explainStep, so the ply-change reset below (which drops us out of explain on any
      // currentPly change) never fires.
      if (reviewSub === 'explain') {
        if (e.key === 'ArrowLeft') { e.preventDefault(); handleLinePrev(); return }
        if (e.key === 'ArrowRight') { e.preventDefault(); handleLineNext(); return }
        // Enter = the "Got it!" button: leave the engine line, back to the idle review state.
        if (e.key === 'Enter') { e.preventDefault(); handleGotIt(); return }
      }
      // In the guided Review chapter's idle state, Enter = the "Next" button (step one move).
      if (sidebarView === 'review' && reviewSub === 'idle' && e.key === 'Enter') {
        e.preventDefault(); if (canGoNext) goToNext(); return
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goToNext() }
      else if (e.key === 'Home') { e.preventDefault(); goToFirst() }
      else if (e.key === 'End') { e.preventDefault(); goToLast() }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goToFirst, goToPrev, goToNext, goToLast, handleFlip, reviewSub, sidebarView, canGoNext, handleLinePrev, handleLineNext, handleGotIt, playout.active, puzzles.active])

  // Board view for the current retry/review sub-mode. Defaults to the plain "current
  // position" view; the best/explain sub-modes override fen/classification/badge/arrow to
  // preview the engine's recommendation instead of the position that's actually loaded.
  // Retry mode always wins (unrelated feature, takes precedence over review sub-modes).
  let viewFen = trialFen ?? currentFen
  let viewClass: MoveClass | undefined = retryMoveIndex === null ? analysis?.classification : undefined
  let viewFrom: string | undefined = retryMoveIndex === null && currentPly > 0 ? moves[currentPly - 1].from : undefined
  let viewTo: string | undefined = retryMoveIndex === null && currentPly > 0 ? moves[currentPly - 1].to : undefined
  let viewArrow = retryMoveIndex !== null ? retryRevealArrow : bestMoveArrow
  // Defaults to the main line's eval. The best/explain preview branches below override it to
  // the pre-move eval (evalResults[currentPly - 1]) — a PV is best play, so that's exactly the
  // evaluation the previewed line/best-move reaches. Keeps the eval bar in sync with viewFen
  // instead of freezing on the post-move eval while the board shows a different position.
  let viewEval = evalResults[currentPly] ?? result

  if (retryMoveIndex === null && reviewSub === 'best' && bestPreview) {
    viewFen = bestPreview.fen
    viewClass = 'Best'
    viewFrom = bestPreview.from
    viewTo = bestPreview.to
    viewArrow = { from: bestPreview.from, to: bestPreview.to }
    viewEval = evalResults[currentPly - 1] ?? result
  } else if (retryMoveIndex === null && reviewSub === 'explain' && lineSteps[explainStep]) {
    const step = lineSteps[explainStep]
    viewFen = step.fen
    viewClass = 'Book'
    viewFrom = step.from
    viewTo = step.to
    viewArrow = undefined
    // The pre-move eval is a genuinely optimal line, so its cp value doesn't change as you step
    // through it — but a mate count must still count down (see explainStepMate), or the eval bar
    // looks frozen the whole way through a forced-mate PV.
    const preEval = evalResults[currentPly - 1] ?? result
    viewEval = preEval && preEval.mate !== null
      ? { ...preEval, mate: explainStepMate(preEval.mate, lineSteps.length, explainStep) }
      : preEval
  }

  // Board controls (interactivity, drop handler, ✓/✗ badge) — default to the retry-at-key-moments
  // wiring, overridden below by the Phase 8 practice/puzzle takeovers.
  let boardInteractive = retryMoveIndex !== null && trialFen === null
  let boardOnDrop: ((from: string, to: string) => boolean) | undefined = handleTrialDrop
  let boardResultBadge: { square: string; correct: boolean } | undefined =
    retryMoveIndex !== null && attemptResult && attemptResult.isCorrect !== null
      ? { square: attemptResult.to, correct: attemptResult.isCorrect }
      : undefined
  // Coach/threat/engine-line overlays are review-chapter features — suppress them while a
  // practice/puzzle game owns the board (both branches set these to undefined).
  let boardExtraArrows = extraArrows
  let boardExtraSquares = extraSquareHighlights

  if (playout.active && playout.fen) {
    viewFen = playout.fen
    viewFrom = playout.lastMove?.from
    viewTo = playout.lastMove?.to
    viewClass = undefined
    viewArrow = undefined
    viewEval = result ?? viewEval // live eval from the play-out search
    boardInteractive = playout.isUserTurn
    boardOnDrop = playout.applyUserMove
    boardResultBadge = undefined
    boardExtraArrows = undefined
    boardExtraSquares = undefined
  } else if (puzzles.active && puzzles.current) {
    const attempt = puzzles.attempt
    const showBest = puzzles.revealed && puzzleBestPreview
    viewFen = attempt?.fen ?? (showBest ? puzzleBestPreview!.fen : puzzles.current.fenBefore)
    viewClass = undefined
    viewFrom = showBest ? puzzleBestPreview!.from : undefined
    viewTo = showBest ? puzzleBestPreview!.to : undefined
    viewArrow = showBest ? { from: puzzleBestPreview!.from, to: puzzleBestPreview!.to } : undefined
    viewEval = evalResults[puzzles.current.moveIndex] ?? null
    boardInteractive = attempt === null && !puzzles.revealed
    boardOnDrop = puzzles.tryMove
    boardResultBadge = attempt ? { square: attempt.to, correct: attempt.correct } : undefined
    boardExtraArrows = undefined
    boardExtraSquares = undefined
  }

  return (
    <div className="h-screen bg-cc-bg text-cc-text flex flex-col overflow-hidden">
      <GamePicker
        onLoad={handleLoadPgn}
        error={error}
        initialUsername={initialUsername}
        autoFetch={autoFetch}
      />

      <ThemePicker
        open={themeOpen}
        onClose={() => setThemeOpen(false)}
        boardId={boardTheme.id}
        pieceId={pieceTheme.id}
        onSelectBoard={setBoardId}
        onSelectPiece={setPieceId}
      />

      <SettingsMenu
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
      />

      <div className="flex flex-1 min-h-0">
        {/* ── Left: Board — width matches board+evalbar+padding exactly (no middle gap).
            Capped by min() against viewport width so a narrow-but-tall window can't force
            the board wider than the screen and crush the sidebar (reserves the sidebar's
            fixed 400px, or 320px on narrow windows where the sidebar itself shrinks — see
            the sidebar's own min-width below). ── */}
        <div
          className="shrink-0 flex flex-col p-3 gap-2"
          // The vh branch caps board size on tall-narrow windows; it must reserve the same
          // vertical chrome as the inner row's own vh branch below (136px: two 32px PlayerBars
          // + one 8px gap added on top of the original 64px nav/padding/gap budget).
          style={{ width: 'min(calc(100vh - 136px), calc(100vw - 320px))' }}
        >
          {isLoaded && (
            <PlayerBar
              name={(topSide === 'white' ? whiteName : blackName) ?? (topSide === 'white' ? 'White' : 'Black')}
              elo={topSide === 'white' ? whiteElo : blackElo}
              clockSeconds={remainingClockSeconds(clocks, currentPly, topSide, timeControl)}
            />
          )}
          <div
            className="flex flex-row items-stretch"
            // 200px reserves the column's non-board chrome: 24px padding (p-3 top+bottom) +
            // two 32px PlayerBars + one 32px NavControls row + three 8px gaps between them,
            // plus the header bar above this column (~47px) and a small safety margin —
            // 128px was the pre-PlayerBar budget (nav/padding/gaps + header only).
            style={{ height: 'min(calc(100vh - 200px), calc(100vw - 384px))' }}
          >
            <EvalBar evalResult={viewEval} orientation={orientation} />
            <div className="aspect-square h-full">
              <BoardPanel
                fen={viewFen}
                lastMoveFrom={viewFrom}
                lastMoveTo={viewTo}
                classification={viewClass}
                bestMoveArrow={viewArrow}
                extraArrows={boardExtraArrows}
                extraSquareHighlights={boardExtraSquares}
                showBadges={settings.showBoardBadges}
                resultBadge={boardResultBadge}
                orientation={orientation}
                interactive={boardInteractive}
                onPieceDrop={boardOnDrop}
                piecesBasePath={pieceTheme.basePath}
                boardImageUrl={boardTheme.url}
              />
            </div>
          </div>
          {isLoaded && (
            <PlayerBar
              name={(bottomSide === 'white' ? whiteName : blackName) ?? (bottomSide === 'white' ? 'White' : 'Black')}
              elo={bottomSide === 'white' ? whiteElo : blackElo}
              clockSeconds={remainingClockSeconds(clocks, currentPly, bottomSide, timeControl)}
            />
          )}
          <BoardToolbar
            onFlip={handleFlip}
            onOpenThemes={() => setThemeOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onCopyLink={handleCopyLink}
            onExportImage={handleExportImage}
            linkCopied={linkCopied}
            isLoaded={isLoaded}
            takeover={playout.active || puzzles.active}
          />
        </div>

        {/* ── Right: Sidebar — three mutually-exclusive chapters that replace each other:
            'setup' (pre-analysis: opening badge, Analyze button, move list for navigation),
            'summary' (chess.com's post-analysis Game Review card), and 'review' (the guided
            walkthrough). See sidebarView. Fixed width (chess.com's sidebar is a constant
            ~400px, never flex-filling the viewport) — shrinks down to 320px before the board
            column (which reserves at least that much, see its width formula above) gives up
            any more room. ── */}
        <div className="w-[400px] min-w-[320px] shrink border-l border-cc-border flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {playout.active ? (
            <PlayoutPanel
              userColor={playout.userColor}
              isUserTurn={playout.isUserTurn}
              engineThinking={playout.engineThinking}
              gameOver={playout.gameOver}
              resultText={playout.resultText}
              moveCount={playout.moveCount}
              onExit={playout.exit}
            />
          ) : puzzles.active ? (
            <PuzzlePanel
              index={puzzles.index}
              total={puzzles.total}
              solvedCount={puzzles.solvedCount}
              finished={puzzles.finished}
              sideToMove={puzzles.current ? (puzzles.current.fenBefore.split(' ')[1] as 'w' | 'b') : null}
              classification={puzzles.current?.classification ?? null}
              attempt={puzzles.attempt}
              revealed={puzzles.revealed}
              bestSan={puzzles.current?.bestSan ?? null}
              onTryAgain={puzzles.retry}
              onReveal={puzzles.reveal}
              onNext={puzzles.next}
              onExit={puzzles.exit}
            />
          ) : sidebarView === 'summary' && evalResults.length > 0 && engineError == null ? (
            <SummaryView
              whiteName={whiteName ?? 'White'}
              blackName={blackName ?? 'Black'}
              whiteElo={whiteElo}
              blackElo={blackElo}
              whiteSummary={whiteSummary}
              blackSummary={blackSummary}
              evalResults={evalResults}
              moveAnalyses={moveAnalyses}
              currentPly={currentPly}
              onSelectPly={goToPly}
              onStartReview={handleStartReview}
              puzzleCount={puzzleList.length}
              onStartPuzzles={handleStartPuzzles}
              reviewAs={settings.reviewAs}
            />
          ) : sidebarView === 'review' && evalResults.length > 0 && engineError == null ? (
            <ReviewView
              onBack={handleBackToSummary}
              onPractice={handleStartPractice}
              canPractice={isReady && currentPly > 0}
              active={reviewActive}
              coachEnabled={settings.coachEnabled}
              headline={reviewHeadlineText}
              headlineParts={headlineParts}
              commentary={reviewSub === 'idle' ? commentary : null}
              activeHighlight={activeHighlight}
              onHoverHighlight={setHoveredHighlight}
              onPinHighlight={handlePinHighlight}
              evalBadge={reviewEvalBadge}
              coachClass={coachClass}
              sub={reviewSub}
              canBest={canBest}
              canExplain={canExplain}
              canNext={canGoNext}
              lineSans={lineSteps.map(s => s.san)}
              lineStep={explainStep}
              onExplain={handleExplain}
              onBest={handleBest}
              onNext={goToNext}
              onLinePrev={handleLinePrev}
              onLineNext={handleLineNext}
              onGotIt={handleGotIt}
              onResume={handleResume}
              moveList={
                <MoveList
                  moves={moves}
                  currentPly={currentPly}
                  onSelectPly={goToPly}
                  moveAnalyses={moveAnalyses}
                  keyMoments={visibleKeyMoments}
                  moveTimeSeconds={moveTimeSeconds}
                  showMoveTimes={false}
                  onRetry={handleRetry}
                />
              }
              graph={
                <EvalGraph
                  evalResults={evalResults}
                  currentPly={currentPly}
                  onSelectPly={goToPly}
                  moveAnalyses={moveAnalyses}
                />
              }
              retry={
                retryMoveIndex !== null && moveAnalyses?.[retryMoveIndex] ? (
                  <div className="shrink-0 border-t border-cc-border p-2">
                    <RetryPanel
                      originalSan={moves[retryMoveIndex].san}
                      originalClassification={moveAnalyses[retryMoveIndex].classification}
                      attempt={attemptResult}
                      onRetryAgain={handleRetryAgain}
                      onExit={handleExitRetry}
                    />
                  </div>
                ) : null
              }
            />
          ) : (
            <div className="flex flex-col flex-1 min-h-0 animate-chapter-fade-in">
              <OpeningBadge opening={openingResult?.opening ?? null} />
              <div className="shrink-0 px-2 py-2 border-b border-cc-border/60">
                <EvalPanel
                  isReady={isReady}
                  isAnalyzing={isAnalyzing}
                  analysisProgress={analysisProgress}
                  result={result}
                  error={engineError}
                  isGameLoaded={isLoaded}
                  hasAnalysis={evalResults.length > 0 && engineError == null}
                  onAnalyzeGame={handleAnalyzeGame}
                  engineLines={currentEngineLines}
                  onHoverEngineLine={settings.showEngineLines ? setHoveredLineSan : undefined}
                />
              </div>
              <MoveList
                moves={moves}
                currentPly={currentPly}
                onSelectPly={goToPly}
                moveAnalyses={moveAnalyses}
                keyMoments={visibleKeyMoments}
                moveTimeSeconds={moveTimeSeconds}
                onRetry={handleRetry}
              />
            </div>
          )}
        </div>
          {/* Sidebar footer — chess.com's five-button move-navigation row (first/prev/play/
              next/last), shared across every chapter (setup/summary/review/playout/puzzle;
              `takeover` disables it during the latter two, same as the buttons it replaced
              under the board). Sits outside the scrollable chapter area so it never scrolls
              out of view. ── */}
          <NavControls
            onFirst={goToFirst}
            onPrev={goToPrev}
            onNext={goToNext}
            onLast={goToLast}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            isLoaded={isLoaded}
            autoplay={settings.autoplay}
            onToggleAutoplay={handleToggleAutoplay}
            takeover={playout.active || puzzles.active}
          />
        </div>
      </div>
    </div>
  )
}

export default App
