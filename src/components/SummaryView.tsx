import { useState } from 'react'
import type { GameSummary, PhaseGrade } from '../lib/analysis/summary'
import { CLASS_ICON, CLASS_DISPLAY_ORDER } from '../lib/analysis/classIcons'
import { summaryHeadline } from '../lib/analysis/review'
import type { EvalResult } from '../lib/engine/useEngine'
import type { MoveAnalysis } from '../lib/analysis/classify'
import { EvalGraph } from './EvalGraph'

// Accuracy threshold for the confetti celebration burst — matches chess.com's "excellent game"
// bar (see summaryHeadline's own >=90 check for the coach headline).
const CELEBRATION_ACCURACY = 90

const PHASE_ROWS: { key: 'opening' | 'middlegame' | 'endgame'; label: string }[] = [
  { key: 'opening', label: 'Opening' },
  { key: 'middlegame', label: 'Middlegame' },
  { key: 'endgame', label: 'Endgame' },
]

interface SummaryViewProps {
  whiteName: string
  blackName: string
  whiteElo?: number
  blackElo?: number
  whiteSummary: GameSummary
  blackSummary: GameSummary
  evalResults: (EvalResult | null)[]
  moveAnalyses: MoveAnalysis[] | null
  currentPly: number
  onSelectPly: (ply: number) => void
  onStartReview: () => void
  // Phase 8: number of drillable mistakes in this game, and the handler to start the puzzle flow.
  // The "Puzzles (n)" button is hidden when there are none.
  puzzleCount: number
  onStartPuzzles: () => void
}

