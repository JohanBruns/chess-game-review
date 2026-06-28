import { Chessboard } from 'react-chessboard'

interface BoardPanelProps {
  fen: string
}

export function BoardPanel({ fen }: BoardPanelProps) {
  return (
    <div className="w-[480px] aspect-square">
      <Chessboard options={{ position: fen, allowDragging: false }} />
    </div>
  )
}
