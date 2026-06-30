import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Chess } from 'chess.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'src', 'data', 'openings.json')

const files = ['a', 'b', 'c', 'd', 'e']
const base = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master'

function pgnToEpd(pgn) {
  const chess = new Chess()
  // Parse simple move list like "1. e4 e5 2. Nf3"
  const cleaned = pgn.replace(/\d+\./g, '').trim()
  const sans = cleaned.split(/\s+/).filter(Boolean)
  for (const san of sans) {
    try { chess.move(san) } catch { break }
  }
  // EPD = first 4 FEN fields
  return chess.fen().split(' ').slice(0, 4).join(' ')
}

const entries = []

for (const f of files) {
  const url = `${base}/${f}.tsv`
  console.log(`Fetching ${url} …`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const text = await res.text()
  const lines = text.trim().split('\n').slice(1) // skip header
  for (const line of lines) {
    const cols = line.split('\t')
    const eco = cols[0]?.trim()
    const name = cols[1]?.trim()
    const pgn = cols[2]?.trim()
    if (eco && name && pgn) {
      const epd = pgnToEpd(pgn)
      entries.push({ eco, name, epd })
    }
  }
}

mkdirSync(join(__dirname, '..', 'src', 'data'), { recursive: true })
writeFileSync(outPath, JSON.stringify(entries, null, 0))
console.log(`Wrote ${entries.length} openings to ${outPath}`)
