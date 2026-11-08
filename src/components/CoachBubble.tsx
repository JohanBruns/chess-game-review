import type { CommentToken } from '../lib/analysis/commentary'
import type { ThemeHighlight } from '../lib/analysis/tactics'

interface CoachBubbleProps {
  tokens: CommentToken[]
  // The highlight currently drawn on the board (hovered or pinned), so its phrase can be styled active.
  activeHighlight: ThemeHighlight | null
  onHover: (highlight: ThemeHighlight | null) => void
  onPin: (highlight: ThemeHighlight) => void
}

// Renders the guided-review coach commentary. Plain tokens are static text; highlight tokens are
// hoverable/clickable phrases that surface their squares+arrows on the board (hover to preview,
// click to pin). Highlight geometry lives in the tokens (from tactics.ts); this only wires events.
export function CoachBubble({ tokens, activeHighlight, onHover, onPin }: CoachBubbleProps) {
  return (
    <span>
      {tokens.map((token, i) => {
        if (!('highlight' in token)) return <span key={i}>{token.text}</span>
        const isActive = token.highlight === activeHighlight
        // A span, not a <button>: buttons are always laid out inline-block, so a phrase that
        // didn't fit wrapped as one centered block and pushed the closing period onto a line of
        // its own. A span flows with the sentence like the plain tokens around it.
        return (
          <span
            key={i}
            role="button"
            tabIndex={0}
            onMouseEnter={() => onHover(token.highlight)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onPin(token.highlight)}
            onKeyDown={e => {
              // stopPropagation keeps App's window-level Enter (= "Next") from also firing.
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onPin(token.highlight) }
            }}
            className={`underline decoration-dotted decoration-[#312e2b]/50 underline-offset-2 cursor-pointer transition-colors ${
              isActive ? 'text-cc-orange' : 'hover:text-cc-orange'
            }`}
          >
            {token.text}
          </span>
        )
      })}
    </span>
  )
}
