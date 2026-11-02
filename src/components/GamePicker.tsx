import { useState, useRef, useEffect, useCallback } from 'react'
import { PgnInput } from './PgnInput'
import { readStorage, writeStorage, USERNAME_KEY } from '../lib/storage'

interface ChessComPlayer {
  username: string
  result: string
  rating: number
}

interface ChessComGame {
  url: string
  pgn: string
  time_class: string
  white: ChessComPlayer
  black: ChessComPlayer
  end_time: number
}

interface GamePickerProps {
  // side is the color `username` played in the selected game, when known (chess.com game
  // selection) — lets the caller orient the board with the reviewed player at the bottom.
  onLoad: (pgn: string, side?: 'white' | 'black') => void
  error: string | null
  // A chess.com game link is being resolved to a PGN (see App's handleLoadInput).
  loading?: boolean
  initialUsername?: string | null
  autoFetch?: boolean
}

const TIME_ICON: Record<string, string> = {
  bullet: '⚡',
  blitz: '⏱',
  rapid: '🐢',
  daily: '📅',
}

function getResult(game: ChessComGame, username: string): 'W' | 'L' | 'D' {
  const isWhite = game.white.username.toLowerCase() === username.toLowerCase()
  const myResult   = isWhite ? game.white.result : game.black.result
  const oppResult  = isWhite ? game.black.result : game.white.result
  if (myResult  === 'win') return 'W'
  if (oppResult === 'win') return 'L'
  return 'D'
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

async function fetchRecentGames(username: string): Promise<ChessComGame[]> {
  const now = new Date()
  const months = [
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    now.getMonth() === 0
      ? { year: now.getFullYear() - 1, month: 12 }
      : { year: now.getFullYear(), month: now.getMonth() },
  ]
  const results = await Promise.allSettled(
    months.map(({ year, month }) =>
      fetch(
        `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${year}/${String(month).padStart(2, '0')}`,
      )
        .then(r => (r.ok ? r.json() : { games: [] }))
        .then(j => (j.games ?? []) as ChessComGame[]),
    ),
  )
  return results
    .filter((r): r is PromiseFulfilledResult<ChessComGame[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .filter(g => typeof g.pgn === 'string' && g.pgn.length > 10)
    .sort((a, b) => b.end_time - a.end_time)
    .slice(0, 20)
}

export function GamePicker({ onLoad, error, loading, initialUsername, autoFetch }: GamePickerProps) {
  const [username, setUsername] = useState<string>(
    () => readStorage(USERNAME_KEY) ?? '',
  )
  const [isLoading, setIsLoading] = useState(false)
  const [games, setGames] = useState<ChessComGame[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleUsernameChange = (val: string) => {
    setUsername(val)
    writeStorage(USERNAME_KEY, val)
  }

  const handleFetch = useCallback(async () => {
    if (!username.trim()) return
    setIsLoading(true)
    setFetchError(null)
    setShowDropdown(false)
    try {
      const result = await fetchRecentGames(username.trim())
      if (result.length === 0) {
        setFetchError('No games found.')
      } else {
        setGames(result)
        setShowDropdown(true)
      }
    } catch {
      setFetchError('Failed to load games.')
    } finally {
      setIsLoading(false)
    }
  }, [username])

  // initialUsername arrives one render after mount (via the app's own URL-param effect),
  // so a lazy useState initializer alone won't catch it. Guard on a ref so it's only applied once.
  const appliedInitialUsernameRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (initialUsername && appliedInitialUsernameRef.current !== initialUsername) {
      appliedInitialUsernameRef.current = initialUsername
      setUsername(initialUsername)
      writeStorage(USERNAME_KEY, initialUsername)
    }
  }, [initialUsername])

  const autoFetchedRef = useRef(false)
  useEffect(() => {
    if (autoFetch && !autoFetchedRef.current && username.trim()) {
      autoFetchedRef.current = true
      handleFetch()
    }
  }, [autoFetch, username, handleFetch])

  const handleSelectGame = (game: ChessComGame) => {
    const isWhite = game.white.username.toLowerCase() === username.toLowerCase()
    onLoad(game.pgn, isWhite ? 'white' : 'black')
    setShowDropdown(false)
  }

  const displayError = fetchError ?? error

  // Lives at the top of the sidebar's setup chapter (chess.com has no top bar — the page is just
  // board + sidebar), so the controls stack vertically in the sidebar's width.
  return (
    <div ref={containerRef} className="relative shrink-0 flex flex-col gap-2 p-4 pb-3">
      <input
        type="text"
        className="h-10 w-full bg-black/20 text-white text-sm px-3 rounded-[5px] border border-white/10 placeholder:text-white/40 focus:outline-none focus:border-cc-green"
        placeholder="chess.com username"
        value={username}
        onChange={e => handleUsernameChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
        spellCheck={false}
      />
      <div className="flex gap-2">
        <button
          className="cc-btn-secondary flex-1 h-10 rounded-[5px] text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
          disabled={!username.trim() || isLoading}
          onClick={handleFetch}
        >
          {isLoading ? 'Loading…' : 'Recent Games ▾'}
        </button>
        <button
          className={`cc-btn-secondary h-10 px-4 rounded-[5px] text-sm font-semibold whitespace-nowrap ${
            showManual ? 'text-white' : ''
          }`}
          aria-pressed={showManual}
          onClick={() => setShowManual(v => !v)}
        >
          PGN
        </button>
      </div>
      {loading ? (
        <span className="text-white/72 text-xs">Loading game from chess.com…</span>
      ) : displayError && (
        <span className="text-cc-red text-xs">{displayError}</span>
      )}

      {/* ── Game dropdown ── */}
      {showDropdown && games.length > 0 && (
        <div className="absolute top-[108px] left-4 right-4 z-50 bg-[#262421] rounded-[5px] border border-white/10 shadow-xl max-h-80 overflow-y-auto">
          {games.map(game => {
            const isWhite = game.white.username.toLowerCase() === username.toLowerCase()
            const opponent = isWhite ? game.black : game.white
            const result = getResult(game, username)
            const resultCls =
              result === 'W' ? 'bg-cc-green text-white' :
              result === 'L' ? 'bg-cc-red text-white'    :
                               'bg-cc-surface-hover text-white'
            return (
              <button
                key={game.url}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/7 transition-colors text-xs border-b border-white/5 last:border-0"
                onClick={() => handleSelectGame(game)}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-cc-text-faint"
                  style={{ backgroundColor: isWhite ? '#e9e9e8' : '#1a1a1a' }}
                />
                <span className="flex-1 text-cc-text truncate min-w-0">
                  vs.{' '}
                  <span className="font-medium">{opponent.username}</span>
                  <span className="text-cc-text-faint ml-1">({opponent.rating})</span>
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${resultCls}`}>
                  {result}
                </span>
                <span className="text-cc-text-dim shrink-0" title={game.time_class}>
                  {TIME_ICON[game.time_class] ?? game.time_class}
                </span>
                <span className="text-cc-text-faint shrink-0 w-16 text-right">
                  {formatDate(game.end_time)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Manual PGN fallback ── */}
      {showManual && <PgnInput onLoad={onLoad} error={null} />}
    </div>
  )
}
