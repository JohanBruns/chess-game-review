import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useGame } from './hooks/useGame'
import { useEngine } from './lib/engine/useEngine'
import { GamePicker } from './components/GamePicker'
import { BoardPanel } from './components/BoardPanel'
import { PlayerBar } from './components/PlayerBar'
import { NavControls } from './components/NavControls'
import { BoardToolbar } from './components/BoardToolbar'
import { MoveList } from './components/MoveList'
import { MoveStrip } from './components/MoveStrip'
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
  summaryHeadline,
} from './lib/analysis/review'
import type { HeadlineParts } from './lib/analysis/review'
import { detectThemes, type ThemeHighlight } from './lib/analysis/tactics'
import { buildCommentary } from './lib/analysis/commentary'
import { explainLine } from './lib/analysis/explain'
import { attemptMove, isBestMove } from './lib/analysis/retry'
import { extractPuzzles } from './lib/analysis/puzzles'
import { detectOpening } from './lib/analysis/openings'
import { OpeningBadge } from './components/OpeningBadge'
import { EvalBar } from './components/EvalBar'
import { ReviewCoach, ReviewView } from './components/ReviewView'
import { BoardErrorBoundary } from './components/BoardErrorBoundary'
import { SummaryView } from './components/SummaryView'
import { RetryPanel } from './components/RetryPanel'
import { PlayoutPanel } from './components/PlayoutPanel'
import { PuzzlePanel } from './components/PuzzlePanel'
import { ThemePicker } from './components/ThemePicker'
import { SettingsMenu } from './components/SettingsMenu'
import { SidebarHeader } from './components/SidebarHeader'
import { CoachSpeech } from './components/CoachSpeech'
import { PhoneFooter, type FooterAction } from './components/PhoneFooter'
import { NewestGameBanner } from './components/NewestGameBanner'
import {
  IconArrowLeft,
  IconArrowRight,
  IconBulb,
  IconCamera,
  IconCheck,
  IconFlip,
  IconGear,
  IconLink,
  IconPalette,
  IconPlay,
  IconRetry,
  IconShare,
  IconStar,
  IconTarget,
} from './components/icons'
import { useTheme } from './hooks/useTheme'
import { useSettings } from './hooks/useSettings'
import { useWakeLock } from './hooks/useWakeLock'
import { useSwipe } from './hooks/useSwipe'
import { usePlayout } from './hooks/usePlayout'
import { usePuzzles } from './hooks/usePuzzles'
import { exportBoardImage, downloadBlob } from './lib/boardImage'
import { readStorage, USERNAME_KEY } from './lib/storage'
import { parseSharedGame, fetchSharedGamePgn, chessComGameId, fetchRecentGames, type ChessComGame } from './lib/chesscom'
import {
  decideNewestGame,
  gameIdFromUrl,
  NEWEST_POLL_INTERVAL_MS,
  NEWEST_POLL_WINDOW_MS,
  type NewestGameTrigger,
} from './lib/newestGame'
import { takePendingShare } from './lib/sharePush'
import { deriveBoardView } from './lib/boardView'

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
// The reply that punishes a Mistake/Blunder — chess.com draws it in light blue next to the green
// best-move arrow (checked live 2026-11-08, 28.Kc2? …Qxe1).
const REFUTATION_ARROW_COLOR = '#5fb0ea'
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
    result: gameResult,
  } = useGame()

  const {
    isReady,
    isAnalyzing,
    isEvaluating,
    result,
    evalResults,
    analysisProgress,
    error: engineError,
    evaluate,
    analyzeGame,
    clearAnalysis,
    refinePosition,
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
  // Phones scroll the whole page, and Start Review sits at the end of the summary — without this
  // the review opened scrolled down to the move list instead of the coach and board. chess.com
  // jumps back to the top too. (The desktop page doesn't scroll, so this is a no-op there.)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [sidebarView])
  // A ?move=N link (see the URL effects further down) opens the guided review at that move once
  // the analysis is in, instead of the summary.
  const openReviewAfterAnalysisRef = useRef(false)
  const wasAnalyzingRef = useRef(false)
  useEffect(() => {
    if (wasAnalyzingRef.current && !isAnalyzing && engineError == null) {
      setSidebarView(openReviewAfterAnalysisRef.current ? 'review' : 'summary')
      openReviewAfterAnalysisRef.current = false
    }
    wasAnalyzingRef.current = isAnalyzing
  }, [isAnalyzing, engineError])
  useWakeLock(isAnalyzing)

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

  // Auto-orient to the reviewed player's side purely from the loaded game — covers ?pgn= links
  // and manual paste, which (unlike GamePicker's Recent-Games flow) never pass handleLoadPgn a
  // reviewingSide. Keyed on `pgn` (not whiteName/blackName): a second game against the same
  // opponent has identical names but a different pgn, and must still get its own check.
  // knownUsername is read fresh here (not memoized) so a username typed into GamePicker's field
  // after mount, before this game loaded, is still picked up. No known username, or no header
  // match → orientation is left untouched (falls through to the reviewAs default above /
  // GamePicker's reviewingSide).
  // detectedSide is the color the user played in the loaded game, when known — from the same
  // username match, or GamePicker's reviewingSide (handleLoadPgn). Unlike `orientation` it isn't
  // touched by Flip Board, so the puzzles (your own mistakes) don't swap sides on a flip.
  const [detectedSide, setDetectedSide] = useState<'white' | 'black' | null>(null)
  const [prevPgn, setPrevPgn] = useState(pgn)
  if (prevPgn !== pgn) {
    setPrevPgn(pgn)
    const params = new URLSearchParams(window.location.search)
    const knownUsername = (params.get('username') ?? readStorage(USERNAME_KEY))
      ?.trim().toLowerCase() || null
    let side: 'white' | 'black' | null = null
    if (knownUsername) {
      if (whiteName?.trim().toLowerCase() === knownUsername) side = 'white'
      else if (blackName?.trim().toLowerCase() === knownUsername) side = 'black'
    }
    setDetectedSide(side)
    if (side) setOrientation(side)
  }

  // The side whose mistakes become puzzles: the detected player first, then an explicit
  // "Review as" setting, and only as a last resort the side at the bottom of the board.
  const mySide: 'white' | 'black' =
    detectedSide ?? (settings.reviewAs !== 'both' ? settings.reviewAs : orientation)

  // Phase 8: puzzles drilled from MY Mistake/Miss/Blunder plies (never the opponent's) that have a
  // unique best reply. Drives the "Puzzles (n)" button in the summary and the puzzle session.
  const puzzleList = useMemo(
    () => (moveAnalyses ? extractPuzzles(moves, fens, evalResults, moveAnalyses, { side: mySide }) : []),
    [moveAnalyses, moves, fens, evalResults, mySide],
  )

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

  // Explain mode says what the engine's line achieves (mate, material won, or how the position
  // stands) — lib/analysis/explain.ts.
  const reviewHeadlineText = useMemo(
    () =>
      reviewSub === 'explain' && currentPly > 0
        ? explainLine(fens[currentPly - 1], lineSteps, evalResults[currentPly - 1] ?? null) || `Explaining ${bestSan ?? ''}`
        : '',
    [reviewSub, currentPly, fens, lineSteps, evalResults, bestSan],
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
  // Without the setting it still shows, in light blue, after a Mistake or Blunder: the reply that
  // punishes it, like chess.com.
  const playedClass = analysis?.classification
  const showRefutation = playedClass === 'Mistake' || playedClass === 'Blunder'
  const threatArrow = useMemo(() => {
    if (!(settings.showThreatArrow || showRefutation) || reviewSub !== 'idle' || currentPly === 0) return undefined
    const bestSan = evalResults[currentPly]?.bestMoveSan
    if (!bestSan) return undefined
    const arrow = getThreatArrow(currentFen, bestSan)
    const color = settings.showThreatArrow ? THREAT_ARROW_COLOR : REFUTATION_ARROW_COLOR
    return arrow ? { from: arrow.from, to: arrow.to, color } : undefined
  }, [settings.showThreatArrow, showRefutation, reviewSub, currentPly, evalResults, currentFen])

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

  // EngineLines on-demand refinement: after the two-pass analysis, non-candidate positions only
  // carry a single-PV result — when the lines panel is open on one of those, run one MultiPV-3
  // search and merge it back into evalResults. The requested-set guards against re-firing on a
  // position where even MultiPV 3 yields no 2nd line (e.g. only one legal move).
  const refineRequestedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    refineRequestedRef.current.clear()
  }, [fens, isAnalyzing])
  useEffect(() => {
    if (!settings.showEngineLines || isAnalyzing || isEvaluating) return
    const stored = evalResults[currentPly]
    if (!stored || stored.secondBestMoveSan != null) return
    if (refineRequestedRef.current.has(currentPly)) return
    refineRequestedRef.current.add(currentPly)
    refinePosition(currentPly, fens[currentPly])
  }, [settings.showEngineLines, isAnalyzing, isEvaluating, evalResults, currentPly, fens, refinePosition])

  // Entering/stepping the explain line also live-evaluates the shown PV position on the
  // (otherwise idle) primary worker, so the eval bar tracks what's on the board instead of
  // freezing on the pre-move eval. Kicked off inside the handlers — batched with the step
  // change, so no frame ever renders the previous step's `result`.
  const handleExplain = useCallback(() => {
    setReviewSub('explain')
    setExplainStep(0)
    if (lineSteps[0]) evaluate(lineSteps[0].fen, settings.depth)
  }, [lineSteps, evaluate, settings.depth])

  const handleBest = useCallback(() => {
    setReviewSub('best')
  }, [])

  const handleLinePrev = useCallback(() => {
    const next = Math.max(0, explainStep - 1)
    setExplainStep(next)
    if (next !== explainStep && lineSteps[next]) evaluate(lineSteps[next].fen, settings.depth)
  }, [explainStep, lineSteps, evaluate, settings.depth])

  const handleLineNext = useCallback(() => {
    const next = Math.min(lineSteps.length - 1, explainStep + 1)
    setExplainStep(next)
    if (next !== explainStep && lineSteps[next]) evaluate(lineSteps[next].fen, settings.depth)
  }, [explainStep, lineSteps, evaluate, settings.depth])

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

  // settings.autoAnalyze: start the analysis as soon as a game is loaded, like chess.com — once
  // per loaded game (keyed on the fens array identity, which only changes on a new load). Waits
  // for the engine to be ready; a game that already has (or is getting) an analysis is skipped,
  // and a later depth change doesn't re-trigger. Cached positions make a revisit instant.
  // "Analyze last game" asks for the same whatever the setting says, via analyzeNextLoadRef.
  const autoAnalyzedFensRef = useRef<string[] | null>(null)
  const analyzeNextLoadRef = useRef(false)
  useEffect(() => {
    if (!(settings.autoAnalyze || analyzeNextLoadRef.current) || !isReady || fens.length === 0) return
    if (autoAnalyzedFensRef.current === fens) return
    autoAnalyzedFensRef.current = fens
    analyzeNextLoadRef.current = false
    if (isAnalyzing || evalResults.length > 0) return
    analyzeGame(fens, settings.depth)
  }, [settings.autoAnalyze, settings.depth, isReady, fens, isAnalyzing, evalResults.length, analyzeGame])

  // reviewingSide comes from GamePicker when a chess.com username's game is selected (it knows
  // which color that username played) — orients the board with the reviewed player at the
  // bottom instead of always defaulting to White. Manual PGN paste / ?pgn= links have no
  // reviewingSide to pass here, but still get oriented via the knownUsername render-phase
  // fallback above (matches whiteName/blackName against a known chess-username/URL param).
  const handleLoadPgn = useCallback((newPgn: string, reviewingSide?: 'white' | 'black') => {
    clearAnalysis()
    loadPgn(newPgn)
    setSidebarView('setup')
    if (reviewingSide) {
      setOrientation(reviewingSide)
      setDetectedSide(reviewingSide)
    }
  }, [clearAnalysis, loadPgn])

  // Share/Export (Phase 7). "Copied!" is a brief self-clearing confirmation, same idea as the
  // retry feedback elsewhere — no toast library for one string.
  const [linkCopied, setLinkCopied] = useState(false)
  // A link to this game at the current move. A chess.com game goes by its id (short); anything
  // else carries its whole PGN.
  const analysisLink = useCallback(() => {
    if (!pgn) return null
    const gameId = chessComGameId(pgn)
    const move = currentPly > 0 ? `&move=${currentPly}` : ''
    const query = gameId ? `game=${gameId}${move}` : `pgn=${encodeURIComponent(pgn)}${move}`
    return `${window.location.origin}${window.location.pathname}?${query}`
  }, [pgn, currentPly])
  const copyLink = useCallback((url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    }).catch(() => {})
  }, [])
  const handleCopyLink = useCallback(() => {
    const url = analysisLink()
    if (url) copyLink(url)
  }, [analysisLink, copyLink])
  // Phones: a Brilliant/Great move gets a share button (chess.com shows one there too). Opens the
  // system share sheet where there is one, else copies the link.
  const handleShareMove = useCallback(() => {
    const url = analysisLink()
    if (!url) return
    if (typeof navigator.share === 'function') navigator.share({ url }).catch(() => {})
    else copyLink(url)
  }, [analysisLink, copyLink])

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
  // The chapters the user opens on purpose (the review from the summary, the loader from the
  // summary's "+") get their own browser history entry, so Back — Android's back button, the
  // browser's, a swipe — returns to the summary instead of leaving the app. The automatic
  // setup → summary step after an analysis adds none. The in-app back arrows go back through
  // that history entry when there is one, so the history never piles up.
  const openChapter = useCallback((view: 'setup' | 'review') => {
    window.history.pushState({ ...window.history.state, chapter: view }, '')
    setSidebarView(view)
  }, [])
  const handleStartReview = useCallback(() => {
    if (moves.length > 0) goToPly(1)
    openChapter('review')
  }, [goToPly, moves.length, openChapter])
  // Leaving the review chapter drops any best/explain preview so the summary board shows the
  // real position at the current ply, not a frozen engine-line preview.
  const handleBackToSummary = useCallback(() => {
    setReviewSub('idle')
    setExplainStep(0)
    const chapter = (window.history.state as { chapter?: string } | null)?.chapter
    if (chapter === 'review' || chapter === 'setup') window.history.back()
    else setSidebarView('summary')
  }, [])
  const hasReviewRef = useRef(false)
  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      const chapter = (e.state as { chapter?: string } | null)?.chapter
      setReviewSub('idle')
      setExplainStep(0)
      setSidebarView(!hasReviewRef.current ? 'setup' : chapter === 'review' || chapter === 'setup' ? chapter : 'summary')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
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
    // Your mistakes, so solve them from your side of the board.
    setOrientation(mySide)
    puzzles.start(puzzleList)
  }, [puzzles, puzzleList, mySide])

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
    // Practice / puzzle modes own the board (same guard as the keyboard nav below) — without
    // this, autoplay keeps stepping the review ply behind a running practice game.
    if (playout.active || puzzles.active) return
    const id = setTimeout(() => goToNext(), AUTOPLAY_INTERVAL_MS)
    return () => clearTimeout(id)
  }, [settings.autoplay, sidebarView, reviewSub, canGoNext, goToNext, currentPly, playout.active, puzzles.active])

  // chess.com game links — the chess.com app's "Share" text (?share=… from the iOS Shortcut,
  // see docs/iphone.md) or a link pasted into the manual field — resolve to a PGN
  // asynchronously; anything that isn't a link goes straight to handleLoadPgn. The request
  // counter drops a slow lookup's result once a newer load has started.
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const linkRequestRef = useRef(0)
  const handleLoadInput = useCallback((text: string, reviewingSide?: 'white' | 'black') => {
    const request = ++linkRequestRef.current
    setLinkError(null)
    const shared = parseSharedGame(text)
    if (!shared) {
      setLinkLoading(false)
      handleLoadPgn(text, reviewingSide)
      return
    }
    setLinkLoading(true)
    fetchSharedGamePgn(shared, readStorage(USERNAME_KEY)).then(sharedPgn => {
      if (request !== linkRequestRef.current) return
      setLinkLoading(false)
      if (sharedPgn) handleLoadPgn(sharedPgn)
      else setLinkError('Could not load this chess.com game.')
    })
  }, [handleLoadPgn])

  const [initialUsername, setInitialUsername] = useState<string | null>(null)
  const [autoFetch, setAutoFetch] = useState(false)
  const urlParamsHandledRef = useRef(false)
  // ?move=N from the address bar: the ply to show once the linked game has loaded.
  const pendingMoveRef = useRef<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pgn = params.get('pgn')
    const game = params.get('game')
    const share = params.get('share')
    const username = params.get('username')
    const move = Number(params.get('move'))

    if (!urlParamsHandledRef.current && (pgn || game || share) && Number.isInteger(move) && move > 0) {
      pendingMoveRef.current = move
    }
    if (!urlParamsHandledRef.current && pgn) {
      urlParamsHandledRef.current = true
      handleLoadPgn(pgn)
    } else if (!urlParamsHandledRef.current && game) {
      urlParamsHandledRef.current = true
      handleLoadInput(game)
    } else if (!urlParamsHandledRef.current && share) {
      urlParamsHandledRef.current = true
      handleLoadInput(share)
    } else if (!urlParamsHandledRef.current && username) {
      urlParamsHandledRef.current = true
      setInitialUsername(username)
      setAutoFetch(params.get('autofetch') === '1')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs once on mount

  // The linked game is in: show the ?move=N position right away, and open the guided review
  // there once the analysis is done (like chess.com's …/review?move=N links).
  useEffect(() => {
    if (pendingMoveRef.current === null || fens.length === 0) return
    goToPly(Math.min(pendingMoveRef.current, fens.length - 1))
    pendingMoveRef.current = null
    openReviewAfterAnalysisRef.current = true
  }, [fens, goToPly])

  // Keep the address bar on the game and move being looked at, so a reload, a bookmark or a
  // copied address opens the same spot: ?game=<chess.com id> when the PGN names its chess.com
  // game (dropping the one-off ?share= / ?username= it was loaded through), plus ?move=N. A ?pgn=
  // stays only while it is still the game on the board. replaceState keeps the chapter history.
  useEffect(() => {
    if (!isLoaded) return
    const url = new URL(window.location.href)
    const params = url.searchParams
    if (params.has('pgn') && params.get('pgn') !== pgn) params.delete('pgn')
    const gameId = params.has('pgn') ? null : chessComGameId(pgn)
    if (gameId) {
      params.set('game', gameId)
      for (const key of ['share', 'username', 'autofetch']) params.delete(key)
    } else {
      params.delete('game')
    }
    if (currentPly > 0) params.set('move', String(currentPly))
    else params.delete('move')
    const query = params.toString()
    const next = `${url.pathname}${query ? `?${query}` : ''}${url.hash}`
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', next)
    }
  }, [isLoaded, pgn, currentPly])

  // "Open the app and the last game is there" (settings.openNewestGame, lib/newestGame.ts): the
  // saved username's newest chess.com game loads on a cold start and when the app comes back
  // after a while away; one that turns up while the app is open is offered in a banner instead.
  // The state the check needs lives in a ref, since it runs from event handlers and timers.
  const [newestOffer, setNewestOffer] = useState<ChessComGame | null>(null)
  const newestStateRef = useRef({ enabled: false, loadedId: null as string | null, hasGame: false, busy: false })
  useEffect(() => {
    newestStateRef.current = {
      enabled: settings.openNewestGame,
      loadedId: chessComGameId(pgn),
      hasGame: isLoaded,
      busy: playout.active || puzzles.active || isAnalyzing || linkLoading,
    }
  })
  const lastNewestIdRef = useRef<string | null>(null)
  const newestRequestRef = useRef(0)
  const openNewestGame = useCallback((game: ChessComGame) => {
    const username = readStorage(USERNAME_KEY)?.trim().toLowerCase() ?? ''
    setNewestOffer(null)
    // Analyzed straight away whatever settings.autoAnalyze says, like "Analyze last game".
    analyzeNextLoadRef.current = true
    handleLoadPgn(game.pgn, game.white.username.toLowerCase() === username ? 'white' : 'black')
  }, [handleLoadPgn])
  const checkNewestGame = useCallback((trigger: NewestGameTrigger, awayMs = 0) => {
    const username = readStorage(USERNAME_KEY)?.trim()
    if (!newestStateRef.current.enabled || !username) return
    const request = ++newestRequestRef.current
    fetchRecentGames(username, { fresh: true }).then(games => {
      if (request !== newestRequestRef.current) return
      const newest = games[0] ?? null
      const newestId = gameIdFromUrl(newest?.url)
      const state = newestStateRef.current
      if (!state.enabled) return
      const action = decideNewestGame({
        trigger,
        newestId,
        loadedId: state.loadedId,
        hasGame: state.hasGame,
        lastHandledId: lastNewestIdRef.current,
        awayMs,
        busy: state.busy,
      })
      if (!action || !newest) return
      lastNewestIdRef.current = newestId
      if (action === 'load') openNewestGame(newest)
      else setNewestOffer(newest)
    }).catch(() => {})
  }, [openNewestGame])
  // Latest callbacks for the mount-only effect below.
  const handleLoadInputRef = useRef(handleLoadInput)
  const checkNewestGameRef = useRef(checkNewestGame)
  useEffect(() => {
    handleLoadInputRef.current = handleLoadInput
    checkNewestGameRef.current = checkNewestGame
  })

  // A game sent from the chess.com share sheet (docs/iphone.md): public/sw.js parked it when the
  // push came in. Check whenever the app comes to the front, and when the service worker says so
  // for the case where it's already there. A shared game wins; without one the newest-game check
  // above runs — not on a start that a ?game= / ?pgn= link already took care of.
  useEffect(() => {
    let hiddenAt: number | null = null
    let lastOpenedAt = Date.now()
    function onFront(trigger: NewestGameTrigger, awayMs = 0) {
      takePendingShare().then(text => {
        if (text) handleLoadInputRef.current(text)
        else if (trigger !== 'start' || !urlParamsHandledRef.current) checkNewestGameRef.current(trigger, awayMs)
      })
    }
    function handleVisibility() {
      if (document.visibilityState !== 'visible') {
        hiddenAt = Date.now()
        return
      }
      const awayMs = hiddenAt === null ? 0 : Date.now() - hiddenAt
      hiddenAt = null
      lastOpenedAt = Date.now()
      onFront('resume', awayMs)
    }
    function handleServiceWorkerMessage() {
      if (document.visibilityState === 'visible') takePendingShare().then(text => { if (text) handleLoadInputRef.current(text) })
    }
    // The archive can list a just-finished game a few minutes late: keep looking for a while
    // after each opening, and offer it once it's there.
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastOpenedAt < NEWEST_POLL_WINDOW_MS) {
        checkNewestGameRef.current('poll')
      }
    }, NEWEST_POLL_INTERVAL_MS)
    if (document.visibilityState === 'visible') onFront('start')
    else hiddenAt = Date.now()
    document.addEventListener('visibilitychange', handleVisibility)
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)
    return () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', handleVisibility)
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
    }
  // Mount-only (everything goes through refs): a re-run would count as a fresh start.
  }, [])

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

  // What the board column shows — the current position, or whichever mode owns the board
  // (practice > puzzle > retry > best/explain preview). See lib/boardView.ts for the rules.
  const boardView = deriveBoardView({
    currentFen,
    lastMove: currentPly > 0 ? moves[currentPly - 1] : null,
    classification: analysis?.classification,
    bestMoveArrow,
    evalAfter: evalResults[currentPly] ?? null,
    evalBefore: currentPly > 0 ? evalResults[currentPly - 1] ?? null : null,
    liveEval: result,
    retry: retryMoveIndex !== null
      ? { trialFen, revealArrow: retryRevealArrow, attempt: attemptResult }
      : null,
    review: { sub: reviewSub, bestPreview, lineSteps, explainStep },
    extraArrows,
    extraSquares: extraSquareHighlights,
    onRetryDrop: handleTrialDrop,
    playout: playout.active && playout.fen
      ? { fen: playout.fen, lastMove: playout.lastMove, isUserTurn: playout.isUserTurn, onDrop: playout.applyUserMove }
      : null,
    puzzle: puzzles.active && puzzles.current
      ? {
          fenBefore: puzzles.current.fenBefore,
          evalBefore: evalResults[puzzles.current.moveIndex] ?? null,
          attempt: puzzles.attempt,
          revealed: puzzles.revealed,
          bestPreview: puzzleBestPreview,
          onDrop: puzzles.tryMove,
        }
      : null,
  })
  // One computed source for both the coach bubble's badge and the eval bar.
  const reviewEvalBadge = formatEvalBadge(boardView.reviewEval)

  // chess.com frames the winner's avatar in the summary; the clock of the side to move carries
  // the clock icon (the other one is faded).
  const winner: 'white' | 'black' | null =
    gameResult === '1-0' ? 'white' : gameResult === '0-1' ? 'black' : null
  const sideToMove: 'white' | 'black' = currentFen.split(' ')[1] === 'b' ? 'black' : 'white'
  const takeover = playout.active || puzzles.active
  const hasReview = evalResults.length > 0 && engineError == null
  // For the popstate handler, which outlives renders.
  useEffect(() => {
    hasReviewRef.current = hasReview
  }, [hasReview])

  // The guided-review coach, shared by ReviewView (desktop sidebar) and the phone top strip.
  const reviewCoachProps = {
    active: reviewActive,
    headline: reviewHeadlineText,
    headlineParts,
    commentary: reviewSub === 'idle' ? commentary : null,
    activeHighlight,
    onHoverHighlight: setHoveredHighlight,
    onPinHighlight: handlePinHighlight,
    evalBadge: reviewEvalBadge,
    coachClass,
    sub: reviewSub,
  }

  // Phones (PhoneFooter): the gear menu collects the desktop controls column's actions, the green
  // middle button is the current chapter's main step, and the arrows step the main line — or the
  // engine line while it is being explained, like the arrow keys.
  const inSummary = sidebarView === 'summary' && hasReview && !takeover
  const inReview = sidebarView === 'review' && hasReview && !takeover
  const explaining = inReview && reviewSub === 'explain'
  const phoneMenu: FooterAction[] = [
    { icon: <IconGear size={20} />, label: 'Settings', onClick: () => setSettingsOpen(true) },
    { icon: <IconFlip />, label: 'Flip Board', onClick: handleFlip, disabled: !isLoaded },
    { icon: <IconPalette />, label: 'Board & Pieces', onClick: () => setThemeOpen(true) },
    {
      icon: linkCopied ? <IconCheck className="text-cc-green" /> : <IconLink />,
      label: linkCopied ? 'Copied!' : 'Copy analysis link',
      onClick: handleCopyLink,
      disabled: !isLoaded || takeover,
    },
    { icon: <IconCamera />, label: 'Export board image', onClick: handleExportImage, disabled: !isLoaded || takeover },
    ...(inReview
      ? [{ icon: <IconTarget />, label: 'Practice from here', onClick: handleStartPractice, disabled: !isReady || currentPly === 0 }]
      : []),
    // The move list's ⚡ marker sits far below the board on phones, so the current key moment
    // can be retried from here too.
    ...(inReview && currentPly > 0 && visibleKeyMoments.has(currentPly - 1) && retryMoveIndex === null
      ? [{ icon: <IconRetry />, label: 'Retry this move', onClick: () => handleRetry(currentPly - 1) }]
      : []),
  ]
  const reviewFinished = inReview && reviewActive && reviewSub === 'idle' && !canGoNext
  const shareableMove = playedClass === 'Brilliant' || playedClass === 'Great'
  const phoneExtras: FooterAction[] =
    inReview && reviewActive && reviewSub === 'idle'
      ? [
          ...(canExplain ? [{ icon: <IconBulb size={22} />, label: 'Explain', onClick: handleExplain }] : []),
          ...(canBest ? [{ icon: <IconStar size={22} />, label: 'Best move', onClick: handleBest }] : []),
        ]
      : []
  // Only while there's room left of the green button (gear + two more).
  if (inReview && reviewActive && reviewSub === 'idle' && shareableMove && phoneExtras.length < 2) {
    phoneExtras.push({ icon: <IconShare size={22} />, label: 'Share this move', onClick: handleShareMove })
  }
  const phonePrimary: FooterAction | null = inSummary
    ? { icon: <IconStar size={20} />, label: 'Start Review', onClick: handleStartReview }
    : !inReview
      ? null
      : reviewActive && reviewSub === 'best'
        ? { icon: <IconPlay size={20} />, label: 'Resume', onClick: handleResume }
        : reviewActive && reviewSub === 'explain'
          ? { icon: <IconCheck size={20} />, label: 'Got it!', onClick: handleGotIt }
          : reviewFinished
            ? { icon: <IconCheck size={20} />, label: 'Finish review', onClick: handleBackToSummary }
            : { icon: <IconArrowRight size={20} />, label: 'Next', onClick: goToNext, disabled: !canGoNext }
  // Like chess.com's phone page, the coach sits above the board; the desktop sidebar keeps its own
  // copy, hidden on phones. Smaller than chess.com's (80px and 96px), to leave room for the board
  // and the accuracy on one screen.
  // Retry feedback: in the desktop review sidebar under the move list, and on phones in the strip
  // above the board — under the move list it would be scrolled far out of view.
  const retryPanel =
    retryMoveIndex !== null && moveAnalyses?.[retryMoveIndex] ? (
      <RetryPanel
        originalSan={moves[retryMoveIndex].san}
        originalClassification={moveAnalyses[retryMoveIndex].classification}
        attempt={attemptResult}
        onRetryAgain={handleRetryAgain}
        onExit={handleExitRetry}
      />
    ) : null
  const phoneCoach =
    retryPanel && !takeover ? retryPanel
    : !settings.coachEnabled || takeover || !hasReview ? null : sidebarView === 'summary' ? (
      <CoachSpeech align="bottom" size={48}>{summaryHeadline(whiteSummary, blackSummary)}</CoachSpeech>
    ) : sidebarView === 'review' ? (
      <ReviewCoach {...reviewCoachProps} size={64} />
    ) : null

  // Swiping across the board steps through the game like the footer arrows (the engine line
  // while it's being explained). Not while a piece can be moved on the board — that's a drag.
  const boardSwipe = useSwipe({
    enabled: isLoaded && !takeover && !boardView.interactive,
    onSwipeLeft: explaining ? handleLineNext : goToNext,
    onSwipeRight: explaining ? handleLinePrev : goToPrev,
  })

  const playerBar = (side: 'white' | 'black') => (
    <PlayerBar
      name={(side === 'white' ? whiteName : blackName) ?? (side === 'white' ? 'White' : 'Black')}
      elo={side === 'white' ? whiteElo : blackElo}
      clockSeconds={isLoaded ? remainingClockSeconds(clocks, currentPly, side, timeControl) : null}
      side={side}
      active={sideToMove === side}
      fen={boardView.fen}
      piecesBasePath={pieceTheme.basePath}
    />
  )

  return (
    // chess.com's page frame, measured at 1440x900: a 16px page padding around [board column]
    // [sidebar card]. The board column is player bar (40) + 10 + board + 10 + player bar (40),
    // with the 30px eval bar 10px left of the board and the 32px controls column to its right;
    // --board is the largest square that fits both the viewport height and the width left over
    // next to the sidebar (whose width scales from 300px at 1440 wide, like chess.com's).
    // Phones (< md) follow chess.com's mobile page (375x812) instead: a scrolling page with the
    // coach on top, the board spanning the full width, the sidebar below it and a footer bar
    // fixed to the bottom of the screen (PhoneFooter).
    <div className="page-frame min-h-screen min-h-dvh pt-2 pb-[calc(49px+env(safe-area-inset-bottom))] bg-cc-bg text-cc-text flex flex-col md:h-screen md:h-dvh md:min-h-0 md:overflow-hidden md:flex-row md:justify-center md:p-4 short:p-2">
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

      {phoneCoach && (
        <div className={`md:hidden px-3 pb-2 ${sidebarView === 'review' ? 'min-h-[72px]' : ''}`}>
          {phoneCoach}
        </div>
      )}

      {/* ── Left: board column, with the controls column standing to its right from the top
          player bar down (chess.com's gear sits level with the top bar). On phones the player
          bars get 16px gutters, the 20px eval bar sits 1px from the edge and the board takes
          the rest of the width; the controls move into PhoneFooter's menu. ── */}
      <div className="shrink-0 flex">
        <div className="flex-1 min-w-0 flex flex-col gap-2.5 md:flex-initial">
          <div className="mx-4 md:mx-0 md:ml-10 md:w-[var(--board)]">{playerBar(topSide)}</div>
          <div className="flex px-px md:px-0 md:h-[var(--board)]">
            <EvalBar evalResult={boardView.evalResult} orientation={orientation} />
            <div
              className="flex-1 min-w-0 ml-[9px] aspect-square md:flex-initial md:ml-2.5 md:h-full"
              {...boardSwipe}
            >
              <BoardErrorBoundary>
                <BoardPanel
                  fen={boardView.fen}
                  lastMoveFrom={boardView.lastMoveFrom}
                  lastMoveTo={boardView.lastMoveTo}
                  classification={boardView.classification}
                  bestMoveArrow={boardView.arrow}
                  extraArrows={boardView.extraArrows}
                  extraSquareHighlights={boardView.extraSquares}
                  showBadges={settings.showBoardBadges}
                  resultBadge={boardView.resultBadge}
                  orientation={orientation}
                  interactive={boardView.interactive}
                  onPieceDrop={boardView.onDrop}
                  piecesBasePath={pieceTheme.basePath}
                  boardImageUrl={boardTheme.url}
                />
              </BoardErrorBoundary>
            </div>
          </div>
          <div className="mx-4 md:mx-0 md:ml-10 md:w-[var(--board)]">{playerBar(bottomSide)}</div>
          {/* Not in the summary: there the accuracy has to fit on the first screen. */}
          {isLoaded && !takeover && !inSummary && (
            <div className="md:hidden -mt-1">
              <MoveStrip moves={moves} currentPly={currentPly} onSelectPly={goToPly} moveAnalyses={moveAnalyses} />
            </div>
          )}
        </div>
        <div className="hidden md:flex">
          <BoardToolbar
            onFlip={handleFlip}
            onOpenThemes={() => setThemeOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onCopyLink={handleCopyLink}
            onExportImage={handleExportImage}
            soundEnabled={settings.soundEnabled}
            onToggleSound={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            linkCopied={linkCopied}
            isLoaded={isLoaded}
            takeover={takeover}
          />
        </div>
      </div>

      {/* ── Right: sidebar card — chapters that replace each other: 'setup' (game loader,
          Analyze button, move list), 'summary' (chess.com's Game Review overview), and 'review'
          (the guided walkthrough), plus the practice/puzzle takeovers. See sidebarView. Each
          chapter draws its own 48px SidebarHeader; the nav footer closes the card off in every
          chapter but the summary, which pins its Start Review button there instead. ── */}
      <div
        className="flex-auto mt-2 bg-black/20 flex flex-col md:flex-initial md:shrink-0 md:min-h-0 md:mt-0 md:rounded-[5px] md:overflow-hidden"
        style={{ width: 'var(--sidebar-w)' }}
      >
        <div className="flex-auto flex flex-col md:flex-1 md:min-h-0">
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
              playedSan={puzzles.current?.playedSan ?? null}
              moveNumber={puzzles.current ? Math.floor(puzzles.current.moveIndex / 2) + 1 : null}
              attempt={puzzles.attempt}
              revealed={puzzles.revealed}
              bestSan={puzzles.current?.bestSan ?? null}
              onTryAgain={puzzles.retry}
              onReveal={puzzles.reveal}
              onNext={puzzles.next}
              onExit={puzzles.exit}
            />
          ) : sidebarView === 'summary' && hasReview ? (
            <SummaryView
              whiteName={whiteName ?? 'White'}
              blackName={blackName ?? 'Black'}
              whiteSummary={whiteSummary}
              blackSummary={blackSummary}
              evalResults={evalResults}
              moveAnalyses={moveAnalyses}
              currentPly={currentPly}
              onSelectPly={goToPly}
              onStartReview={handleStartReview}
              onNewGame={() => openChapter('setup')}
              puzzleCount={puzzleList.length}
              onStartPuzzles={handleStartPuzzles}
              winner={winner}
            />
          ) : sidebarView === 'review' && hasReview ? (
            <ReviewView
              onBack={handleBackToSummary}
              {...reviewCoachProps}
              coachEnabled={settings.coachEnabled}
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
              finished={reviewFinished}
              puzzleCount={puzzleList.length}
              onStartPuzzles={handleStartPuzzles}
              onNextGame={() => openChapter('setup')}
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
              retry={retryPanel && <div className="hidden md:block shrink-0 pt-2">{retryPanel}</div>}
            />
          ) : (
            <div className="flex flex-col flex-1 min-h-0 short:overflow-y-auto animate-chapter-fade-in">
              <SidebarHeader
                title="Analysis"
                icon={<IconTarget size={22} className="text-cc-green" />}
                start={
                  hasReview
                    ? { icon: <IconArrowLeft />, label: 'Back to Game Review', onClick: handleBackToSummary }
                    : undefined
                }
              />
              <GamePicker
                onLoad={handleLoadInput}
                error={linkError ?? error}
                loading={linkLoading}
                initialUsername={initialUsername}
                autoFetch={autoFetch}
                renderPrimary={lastGame => (
                  <EvalPanel
                    isReady={isReady}
                    isAnalyzing={isAnalyzing}
                    analysisProgress={analysisProgress}
                    result={result}
                    error={engineError}
                    isGameLoaded={isLoaded}
                    hasAnalysis={hasReview}
                    onAnalyzeGame={handleAnalyzeGame}
                    canAnalyzeLastGame={lastGame.available}
                    onAnalyzeLastGame={() => {
                      analyzeNextLoadRef.current = true
                      lastGame.load().then(loaded => { if (!loaded) analyzeNextLoadRef.current = false })
                    }}
                    engineLines={currentEngineLines}
                    onHoverEngineLine={settings.showEngineLines ? setHoveredLineSan : undefined}
                  />
                )}
              />
              <OpeningBadge opening={openingResult?.opening ?? null} />
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
            next/last), with a tertiary row of ghost buttons in the review chapter. `takeover`
            disables it during practice/puzzles. Sits outside the scrollable chapter area so it
            never scrolls out of view; the summary chapter has its Start Review button here. */}
        {!inSummary && (
          <div className="hidden md:block">
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
              takeover={takeover}
            >
              {inReview && (
                <>
                  <button
                    onClick={handleStartPractice}
                    disabled={!isReady || currentPly === 0}
                    className="cc-btn-ghost h-10 px-4 rounded-[5px] flex items-center gap-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <IconTarget className="text-white/50" /> Practice
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="cc-btn-ghost h-10 px-4 rounded-[5px] flex items-center gap-2 text-sm font-semibold transition-colors"
                  >
                    <IconLink className="text-white/50" /> {linkCopied ? 'Copied!' : 'Share'}
                  </button>
                </>
              )}
            </NavControls>
          </div>
        )}
      </div>

      {newestOffer && (
        <NewestGameBanner
          game={newestOffer}
          username={readStorage(USERNAME_KEY)?.trim() ?? ''}
          onAnalyze={() => openNewestGame(newestOffer)}
          onDismiss={() => setNewestOffer(null)}
        />
      )}

      <PhoneFooter
        menu={phoneMenu}
        extras={phoneExtras}
        primary={phonePrimary}
        onPrev={explaining ? handleLinePrev : goToPrev}
        onNext={explaining ? handleLineNext : goToNext}
        canPrev={explaining ? explainStep > 0 : isLoaded && canGoPrev && !takeover}
        canNext={explaining ? explainStep < lineSteps.length - 1 : isLoaded && canGoNext && !takeover}
      />
    </div>
  )
}

export default App
