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
  // Whose side is being reviewed (settings.reviewAs) — the matching avatar gets a green
  // highlight ring, chess.com-style. 'both' has no single reviewed side, so neither is ringed.
  reviewAs: 'white' | 'black' | 'both'
}

// Every player-comparison row (names, Players/avatars, Accuracy, classification counts, Game
// Rating, phase grades) shares this exact 4-column template — measured live against chess.com
// (Screenshot_20/_1/_2): label left (flex), then two 64px value columns (white/black) with a
// 32px icon column between them. Sharing one template is what keeps every row's values lined up
// under each other instead of drifting per-row (the plan's "values stick to the outer edges" bug).
function GridRow({
  label,
  left,
  icon,
  right,
  className = '',
}: {
  label: React.ReactNode
  left: React.ReactNode
  icon?: React.ReactNode
  right: React.ReactNode
  className?: string
}) {
  return (
    <div className={`grid grid-cols-[1fr_64px_32px_64px] items-center gap-1 ${className}`}>
      <span className="text-cc-text-faint text-xs truncate">{label}</span>
      <div className="flex justify-center">{left}</div>
      <div className="flex justify-center">{icon}</div>
      <div className="flex justify-center">{right}</div>
    </div>
  )
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
  reviewAs,
}: SummaryViewProps) {
  const [tableExpanded, setTableExpanded] = useState(true)
  const bestAccuracy = Math.max(whiteSummary.accuracy ?? 0, blackSummary.accuracy ?? 0)
  const celebrate = bestAccuracy >= CELEBRATION_ACCURACY

  return (
    <div className="relative flex flex-col h-full overflow-y-auto animate-chapter-fade-in">
      {celebrate && <ConfettiBurst />}

      <div className="shrink-0 flex items-center justify-center gap-1.5 px-2 py-2 border-b border-cc-border/60">
        <img src="/marks/best_128x.png" alt="" className="w-4 h-4" />
        <h2 className="text-sm font-semibold">Game Review</h2>
      </div>

      <div className="flex flex-col gap-2 px-2 py-2 border-b border-cc-border/60">
        <div className="flex items-start gap-2">
          <div className="w-14 h-14 shrink-0 rounded-lg bg-cc-surface overflow-hidden">
            <img src="/chess-coach.png" alt="Coach" className="w-full h-full object-cover" />
          </div>
          <div className="relative flex-1 bg-white rounded-lg px-3 py-2.5 min-h-14 flex items-center">
            <span aria-hidden className="absolute -left-1.5 top-4 w-3 h-3 bg-white rotate-45" />
            <span className="text-[#312e2b] text-[15px] leading-snug">
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
        <GridRow
          label=""
          left={
            <span className="font-semibold text-sm truncate">
              {whiteName}{whiteElo ? ` (${whiteElo})` : ''}
            </span>
          }
          right={
            <span className="font-semibold text-sm truncate">
              {blackName}{blackElo ? ` (${blackElo})` : ''}
            </span>
          }
        />
        <GridRow
          label="Players"
          left={<PlayerAvatar name={whiteName} highlighted={reviewAs === 'white'} />}
          right={<PlayerAvatar name={blackName} highlighted={reviewAs === 'black'} />}
        />

        <GridRow
          label="Accuracy"
          left={<AccuracyPill accuracy={whiteSummary.accuracy} light />}
          right={<AccuracyPill accuracy={blackSummary.accuracy} light={false} />}
        />

        <button
          onClick={() => setTableExpanded(e => !e)}
          aria-label={tableExpanded ? 'Hide details' : 'Show details'}
          className="flex items-center justify-center rounded hover:bg-cc-surface/40 py-1 transition-colors text-cc-text-faint text-xs"
        >
          {tableExpanded ? '▲' : '▼'}
        </button>

        {tableExpanded && (
          <>
            <div className="flex flex-col gap-0.5 text-xs">
              {CLASS_DISPLAY_ORDER.map(cls => (
                <GridRow
                  key={cls}
                  label={cls}
                  left={<span className="font-semibold">{whiteSummary.classificationCounts[cls]}</span>}
                  icon={<img src={CLASS_ICON[cls]} alt={cls} className="w-4 h-4" />}
                  right={<span className="font-semibold">{blackSummary.classificationCounts[cls]}</span>}
                />
              ))}
            </div>

            <GridRow
              className="pt-2 border-t border-cc-border/60"
              label="Game Rating"
              left={<RatingPill rating={whiteSummary.gameRating} />}
              right={<RatingPill rating={blackSummary.gameRating} />}
            />

            {PHASE_ROWS.map(({ key, label }) => (
              <GridRow
                key={key}
                label={label}
                left={<PhaseIcon grade={whiteSummary.phaseGrades[key]} />}
                right={<PhaseIcon grade={blackSummary.phaseGrades[key]} />}
              />
            ))}
          </>
        )}
      </div>

      <div className="flex-1 min-h-4" />

      <div className="shrink-0 p-2 flex flex-col gap-2">
        <button
          onClick={onStartReview}
          className="w-full h-12 rounded-lg bg-cc-green hover:bg-cc-green-hover text-white text-[15px] font-bold transition-colors"
        >
          Start Review
        </button>
        {puzzleCount > 0 && (
          <button
            onClick={onStartPuzzles}
            className="w-full h-12 rounded-lg bg-cc-surface hover:bg-cc-surface-hover text-cc-text text-[15px] font-bold transition-colors"
          >
            Puzzles ({puzzleCount})
          </button>
        )}
      </div>
    </div>
  )
}

function PlayerAvatar({ name, highlighted }: { name: string; highlighted: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      className={`w-12 h-12 rounded-lg bg-cc-surface flex items-center justify-center text-cc-text-dim font-bold select-none ${
        highlighted ? 'ring-2 ring-cc-green' : ''
      }`}
    >
      {initial}
    </div>
  )
}

function AccuracyPill({ accuracy, light }: { accuracy: number | null; light: boolean }) {
  return (
    <span
      className={`px-2 py-1 rounded font-semibold text-sm ${
        light ? 'bg-cc-text text-cc-bg' : 'bg-cc-bg-dark text-cc-text border border-cc-border'
      }`}
    >
      {accuracy != null ? accuracy.toFixed(1) : '–'}
    </span>
  )
}

function RatingPill({ rating }: { rating: number | null }) {
  return (
    <span className="px-2 py-0.5 rounded bg-cc-surface font-bold text-cc-text min-w-10 text-center">
      {rating ?? '–'}
    </span>
  )
}

function PhaseIcon({ grade }: { grade: PhaseGrade | null | undefined }) {
  if (!grade) return <span className="text-cc-text-faint">–</span>
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
