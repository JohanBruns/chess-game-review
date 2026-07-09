import { useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard'
import type { MoveClass } from '../lib/analysis/classify'
import { CLASS_COLOR } from '../lib/analysis/classColors'
import { pieceImageMap, PIECE_KEYS } from '../lib/themes'

interface BoardPanelProps {
  fen: string
  lastMoveFrom?: string
  lastMoveTo?: string
  classification?: MoveClass
  // Engine's recommended move, shown as a green arrow (toggled on by the caller).
  bestMoveArrow?: { from: string; to: string }
  // Extra arrows with explicit colors — used by the coach's hoverable tactical-theme highlights
  // (Phase 4). Drawn alongside bestMoveArrow. In Phase 5 the threat arrow returns through here too.
  extraArrows?: { from: string; to: string; color: string }[]
  // Extra square tints (square → css color) for coach theme highlights; merged over the last-move tint.
  extraSquareHighlights?: Record<string, string>
  // Which side's perspective the board is drawn from. react-chessboard flips pieces, arrows,
  // and squareStyles automatically; only the manual badge-overlay geometry below needs mirroring.
  orientation?: 'white' | 'black'
  // Retry-at-key-moments: when true, the side to move's pieces can be dragged. The library
  // has no chess-rules awareness — legality is validated by the caller in onPieceDrop.
  interactive?: boolean
  // Called with (from, to) on a drop; return true to accept (and update `fen` accordingly)
  // or false to reject (piece snaps back). react-chessboard never commits the move itself.
  onPieceDrop?: (from: string, to: string) => boolean
  // Theme (from the theme picker): directory of the 12 piece PNGs, and the board background URL.
  piecesBasePath: string
  boardImageUrl: string
}

// Matches --color-cc-green / --color-cc-orange / --color-cc-red in index.css —
// hardcoded because react-chessboard renders these as raw SVG fill/stroke attributes.
//
// The "you should have played this" suggestion arrow is always green on chess.com,
// regardless of how bad the played move was (Mistake/Blunder included) — it's the
// same "best move" color as the Best/Excellent square highlight, not severity-coded.
const BEST_MOVE_ARROW_COLOR = '#9FCF3F'

const MARK_FILE: Record<Exclude<MoveClass, 'Book'>, string> = {
  Brilliant:  'brilliant_128x.png',
  Great:      'great_find_128x.png',
  Best:       'best_128x.png',
  Excellent:  'excellent_128x.png',
  Good:       'good_128x.png',
  Inaccuracy: 'inaccuracy_128x.png',
  Mistake:    'mistake_128x.png',
  Blunder:    'blunder_128x.png',
  Miss:       'miss_128x.png',
  Forced:     'forced_128x.png',
}

const IMG: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' }

export function BoardPanel({
  fen,
  lastMoveFrom,
  lastMoveTo,
  classification,
  bestMoveArrow,
  extraArrows,
  extraSquareHighlights,
  orientation = 'white',
  interactive = false,
  onPieceDrop,
  piecesBasePath,
  boardImageUrl,
}: BoardPanelProps) {
  // Custom piece renderers, rebuilt only when the piece theme changes. react-chessboard
  // memoizes off this object reference, so a fresh literal every render would defeat that.
  const customPieces = useMemo(() => {
    const map = pieceImageMap(piecesBasePath)
    return Object.fromEntries(
      PIECE_KEYS.map(key => [key, () => <img src={map[key]} style={IMG} alt="" />]),
    )
  }, [piecesBasePath])

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (lastMoveFrom && lastMoveTo && classification) {
    const color = `rgba(${CLASS_COLOR[classification]}, 0.55)`
    squareStyles[lastMoveFrom] = { backgroundColor: color }
    squareStyles[lastMoveTo] = { backgroundColor: color }
  }
  // Coach theme highlights sit on top of the last-move tint (they share few squares in practice).
  if (extraSquareHighlights) {
    for (const [sq, color] of Object.entries(extraSquareHighlights)) {
      squareStyles[sq] = { backgroundColor: color }
    }
  }

  // react-chessboard memoizes internal children off the `arrows` array reference — without
  // useMemo a fresh literal on every render (e.g. during a rapid-navigation burst) would
  // defeat that memoization on top of the extra render volume itself.
  const arrows = useMemo<Arrow[]>(() => {
    const result: Arrow[] = []
    if (bestMoveArrow) {
      result.push({ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: BEST_MOVE_ARROW_COLOR })
    }
    if (extraArrows) {
      for (const a of extraArrows) {
        result.push({ startSquare: a.from, endSquare: a.to, color: a.color })
      }
    }
    return result
  }, [bestMoveArrow, extraArrows])

  const badge =
    lastMoveTo && classification && classification !== 'Book'
      ? (() => {
          const file = lastMoveTo.charCodeAt(0) - 97  // 0 = a … 7 = h
          const rank = parseInt(lastMoveTo[1])          // 1–8
          const flipped = orientation === 'black'
          // Badge sits at the destination square's top-right *screen* corner. White screen
          // col=file, row=8-rank; Black screen col=7-file, row=rank-1 (board mirrored on
          // both axes) — the +1 on the White right-edge case becomes (8-file) for Black.
          return {
            left: flipped ? (8 - file) / 8 * 100 : (file + 1) / 8 * 100,
            top:  flipped ? (rank - 1) / 8 * 100 : (8 - rank) / 8 * 100,
            src:  `/marks/${MARK_FILE[classification as Exclude<MoveClass, 'Book'>]}`,
          }
        })()
      : null

  return (
    <div className="w-full h-full relative">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          canDragPiece: interactive
            ? ({ piece }) => piece.pieceType[0] === fen.split(' ')[1]  // only the side to move
            : undefined,
          onPieceDrop: interactive && onPieceDrop
            ? ({ sourceSquare, targetSquare }) =>
                targetSquare !== null && onPieceDrop(sourceSquare, targetSquare)
            : undefined,
          pieces: customPieces,
          boardStyle: {
            backgroundImage: `url(${boardImageUrl})`,
            backgroundSize: '100% 100%',
          },
          darkSquareStyle:  { backgroundColor: 'transparent' },
          lightSquareStyle: { backgroundColor: 'transparent' },
          squareStyles,
          arrows,
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
        }}
      />
      {badge && (
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={badge.src}
            alt={classification}
            className="absolute w-5 h-5 drop-shadow-lg"
            style={{
              left: `${badge.left}%`,
              top:  `${badge.top}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      )}
    </div>
  )
}
