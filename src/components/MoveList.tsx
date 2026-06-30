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

const CLASS_STYLE: Record<MoveClass, { symbol: string; cls: string }> = {
  Book:        { symbol: '📖', cls: 'text-slate-400' },
  Best:        { symbol: '★',  cls: 'text-cyan-400' },
  Excellent:   { symbol: '✓✓', cls: 'text-green-400' },
  Good:        { symbol: '✓',  cls: 'text-green-600' },
  Inaccuracy:  { symbol: '?!', cls: 'text-yellow-400' },
  Mistake:     { symbol: '?',  cls: 'text-orange-400' },
  Blunder:     { symbol: '??', cls: 'text-red-500' },
}

export function MoveList({ moves, currentPly, onSelectPly, moveAnalyses, keyMoments }: MoveListProps) {
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentPly])

  if (moves.length === 0) {
    return (
      <div className="flex-1 bg-slate-800 rounded p-3 text-slate-500 text-sm italic">
        Keine Züge geladen
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
    <div className="flex-1 bg-slate-800 rounded overflow-y-auto max-h-[520px] p-2">
      <table className="w-full text-sm border-collapse">
        <tbody>
          {rows.map(({ moveNumber, whitePly, blackPly }) => (
            <tr key={moveNumber} className="hover:bg-slate-700/40">
              <td className="text-slate-500 pr-2 pl-1 py-0.5 select-none w-8 text-right">
                {moveNumber}.
              </td>
              <td className="py-0.5 w-1/2">
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
              <td className="py-0.5 w-1/2">
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
  const style = analysis ? CLASS_STYLE[analysis.classification] : null

  return (
    <button
      ref={isActive ? selectedRef : null}
      className={`w-full text-left px-2 py-0.5 rounded font-mono transition-colors ${
        isActive
          ? 'bg-blue-600 text-white font-semibold'
          : 'text-slate-200 hover:bg-slate-600'
      }`}
      onClick={() => onClick(ply)}
    >
      {san}
      {style && (
        <span className={`ml-1 text-xs font-sans ${isActive ? 'text-white/80' : style.cls}`}>
          {style.symbol}
        </span>
      )}
      {isKeyMoment && (
        <span className={`ml-1 text-xs ${isActive ? 'text-white/80' : 'text-red-400'}`}>⚡</span>
      )}
    </button>
  )
}
