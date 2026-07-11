import { Chess } from 'chess.js'


// Pure UCI-parsing helpers shared by the primary engine worker (useEngine.ts) and the
// batch-analysis pool (enginePool.ts). Extracted 1:1 from the live-verified logic that
// used to live inline in useEngine's worker.onmessage closure.

export interface InfoScore {
  multipvIdx: number
  // White-absolute centipawns. Mate scores are folded into a ±10000 sentinel (see below),
  // so consumers like evalToCp/secondBestCp never see an ambiguous null.
  cp: number | null
  // White-absolute mate distance; null when the line has no mate score (or mate 0).
  mate: number | null
  // Full principal variation in UCI notation (may be empty).
  pvUci: string[]
}

// Parses a UCI `info ... score ...` line. Scores arrive from the side to move's
// perspective; both cp and mate are flipped into White-absolute perspective. Any mate
// score (not just mate=0, the "already checkmated" edge case) converts to a signed
// ±10000 cp sentinel: rawMate > 0 means the side to move delivers mate (good, +10000
// for them); rawMate <= 0 means they get mated (bad, -10000). Applied uniformly so
// multipv 2/3 lines that lead to forced mate also get a usable cp instead of null.
export function parseInfoScore(line: string, isBlackToMove: boolean): InfoScore | null {
  if (!line.startsWith('info') || !line.includes(' score ')) return null

  const multipvMatch = line.match(/multipv (\d+)/)
  const multipvIdx = multipvMatch ? parseInt(multipvMatch[1], 10) : 1

  const cpMatch = line.match(/score cp (-?\d+)/)
  const mateMatch = line.match(/score mate (-?\d+)/)
  const rawCp = cpMatch ? parseInt(cpMatch[1], 10) : null
  const rawMate = mateMatch ? parseInt(mateMatch[1], 10) : null

  const cpFromMate = rawMate !== null
    ? (isBlackToMove ? -1 : 1) * (rawMate > 0 ? 10000 : -10000)
    : null
  const cp = rawCp !== null ? (isBlackToMove ? -rawCp : rawCp) : cpFromMate
  const mate = rawMate !== null && rawMate !== 0 ? (isBlackToMove ? -rawMate : rawMate) : null

  const pvMatch = line.match(/ pv (.+)$/)
  const pvUci = pvMatch ? pvMatch[1].trim().split(' ') : []

  return { multipvIdx, cp, mate, pvUci }
}

// Single-move UCI → SAN. Returns null for `(none)` (checkmate/stalemate bestmove),
// missing input, or moves that are illegal in the given position.
export function uciToSan(fen: string | null, uci: string | null | undefined): string | null {
  if (!uci || uci === '(none)' || !fen) return null
  try {
    const chess = new Chess(fen)
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? undefined })
    return m?.san ?? null
  } catch {
    return null
  }
}

// UCI PV → space-separated SAN line; stops at the first move that doesn't apply.
export function uciPvToSan(fen: string, uciMoves: string[]): string {
  const chess = new Chess(fen)
  const sans: string[] = []
  for (const uci of uciMoves) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      if (m) sans.push(m.san); else break
    } catch { break }
  }
  return sans.join(' ')
}
