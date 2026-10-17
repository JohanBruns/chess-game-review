import { Chess, type Square } from 'chess.js'

// Piece values in pawn units, shared with classification (sacrifice detection,
// endgame-material phase trigger).
export const PIECE_VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

// Static Exchange Evaluation: net material (pawn units) the side to move in `fen`
// can win by starting the capture sequence on `square`. Implemented as a recursive
// simulation of real legal captures instead of the classic swap algorithm — chess.js
// legality handles pins, x-rays and king safety for free. Either side may stop
// capturing when continuing loses material, hence the max(0, …) at each ply.
export function seeGain(fen: string, square: Square): number {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return 0
  }
  return seeGainOn(chess, square)
}

function seeGainOn(chess: Chess, square: Square): number {
  const target = chess.get(square)
  if (!target || target.color === chess.turn()) return 0

  // Capture with the least valuable attacker first (king last — it can only recapture when
  // the square is undefended anyway, which legality enforces). attackers() is pseudo-legal, so
  // walk them cheapest-first and take the first capture chess.js accepts (a pinned piece or a
  // king stepping into check is rejected). Deliberately not moves({ verbose: true }): that
  // builds every legal move with before/after FENs just to filter a handful of captures, and
  // made SEE the dominant cost of classifying a game (~1.3s of ~2s for 108 plies).
  const attackers = chess.attackers(square, chess.turn())
    .map(from => ({ from, value: orderVal(chess.get(from)?.type ?? 'k') }))
    .sort((a, b) => a.value - b.value)
  const promotes = square[1] === '8' || square[1] === '1'
  for (const { from } of attackers) {
    const isPawn = chess.get(from)?.type === 'p'
    try {
      chess.move({ from, to: square, promotion: isPawn && promotes ? 'q' : undefined })
    } catch {
      continue // illegal (pin / king safety) — try the next-cheapest attacker
    }
    const gain = (PIECE_VAL[target.type] ?? 0) - seeGainOn(chess, square)
    chess.undo()
    return Math.max(0, gain)
  }
  return 0
}

function orderVal(piece: string): number {
  return piece === 'k' ? 100 : PIECE_VAL[piece] ?? 0
}