// Sidebar "chapter 1" — chess.com's post-analysis Game Review summary. Structure verified
// live (2026-07-08 checkpoint, game 171190174548): header, coach bubble, mini eval graph,
// player names + accuracy pills (light/dark), collapsible classification count table, Game
// Rating pills, and Opening/Middlegame/Endgame rows that show only an ICON (reusing the
// move-classification icon set) — chess.com does not print a phase-grade word anywhere here.
// This view REPLACES the rest of the sidebar (MoveList/graph/legend live in chapter 2 instead
// of alongside this card) — see sidebarView in App.tsx.
export function SummaryView({
  whiteName,
  blackName,
  whiteElo,
  blackElo,
  whiteSummary,
  blackSummary,
  evalResults,
  moveAnalyses,
  currentPly,
  onSelectPly,
  onStartReview,
  puzzleCount,
  onStartPuzzles,
}: SummaryViewProps) {
  const [tableExpanded, setTableExpanded] = useState(true)
  const bestAccuracy = Math.max(whiteSummary.accuracy ?? 0, blackSummary.accuracy ?? 0)
  const celebrate = bestAccuracy >= CELEBRATION_ACCURACY

  return (
    <div className="relative flex flex-col h-full overflow-y-auto animate-chapter-fade-in">
      {celebrate && <ConfettiBurst />}

      <div className="shrink-0 px-2 py-2 border-b border-cc-border/60">
        <h2 className="font-heading text-sm font-semibold">Game Review</h2>
      </div>

      <div className="flex flex-col gap-2 px-2 py-2 border-b border-cc-border/60">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 shrink-0 rounded-full bg-cc-surface overflow-hidden">
            <img src="/chess-coach.png" alt="Coach" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 bg-cc-surface rounded px-3 py-2">
            <span className="text-cc-text text-xs leading-relaxed">
              {summaryHeadline(whiteSummary, blackSummary)}
            </span>
          </div>
        </div>

        <EvalGraph
          evalResults={evalResults}
          currentPly={currentPly}
          onSelectPly={onSelectPly}
          moveAnalyses={moveAnalyses}
        />
      </div>

      <div className="flex flex-col gap-2 px-2 py-2 border-b border-cc-border/60">
        <div className="flex items-center justify-between text-sm gap-2">
          <span className="font-medium truncate">
            {whiteName}{whiteElo ? ` (${whiteElo})` : ''}
          </span>
          <span className="font-medium truncate text-right">
            {blackName}{blackElo ? ` (${blackElo})` : ''}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <AccuracyPill accuracy={whiteSummary.accuracy} light />
          <span className="text-cc-text-faint text-xs shrink-0">Accuracy</span>
          <AccuracyPill accuracy={blackSummary.accuracy} light={false} />
        </div>

        <button
          onClick={() => setTableExpanded(e => !e)}
          className="flex items-center justify-center gap-1 rounded hover:bg-cc-surface/40 py-1 transition-colors text-cc-text-faint text-xs"
        >
          {tableExpanded ? '▲ Hide details' : '▼ Show details'}
        </button>

        {tableExpanded && (
          <>
            <div className="flex flex-col gap-0.5 text-xs">
              {CLASS_DISPLAY_ORDER.map(cls => (
                <div key={cls} className="flex items-center justify-between px-1 py-0.5">
                  <span className="font-semibold w-5 text-center">
                    {whiteSummary.classificationCounts[cls]}
                  </span>
                  <span className="flex items-center gap-1.5 text-cc-text-dim flex-1 justify-center min-w-0">
                    <img src={CLASS_ICON[cls]} alt={cls} className="w-4 h-4 shrink-0" />
                    <span className="truncate">{cls}</span>
                  </span>
                  <span className="font-semibold w-5 text-center">
                    {blackSummary.classificationCounts[cls]}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs px-1 pt-2 border-t border-cc-border/60">
              <RatingPill rating={whiteSummary.gameRating} />
              <span className="text-cc-text-faint">Game Rating</span>
              <RatingPill rating={blackSummary.gameRating} />
            </div>

            {PHASE_ROWS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between text-xs px-1">
                <PhaseIcon grade={whiteSummary.phaseGrades[key]} />
                <span className="text-cc-text-faint">{label}</span>
                <PhaseIcon grade={blackSummary.phaseGrades[key]} />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="flex-1 min-h-4" />

      <div className="shrink-0 p-2 flex flex-col gap-2">
        <button
          onClick={onStartReview}
          className="w-full px-3 py-2.5 rounded bg-cc-green hover:bg-cc-green-hover text-white text-sm font-semibold transition-colors"
        >
          Start Review
        </button>
        {puzzleCount > 0 && (
          <button
            onClick={onStartPuzzles}
            className="w-full px-3 py-2 rounded bg-cc-surface hover:bg-cc-surface-hover text-cc-text text-sm font-semibold transition-colors"
          >
            Puzzles ({puzzleCount})
          </button>
        )}
      </div>
    </div>
  )
}

function AccuracyPill({ accuracy, light }: { accuracy: number | null; light: boolean }) {
  return (
    <span
      className={`font-heading px-2 py-1 rounded font-semibold text-sm ${
        light ? 'bg-cc-text text-cc-bg' : 'bg-cc-bg-dark text-cc-text border border-cc-border'
      }`}
    >
      {accuracy != null ? accuracy.toFixed(1) : '–'}
    </span>
  )
}

function RatingPill({ rating }: { rating: number | null }) {
  return (
    <span className="font-heading px-2 py-0.5 rounded bg-cc-surface font-bold text-cc-text min-w-10 text-center">
      {rating ?? '–'}
    </span>
  )
}

function PhaseIcon({ grade }: { grade: PhaseGrade | null | undefined }) {
  if (!grade) return <span className="w-4 h-4 inline-block" />
  return <img src={CLASS_ICON[grade]} alt={grade} title={grade} className="w-4 h-4" />
}

const CONFETTI_COLORS = ['#81b64c', '#e2903f', '#749bbf', '#e5533d', '#f7c631']

// A small CSS-only confetti burst (no canvas/animation library) for the accuracy>=90
// celebration — a fixed set of pieces, randomized once via useState's lazy initializer (the
// idiomatic one-time-impure-computation escape hatch; a useMemo callback isn't safe here since
// React may re-invoke or discard it), each falling via the `animate-confetti-fall` keyframe
// (index.css) with a per-piece delay/rotation/color.
function ConfettiBurst() {
  const [pieces] = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 300,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360,
    })),
  )

  return (
    <div className="absolute inset-x-0 top-0 h-24 overflow-hidden pointer-events-none z-10">
      {pieces.map(p => (
        <span
          key={p.id}
          className="absolute w-1.5 h-2.5 animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            top: '-8px',
            backgroundColor: p.color,
            animationDelay: `${p.delay}ms`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}
