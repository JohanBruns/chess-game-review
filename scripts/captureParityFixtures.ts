// Captures the engine evals of the chess.com parity reference games into JSON fixtures for
// src/lib/analysis/parity.test.ts:
//
//   npm run capture:parity
//
// Fetches each game's PGN from the official chess.com public API (monthly archive), keeps only
// what classification needs (SAN moves + Elo), and analyzes the game with the shipped Stockfish
// build exactly like the app's batch analysis: the same two passes (src/lib/engine/twoPass.ts)
// with the same candidate selection, on nodeEngine.ts. A game whose fixture already exists is
// re-analyzed from the moves stored in it, without a network request. Because each search
// starts from a cleared hash, re-running this reproduces the same fixtures — they only change
// when the engine, its options, the analysis depth or the candidate selection change.
// Re-capture after such a change, then review the parity test (chess.com verdicts + snapshot)
// before updating the snapshot.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { NodeEngine } from './nodeEngine.ts'
import { secondLineCandidates } from '../src/lib/analysis/candidates.ts'
import { analyzeTwoPass } from '../src/lib/engine/twoPass.ts'
import type { EvalResult, SearchJob } from '../src/lib/engine/uci.ts'

// The app's default ("Balanced") analysis depth.
const DEPTH = 15
const PARALLEL_ENGINES = 4
const OUT_DIR = new URL('../src/lib/analysis/__fixtures__/parity/', import.meta.url)

// Reference games with verdicts checked against a live chess.com Game Review (2026-07, and the
// Brilliant set 2026-11). The verdicts themselves are asserted in parity.test.ts; this list only
// says where to fetch.
const GAMES: { id: string; player: string; month: string }[] = [
  { id: '171190174548', player: 'jojo2go', month: '2026/07' },
  { id: '147779282758', player: 'jojo2go', month: '2026/01' },
  { id: '170984117356', player: 'jojo2go', month: '2026/07' },
  { id: '170666529854', player: 'jojo2go', month: '2026/06' },
  { id: '170988770322', player: 'jojo2go', month: '2026/07' },
  // chess.com Brilliant
  { id: '173412280300', player: 'jojo2go', month: '2026/08' },
  { id: '172856746274', player: 'jojo2go', month: '2026/08' },
  { id: '172187507640', player: 'jojo2go', month: '2026/07' },
  { id: '171688809516', player: 'jojo2go', month: '2026/07' },
  { id: '184149603540', player: 'jojo2go', month: '2026/09' },
  { id: '184266701180', player: 'jojo2go', month: '2026/09' },
  { id: '172657036964', player: 'jojo2go', month: '2026/08' },
  // no Brilliant on chess.com, but tempting sacrifice look-alikes
  { id: '171655051226', player: 'jojo2go', month: '2026/07' },
  { id: '171330597782', player: 'jojo2go', month: '2026/07' },
  { id: '184611401806', player: 'jojo2go', month: '2026/09' },
  { id: '183964542178', player: 'jojo2go', month: '2026/09' },
  { id: '173756714744', player: 'jojo2go', month: '2026/08' },
  { id: '172536947728', player: 'jojo2go', month: '2026/08' },
  { id: '173675004502', player: 'jojo2go', month: '2026/08' },
  { id: '174288505864', player: 'jojo2go', month: '2026/09' },
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

// The game as the fixture stores it — from the existing fixture file, else from chess.com.
async function loadGame(id: string, player: string, month: string): Promise<Omit<ParityFixture, 'evalResults'>> {
  const file = new URL(`${id}.json`, OUT_DIR)
  if (existsSync(file)) {
    const { url, whiteElo, blackElo, sans } = JSON.parse(readFileSync(file, 'utf8')) as ParityFixture
    return { id, url, depth: DEPTH, whiteElo, blackElo, sans }
  }
  const { pgn, url } = await fetchPgn(player, month, id)
  const chess = new Chess()
  chess.loadPgn(pgn)
  const headers = chess.header()
  return {
    id,
    url,
    depth: DEPTH,
    whiteElo: elo(headers.WhiteElo ?? undefined),
    blackElo: elo(headers.BlackElo ?? undefined),
    sans: chess.history(),
  }
}

mkdirSync(OUT_DIR, { recursive: true })
const engines = await Promise.all(Array.from({ length: PARALLEL_ENGINES }, () => NodeEngine.start()))

// Runs the jobs on the engine instances, sharing one cursor (results don't depend on the
// distribution — every search clears the hash first).
async function runBatch(jobs: SearchJob[]): Promise<EvalResult[]> {
  const results = new Array<EvalResult>(jobs.length)
  let cursor = 0
  await Promise.all(engines.map(async engine => {
    while (cursor < jobs.length) {
      const idx = cursor++
      results[idx] = await engine.analyze(jobs[idx], DEPTH)
    }
  }))
  return results
}

for (const { id, player, month } of GAMES) {
  const game = await loadGame(id, player, month)
  const chess = new Chess()
  for (const san of game.sans) chess.move(san)
  const moves = chess.history({ verbose: true })
  const fens = [moves[0].before, ...moves.map(m => m.after)]
  const started = Date.now()
  const outcome = await analyzeTwoPass({
    fens,
    known: new Array<EvalResult | null>(fens.length).fill(null),
    selectCandidates: firstPass =>
      secondLineCandidates(moves, firstPass, game.whiteElo ?? undefined, game.blackElo ?? undefined),
    runBatch,
  })
  const fixture: ParityFixture = { ...game, evalResults: outcome!.results as EvalResult[] }
  writeFileSync(new URL(`${id}.json`, OUT_DIR), `${JSON.stringify(fixture, null, 1)}\n`)
  const secondLines = fixture.evalResults.filter(r => r.secondBestMoveSan != null).length
  console.log(`${id}: ${fens.length} positions (${secondLines} with a second line) in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}
for (const engine of engines) engine.quit()
