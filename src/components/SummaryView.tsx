import { useState } from 'react'
import type { GameSummary, PhaseGrade } from '../lib/analysis/summary'
import type { MoveClass } from '../lib/analysis/classify'
import { CLASS_ICON, CLASS_DISPLAY_ORDER } from '../lib/analysis/classIcons'
import { classTextColor } from '../lib/analysis/classColors'
import { summaryHeadline } from '../lib/analysis/review'
import type { EvalResult } from '../lib/engine/useEngine'
import type { MoveAnalysis } from '../lib/analysis/classify'
import { usePlayerAvatar } from '../hooks/usePlayerAvatar'
import { LazyEvalGraph } from './LazyEvalGraph'
import { SidebarHeader } from './SidebarHeader'
import { CoachSpeech } from './CoachSpeech'
import { IconChevronDown, IconChevronUp, IconClose, IconPlus, IconPuzzle, PawnAvatar } from './icons'

// Accuracy threshold for the confetti celebration burst — matches chess.com's "excellent game"
// bar (see summaryHeadline's own >=90 check for the coach headline).
const CELEBRATION_ACCURACY = 90

// The tally rows chess.com keeps visible while the table is collapsed (Book, Good, Inaccuracy and
// a zero Brilliant fold away).
const COLLAPSED_CLASSES = new Set<MoveClass>(['Great', 'Best', 'Excellent', 'Mistake', 'Miss', 'Blunder'])

const PHASE_ROWS:{ key: 'opening' | 'middlegame' | 'endgame'; label: string }[] = [
  { key: 'opening', label: 'Opening' },
  { key: 'middlegame', label: 'Middlegame' },
  { key: 'endgame', label: 'Endgame' },
]

interface SummaryViewProps {
  whiteName: string
  blackName: string
  whiteSummary: GameSummary
  blackSummary: GameSummary
  evalResults: (EvalResult | null)[]
  moveAnalyses: MoveAnalysis[] | null
  currentPly: number
  onSelectPly: (ply: number) => void
  onStartReview: () => void
  // Header "+" — back to the setup chapter to load another game.
  onNewGame: () => void
  // Phase 8: number of drillable mistakes of the user's own side, and the handler to start the
  // puzzle flow.
  // The "Puzzles (n)" button is hidden when there are none.
  puzzleCount: number
  onStartPuzzles: () => void
  // The game's winner (PGN Result header) — chess.com frames the winner's avatar in green.
  winner: 'white' | 'black' | null
  // Phones: the gear menu in the header's right slot (the summary has the screen to itself there,
  // without the footer that otherwise holds it).
  phoneMenu?: React.ReactNode
}

// Every player-comparison row shares one 3-column template, measured live against chess.com at
// 1440x900 (sidebar 300px, 24px padding → three 81px columns): label left, then the white and
// black values centered in their own column. The tally rows add a classification glyph centered
// on the boundary between the two value columns (see TallyRow).
function GridRow({
  label,
  left,
  right,
  className = '',
}: {
  label: React.ReactNode
  left: React.ReactNode
  right: React.ReactNode
  className?: string
}) {
  return (
    <div className={`grid grid-cols-3 items-center ${className}`}>
      <span className="text-sm font-semibold leading-5 text-white">{label}</span>
      <div className="flex justify-center min-w-0">{left}</div>
      <div className="flex justify-center min-w-0">{right}</div>
    </div>
  )
}

