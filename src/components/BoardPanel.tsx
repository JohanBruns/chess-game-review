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
}

// Matches --color-cc-green / --color-cc-orange / --color-cc-red in index.css —
// hardcoded because react-chessboard renders these as raw SVG fill/stroke attributes.
const BEST_MOVE_ARROW_COLOR = '#81b64c'
const ATTACKS_ARROW_COLOR = '#e2903f'
const ATTACKED_BY_ARROW_COLOR = '#e5533d'

const MARK_FILE: Record<Exclude<MoveClass, 'Book'>, string> = {
  Brilliant:  'brilliant_128x.png',
  Great:      'great_find_128x.png',
  Best:       'best_128x.png',
  Excellent:  'excellent_128x.png',
  Good:       'good_128x.png',
  Inaccuracy: 'inaccuracy_128x.png',
  Mistake:    'mistake_128x.png',
  Blunder:    'blunder_128x.png',
}

// rgb() triples so the square-highlight alpha can be applied uniformly
const CLASS_COLOR: Record<MoveClass, string> = {
  Brilliant:  '27, 170, 166',
  Great:      '92, 139, 176',
  Best:       '129, 182, 76',   // var(--color-cc-green)
  Excellent:  '129, 182, 76',
  Good:       '147, 167, 110',
  Book:       '240, 210, 100',  // neutral last-move tint, not a classification color
  Inaccuracy: '240, 177, 85',
  Mistake:    '226, 144, 63',
  Blunder:    '229, 83, 61',    // var(--color-cc-red)
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
}: BoardPanelProps) {
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (lastMoveFrom && lastMoveTo && classification) {
    const color = `rgba(${CLASS_COLOR[classification]}, 0.55)`
    squareStyles[lastMoveFrom] = { backgroundColor: color }
    squareStyles[lastMoveTo] = { backgroundColor: color }
  }

  const arrows: Arrow[] = []
  if (bestMoveArrow) {
    arrows.push({ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: BEST_MOVE_ARROW_COLOR })
  }
  if (attackArrows && lastMoveTo) {
    for (const target of attackArrows.attacks) {
      arrows.push({ startSquare: lastMoveTo, endSquare: target, color: ATTACKS_ARROW_COLOR })
    }
    for (const attacker of attackArrows.attackedBy) {
      arrows.push({ startSquare: attacker, endSquare: lastMoveTo, color: ATTACKED_BY_ARROW_COLOR })
    }
  }

  const badge =
    lastMoveTo && classification && classification !== 'Book'
      ? (() => {
          const file = lastMoveTo.charCodeAt(0) - 97  // 0 = a … 7 = h
          const rank = parseInt(lastMoveTo[1])          // 1–8
          return {
            left: (file + 1) / 8 * 100,
            top:  (8 - rank) / 8 * 100,
            src:  `/marks/${MARK_FILE[classification as Exclude<MoveClass, 'Book'>]}`,
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
