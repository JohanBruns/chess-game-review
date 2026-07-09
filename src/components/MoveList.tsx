import { useEffect, useRef } from 'react'
import type { Move } from 'chess.js'
import type { MoveAnalysis, MoveClass } from '../lib/analysis/classify'
import { CLASS_ICON } from '../lib/analysis/classIcons'
import { classColor } from '../lib/analysis/classColors'
import { formatMoveTime } from '../lib/analysis/clocks'

// Which classifications chess.com surfaces in the move list — an inline icon AND a colored SAN.
// Verified against a live Game Review move list (Board&Game/review/Screenshot_3, game
// 171300157032): Best moves DO get a green star + green text; the routine Excellent/Good band
// gets neither (default light text, no icon), and Forced is our own class with no equivalent.
// This corrects the earlier plan note (which claimed Best carried no icon).
const MARKED_CLASSES = new Set<MoveClass>([
  'Book', 'Brilliant', 'Great', 'Best', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder',
])

// Piece letter → filled Unicode figurine, drawn in place of the SAN's leading letter (Nf3 → ♞f3)
// like chess.com. Pawn moves and castling have no leading piece letter and render unchanged. The
// glyph inherits the surrounding text color, so a colored move tints its figurine to match.
const FIGURINE: Record<string, string> = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞',
}

function splitSan(san: string): { figurine: string | null; text: string } {
  const figurine = FIGURINE[san[0]]
  return figurine ? { figurine, text: san.slice(1) } : { figurine: null, text: san }
}

interface MoveListProps {
  moves: Move[]
  currentPly: number
  onSelectPly: (ply: number) => void
  moveAnalyses: MoveAnalysis[] | null
  keyMoments?: Set<number>
  // Per-ply time spent (seconds), same 0-based indexing as moveAnalyses/moves (parseClocks/
  // moveTimes in clocks.ts) — null entries (no %clk data) render no time label.
  moveTimeSeconds?: (number | null)[]
  // chess.com hides move times in the guided-review move list but the setup chapter keeps them.
  // Defaults to showing them; the review chapter passes false.
  showMoveTimes?: boolean
  // Retry-at-key-moments: called with the move's 0-based moveIndex (the position BEFORE the
  // move, unlike onSelectPly's 1-based ply which is the position after it).
  onRetry?: (moveIndex: number) => void
}

export function MoveList({
  moves,
  currentPly,
  onSelectPly,
  moveAnalyses,
  keyMoments,
  moveTimeSeconds,
  showMoveTimes = true,
  onRetry,
}: MoveListProps) {
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentPly])

  if (moves.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-cc-text-faint text-xs italic">
        No moves loaded
      </div>
    )
  }

  const rows: { moveNumber: number; whitePly: number; blackPly: number | null }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      moveNumber: Math.floor(i / 2) + 1,
      whitePly: i + 1,
      blackPly: i + 1 < moves.length ? i + 2 : null,
    })
  }

  return (
    <div className="flex-1 min-h-[220px] overflow-y-auto">
      <table className="w-full border-collapse">
        <tbody>
          {rows.map(({ moveNumber, whitePly, blackPly }) => (
            <tr
              key={moveNumber}
              className={`group h-[30px] ${moveNumber % 2 === 0 ? 'bg-cc-bg-dark/40' : ''}`}
            >
              <td className="text-cc-text-faint pr-1 pl-2 select-none w-7 text-right text-[11px] align-middle">
                {moveNumber}.
              </td>
              <td className="w-[46%] align-middle">
                <MoveButton
                  san={moves[whitePly - 1].san}
                  ply={whitePly}
                  currentPly={currentPly}
                  onClick={onSelectPly}
                  selectedRef={selectedRef}
                  analysis={moveAnalyses?.[whitePly - 1] ?? null}
                  isKeyMoment={keyMoments?.has(whitePly - 1) ?? false}
                  timeSeconds={showMoveTimes ? moveTimeSeconds?.[whitePly - 1] ?? null : null}
                  onRetry={onRetry}
                />
              </td>
              <td className="w-[46%] align-middle">
                {blackPly !== null && (
                  <MoveButton
                    san={moves[blackPly - 1].san}
                    ply={blackPly}
                    currentPly={currentPly}
                    onClick={onSelectPly}
                    selectedRef={selectedRef}
                    analysis={moveAnalyses?.[blackPly - 1] ?? null}
                    isKeyMoment={keyMoments?.has(blackPly - 1) ?? false}
                    timeSeconds={showMoveTimes ? moveTimeSeconds?.[blackPly - 1] ?? null : null}
                    onRetry={onRetry}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface MoveButtonProps {
  san: string
  ply: number
  currentPly: number
  onClick: (ply: number) => void
  selectedRef: React.RefObject<HTMLButtonElement | null>
  analysis: MoveAnalysis | null
  isKeyMoment: boolean
  timeSeconds?: number | null
  onRetry?: (moveIndex: number) => void
}

function MoveButton({ san, ply, currentPly, onClick, selectedRef, analysis, isKeyMoment, timeSeconds, onRetry }: MoveButtonProps) {
  const isActive = ply === currentPly
  const marked = analysis != null && MARKED_CLASSES.has(analysis.classification)
  const { figurine, text } = splitSan(san)

  return (
    <span className="flex items-center gap-0.5">
      <button
        ref={isActive ? selectedRef : null}
        className={`text-left px-1 py-0.5 rounded-[2px] text-[13px] font-bold leading-5 transition-colors flex items-center ${
          isActive ? 'bg-white/[0.14]' : 'hover:bg-cc-surface-hover/40'
        } ${marked ? '' : 'text-cc-text'}`}
        style={marked ? { color: classColor(analysis!.classification) } : undefined}
        onClick={() => onClick(ply)}
      >
        {analysis && MARKED_CLASSES.has(analysis.classification) && (
          <img
            src={CLASS_ICON[analysis.classification]}
            alt={analysis.classification}
            title={analysis.classification}
            className="inline w-4 h-4 mr-1 align-middle shrink-0"
          />
        )}
        {figurine && <span className="mr-0.5 text-[15px] leading-none">{figurine}</span>}
        {text}
      </button>
      {timeSeconds != null && (
        <span className="text-[10px] text-cc-text-faint tabular-nums">
          {formatMoveTime(timeSeconds)}
        </span>
      )}
      {isKeyMoment && (
        onRetry ? (
          <button
            onClick={() => onRetry(ply - 1)}
            title="Try this move yourself"
            className="text-[11px] text-cc-red/70 hover:text-cc-red opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ⚡
          </button>
        ) : (
          <span className="text-[11px] text-cc-red/70 opacity-0 group-hover:opacity-100 transition-opacity">⚡</span>
        )
      )}
    </span>
  )
}
