import openingsRaw from '../../data/openings.json'

export interface Opening {
  eco: string
  name: string
}

const DEFAULT_MAP = new Map<string, Opening>(
  (openingsRaw as { eco: string; name: string; epd: string }[]).map(o => [
    o.epd,
    { eco: o.eco, name: o.name },
  ]),
)

export function fenToEpd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ')
}

export function detectOpening(
  fens: string[],
  map: Map<string, Opening> = DEFAULT_MAP,
): { opening: Opening; fenPly: number } | null {
  for (let i = fens.length - 1; i >= 0; i--) {
    const match = map.get(fenToEpd(fens[i]))
    if (match) return { opening: match, fenPly: i }
  }
  return null
}
