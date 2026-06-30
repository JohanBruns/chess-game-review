import { Chessboard } from 'react-chessboard'
import type { MoveClass } from '../lib/analysis/classify'

interface BoardPanelProps {
  fen: string
  lastMoveTo?: string
  classification?: MoveClass
}

const BADGE: Record<Exclude<MoveClass, 'Book'>, { bg: string; symbol: string }> = {
  Best:       { bg: '#22d3ee', symbol: '★' },
  Excellent:  { bg: '#4ade80', symbol: '✓✓' },
  Good:       { bg: '#16a34a', symbol: '✓' },
  Inaccuracy: { bg: '#facc15', symbol: '?!' },
  Mistake:    { bg: '#fb923c', symbol: '?' },
  Blunder:    { bg: '#ef4444', symbol: '??' },
}

const IMG: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' }

const CUSTOM_PIECES = {
  wP: () => <img src="/pieces/wp.png" style={IMG} />,
  wR: () => <img src="/pieces/wr.png" style={IMG} />,
  wN: () => <img src="/pieces/wn.png" style={IMG} />,
  wB: () => <img src="/pieces/wb.png" style={IMG} />,
  wQ: () => <img src="/pieces/wq.png" style={IMG} />,
  wK: () => <img src="/pieces/wk.png" style={IMG} />,
  bP: () => <img src="/pieces/bp.png" style={IMG} />,
  bR: () => <img src="/pieces/br.png" style={IMG} />,
  bN: () => <img src="/pieces/bn.png" style={IMG} />,
  bB: () => <img src="/pieces/bb.png" style={IMG} />,
  bQ: () => <img src="/pieces/bq.png" style={IMG} />,
  bK: () => <img src="/pieces/bk.png" style={IMG} />,
}

export function BoardPanel({ fen, lastMoveTo, classification }: BoardPanelProps) {
  const badge =
    lastMoveTo && classification && classification !== 'Book'
      ? (() => {
          const file = lastMoveTo.charCodeAt(0) - 97  // 0 = a … 7 = h
          const rank = parseInt(lastMoveTo[1])          // 1–8
          return {
            left: (file + 1) / 8 * 100,               // right edge of column (%)
            top:  (8 - rank + 1) / 8 * 100,           // bottom edge of row (%)
            style: BADGE[classification as Exclude<MoveClass, 'Book'>],
          }
        })()
      : null

  return (
    <div className="w-full h-full relative">
      <Chessboard
        options={{
          position: fen,
          allowDragging: false,
          pieces: CUSTOM_PIECES,
          boardStyle: {
            backgroundImage: 'url(/pieces/brett.png)',
            backgroundSize: '100% 100%',
          },
          darkSquareStyle:  { backgroundColor: 'transparent' },
          lightSquareStyle: { backgroundColor: 'transparent' },
        }}
      />
      {badge && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute flex items-center justify-center rounded-full text-white font-bold select-none"
            style={{
              left: `${badge.left}%`,
              top:  `${badge.top}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: badge.style.bg,
              width:  '22px',
              height: '22px',
              fontSize: '9px',
              lineHeight: 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}
          >
            {badge.style.symbol}
          </div>
        </div>
      )}
    </div>
  )
}
