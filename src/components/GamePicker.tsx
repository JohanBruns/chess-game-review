import { useState, useRef, useEffect, useCallback } from 'react'
import { PgnInput } from './PgnInput'
import { readStorage, writeStorage, USERNAME_KEY } from '../lib/storage'
import { containsGame, fetchRecentGames, type ChessComGame } from '../lib/chesscom'

interface GamePickerProps {
  // side is the color `username` played in the selected game, when known (chess.com game
  // selection) — lets the caller orient the board with the reviewed player at the bottom.
  onLoad: (pgn: string, side?: 'white' | 'black') => void
  error: string | null
  // A chess.com game link is being resolved to a PGN (see App's handleLoadInput).
  loading?: boolean
  initialUsername?: string | null
  autoFetch?: boolean
  // The main action, drawn above the loading controls. Gets the "newest game" load, whose result
  // says whether a game was loaded.
  renderPrimary: (lastGame: { load: () => Promise<boolean>; available: boolean }) => React.ReactNode
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

function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// navigator.clipboard is undefined outside secure contexts (e.g. the dev server over the LAN).
const canReadClipboard = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

export function GamePicker({ onLoad, error, loading, initialUsername, autoFetch, renderPrimary }: GamePickerProps) {
  const [username, setUsername] = useState<string>(
    () => readStorage(USERNAME_KEY) ?? '',
  )
  const [isLoading, setIsLoading] = useState(false)
  const [games, setGames] = useState<ChessComGame[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lastGameNote, setLastGameNote] = useState<string | null>(null)

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
    setLastGameNote(null)
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

  // Every load goes through here so an error from an earlier attempt can't sit above a game that
  // loaded fine.
  const load = (pgn: string, side?: 'white' | 'black') => {
    setFetchError(null)
    setLastGameNote(null)
    setShowDropdown(false)
    onLoad(pgn, side)
  }

  const handleSelectGame = (game: ChessComGame) => {
    const isWhite = game.white.username.toLowerCase() === username.trim().toLowerCase()
    load(game.pgn, isWhite ? 'white' : 'black')
  }

  const handleLastGame = async () => {
    setIsLoading(true)
    setFetchError(null)
    setLastGameNote(null)
    setShowDropdown(false)
    try {
      const [latest] = await fetchRecentGames(username.trim())
      if (!latest) {
        setFetchError('No games found.')
        return false
      }
      handleSelectGame(latest)
      // The archive can lag behind a game that just ended, so this may be the one before it —
      // name the game rather than let that pass unnoticed.
      const isWhite = latest.white.username.toLowerCase() === username.trim().toLowerCase()
      const opponent = isWhite ? latest.black : latest.white
      setLastGameNote(
        `Loaded vs. ${opponent.username}, ${formatDateTime(latest.end_time)}. Just finished a game? chess.com can take a few minutes to list it.`,
      )
      return true
    } catch {
      setFetchError('Failed to load games.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaste = async () => {
    setFetchError(null)
    setLastGameNote(null)
    setShowDropdown(false)
    let text: string
    try {
      // iOS only allows this directly inside the tap, and shows its own "Paste" confirmation.
      text = await navigator.clipboard.readText()
    } catch {
      setFetchError('Could not read the clipboard.')
      return
    }
    if (containsGame(text)) load(text)
    else setFetchError('No chess.com game link in the clipboard.')
  }

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

  const displayError = fetchError ?? error
  const busy = isLoading || !!loading

  // Lives at the top of the sidebar's setup chapter (chess.com has no top bar — the page is just
  // board + sidebar), so the controls stack vertically in the sidebar's width. The username comes
  // last: it's typed once and then saved.
  return (
    <div ref={containerRef} className="relative shrink-0 flex flex-col gap-2 p-4 pb-3">
      {renderPrimary({ load: handleLastGame, available: !!username.trim() && !busy })}
      <div className="relative">
        <div className="flex gap-2">
          {canReadClipboard && (
            <button
              className="cc-btn-secondary flex-1 h-10 rounded-[5px] text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
              disabled={busy}
              onClick={handlePaste}
            >
              Paste link
            </button>
          )}
          <button
            className="cc-btn-secondary flex-1 h-10 rounded-[5px] text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
            disabled={!username.trim() || busy}
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

        {/* ── Game dropdown ── */}
        {showDropdown && games.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#262421] rounded-[5px] border border-white/10 shadow-xl max-h-80 overflow-y-auto">
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
      </div>
      <input
        type="text"
        className="h-10 w-full bg-black/20 text-white text-base md:text-sm px-3 rounded-[5px] border border-white/10 placeholder:text-white/40 focus:outline-none focus:border-cc-green"
        placeholder="chess.com username"
        aria-label="chess.com username"
        value={username}
        onChange={e => handleUsernameChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
        spellCheck={false}
      />
      {loading ? (
        <span className="text-white/72 text-xs">Loading game from chess.com…</span>
      ) : displayError ? (
        <span className="text-cc-red text-xs">{displayError}</span>
      ) : lastGameNote && (
        <span className="text-white/72 text-xs">{lastGameNote}</span>
      )}

      {/* ── Manual PGN fallback ── */}
      {showManual && <PgnInput onLoad={load} error={null} />}
    </div>
  )
}
