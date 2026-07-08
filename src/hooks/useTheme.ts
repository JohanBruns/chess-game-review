import { useCallback, useEffect, useState } from 'react'
import {
  boardThemeById,
  pieceThemeById,
  DEFAULT_BOARD_ID,
  DEFAULT_PIECE_ID,
  type BoardTheme,
  type PieceTheme,
} from '../lib/themes'

const BOARD_KEY = 'theme.board'
const PIECE_KEY = 'theme.pieces'

// Read a persisted theme id, validating it still resolves to a known theme (a removed/renamed
// theme falls back to the default rather than pointing at a missing asset).
function readId(storageKey: string, fallback: string, resolve: (id: string) => { id: string }): string {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored && resolve(stored).id === stored) return stored
  } catch {
    // localStorage unavailable (private mode / SSR) — fall through to default.
  }
  return fallback
}

export interface UseThemeResult {
  boardTheme: BoardTheme
  pieceTheme: PieceTheme
  setBoardId: (id: string) => void
  setPieceId: (id: string) => void
}

export function useTheme(): UseThemeResult {
  const [boardId, setBoardId] = useState(() => readId(BOARD_KEY, DEFAULT_BOARD_ID, boardThemeById))
  const [pieceId, setPieceId] = useState(() => readId(PIECE_KEY, DEFAULT_PIECE_ID, pieceThemeById))

  useEffect(() => {
    try { localStorage.setItem(BOARD_KEY, boardId) } catch { /* ignore */ }
  }, [boardId])
  useEffect(() => {
    try { localStorage.setItem(PIECE_KEY, pieceId) } catch { /* ignore */ }
  }, [pieceId])

  return {
    boardTheme: boardThemeById(boardId),
    pieceTheme: pieceThemeById(pieceId),
    setBoardId: useCallback((id: string) => setBoardId(id), []),
    setPieceId: useCallback((id: string) => setPieceId(id), []),
  }
}
