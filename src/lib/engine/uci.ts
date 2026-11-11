import { Chess } from 'chess.js'


// Pure UCI-parsing helpers shared by the primary engine worker (useEngine.ts), the
// batch-analysis pool (enginePool.ts) and the Node-side fixture capture script
// (scripts/captureParityFixtures.ts). Extracted 1:1 from the live-verified logic that
// used to live inline in useEngine's worker.onmessage closure. Kept free of relative
// imports so Node can load it directly.

// One engine verdict for a position. cp/mate are White-absolute (see parseInfoScore). The
// batch analysis fills the 2nd line only where the classification needs it (twoPass.ts); the
// rest, and every 3rd line, come from the on-demand search behind the engine-lines panel.
// Re-exported by useEngine for the app's imports.
export interface EvalResult {
  cp: number | null
  mate: number | null
  bestMoveSan: string | null
  pv: string | null
  secondBestCp: number | null
  secondBestMoveSan: string | null
  thirdBestCp: number | null
  thirdBestMoveSan: string | null
}

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

// Accumulates the info lines of one search until its bestmove arrives. Only the last line
// per MultiPV index counts (the deepest completed iteration); the PV is capped at 10 plies.
export interface SearchAccumulator {
  fen: string
  cp: number | null
  mate: number | null
  pv: string[]
  secondCp: number | null
  secondUci: string | null
  thirdCp: number | null
  thirdUci: string | null
}

export function newSearch(fen: string): SearchAccumulator {
  return { fen, cp: null, mate: null, pv: [], secondCp: null, secondUci: null, thirdCp: null, thirdUci: null }
}

export function accumulateInfo(s: SearchAccumulator, line: string): void {
  const info = parseInfoScore(line, s.fen.split(' ')[1] === 'b')
  if (!info) return
  if (info.multipvIdx === 1) {
    s.cp = info.cp
    s.mate = info.mate
    if (info.pvUci.length > 0) s.pv = info.pvUci.slice(0, 10)
  } else if (info.multipvIdx === 2 && info.cp !== null) {
    s.secondCp = info.cp
    if (info.pvUci.length > 0) s.secondUci = info.pvUci[0]
  } else if (info.multipvIdx === 3 && info.cp !== null) {
    s.thirdCp = info.cp
    if (info.pvUci.length > 0) s.thirdUci = info.pvUci[0]
  }
}

export function finishSearch(s: SearchAccumulator, bestmoveLine: string): EvalResult {
  const uciMove = bestmoveLine.split(' ')[1]
  return {
    cp: s.cp,
    mate: s.mate,
    bestMoveSan: uciToSan(s.fen, uciMove),
    pv: s.pv.length > 0 ? uciPvToSan(s.fen, s.pv) : null,
    secondBestCp: s.secondCp,
    secondBestMoveSan: uciToSan(s.fen, s.secondUci),
    thirdBestCp: s.thirdCp,
    thirdBestMoveSan: uciToSan(s.fen, s.thirdUci),
  }
}

// One batch-analysis search: the position, and optionally the only root moves to consider
// (UCI) — the second-line search passes every legal move except the best one.
export interface SearchJob {
  fen: string
  searchMoves?: string[]
}

// Batch-analysis engine configuration, shared by enginePool.ts and the Node fixture capture
// so both search identically. A single PV: MultiPV 3 cost about three times the nodes at the
// same depth (measured 2026-11, depth 15 and 18), and the lines it added are only read for a
// minority of positions — see twoPass.ts. A small hash: it is cleared before every search
// (about 10 ms at 32 MB, 6 ms at 8 MB, more with several instances running), and at depth
// 12-18 a search fills only a fraction of it — 4 to 32 MB searched the same node counts.
// The hash size is part of the result's identity — a different size can change a
// depth-limited search.
export const ANALYSIS_OPTION_COMMANDS = ['setoption name MultiPV value 1', 'setoption name Hash value 8']

// Per-position time caps, passed alongside the depth limit (`go depth D movetime T` stops
// at whichever limit is hit first). Depth terminates virtually every search long before
// these caps; they only rein in pathological outlier positions. Keyed by the settings
// depth (12/15/18 = the Fast/Balanced/Deep presets).
const BATCH_MOVETIME_MS: Record<number, number> = { 12: 7000, 15: 10000, 18: 20000 }

export function batchMovetimeMs(depth: number): number {
  return BATCH_MOVETIME_MS[depth] ?? 10000
}

// The command sequence for one batch-analysis search. `ucinewgame` first resets the hash and
// search history, so a position's result depends only on (fen, depth) — not on which worker
// got it or what that worker searched before. Without it, re-analyzing the same game gave
// different evals (and thus classifications/accuracy) from run to run, and cached results
// would not match a fresh analysis. `go depth D movetime T` stops at whichever comes first;
// the movetime cap only reins in pathological outliers (it is the one remaining source of
// timing-dependent results).
export function analysisCommands(fen: string, depth: number, movetime: number, searchMoves?: string[]): string[] {
  const only = searchMoves && searchMoves.length > 0 ? ` searchmoves ${searchMoves.join(' ')}` : ''
  return ['ucinewgame', `position fen ${fen}`, `go depth ${depth} movetime ${movetime}${only}`]
}

// Every legal move except `bestSan`, in UCI — the root moves of a second-line search. Empty
// when there is no alternative (or no best move to exclude).
export function alternativeMoves(fen: string, bestSan: string | null): string[] {
  if (!bestSan) return []
  try {
    return new Chess(fen).moves({ verbose: true }).filter(m => m.san !== bestSan).map(m => m.lan)
  } catch {
    return []
  }
}

// The eval of a line other than the best one, not rated above the best line (from the side to
// move's view; cp values are White-absolute). The other lines come from a search of their own,
// and two depth-limited searches can disagree by a few centipawns about near-equal moves
// (measured 2026-11: in 1 of 7 second-line searches, almost always by less than 2 win%). Such
// a line counts as "as good as the best move"; the best move stays the first search's, the way
// a single search would have named one of the two. A forced mate is no such noise and is kept
// as found, even if the first search missed it — the classification tells mates from large
// evals (classify.ts BRILLIANT_WINNING_ANYWAY_CP).
const MATE_CP = 10000

export function cappedAtBest(fen: string, bestCp: number | null, cp: number): number {
  if (bestCp === null || Math.abs(cp) >= MATE_CP) return cp
  return fen.split(' ')[1] === 'b' ? Math.max(cp, bestCp) : Math.min(cp, bestCp)
}

// Adds the outcome of a second-line search (run on alternativeMoves, so its best line is the
// position's second-best) to the first-pass result. A failed second search leaves it unchanged.
export function withSecondLine(fen: string, first: EvalResult, second: EvalResult | null): EvalResult {
  if (!second || second.cp === null || second.bestMoveSan === null) return first
  return {
    ...first,
    secondBestCp: cappedAtBest(fen, first.cp, second.cp),
    secondBestMoveSan: second.bestMoveSan,
  }
}
