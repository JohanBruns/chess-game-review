import type { EvalResult } from './uci'

// Per-position IndexedDB cache of batch-analysis results. Sound only because every batch
// search starts from a cleared hash (uci.ts analysisCommands): a position's result depends on
// nothing but (engine build + options, fen, depth), so a cached entry equals what a fresh
// search would return. Re-opening a game, or a shared ?pgn= link, then skips the engine
// entirely, and positions shared between games (openings) are only searched once.
// An entry carries the second-best line only if some game needed it there (twoPass.ts); a
// game that needs it later runs just that search and the entry is stored again, extended.
//
// Best effort throughout: any IndexedDB failure (unsupported, blocked storage, quota) makes
// loads miss and stores no-op — the analysis itself never fails because of the cache.

const DB_NAME = 'chess-review-analysis'
const STORE = 'evals'
// Identity of the search configuration. Bump whenever the engine build, ANALYSIS_OPTION_COMMANDS,
// analysisCommands or the EvalResult shape changes — old entries then simply stop matching.
const CACHE_VERSION = 'sf18-lite-single|2pass|hash8|newgame|v2'
// ~300 bytes per entry → the cap keeps the cache around 15MB. Oldest entries go first.
const MAX_ENTRIES = 50_000
const PRUNE_TO = 45_000

interface CacheEntry {
  key: string
  result: EvalResult
  ts: number
}

export function cacheKey(fen: string, depth: number): string {
  return `${CACHE_VERSION}|d${depth}|${fen}`
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
          const store = req.result.createObjectStore(STORE, { keyPath: 'key' })
          store.createIndex('ts', 'ts')
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
        req.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return dbPromise
}

// One cached result (or null) per fen. Never rejects.
export async function loadCached(fens: string[], depth: number): Promise<(EvalResult | null)[]> {
  const misses = (): (EvalResult | null)[] => new Array(fens.length).fill(null)
  const db = await openDb()
  if (!db) return misses()
  return new Promise(resolve => {
    try {
      const results = misses()
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      fens.forEach((fen, i) => {
        const req = store.get(cacheKey(fen, depth))
        req.onsuccess = () => { results[i] = (req.result as CacheEntry | undefined)?.result ?? null }
      })
      tx.oncomplete = () => resolve(results)
      tx.onerror = () => resolve(misses())
      tx.onabort = () => resolve(misses())
    } catch {
      resolve(misses())
    }
  })
}

// Stores every non-null result, then prunes the oldest entries past MAX_ENTRIES. Fire and forget.
export async function storeCached(fens: string[], depth: number, results: (EvalResult | null)[]): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const ts = Date.now()
    fens.forEach((fen, i) => {
      const result = results[i]
      if (result) store.put({ key: cacheKey(fen, depth), result, ts } satisfies CacheEntry)
    })
    const countReq = store.count()
    countReq.onsuccess = () => {
      let excess = countReq.result - PRUNE_TO
      if (countReq.result <= MAX_ENTRIES || excess <= 0) return
      const cursorReq = store.index('ts').openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor || excess <= 0) return
        cursor.delete()
        excess--
        cursor.continue()
      }
    }
  } catch {
    // cache write failed — the next analysis of these positions just searches again
  }
}
