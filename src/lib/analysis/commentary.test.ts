import { describe, it, expect } from 'vitest'
import { buildCommentary, type CommentToken } from './commentary'
import type { TacticalTheme } from './tactics'

const hangingTheme: TacticalTheme = {
  kind: 'hangingPiece',
  description: 'it leaves the rook on a8 hanging',
  highlight: { squares: ['a8'], arrows: [] },
}
const allowsMateTheme: TacticalTheme = {
  kind: 'allowsMate',
  description: 'it allows a forced mate',
  highlight: { squares: ['e1'], arrows: [] },
}

function hasHighlight(t: CommentToken): t is { text: string; highlight: TacticalTheme['highlight'] } {
  return 'highlight' in t
}

describe('buildCommentary', () => {
  it('falls back to the plain headline when there are no themes', () => {
    const tokens = buildCommentary({
      san: 'Nf3', classification: 'Good', isEnginesBest: false, bestSan: null, themes: [], ply: 4,
    })
    expect(tokens).toEqual([{ text: 'Nf3 is a good move' }])
  })

  it('appends a hoverable theme phrase for a blunder', () => {
    const tokens = buildCommentary({
      san: 'Qxg4', classification: 'Blunder', isEnginesBest: false, bestSan: 'Qd1',
      themes: [hangingTheme], ply: 4,
    })
    expect(tokens[0].text).toBe('Qxg4 is a blunder — ')
    const highlighted = tokens.filter(hasHighlight)
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0].text).toBe('it leaves the rook on a8 hanging')
    expect(highlighted[0].highlight).toBe(hangingTheme.highlight)
  })

  it('drops themes that do not fit the move quality (a Best move keeps no negative theme)', () => {
    const tokens = buildCommentary({
      san: 'Rd8', classification: 'Best', isEnginesBest: true, bestSan: 'Rd8',
      themes: [hangingTheme], ply: 6,
    })
    expect(tokens).toEqual([{ text: 'Rd8 is best' }])
  })

  it('varies the connector deterministically by ply parity', () => {
    const even = buildCommentary({
      san: 'Qxg4', classification: 'Blunder', isEnginesBest: false, bestSan: null, themes: [hangingTheme], ply: 4,
    })
    const odd = buildCommentary({
      san: 'Qxg4', classification: 'Blunder', isEnginesBest: false, bestSan: null, themes: [hangingTheme], ply: 5,
    })
    expect(even[0].text.endsWith(' — ')).toBe(true)
    expect(odd[0].text.endsWith(': ')).toBe(true)
  })

  it('joins two themes with ", and "', () => {
    const tokens = buildCommentary({
      san: 'Qxg4', classification: 'Blunder', isEnginesBest: false, bestSan: null,
      themes: [allowsMateTheme, hangingTheme], ply: 4,
    })
    expect(tokens.some(t => t.text === ', and ')).toBe(true)
    expect(tokens.filter(hasHighlight)).toHaveLength(2)
  })
})