// Sidebar "chapter 1" — chess.com's post-analysis Game Review overview. Structure and metrics
// measured live (2026-11-02, game 186365372722 at 1440x900): header, coach bubble (avatar
// bottom-aligned with the speech bubble), 80px eval graph, names / avatars / accuracy boxes, a
// collapsible tally table, Game Rating boxes, and Opening/Middlegame/Endgame rows that show only
// an ICON (reusing the move-classification icon set). A big gradient "Start Review" button is
// pinned under the scrolling area. This view REPLACES the rest of the sidebar (MoveList/graph
// live in chapter 2 instead) — see sidebarView in App.tsx.
export function SummaryView({
  whiteName,
  blackName,
  whiteSummary,
  blackSummary,
  evalResults,
  moveAnalyses,
  currentPly,
  onSelectPly,
  onStartReview,
  onNewGame,
  puzzleCount,
  onStartPuzzles,
  winner,
  phoneMenu,
}: SummaryViewProps) {
  // Collapsed by default, like chess.com (checked live 2026-11-08): only the rows that tell the
  // story stay, the rest folds away behind the chevron. Saves a lot of scrolling on phones.
  const [tableExpanded, setTableExpanded] = useState(false)
  const visibleClasses = tableExpanded
    ? CLASS_DISPLAY_ORDER
    : CLASS_DISPLAY_ORDER.filter(cls =>
        COLLAPSED_CLASSES.has(cls) ||
        // A Brilliant is worth showing whenever there is one.
        (cls === 'Brilliant' && whiteSummary.classificationCounts[cls] + blackSummary.classificationCounts[cls] > 0),
      )
  const bestAccuracy = Math.max(whiteSummary.accuracy ?? 0, blackSummary.accuracy ?? 0)
  const celebrate = bestAccuracy >= CELEBRATION_ACCURACY

  return (
    <div className="relative flex flex-col h-full overflow-hidden animate-chapter-fade-in">
      {celebrate && <ConfettiBurst />}

      <SidebarHeader
        title="Game Review"
        icon={<img src="/marks/best_128x.png" alt="" className="w-6 h-6" />}
        start={{
          // An ✕ on phones, like the chess.com app's full-screen summary; "+" in the sidebar.
          icon: (
            <>
              <IconClose className="md:hidden" />
              <IconPlus className="max-md:hidden" />
            </>
          ),
          label: 'Load another game',
          onClick: onNewGame,
        }}
        end={phoneMenu ? <div className="md:invisible">{phoneMenu}</div> : undefined}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 pb-2 md:p-6 md:pb-2">
          <div className="mb-4">
            <CoachSpeech align="bottom">{summaryHeadline(whiteSummary, blackSummary)}</CoachSpeech>
          </div>

          <div>
            <LazyEvalGraph
              evalResults={evalResults}
              currentPly={currentPly}
              onSelectPly={onSelectPly}
              moveAnalyses={moveAnalyses}
            />
          </div>

          <GridRow
            className="pt-2"
            label=""
            left={<span className="text-[13px] font-bold text-white truncate">{whiteName}</span>}
            right={<span className="text-[13px] font-bold text-white truncate">{blackName}</span>}
          />
          <GridRow
            className="pt-2"
            label="Players"
            left={<PlayerAvatar name={whiteName} winner={winner === 'white'} />}
            right={<PlayerAvatar name={blackName} winner={winner === 'black'} />}
          />
          <GridRow
            className="pt-2"
            label="Accuracy"
            left={<ScoreBox value={whiteSummary.accuracy?.toFixed(1)} light />}
            right={<ScoreBox value={blackSummary.accuracy?.toFixed(1)} light={false} />}
          />

          <div className="my-4 border-t border-white/10" />

          <div className="flex flex-col">
            {visibleClasses.map(cls => (
              <TallyRow
                key={cls}
                cls={cls}
                white={whiteSummary.classificationCounts[cls]}
                black={blackSummary.classificationCounts[cls]}
              />
            ))}
          </div>

          <div className="flex justify-center pt-2.5">
            <button
              onClick={() => setTableExpanded(e => !e)}
              aria-label={tableExpanded ? 'Hide details' : 'Show details'}
              className="w-6 h-6 flex items-center justify-center rounded-[5px] text-white/50 hover:text-white transition-colors"
            >
              {tableExpanded ? <IconChevronUp size={24} /> : <IconChevronDown size={24} />}
            </button>
          </div>

          <div className="my-4 border-t border-white/10" />

          <GridRow
            label="Game Rating"
            left={<ScoreBox value={whiteSummary.gameRating?.toString()} light />}
            right={<ScoreBox value={blackSummary.gameRating?.toString()} light={false} />}
          />

          {PHASE_ROWS.map(({ key, label }) => (
            <GridRow
              key={key}
              className="h-10"
              label={label}
              left={<PhaseIcon grade={whiteSummary.phaseGrades[key]} />}
              right={<PhaseIcon grade={blackSummary.phaseGrades[key]} />}
            />
          ))}

          {puzzleCount > 0 && (
            <button
              onClick={onStartPuzzles}
              title="Puzzles built from your own mistakes in this game"
              className="cc-btn-secondary mt-4 w-full h-12 rounded-[10px] text-[17px] font-semibold flex items-center justify-center gap-2"
            >
              <IconPuzzle size={22} className="text-white/72" />
              Puzzles ({puzzleCount})
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 px-6 pt-[5px] pb-6 max-md:px-4 max-md:pb-[max(16px,env(safe-area-inset-bottom))] short:pb-2">
        <button
          onClick={onStartReview}
          className="cc-btn-primary w-full h-16 short:h-11 rounded-[10px] text-[22px] short:text-lg font-extrabold"
        >
          Start Review
        </button>
      </div>
    </div>
  )
}

// chess.com's tally rows print the label in plain white and only the two counts in the
// classification color (measured 2026-11-02), with the class glyph between the counts.
function TallyRow({ cls, white, black }: { cls: MoveClass; white: number; black: number }) {
  const color = classTextColor(cls)
  return (
    <div className="relative h-10 grid grid-cols-3 items-center">
      <span className="text-sm font-semibold leading-5 text-white">{cls}</span>
      <span className="text-center text-[17px] font-bold leading-5" style={{ color }}>{white}</span>
      <span className="text-center text-[17px] font-bold leading-5" style={{ color }}>{black}</span>
      <img
        src={CLASS_ICON[cls]}
        alt=""
        className="absolute left-2/3 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6"
      />
    </div>
  )
}

function PlayerAvatar({ name, winner }: { name: string; winner: boolean }) {
  const avatar = usePlayerAvatar(name)
  return (
    <div
      className={`w-16 h-16 rounded-[5px] overflow-hidden ${winner ? 'border-4 border-cc-green' : ''}`}
      title={name}
    >
      {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <PawnAvatar size={64} />}
    </div>
  )
}

// Accuracy / Game Rating value: a 64x36 box, white on the white player's side and a faint
// translucent box on Black's (17px/700, 5px radius — chess.com's review-rating component).
function ScoreBox({ value, light }: { value: string | undefined; light: boolean }) {
  return (
    <span
      className={`w-16 h-9 rounded-[5px] flex items-center justify-center text-[17px] font-bold ${
        light ? 'bg-white text-[#312e2b]' : 'bg-white/5 text-white'
      }`}
    >
      {value ?? '–'}
    </span>
  )
}

function PhaseIcon({ grade }: { grade: PhaseGrade | null | undefined }) {
  if (!grade) return <span className="text-white/50">–</span>
  return <img src={CLASS_ICON[grade]} alt={grade} title={grade} className="w-6 h-6" />
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
