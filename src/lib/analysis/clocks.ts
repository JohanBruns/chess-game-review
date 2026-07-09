export interface TimeControl {
  initialSeconds: number
  incrementSeconds: number
}

// PGN TimeControl header: "600" (600s, no increment) or "180+2" (180s + 2s/move). Chess.com
// also emits "1/259200" (correspondence, days per move) and "-" (unknown) — both unsupported,
// return null so moveTimes falls back to skipping the first move of each side instead of
// guessing.
export function parseTimeControl(tc: string | null | undefined): TimeControl | null {
  if (!tc) return null
  const m = tc.match(/^(\d+)(?:\+(\d+))?$/)
  if (!m) return null
  return { initialSeconds: parseInt(m[1], 10), incrementSeconds: m[2] ? parseInt(m[2], 10) : 0 }
}

// "H:MM:SS" or "H:MM:SS.f" (chess.com's %clk format) → total seconds. Returns null on anything
// that doesn't parse cleanly rather than guessing.
function parseClockString(s: string): number | null {
  const parts = s.split(':')
  if (parts.length === 0 || parts.some(p => p === '' || Number.isNaN(Number(p)))) return null
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0)
}

// Extracts each ply's remaining clock time from a RAW (un-stripped) PGN — must run before
// useGame's comment-stripping regex, which discards the `{[%clk ...]}` annotations chess.js
// 1.x can't parse. `{...}` brace comments only ever appear in the movetext (PGN headers are
// `[Tag "value"]` bracket lines, a different syntax), so matching every `%clk` comment in
// document order reliably lines up with ply order. Index i = the clock reading after ply i+1
// (1-based ply), matching useEngine's evalResults indexing.
export function parseClocks(pgn: string): (number | null)[] {
  const re = /\{[^}]*\[%clk\s+([\d:.]+)\][^}]*\}/g
  const clocks: (number | null)[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(pgn)) !== null) {
    clocks.push(parseClockString(m[1]))
  }
  return clocks
}

// Seconds spent on each ply: previous same-side clock reading minus this ply's reading, plus
// any increment. The first move of each side has no previous same-side reading (clocks[i-2])
// within the game, so it falls back to the time control's starting allotment; without a time
// control that ply's spend is unknown (null) rather than a guess.
export function moveTimes(clocks: (number | null)[], timeControl?: TimeControl | null): (number | null)[] {
  return clocks.map((clock, i) => {
    if (clock === null) return null
    const prevClock = i >= 2 ? clocks[i - 2] : (timeControl?.initialSeconds ?? null)
    if (prevClock === null) return null
    const spent = prevClock - clock + (timeControl?.incrementSeconds ?? 0)
    return spent >= 0 ? spent : null
  })
}

// "0:07" / "1:23" (m:ss) for the MoveList time label — chess.com never shows an hours digit
// for per-move spend, only for the clock display itself.
export function formatMoveTime(seconds: number): string {
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}
