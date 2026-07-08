import type { GameSummary, PhaseGrade } from '../lib/analysis/summary'
import { CLASS_ICON, CLASS_DISPLAY_ORDER } from '../lib/analysis/classIcons'

const PHASE_ROWS: { key: 'opening' | 'middlegame' | 'endgame'; label: string }[] = [
  { key: 'opening', label: 'Opening' },
  { key: 'middlegame', label: 'Middlegame' },
  { key: 'endgame', label: 'Endgame' },
]

interface SummaryCardProps {
  whiteName: string
  blackName: string
  whiteElo?: number
  blackElo?: number
  whiteSummary: GameSummary
  blackSummary: GameSummary
  expanded: boolean
  onToggle: () => void
}

// The post-analysis report card — chess.com's "Game Review" panel. Structure verified live
// (2026-07-08 checkpoint, game 171190174548): player names, accuracy pills (light/dark),
// classification count table with icons, a collapse toggle, Game Rating pills, and
// Opening/Middlegame/Endgame rows that show only an ICON (reusing the move-classification
// icon set) — chess.com does not print a phase-grade word anywhere in this card.
export function SummaryCard({
  whiteName,
  blackName,
  whiteElo,
  blackElo,
  whiteSummary,
  blackSummary,
  expanded,
  onToggle,
}: SummaryCardProps) {
  return (
    <div className="flex flex-col gap-2 px-2 py-2 border-b border-cc-border/60">
      <div className="flex items-center justify-between text-sm gap-2">
        <span className="font-medium truncate">
          {whiteName}{whiteElo ? ` (${whiteElo})` : ''}
        </span>
        <span className="font-medium truncate text-right">
          {blackName}{blackElo ? ` (${blackElo})` : ''}
        </span>
      </div>

      <button
        onClick={onToggle}
        className="flex items-center justify-between gap-2 rounded hover:bg-cc-surface/40 px-1 py-1 -mx-1 transition-colors"
      >
        <AccuracyPill accuracy={whiteSummary.accuracy} light />
        <span className="text-cc-text-faint text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
        <AccuracyPill accuracy={blackSummary.accuracy} light={false} />
      </button>

      {expanded && (
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
  if (!grade) return <span className="w-4 h-4 inline-block" />
  return <img src={CLASS_ICON[grade]} alt={grade} title={grade} className="w-4 h-4" />
}
