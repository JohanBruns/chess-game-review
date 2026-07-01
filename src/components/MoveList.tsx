import { useEffect, useRef } from 'react'
import type { Move } from 'chess.js'
import type { MoveAnalysis, MoveClass } from '../lib/analysis/classify'

interface MoveListProps {
  moves: Move[]
  currentPly: number
  onSelectPly: (ply: number) => void
  moveAnalyses: MoveAnalysis[] | null
  keyMoments?: Set<number>
}

const CLASS_ICON: Record<MoveClass, string> = {
  Book:        '/marks/book_128x.png',
  Brilliant:   '/marks/brilliant_128x.png',
  Great:       '/marks/great_find_128x.png',
  Best:        '/marks/best_128x.png',
  Excellent:   '/marks/excellent_128x.png',
  Good:        '/marks/good_128x.png',
  Inaccuracy:  '/marks/inaccuracy_128x.png',
  Mistake:     '/marks/mistake_128x.png',
  Blunder:     '/marks/blunder_128x.png',
}

export function MoveList({ moves, currentPly, onSelectPly, moveAnalyses, keyMoments }: MoveListProps) {
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
    <div className="flex-1 min-h-0 overflow-y-auto">
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
}

function MoveButton({ san, ply, currentPly, onClick, selectedRef, analysis, isKeyMoment }: MoveButtonProps) {
  const isActive = ply === currentPly

  return (
    <button
      ref={isActive ? selectedRef : null}
      className={`w-full text-left px-1.5 py-0.5 rounded font-mono text-xs leading-5 transition-colors ${
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
      {isKeyMoment && (
        <span className={`ml-0.5 ${isActive ? 'text-white/80' : 'text-cc-red'}`}>⚡</span>
      )}
    </button>
  )
}
