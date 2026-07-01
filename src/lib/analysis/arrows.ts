import { Chess, type Square, type Color } from 'chess.js'

export interface ArrowSquares {
  from: Square
  to: Square
}

// Parses the engine's best-move SAN against the position before it was played,
// so callers get board coordinates instead of just a SAN string.
export function getBestMoveArrow(fenBefore: string, bestMoveSan: string | null): ArrowSquares | null {
  if (!bestMoveSan) return null
  try {
    const chess = new Chess(fenBefore)
    const move = chess.move(bestMoveSan)
    return { from: move.from, to: move.to }
  } catch {
    return null
  }
}

export interface AttackArrows {
  attacks: Square[]     // enemy squares the moved piece now attacks
  attackedBy: Square[]  // enemy squares that attack the moved piece's destination
}

// Pure board geometry (chess.js attackers()) — independent of engine eval/classification.
export function getAttackArrows(fenAfter: string, moveTo: Square, moverColor: Color): AttackArrows {
  const chess = new Chess(fenAfter)
  const opponentColor: Color = moverColor === 'w' ? 'b' : 'w'

  const attackedBy = chess.attackers(moveTo, opponentColor)

  const attacks: Square[] = []
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== opponentColor) continue
      if (chess.attackers(piece.square, moverColor).includes(moveTo)) {
        attacks.push(piece.square)
      }
    }
  }

  return { attacks, attackedBy }
}
