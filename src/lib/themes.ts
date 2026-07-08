// Board and piece themes, bundled locally under public/ (see public/themes/*, copied from
// github.com/JohanBruns/chess.com-boards-and-pieces). Board theme and piece theme are two
// independent axes, exactly like chess.com's appearance settings.

export interface BoardTheme {
  id: string
  label: string
  /** Background image URL for the board (public path). */
  url: string
}

export interface PieceTheme {
  id: string
  label: string
  /** Directory (public path) holding the 12 piece PNGs, e.g. `${basePath}/wp.png`. */
  basePath: string
}

// The 12 react-chessboard piece keys. Files on disk are lowercase (wP -> wp.png).
export const PIECE_KEYS = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'] as const
export type PieceKey = (typeof PIECE_KEYS)[number]

// Turn a folder id into a display label: '3d_wood' -> '3D Wood', '8_bit' -> '8 Bit',
// 'icy_sea' -> 'Icy Sea'.
export function prettify(id: string): string {
  return id
    .split('_')
    .map((part) => {
      const dim = part.match(/^(\d+)d$/i)
      if (dim) return `${dim[1]}D`
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

// Map each react-chessboard piece key to its PNG url under `basePath`.
export function pieceImageMap(basePath: string): Record<PieceKey, string> {
  const out = {} as Record<PieceKey, string>
  for (const key of PIECE_KEYS) {
    out[key] = `${basePath}/${key.toLowerCase()}.png`
  }
  return out
}

// The look shipped before the theme picker existed — kept as the default so existing users see
// no change. Assets live at public/pieces/* (brett.png + flat wp.png…).
export const DEFAULT_BOARD_ID = 'default'
export const DEFAULT_PIECE_ID = 'default'

// Folder names present under public/themes/boards/*.png.
const BOARD_IDS = [
  '8_bit', 'bases', 'blue', 'brown', 'bubblegum', 'burled_wood', 'dark_wood', 'dash', 'glass',
  'graffiti', 'green', 'icy_sea', 'light', 'lolz', 'marble', 'metal', 'neon', 'newspaper', 'orange',
  'overlay', 'parchment', 'purple', 'red', 'sand', 'sky', 'stone', 'tan', 'tournament', 'translucent',
  'walnut',
]

// Folder names present under public/themes/pieces/<id>/.
const PIECE_IDS = [
  '3d_chesskid', '3d_plastic', '3d_staunton', '3d_wood', '8_bit', 'alpha', 'bases', 'blindfold',
  'book', 'bubblegum', 'cases', 'classic', 'club', 'condal', 'dash', 'game_room', 'glass', 'gothic',
  'graffiti', 'icy_sea', 'light', 'lolz', 'marble', 'maya', 'metal', 'modern', 'nature', 'neo',
  'neo_wood', 'neon', 'newspaper', 'ocean', 'sky', 'space', 'tigers', 'tournament', 'vintage', 'wood',
]

export const BOARD_THEMES: BoardTheme[] = [
  { id: DEFAULT_BOARD_ID, label: 'Standard', url: '/pieces/brett.png' },
  ...BOARD_IDS.map((id) => ({ id, label: prettify(id), url: `/themes/boards/${id}.png` })),
]

export const PIECE_THEMES: PieceTheme[] = [
  { id: DEFAULT_PIECE_ID, label: 'Standard', basePath: '/pieces' },
  ...PIECE_IDS.map((id) => ({ id, label: prettify(id), basePath: `/themes/pieces/${id}` })),
]

export function boardThemeById(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0]
}

export function pieceThemeById(id: string): PieceTheme {
  return PIECE_THEMES.find((t) => t.id === id) ?? PIECE_THEMES[0]
}
