import { useEffect, useRef } from 'react'
import type { Move } from 'chess.js'

interface MoveListProps {
  moves: Move[]
  currentPly: number
  onSelectPly: (ply: number) => void
}

export function MoveList({ moves, currentPly, onSelectPly }: MoveListProps) {
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

  const rows: { moveNumber: number; whitePly: number; blackPly: number | null }[] =
    []
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
}

function MoveButton({ san, ply, currentPly, onClick, selectedRef }: MoveButtonProps) {
  const isActive = ply === currentPly
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
    </button>
  )
}
