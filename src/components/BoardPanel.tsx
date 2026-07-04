import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard'
import type { MoveClass } from '../lib/analysis/classify'

interface BoardPanelProps {
  fen: string
  lastMoveFrom?: string
  lastMoveTo?: string
  classification?: MoveClass
  // Engine's recommended move, shown as a green arrow (toggled on by the caller).
  bestMoveArrow?: { from: string; to: string }
  // Squares the played move now attacks / is attacked by (pure board geometry).
  attackArrows?: { attacks: string[]; attackedBy: string[] }
  // Engine's best move in the current position — the standing threat, shown as a red arrow.
  threatArrow?: { from: string; to: string }
  // T7c engine-lines panel: the (best, or hovered) candidate move for the current position.
  // chess.com only ever draws one such arrow at a time — never all lines simultaneously.
  candidateArrow?: { from: string; to: string }
  // Which side's perspective the board is drawn from. react-chessboard flips pieces, arrows,
  // and squareStyles automatically; only the manual badge-overlay geometry below needs mirroring.
  orientation?: 'white' | 'black'
  // Retry-at-key-moments: when true, the side to move's pieces can be dragged. The library
  // has no chess-rules awareness — legality is validated by the caller in onPieceDrop.
  interactive?: boolean
  // Called with (from, to) on a drop; return true to accept (and update `fen` accordingly)
  // or false to reject (piece snaps back). react-chessboard never commits the move itself.
  onPieceDrop?: (from: string, to: string) => boolean
}

// Matches --color-cc-green / --color-cc-orange / --color-cc-red in index.css —
// hardcoded because react-chessboard renders these as raw SVG fill/stroke attributes.
//
// Verified 2026-07-04 against a live chess.com Game Review: the "you should have played
// this" suggestion arrow is NOT a fixed color there — it's green after a Miss/Inaccuracy/Good,
// red-orange after a Mistake/Blunder (severity-coded, not tied 1:1 to CLASS_COLOR). See
// bestMoveArrowColor() below. ATTACKS_ARROW_COLOR is chess.com's separate "why is this move
// great" explanatory arrow (e.g. "g5 is a great move" pointed the bishop at the piece it now
// attacks) — matched to the measured #FFAA00. ATTACKED_BY_ARROW_COLOR/THREAT_ARROW_COLOR have
// no directly observed chess.com equivalent (no live example surfaced one) — left unchanged.
const BEST_MOVE_ARROW_GOOD_COLOR = '#9FCF3F'   // Miss / Inaccuracy / Good (and anything else)
const BEST_MOVE_ARROW_SEVERE_COLOR = '#F8553F' // Mistake / Blunder
const ATTACKS_ARROW_COLOR = '#FFAA00'
const ATTACKED_BY_ARROW_COLOR = '#e5533d'
const THREAT_ARROW_COLOR = '#e02c2c'
// chess.com's analysis-mode engine-lines arrow — same green as its "best move" square/line highlight.
const CANDIDATE_ARROW_COLOR = '#81b64c'

function bestMoveArrowColor(classification?: MoveClass): string {
  return classification === 'Mistake' || classification === 'Blunder'
    ? BEST_MOVE_ARROW_SEVERE_COLOR
    : BEST_MOVE_ARROW_GOOD_COLOR
}

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

// rgb() triples so the square-highlight alpha can be applied uniformly.
// Verified 2026-07-04 against a live chess.com Game Review (DevTools computed styles) —
// Brilliant/Great/Good/Inaccuracy/Mistake/Miss/Blunder updated to the measured values.
// Book and Forced have no chess.com equivalent to check against (Book here is a neutral
// last-move tint, not chess.com's own book-brown; Forced is our own proprietary class) —
// left unchanged.
const CLASS_COLOR: Record<MoveClass, string> = {
  Brilliant:  '38, 194, 163',
  Great:      '116, 155, 191',
  Best:       '129, 182, 76',   // var(--color-cc-green)
  Excellent:  '129, 182, 76',
  Good:       '149, 183, 118',
  Book:       '240, 210, 100',  // neutral last-move tint, not a classification color
  Inaccuracy: '247, 198, 49',
  Mistake:    '255, 164, 89',
  Blunder:    '250, 65, 45',
  Miss:       '255, 119, 105',
  Forced:     '128, 128, 128',
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

export function BoardPanel({
  fen,
  lastMoveFrom,
  lastMoveTo,
  classification,
  bestMoveArrow,
  attackArrows,
  threatArrow,
  candidateArrow,
  orientation = 'white',
  interactive = false,
  onPieceDrop,
}: BoardPanelProps) {
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (lastMoveFrom && lastMoveTo && classification) {
    const color = `rgba(${CLASS_COLOR[classification]}, 0.55)`
    squareStyles[lastMoveFrom] = { backgroundColor: color }
    squareStyles[lastMoveTo] = { backgroundColor: color }
  }

  const arrows: Arrow[] = []
  if (bestMoveArrow) {
    arrows.push({ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: bestMoveArrowColor(classification) })
  }
  if (attackArrows && lastMoveTo) {
    for (const target of attackArrows.attacks) {
      arrows.push({ startSquare: lastMoveTo, endSquare: target, color: ATTACKS_ARROW_COLOR })
    }
    for (const attacker of attackArrows.attackedBy) {
      arrows.push({ startSquare: attacker, endSquare: lastMoveTo, color: ATTACKED_BY_ARROW_COLOR })
    }
  }
  if (threatArrow) {
    arrows.push({ startSquare: threatArrow.from, endSquare: threatArrow.to, color: THREAT_ARROW_COLOR })
  }
  if (candidateArrow) {
    arrows.push({ startSquare: candidateArrow.from, endSquare: candidateArrow.to, color: CANDIDATE_ARROW_COLOR })
  }

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
          pieces: CUSTOM_PIECES,
          boardStyle: {
            backgroundImage: 'url(/pieces/brett.png)',
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
