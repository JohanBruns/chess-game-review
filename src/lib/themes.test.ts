import { describe, it, expect } from 'vitest'
import {
  prettify,
  pieceImageMap,
  PIECE_KEYS,
  BOARD_THEMES,
  PIECE_THEMES,
  DEFAULT_BOARD_ID,
  DEFAULT_PIECE_ID,
  boardThemeById,
  pieceThemeById,
} from './themes'

describe('prettify', () => {
  it('upcases a NNd dimension prefix', () => {
    expect(prettify('3d_wood')).toBe('3D Wood')
  })
  it('keeps a leading digit and capitalizes the rest', () => {
    expect(prettify('8_bit')).toBe('8 Bit')
  })
  it('capitalizes each underscore-separated word', () => {
    expect(prettify('icy_sea')).toBe('Icy Sea')
  })
  it('handles a single word', () => {
    expect(prettify('walnut')).toBe('Walnut')
  })
})

describe('pieceImageMap', () => {
  it('maps every react-chessboard key to a lowercase PNG under basePath', () => {
    const map = pieceImageMap('/themes/pieces/neo')
    expect(Object.keys(map)).toHaveLength(PIECE_KEYS.length)
    expect(map.wP).toBe('/themes/pieces/neo/wp.png')
    expect(map.bK).toBe('/themes/pieces/neo/bk.png')
    for (const key of PIECE_KEYS) {
      expect(map[key]).toBe(`/themes/pieces/neo/${key.toLowerCase()}.png`)
    }
  })
})

describe('theme lists', () => {
  it('are non-empty and lead with the default entry', () => {
    expect(BOARD_THEMES.length).toBeGreaterThan(1)
    expect(PIECE_THEMES.length).toBeGreaterThan(1)
    expect(BOARD_THEMES[0].id).toBe(DEFAULT_BOARD_ID)
    expect(PIECE_THEMES[0].id).toBe(DEFAULT_PIECE_ID)
  })
  it('have unique ids', () => {
    expect(new Set(BOARD_THEMES.map(t => t.id)).size).toBe(BOARD_THEMES.length)
    expect(new Set(PIECE_THEMES.map(t => t.id)).size).toBe(PIECE_THEMES.length)
  })
  it('resolve known ids and fall back to the default for unknown ones', () => {
    expect(boardThemeById('green').id).toBe('green')
    expect(pieceThemeById('neo').id).toBe('neo')
    expect(boardThemeById('nope').id).toBe(DEFAULT_BOARD_ID)
    expect(pieceThemeById('nope').id).toBe(DEFAULT_PIECE_ID)
  })
})
