import { useEffect, useRef } from 'react'
import type { Move } from 'chess.js'
import type { MoveAnalysis } from '../lib/analysis/classify'
import { CLASS_ICON } from '../lib/analysis/classIcons'

interface MoveListProps {
  moves: Move[]
  currentPly: number
  onSelectPly: (ply: number) => void
  moveAnalyses: MoveAnalysis[] | null
  keyMoments?: Set<number>
  // Retry-at-key-moments: called with the move's 0-based moveIndex (the position BEFORE the
  // move, unlike onSelectPly's 1-based ply which is the position after it).
  onRetry?: (moveIndex: number) => void
}

export function MoveList({ moves, currentPly, onSelectPly, moveAnalyses, keyMoments, onRetry }: MoveListProps) {
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
            <tr key={moveNumber} className="hover:bg-cc-surface/30">
              <td className="text-cc-text-faint pr-1 pl-2 py-0 select-none w-7 text-right text-[11px] leading-5">
                {moveNumber}.
              </td>
              <td className="py-0 w-[46%]">
                <MoveButton
                  san={moves[whitePly - 1].san}
                  ply={whitePly}
                  currentPly={currentPly}
                  onClick={onSelectPly}
                  selectedRef={selectedRef}
                  analysis={moveAnalyses?.[whitePly - 1] ?? null}
                  isKeyMoment={keyMoments?.has(whitePly - 1) ?? false}
                  onRetry={onRetry}
                />
              </td>
              <td className="py-0 w-[46%]">
                {blackPly !== null && (
                  <MoveButton
                    san={moves[blackPly - 1].san}
                    ply={blackPly}
                    currentPly={currentPly}
                    onClick={onSelectPly}
                    selectedRef={selectedRef}
                    analysis={moveAnalyses?.[blackPly - 1] ?? null}
                    isKeyMoment={keyMoments?.has(blackPly - 1) ?? false}
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
  onRetry?: (moveIndex: number) => void
}

function MoveButton({ san, ply, currentPly, onClick, selectedRef, analysis, isKeyMoment, onRetry }: MoveButtonProps) {
  const isActive = ply === currentPly

  return (
    <span className="flex items-center gap-0.5">
      <button
        ref={isActive ? selectedRef : null}
        className={`text-left px-1.5 py-0.5 rounded font-mono text-xs leading-5 transition-colors ${
          isActive
            ? 'bg-cc-green text-white font-semibold'
            : 'text-cc-text-dim hover:bg-cc-surface-hover/50'
        }`}
        onClick={() => onClick(ply)}
      >
        {san}
        {analysis && (
          <img
            src={CLASS_ICON[analysis.classification]}
            alt={analysis.classification}
            title={analysis.classification}
            className="inline w-4 h-4 ml-0.5 align-middle"
          />
        )}
      </button>
      {isKeyMoment && (
        onRetry ? (
          <button
            onClick={() => onRetry(ply - 1)}
            title="Try this move yourself"
            className="text-xs leading-5 text-cc-red hover:text-cc-red-hover"
          >
            ⚡
          </button>
        ) : (
          <span className="text-xs leading-5 text-cc-red">⚡</span>
        )
      )}
    </span>
  )
}
