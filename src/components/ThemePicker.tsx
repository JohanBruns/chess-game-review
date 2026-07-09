import { useEffect } from 'react'
import { BOARD_THEMES, PIECE_THEMES } from '../lib/themes'

interface ThemePickerProps {
  open: boolean
  onClose: () => void
  boardId: string
  pieceId: string
  onSelectBoard: (id: string) => void
  onSelectPiece: (id: string) => void
}

const CARD =
  'group flex flex-col items-center gap-1 rounded p-1.5 transition-colors cursor-pointer hover:bg-cc-surface'
const SWATCH = 'w-full aspect-square rounded overflow-hidden border border-cc-border'

export function ThemePicker({
  open,
  onClose,
  boardId,
  pieceId,
  onSelectBoard,
  onSelectPiece,
}: ThemePickerProps) {
  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg border border-cc-border bg-cc-panel shadow-2xl"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-cc-border bg-cc-panel">
          <h2 className="font-heading text-sm font-semibold text-cc-text">Board &amp; Pieces</h2>
          <button
            className="px-2 py-1 rounded text-cc-text-dim hover:bg-cc-surface hover:text-cc-text text-sm"
            onClick={onClose}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* ── Board ── */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-cc-text-faint mb-2">Board</h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {BOARD_THEMES.map(theme => {
                const active = theme.id === boardId
                return (
                  <button
                    key={theme.id}
                    className={CARD}
                    onClick={() => onSelectBoard(theme.id)}
                    title={theme.label}
                  >
                    <span className={`${SWATCH} ${active ? 'ring-2 ring-cc-green' : ''}`}>
                      <img
                        src={theme.url}
                        alt={theme.label}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </span>
                    <span className={`text-[10px] truncate max-w-full ${active ? 'text-cc-green' : 'text-cc-text-dim'}`}>
                      {theme.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Pieces ── */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-cc-text-faint mb-2">Pieces</h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {PIECE_THEMES.map(theme => {
                const active = theme.id === pieceId
                return (
                  <button
                    key={theme.id}
                    className={CARD}
                    onClick={() => onSelectPiece(theme.id)}
                    title={theme.label}
                  >
                    <span className={`${SWATCH} flex items-center justify-center bg-cc-bg ${active ? 'ring-2 ring-cc-green' : ''}`}>
                      <img src={`${theme.basePath}/wn.png`} alt="" loading="lazy" className="w-1/2 h-full object-contain" />
                      <img src={`${theme.basePath}/bn.png`} alt="" loading="lazy" className="w-1/2 h-full object-contain" />
                    </span>
                    <span className={`text-[10px] truncate max-w-full ${active ? 'text-cc-green' : 'text-cc-text-dim'}`}>
                      {theme.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
