import { useEffect, useRef } from 'react'
import type { Move } from 'chess.js'
import type { MoveAnalysis } from '../lib/analysis/classify'
import { CLASS_ICON } from '../lib/analysis/classIcons'
import { classTextColor } from '../lib/analysis/classColors'
import { MARKED_CLASSES, splitSan } from '../lib/analysis/moveDisplay'
import { IconChevronLeft, IconChevronRight } from './icons'

interface MoveStripProps {
  moves: Move[]
  currentPly: number
  onSelectPly: (ply: number) => void
  moveAnalyses: MoveAnalysis[] | null
  // Step buttons at both ends, like the chess.com app's review (the loader chapter has them in
  // its footer instead).
  arrows?: { onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean }
}

const ARROW_BTN =
  'w-10 h-10 shrink-0 flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'

// After the finger lets go, the strip counts as settled once it has stopped scrolling this long
// (iOS keeps scrolling with momentum for a while).
const SETTLE_MS = 150

// Phones only: the game as one horizontally scrolling line right under the board, like the
// chess.com app. It works both ways: stepping through the game keeps the current move centered,
// and scrolling the strip by hand steps the game — whatever move passes the middle becomes the
// current one, live, and the strip snaps it to the center once it comes to rest. Spacers at both
// ends let the first and last moves reach the middle too.
export function MoveStrip({ moves, currentPly, onSelectPly, moveAnalyses, arrows }: MoveStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)
  // The user is scrolling the strip (finger down, or momentum/wheel still running): their scroll
  // picks the move, so the centering below must not fight it.
  const userScrollRef = useRef(false)
  const touchingRef = useRef(false)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pickFrameRef = useRef<number | null>(null)
  const currentPlyRef = useRef(currentPly)
  const onSelectPlyRef = useRef(onSelectPly)
  useEffect(() => {
    currentPlyRef.current = currentPly
    onSelectPlyRef.current = onSelectPly
  })

  // Center the current move by scrolling the strip itself (scrollIntoView would also move the
  // page): glide for a step, jump for a jump across the game. Not while the user is scrolling.
  // moveAnalyses too: the class icons arriving with the analysis widen the moves before this one;
  // and hasArrows, because switching the arrows on or off builds a new scroll box (at 0).
  const hasArrows = arrows != null
  useEffect(() => {
    const strip = stripRef.current
    if (!strip || userScrollRef.current) return
    centerActive(strip, activeRef.current, false)
  }, [currentPly, moves, moveAnalyses, hasArrows])

  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    if (pickFrameRef.current !== null) cancelAnimationFrame(pickFrameRef.current)
  }, [])

  // Once the strip has come to rest, hand control back and snap the current move to the middle.
  function scheduleSettle() {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    settleTimerRef.current = setTimeout(() => {
      if (touchingRef.current) return
      userScrollRef.current = false
      if (stripRef.current) centerActive(stripRef.current, activeRef.current, true)
    }, SETTLE_MS)
  }

  function startUserScroll() {
    userScrollRef.current = true
    scheduleSettle()
  }

  // The move nearest the strip's middle becomes the current one (once per frame).
  function handleScroll() {
    if (!userScrollRef.current) return
    scheduleSettle()
    if (pickFrameRef.current !== null) return
    pickFrameRef.current = requestAnimationFrame(() => {
      pickFrameRef.current = null
      const strip = stripRef.current
      if (!strip) return
      const ply = plyAtMiddle(strip)
      if (ply !== null && ply !== currentPlyRef.current) onSelectPlyRef.current(ply)
    })
  }

  if (moves.length === 0) return null

  const strip = (
    <div
      ref={stripRef}
      onScroll={handleScroll}
      onTouchStart={() => { touchingRef.current = true; startUserScroll() }}
      onTouchEnd={() => { touchingRef.current = false; scheduleSettle() }}
      onTouchCancel={() => { touchingRef.current = false; scheduleSettle() }}
      onWheel={startUserScroll}
      className="relative h-9 flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <span aria-hidden className="shrink-0 w-[calc(50%-1.5rem)]" />
      {moves.map((move, i) => {
        const ply = i + 1
        const isActive = ply === currentPly
        const cls = moveAnalyses?.[i]?.classification
        const marked = cls != null && MARKED_CLASSES.has(cls)
        const { figurine, text } = splitSan(move.san)
        return (
          <span key={ply} className="shrink-0 flex items-center">
            {i % 2 === 0 && (
              <span className="ml-1.5 mr-0.5 text-[13px] font-semibold text-white/50 select-none">
                {i / 2 + 1}.
              </span>
            )}
            <button
              ref={isActive ? activeRef : null}
              data-ply={ply}
              onClick={() => onSelectPly(ply)}
              className={`h-7 px-1.5 rounded-[3px] flex items-center gap-1 text-[14px] font-bold whitespace-nowrap ${
                isActive ? 'bg-white/14 border-b-[3px] border-white/10 text-white' : marked ? '' : 'text-white/72'
              }`}
              style={marked && !isActive ? { color: classTextColor(cls) } : undefined}
            >
              {marked && <img src={CLASS_ICON[cls]} alt={cls} className="w-4 h-4" />}
              <span>
                {figurine && <span className="mr-px text-[15px] leading-none">{figurine}</span>}
                {text}
              </span>
            </button>
          </span>
        )
      })}
      <span aria-hidden className="shrink-0 w-[calc(50%-1.5rem)]" />
    </div>
  )

  if (!arrows) return strip
  return (
    <div className="flex items-center">
      <button className={ARROW_BTN} onClick={arrows.onPrev} disabled={!arrows.canPrev} aria-label="Previous Move">
        <IconChevronLeft size={26} />
      </button>
      {strip}
      <button className={ARROW_BTN} onClick={arrows.onNext} disabled={!arrows.canNext} aria-label="Next Move">
        <IconChevronRight size={26} />
      </button>
    </div>
  )
}

// Scrolls the strip so `active` sits in its middle (the start, before the first move). Smooth
// for a settle snap or a short step, instant for a jump across the game.
function centerActive(strip: HTMLDivElement, active: HTMLElement | null, smooth: boolean) {
  const left = Math.max(0, active ? active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2 : 0)
  const glide = smooth || Math.abs(left - strip.scrollLeft) <= strip.clientWidth
  strip.scrollTo({ left, behavior: glide ? 'smooth' : 'auto' })
}

// The ply of the move closest to the strip's horizontal middle.
function plyAtMiddle(strip: HTMLDivElement): number | null {
  const rect = strip.getBoundingClientRect()
  const middle = rect.left + rect.width / 2
  let best: number | null = null
  let bestDistance = Infinity
  for (const button of strip.querySelectorAll<HTMLButtonElement>('button[data-ply]')) {
    const r = button.getBoundingClientRect()
    const distance = Math.abs(r.left + r.width / 2 - middle)
    if (distance < bestDistance) {
      bestDistance = distance
      best = Number(button.dataset.ply)
    }
  }
  return best
}
