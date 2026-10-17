// Captures the engine evals of the chess.com parity reference games into JSON fixtures for
// src/lib/analysis/parity.test.ts:
//
//   npm run capture:parity
//
// Fetches each game's PGN from the official chess.com public API (monthly archive), keeps only
// what classification needs (SAN moves + Elo), and analyzes every position with the shipped
// Stockfish build exactly like the app's batch analysis (nodeEngine.ts). Because each search
// starts from a cleared hash, re-running this reproduces the same fixtures — they only change
// when the engine, its options or the analysis depth change. Re-capture after such a change,
// then review the parity test (chess.com verdicts + snapshot) before updating the snapshot.

import { mkdirSync, writeFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { NodeEngine } from './nodeEngine.ts'
import type { EvalResult } from '../src/lib/engine/uci.ts'

// The app's default ("Balanced") analysis depth.
const DEPTH = 15
const PARALLEL_ENGINES = 4
const OUT_DIR = new URL('../src/lib/analysis/__fixtures__/parity/', import.meta.url)

// Reference games with verdicts checked against a live chess.com Game Review (2026-07). The
// verdicts themselves are asserted in parity.test.ts; this list only says where to fetch.
const GAMES: { id: string; player: string; month: string }[] = [
  { id: '171190174548', player: 'jojo2go', month: '2026/07' },
  { id: '147779282758', player: 'jojo2go', month: '2026/01' },
  { id: '170984117356', player: 'jojo2go', month: '2026/07' },
  { id: '170666529854', player: 'jojo2go', month: '2026/06' },
  { id: '170988770322', player: 'jojo2go', month: '2026/07' },
]

export interface ParityFixture {
  id: string
  url: string
  depth: number
  whiteElo: number | null
  blackElo: number | null
  sans: string[]
  evalResults: EvalResult[]
}

async function fetchPgn(player: string, month: string, id: string): Promise<{ pgn: string; url: string }> {
  const res = await fetch(`https://api.chess.com/pub/player/${player}/games/${month}`, {
    headers: { 'User-Agent': 'chess-game-review parity fixture capture' },
  })
  if (!res.ok) throw new Error(`chess.com archive ${player} ${month}: HTTP ${res.status}`)
  const { games } = (await res.json()) as { games: { url: string; pgn?: string }[] }
  const game = games.find(g => g.url.endsWith(`/${id}`))
  if (!game?.pgn) throw new Error(`game ${id} not found in ${player}'s ${month} archive`)
  return { pgn: game.pgn, url: game.url }
}

function elo(v: string | undefined): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

// Analyzes all positions on a few engine instances sharing one cursor (results don't depend
// on the distribution — every search clears the hash first).
async function analyzeAll(fens: string[]): Promise<EvalResult[]> {
  const results = new Array<EvalResult>(fens.length)
  let cursor = 0
  await Promise.all(Array.from({ length: PARALLEL_ENGINES }, async () => {
    const engine = await NodeEngine.start()
    while (cursor < fens.length) {
      const idx = cursor++
      results[idx] = await engine.analyze(fens[idx], DEPTH)
    }
    engine.quit()
  }))
  return results
}

mkdirSync(OUT_DIR, { recursive: true })
for (const { id, player, month } of GAMES) {
  const { pgn, url } = await fetchPgn(player, month, id)
  const chess = new Chess()
  chess.loadPgn(pgn)
  const moves = chess.history({ verbose: true })
  const fens = [moves[0].before, ...moves.map(m => m.after)]
  const headers = chess.header()
  const started = Date.now()
  const fixture: ParityFixture = {
    id,
    url,
    depth: DEPTH,
    whiteElo: elo(headers.WhiteElo ?? undefined),
    blackElo: elo(headers.BlackElo ?? undefined),
    sans: moves.map(m => m.san),
    evalResults: await analyzeAll(fens),
  }
  writeFileSync(new URL(`${id}.json`, OUT_DIR), `${JSON.stringify(fixture, null, 1)}\n`)
  console.log(`${id}: ${fens.length} positions in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}
