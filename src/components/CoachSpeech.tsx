// The coach avatar with a white speech bubble to its right — chess.com's bot-speech component,
// measured at 1440x900: 64px avatar, bubble 10px radius / 12px 16px padding / 15px 500-weight
// text, and a small tail pointing at the coach. The overview chapter bottom-aligns avatar and
// bubble; the move-by-move chapter top-aligns them.
export function CoachSpeech({
  align,
  children,
}: {
  align: 'top' | 'bottom'
  children: React.ReactNode
}) {
  return (
    <div className={`flex ${align === 'bottom' ? 'items-end' : 'items-start'}`}>
      <img src="/chess-coach.png" alt="Coach" className="w-16 h-16 shrink-0 rounded-[2px] object-cover" />
      <div className="relative flex-1 min-w-0 ml-[14px]">
        <svg
          aria-hidden
          width="15"
          height="22"
          viewBox="0 0 15 22"
          className={`absolute -left-[14px] text-white ${align === 'bottom' ? 'bottom-4' : 'top-[26px]'}`}
        >
          <path fill="currentColor" d="M15 0v22L1.5 12.5c-.9-.7-.9-2 0-2.6L15 0Z" />
        </svg>
        <div className="bg-white rounded-[10px] px-4 py-3 text-[15px] font-medium leading-5 text-[#312e2b]">
          {children}
        </div>
      </div>
    </div>
  )
}
