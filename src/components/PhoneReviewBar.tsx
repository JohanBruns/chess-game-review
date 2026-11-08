export interface ReviewBarAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  // Highlighted while its mode is on (Show while the line is explained, Best while previewed).
  active?: boolean
}

interface PhoneReviewBarProps {
  // Up to three labeled actions left of the big button (Retry / Show / Best). A null keeps its
  // slot empty, so the buttons don't shift from move to move.
  actions: (ReviewBarAction | null)[]
  primary: { label: string; onClick: () => void; disabled?: boolean }
}

// The guided review's bottom bar on phones, after the chess.com app: icon-over-label buttons for
// the secondary actions and a large green "Next" on the right. Fixed to the bottom of the screen.
export function PhoneReviewBar({ actions, primary }: PhoneReviewBarProps) {
  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-cc-bg pb-[env(safe-area-inset-bottom)]">
      <div className="h-[72px] px-3 flex items-center gap-1">
        {actions.map((a, i) =>
          a ? (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.disabled}
              aria-pressed={a.active}
              className={`flex-1 min-w-0 h-14 flex flex-col items-center justify-center gap-0.5 rounded-[8px] text-[12px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                a.active ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'
              }`}
            >
              {a.icon}
              <span className="truncate max-w-full">{a.label}</span>
            </button>
          ) : (
            <span key={`empty-${i}`} className="flex-1" />
          ),
        )}
        <button
          onClick={primary.onClick}
          disabled={primary.disabled}
          className="cc-btn-primary basis-[38%] shrink-0 h-14 ml-1 rounded-[10px] text-[20px] font-extrabold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {primary.label}
        </button>
      </div>
    </div>
  )
}
