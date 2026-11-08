import { useMemo, useState } from 'react'
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
  // Settings toggle for the classification badge (⭐/❓/❗ etc.) on the last-moved square.
  showBadges?: boolean
  // Retry-at-key-moments feedback (Phase 6 polish): a ✓/✗ badge on the attempted move's target
  // square, independent of the classification badge above (retry passes classification=undefined
  // so the two never overlap).
  resultBadge?: { square: string; correct: boolean }
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

const MARK_FILE: Record<MoveClass, string> = {
  Book:       'book_128x.png',
  Brilliant:  'brilliant_128x.png',
  Great:      'great_find_128x.png',
  Best:       'best_128x.png',
  Excellent:  'excellent_128x.png',
  Good:       'good_128x.png',
  Inaccuracy: 'inaccuracy_128x.png',
  Mistake:    'mistake_128x.png',
  Blunder:    'blunder_128x.png',
  Miss:       'miss.svg',
  Forced:     'forced_128x.png',
}

const IMG: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' }

// Badge sits at a square's top-right *screen* corner. White screen col=file, row=8-rank;
// Black screen col=7-file, row=rank-1 (board mirrored on both axes) — the +1 on the White
// right-edge case becomes (8-file) for Black.
function badgeScreenPosition(square: string, orientation: 'white' | 'black'): { left: number; top: number } {
  const file = square.charCodeAt(0) - 97  // 0 = a … 7 = h
  const rank = parseInt(square[1])          // 1–8
  const flipped = orientation === 'black'
  return {
    left: flipped ? (8 - file) / 8 * 100 : (file + 1) / 8 * 100,
    top:  flipped ? (rank - 1) / 8 * 100 : (8 - rank) / 8 * 100,
  }
}

export function BoardPanel({
  fen,
  lastMoveFrom,
  lastMoveTo,
  classification,
  bestMoveArrow,
  extraArrows,
  extraSquareHighlights,
  showBadges = true,
  resultBadge,
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

  // Tap-to-move for the interactive modes (retry, puzzles, practice): tap one of your pieces,
  // then the square it should go to — dragging a piece with a finger covers it and the target.
  // Dropped whenever the position or the interactivity changes (React's adjust-on-change pattern).
  const [selected, setSelected] = useState<string | null>(null)
  const [selectionKey, setSelectionKey] = useState(`${fen}|${interactive}`)
  if (selectionKey !== `${fen}|${interactive}`) {
    setSelectionKey(`${fen}|${interactive}`)
    setSelected(null)
  }
  const sideToMove = fen.split(' ')[1]
  const handleSquareClick = ({ piece, square }: { piece: { pieceType: string } | null; square: string }) => {
    const ownPiece = piece != null && piece.pieceType[0] === sideToMove
    if (selected === null || square === selected) {
      setSelected(ownPiece && square !== selected ? square : null)
    } else if (ownPiece) {
      setSelected(square)
    } else {
      setSelected(null)
      onPieceDrop?.(selected, square)
    }
  }

  const squareStyles: Record<string, React.CSSProperties> = {}
  // chess.com tints both last-move squares in the move's class color at 50% (book moves in the
  // tan of the book icon — the same color the move list prints them in).
  if (lastMoveFrom && lastMoveTo && classification) {
    const color = classification === 'Book' ? 'rgba(213, 164, 125, 0.5)' : `rgba(${CLASS_COLOR[classification]}, 0.5)`
    squareStyles[lastMoveFrom] = { backgroundColor: color }
    squareStyles[lastMoveTo] = { backgroundColor: color }
  }
  // Coach theme highlights sit on top of the last-move tint (they share few squares in practice).
  if (extraSquareHighlights) {
    for (const [sq, color] of Object.entries(extraSquareHighlights)) {
      squareStyles[sq] = { backgroundColor: color }
    }
  }
  if (interactive && selected) {
    squareStyles[selected] = { backgroundColor: 'rgba(255, 255, 51, 0.5)' }
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
    showBadges && lastMoveTo && classification
      ? {
          ...badgeScreenPosition(lastMoveTo, orientation),
          src: `/marks/${MARK_FILE[classification]}`,
        }
      : null

  // chess.com spells out the special finds as a short-lived pill over the target square.
  const label =
    badge && (classification === 'Brilliant' || classification === 'Great')
      ? { text: classification === 'Brilliant' ? 'Brilliant!' : 'Great!', below: badge.top < 12 }
      : null

  const resultBadgePos = resultBadge
    ? {
        ...badgeScreenPosition(resultBadge.square, orientation),
        src: resultBadge.correct ? '/marks/correct_128x.png' : '/marks/incorrect_128x.png',
      }
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
            ? ({ sourceSquare, targetSquare }) => {
                setSelected(null)
                return targetSquare !== null && onPieceDrop(sourceSquare, targetSquare)
              }
            : undefined,
          onSquareClick: interactive && onPieceDrop ? handleSquareClick : undefined,
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
          animationDurationInMs: 200,
        }}
      />
      {badge && (
        <div className="absolute inset-0 pointer-events-none">
          <img
            key={`${badge.src}-${lastMoveTo}`}
            src={badge.src}
            alt={classification}
            // ~40% of a square (measured off a live chess.com review) → 5% of the board width;
            // centered on the target square's top-right corner so it spills slightly past the edge.
            className="absolute w-[5%] aspect-square drop-shadow-lg animate-badge-pop-in"
            style={{
              left: `${badge.left}%`,
              top:  `${badge.top}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      )}
      {badge && label && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <span
            key={`${label.text}-${lastMoveTo}-${fen}`}
            className="absolute px-2 py-0.5 rounded-full text-[13px] font-bold text-white whitespace-nowrap shadow-lg animate-label-pop"
            style={{
              left: `${Math.min(88, Math.max(12, badge.left))}%`,
              top: `${badge.top}%`,
              backgroundColor: `rgb(${CLASS_COLOR[classification!]})`,
              translate: label.below ? '-50% 60%' : '-50% -160%',
            }}
          >
            {label.text}
          </span>
        </div>
      )}
      {resultBadgePos && (
        <div className="absolute inset-0 pointer-events-none">
          <img
            key={`${resultBadgePos.src}-${resultBadge!.square}`}
            src={resultBadgePos.src}
            alt={resultBadge!.correct ? 'Correct' : 'Incorrect'}
            // Slightly larger than the classification badge, same corner-anchored scaling.
            className="absolute w-[6%] aspect-square drop-shadow-lg animate-badge-pop-in"
            style={{
              left: `${resultBadgePos.left}%`,
              top:  `${resultBadgePos.top}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      )}
    </div>
  )
}
