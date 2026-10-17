// Node-side UCI driver for the exact Stockfish build the app ships (public/engine/
// stockfish-18-lite-single.*), configured and queried like the browser's batch-analysis pool
// (src/lib/engine/enginePool.ts) through the same shared helpers in uci.ts. Results therefore
// match a browser analysis of the same positions — used by captureParityFixtures.ts.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import {
  accumulateInfo, analysisCommands, batchMovetimeMs, finishSearch, newSearch, ANALYSIS_OPTION_COMMANDS,
  type EvalResult,
} from '../src/lib/engine/uci.ts'

// The shipped copy in public/engine can't be run directly: this package is "type": "module"
// and the engine script is CommonJS. The npm package's copy (outside this package's scope)
// runs fine — and is asserted byte-identical to the shipped build, so results stay comparable.
const ENGINE_FILE = 'stockfish-18-lite-single'
const ENGINE_PATH = fileURLToPath(new URL(`../node_modules/stockfish/bin/${ENGINE_FILE}.js`, import.meta.url))

function assertSameBuild(): void {
  for (const ext of ['js', 'wasm']) {
    const shipped = readFileSync(new URL(`../public/engine/${ENGINE_FILE}.${ext}`, import.meta.url))
    const npm = readFileSync(new URL(`../node_modules/stockfish/bin/${ENGINE_FILE}.${ext}`, import.meta.url))
    if (!shipped.equals(npm)) {
      throw new Error(`public/engine/${ENGINE_FILE}.${ext} differs from the npm stockfish package's copy`)
    }
  }
}

export class NodeEngine {
  private readonly proc: ChildProcessWithoutNullStreams
  private listener: ((line: string) => void) | null = null

  private constructor() {
    this.proc = spawn(process.execPath, [ENGINE_PATH])
    createInterface({ input: this.proc.stdout }).on('line', line => this.listener?.(line.trim()))
  }

  static async start(): Promise<NodeEngine> {
    assertSameBuild()
    const engine = new NodeEngine()
    engine.send('uci')
    await engine.until(line => line === 'uciok')
    for (const cmd of ANALYSIS_OPTION_COMMANDS) engine.send(cmd)
    engine.send('isready')
    await engine.until(line => line === 'readyok')
    return engine
  }

  send(cmd: string): void {
    this.proc.stdin.write(`${cmd}\n`)
  }

  // Resolves with the first line matching `done`; every line before it goes to `onLine`.
  private until(done: (line: string) => boolean, onLine?: (line: string) => void): Promise<string> {
    return new Promise(resolve => {
      this.listener = line => {
        if (done(line)) {
          this.listener = null
          resolve(line)
        } else {
          onLine?.(line)
        }
      }
    })
  }

  // One batch-analysis search. `clearHash: false` skips the leading `ucinewgame` — only for
  // demonstrating why the app clears it (carried-over hash makes results order-dependent).
  async analyze(fen: string, depth: number, { clearHash = true } = {}): Promise<EvalResult> {
    const acc = newSearch(fen)
    const commands = analysisCommands(fen, depth, batchMovetimeMs(depth))
    for (const cmd of clearHash ? commands : commands.filter(c => c !== 'ucinewgame')) this.send(cmd)
    const bestmove = await this.until(line => line.startsWith('bestmove'), line => {
      if (line.startsWith('info')) accumulateInfo(acc, line)
    })
    return finishSearch(acc, bestmove)
  }

  quit(): void {
    this.send('quit')
    this.proc.stdin.end()
  }
}
