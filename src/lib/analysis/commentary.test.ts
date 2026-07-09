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
  it('returns no tokens when there are no themes', () => {
    const tokens = buildCommentary({ classification: 'Good', themes: [] })
    expect(tokens).toEqual([])
  })

  it('renders a capitalized, hoverable theme phrase for a blunder', () => {
    const tokens = buildCommentary({ classification: 'Blunder', themes: [hangingTheme] })
    const highlighted = tokens.filter(hasHighlight)
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0].text).toBe('It leaves the rook on a8 hanging')
    expect(highlighted[0].highlight).toBe(hangingTheme.highlight)
    expect(tokens.some(t => t.text === '.')).toBe(true)
  })

  it('drops themes that do not fit the move quality (a Best move keeps no negative theme)', () => {
    const tokens = buildCommentary({ classification: 'Best', themes: [hangingTheme] })
    expect(tokens).toEqual([])
  })

  it('joins two themes with ", and "', () => {
    const tokens = buildCommentary({
      classification: 'Blunder',
      themes: [allowsMateTheme, hangingTheme],
    })
    expect(tokens.some(t => t.text === ', and ')).toBe(true)
    expect(tokens.filter(hasHighlight)).toHaveLength(2)
  })
})
