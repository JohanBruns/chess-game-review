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

// Phones only: the game as one horizontally scrolling line right under the board (like the
// chess.com and lichess apps), kept centered on the current move. The full move list in the
// sidebar grows with the page there, so while stepping through a game it showed moves 1-4 under
// the board no matter where you were.
export function MoveStrip({ moves, currentPly, onSelectPly, moveAnalyses, arrows }: MoveStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  // Center the current move by scrolling the strip itself (scrollIntoView would also move the
  // page). Before the first move, back to the start.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const active = activeRef.current
    const left = Math.max(0, active ? active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2 : 0)
    // Glide for a step to the next move, jump straight there for a jump across the game.
    const far = Math.abs(left - strip.scrollLeft) > strip.clientWidth
    strip.scrollTo({ left, behavior: far ? 'auto' : 'smooth' })
    // moveAnalyses too: the class icons arriving with the analysis widen the moves before this one.
  }, [currentPly, moves, moveAnalyses])

  if (moves.length === 0) return null

  const strip = (
    <div
      ref={stripRef}
      className={`relative h-9 flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        arrows ? 'px-1' : 'px-3'
      }`}
    >
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
