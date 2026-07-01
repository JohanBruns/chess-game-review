import { useState, useRef, useEffect, useCallback } from 'react'
import { PgnInput } from './PgnInput'

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
  onLoad: (pgn: string) => void
  error: string | null
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

export function GamePicker({ onLoad, error }: GamePickerProps) {
  const [username, setUsername] = useState<string>(
    () => localStorage.getItem('chess-username') ?? '',
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
    localStorage.setItem('chess-username', val)
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

  const handleSelectGame = (pgn: string) => {
    onLoad(pgn)
    setShowDropdown(false)
  }

  const displayError = fetchError ?? error

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* ── Top bar ── */}
      <div className="flex gap-2 items-center px-3 py-2 border-b border-cc-border bg-cc-panel/40">
        <span className="text-cc-text-dim text-xs shrink-0">User:</span>
        <input
          type="text"
          className="w-36 bg-cc-panel text-cc-text text-xs px-2 py-1.5 rounded border border-cc-border focus:outline-none focus:border-cc-green"
          placeholder="chess.com username"
          value={username}
          onChange={e => handleUsernameChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
          spellCheck={false}
        />
        <button
          className="flex items-center gap-1 px-3 py-1.5 bg-cc-green hover:bg-cc-green-hover text-white rounded font-medium text-xs disabled:opacity-40 whitespace-nowrap transition-colors"
          disabled={!username.trim() || isLoading}
          onClick={handleFetch}
        >
          {isLoading ? '…' : 'Recent Games ▾'}
        </button>
        <button
          className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
            showManual
              ? 'bg-cc-surface-hover text-white'
              : 'bg-cc-surface text-cc-text-dim hover:bg-cc-surface-hover'
          }`}
          onClick={() => setShowManual(v => !v)}
        >
          ✎ Manual
        </button>
        {displayError && (
          <span className="text-cc-red text-[11px] truncate ml-1">{displayError}</span>
        )}
      </div>

      {/* ── Game dropdown ── */}
      {showDropdown && games.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-cc-panel border-x border-b border-cc-border shadow-xl max-h-72 overflow-y-auto">
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
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-cc-surface transition-colors text-xs border-b border-cc-border/50 last:border-0"
                onClick={() => handleSelectGame(game.pgn)}
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
