import { Chess } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'
import type { LineStep } from './review'
import { PIECE_VAL } from './see'

// The coach's sentence in Explain mode: what the engine's line actually achieves, worked out from
// the line itself — mate, the material it wins (and through which capture), or else how the
// position stands afterwards. Before, Explain only said "Explaining Qe3+".

// Material of one side in pawns (kings left out), read off a FEN's board.
function material(fen: string, color: 'w' | 'b'): number {
  let sum = 0
  for (const ch of fen.split(' ')[0]) {
    const lower = ch.toLowerCase()
    if (!(lower in PIECE_VAL)) continue
    const isWhite = ch !== lower
    if ((color === 'w') === isWhite) sum += PIECE_VAL[lower]
  }
  return sum
}

function balance(fen: string, mover: 'w' | 'b'): number {
  return material(fen, mover) - material(fen, mover === 'w' ? 'b' : 'w')
}

// evalBefore: the engine's evaluation of the position the line starts from (White's view).
export function explainLine(fenBefore: string, steps: LineStep[], evalBefore: EvalResult | null): string {
  if (steps.length === 0) return ''
  const mover = fenBefore.split(' ')[1] === 'b' ? 'b' : 'w'
  const first = steps[0].san
  const moverSign = mover === 'w' ? 1 : -1

  // Mate for the side to move.
  const mate = evalBefore?.mate ?? null
  if (mate !== null && mate !== 0 && Math.sign(mate) === moverSign) {
    return `${first} leads to mate in ${Math.abs(mate)}.`
  }
  if (steps.some(s => s.san.endsWith('#'))) return `${first} leads to mate.`
  // Mate against the side to move: the line is the longest resistance.
  if (mate !== null && mate !== 0) return `${first} is the best defense.`

  // Material won over the line, and the last capture of the mover's that got it there.
  const start = balance(fenBefore, mover)
  const gain = balance(steps[steps.length - 1].fen, mover) - start
  let keyIndex = -1
  let keyPiece: string | null = null
  const chess = new Chess(fenBefore)
  for (let i = 0; i < steps.length; i++) {
    let move
    try {
      move = chess.move(steps[i].san)
    } catch {
      break
    }
    if (i % 2 === 0 && move.captured && balance(steps[i].fen, mover) - start > 0) {
      keyIndex = i
      keyPiece = move.captured
    }
  }

  const via = keyIndex > 0 ? ` (${steps.slice(0, keyIndex + 1).map(s => s.san).join(' ')})` : ''
  if (gain >= 1) {
    const what =
      gain >= 8 ? 'the queen'
      : gain === 2 && keyPiece === 'r' ? 'the exchange'
      : gain >= 5 ? 'a rook'
      : gain >= 3 ? 'a piece'
      : gain === 1 ? 'a pawn'
      : `${gain} pawns`
    return `${first} wins ${what}${via}.`
  }

  // No material won: say how the position stands, from the mover's side.
  const cp = evalBefore?.cp != null ? evalBefore.cp * moverSign : null
  if (gain <= -2 && cp !== null && cp >= 100) return `${first} gives up material for a strong attack.`
  if (cp === null) return `${first} is the strongest continuation.`
  if (cp >= 300) return `${first} keeps a winning position.`
  if (cp >= 120) return `${first} keeps a clear advantage.`
  if (cp >= 40) return `${first} keeps an edge.`
  if (cp > -40) return `${first} keeps the balance.`
  return `${first} is the best defense.`
}
