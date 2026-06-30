import { Chessboard } from 'react-chessboard'

interface BoardPanelProps {
  fen: string
}

export function BoardPanel({ fen }: BoardPanelProps) {
  return (
    <div className="w-full h-full">
      <Chessboard options={{ position: fen, allowDragging: false }} />
    </div>
  )
}
