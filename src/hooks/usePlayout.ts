import { useState, useCallback, useRef, useEffect } from 'react'
import { Chess } from 'chess.js'

export interface PlayoutView {
  active: boolean
  fen: string | null
  // The side the human controls — fixed to whoever was to move when practice started.
  userColor: 'w' | 'b'
  isUserTurn: boolean
  engineThinking: boolean
  gameOver: boolean
  // One-line outcome once the game ends (checkmate/draw), null while playing.
  resultText: string | null
  lastMove: { from: string; to: string } | null
  // Half-moves played since practice started (both sides), for the "move N" status line.
  moveCount: number
  start: (fen: string) => void
  exit: () => void
  applyUserMove: (from: string, to: string) => boolean
}

function outcome(chess: Chess, userColor: 'w' | 'b'): string | null {
  if (chess.isCheckmate()) {
    // Side to move is checkmated → the other side delivered mate.
    return chess.turn() === userColor ? 'Checkmate — the engine wins.' : 'Checkmate — you win!'
  }
  if (chess.isStalemate()) return 'Stalemate — draw.'
  if (chess.isInsufficientMaterial()) return 'Draw — insufficient material.'
  if (chess.isThreefoldRepetition()) return 'Draw — threefold repetition.'
  if (chess.isDraw()) return 'Draw.'
  return null
}

// "Practice from here" (Phase 8): the user takes over the current position and plays it out
// against a shallow, fast Stockfish (`requestPlayMove`, go movetime). The engine replies to every
// user move via the effect below. Nothing here touches useGame's state, so exiting simply drops
// this hook's state and the review board reappears at whatever ply it was on.
export function usePlayout(requestPlayMove: (fen: string, movetimeMs?: number) => Promise<string | null>) {
  const [fen, setFen] = useState<string | null>(null)
  const [userColor, setUserColor] = useState<'w' | 'b'>('w')
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [moveCount, setMoveCount] = useState(0)

  // Bumped on every start/exit so an in-flight engine reply from a previous session (or a session
  // the user just left) is discarded instead of landing on a stale/closed board.
  const genRef = useRef(0)
  const fenRef = useRef<string | null>(null)
  const userColorRef = useRef<'w' | 'b'>('w')
  useEffect(() => { fenRef.current = fen }, [fen])
  useEffect(() => { userColorRef.current = userColor }, [userColor])

  const active = fen !== null
  const chess = active ? new Chess(fen) : null
  const gameOver = chess?.isGameOver() ?? false
  const resultText = chess ? outcome(chess, userColor) : null
  const isUserTurn = active && !gameOver && chess!.turn() === userColor
  // Derived, not stored: whenever it's the engine's turn and the game isn't over, the reply
  // effect below is (or is about to be) running. Deriving it avoids a synchronous setState.
  const engineThinking = active && !gameOver && !isUserTurn

  const start = useCallback((startFen: string) => {
    genRef.current++
    let turn: 'w' | 'b' = 'w'
    try { turn = new Chess(startFen).turn() } catch { /* keep default */ }
    setUserColor(turn)
    setLastMove(null)
    setMoveCount(0)
    setFen(startFen)
  }, [])

  const exit = useCallback(() => {
    genRef.current++
    setFen(null)
    setLastMove(null)
    setMoveCount(0)
  }, [])

  const applyUserMove = useCallback((from: string, to: string): boolean => {
    const current = fenRef.current
    if (current == null) return false
    const c = new Chess(current)
    if (c.turn() !== userColorRef.current) return false
    try {
      const m = c.move({ from, to, promotion: 'q' })
      if (!m) return false
      setFen(c.fen())
      setLastMove({ from: m.from, to: m.to })
      setMoveCount(n => n + 1)
      return true
    } catch {
      return false
    }
  }, [])

  // Engine reply: fires whenever the board lands on a position where it's the engine's turn and
  // the game isn't over. Guarded by genRef so a reply from a superseded session is dropped.
  useEffect(() => {
    if (fen == null) return
    const c = new Chess(fen)
    if (c.isGameOver() || c.turn() === userColor) return
    const gen = genRef.current
    let cancelled = false
    requestPlayMove(fen, 500).then((uci) => {
      if (cancelled || gen !== genRef.current) return
      if (!uci) return
      const c2 = new Chess(fen)
      try {
        const m = c2.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
        if (!m) return
        setFen(c2.fen())
        setLastMove({ from: m.from, to: m.to })
        setMoveCount(n => n + 1)
      } catch { /* illegal engine move (shouldn't happen) — leave the turn to the user */ }
    })
    return () => { cancelled = true }
  }, [fen, userColor, requestPlayMove])

  return {
    active,
    fen,
    userColor,
    isUserTurn,
    engineThinking,
    gameOver,
    resultText,
    lastMove,
    moveCount,
    start,
    exit,
    applyUserMove,
  }
}
