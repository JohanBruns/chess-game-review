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

// The last known %clk reading for one side as of a given ply (PlayerBar's static clock —
// chess.com doesn't tick it live in Game Review, it just shows the reading at the current
// position). `clocks[i]` holds the reading after ply `i+1` (see parseClocks); White's readings
// live at odd plies (i even), Black's at even plies (i odd). Falls back to the time control's
// starting allotment before either side has moved, or null if neither is known.
export function remainingClockSeconds(
  clocks: (number | null)[],
  ply: number,
  side: 'white' | 'black',
  timeControl?: TimeControl | null,
): number | null {
  let last = timeControl?.initialSeconds ?? null
  const startIndex = side === 'white' ? 0 : 1
  for (let i = startIndex; i < clocks.length && i + 1 <= ply; i += 2) {
    if (clocks[i] !== null) last = clocks[i]
  }
  return last
}

// "9:58" (m:ss) or "1:02:33" (h:mm:ss) for the PlayerBar clock pill — chess.com shows the
// hours digit once a game clock reaches an hour, unlike the always-m:ss per-move spend label.
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
  return `${m}:${r.toString().padStart(2, '0')}`
}
