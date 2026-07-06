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
  const captures = chess
    .moves({ verbose: true })
    .filter(m => m.to === square && m.captured)
  if (captures.length === 0) return 0

  // Capture with the least valuable attacker first (king last — it can only
  // recapture when the square is undefended anyway, which legality enforces).
  let cheapest = captures[0]
  for (const m of captures) {
    if (orderVal(m.piece) < orderVal(cheapest.piece)) cheapest = m
  }

  chess.move(cheapest)
  const gain = (PIECE_VAL[cheapest.captured!] ?? 0) - seeGainOn(chess, square)
  chess.undo()
  return Math.max(0, gain)
}

function orderVal(piece: string): number {
  return piece === 'k' ? 100 : PIECE_VAL[piece] ?? 0
}
