// Small stroke/fill icon set for the chess.com-style chrome (board controls column, sidebar
// header, coach buttons, nav footer). Drawn from scratch as simple 24x24 SVGs, all using
// currentColor so the surrounding button decides the tint.
interface IconProps {
  size?: number
  className?: string
}

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      {children}
    </svg>
  )
}

const STROKE = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function IconGear(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.7a7.6 7.6 0 0 1 0 1.9l2 1.7-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.7a7.6 7.6 0 0 1 0-1.9l-2-1.7 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9L10.3 2ZM12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        transform="translate(0 1)"
      />
    </Svg>
  )
}

export function IconFlip(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} d="M7 4v15M3.5 15.5 7 19l3.5-3.5M17 20V5M13.5 8.5 17 5l3.5 3.5" />
    </Svg>
  )
}

export function IconPalette(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2.5C6.8 2.5 2.5 6.6 2.5 11.7c0 5 4.1 9.8 8.6 9.8 1.4 0 2-1 1.6-2.2-.4-1.2.1-2.4 1.6-2.4h2.4c2.8 0 4.8-2 4.8-5 0-5.1-4.3-9.4-9.5-9.4ZM7.5 13a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Zm3-4.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Zm5 0a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z"
      />
    </Svg>
  )
}

export function IconLink(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path {...STROKE} d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </Svg>
  )
}

export function IconCamera(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M9 4h6l1.5 2.5H20a1.5 1.5 0 0 1 1.5 1.5v10.5A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 4 6.5h3.5L9 4Zm3 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
      />
    </Svg>
  )
}

export function IconSound(p: IconProps) {
  return (
    <Svg {...p}>
      <path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4V9Z" />
      <path {...STROKE} d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
    </Svg>
  )
}

export function IconSoundOff(p: IconProps) {
  return (
    <Svg {...p}>
      <path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4V9Z" />
      <path {...STROKE} d="m16 9.5 5 5M21 9.5l-5 5" />
    </Svg>
  )
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={2.5} d="M5 12.5 10 17.5 19 7" />
    </Svg>
  )
}

export function IconArrowLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={2.5} d="M20 12H5M11 5l-7 7 7 7" />
    </Svg>
  )
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={2.5} d="M4 12h15M13 5l7 7-7 7" />
    </Svg>
  )
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={2.5} d="M6 6l12 12M18 6 6 18" />
    </Svg>
  )
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={2.5} d="M12 4.5v15M4.5 12h15" />
    </Svg>
  )
}

export function IconBulb(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Zm-3 18h6v.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20.5V20Z"
      />
    </Svg>
  )
}

export function IconStar(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8 2.9-6Z"
      />
    </Svg>
  )
}

export function IconPlay(p: IconProps) {
  return (
    <Svg {...p}>
      <path fill="currentColor" d="M7 4.5v15l12.5-7.5L7 4.5Z" />
    </Svg>
  )
}

// Three connected dots — the common "share" glyph.
export function IconShare(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="17.5" cy="5.5" r="2.5" {...STROKE} />
      <circle cx="6.5" cy="12" r="2.5" {...STROKE} />
      <circle cx="17.5" cy="18.5" r="2.5" {...STROKE} />
      <path {...STROKE} d="m8.7 10.7 6.6-3.9M8.7 13.3l6.6 3.9" />
    </Svg>
  )
}

// Counter-clockwise arrow: "try this move again".
export function IconRetry(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path {...STROKE} d="M4 4.5v4.5h4.5" />
    </Svg>
  )
}

export function IconPause(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    </Svg>
  )
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={3} d="M15 4.5 7.5 12l7.5 7.5" />
    </Svg>
  )
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={3} d="M9 4.5 16.5 12 9 19.5" />
    </Svg>
  )
}

export function IconFirst(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={3} d="M5.5 4.5v15M17.5 4.5 10 12l7.5 7.5" />
    </Svg>
  )
}

export function IconLast(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={3} d="M18.5 4.5v15M6.5 4.5 14 12l-7.5 7.5" />
    </Svg>
  )
}

export function IconChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={2.5} d="M6 9.5 12 15.5l6-6" />
    </Svg>
  )
}

export function IconChevronUp(p: IconProps) {
  return (
    <Svg {...p}>
      <path {...STROKE} strokeWidth={2.5} d="M6 14.5 12 8.5l6 6" />
    </Svg>
  )
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" {...STROKE} strokeWidth={2.5} />
      <path {...STROKE} strokeWidth={2.5} d="M12 7.5V12l3 2" />
    </Svg>
  )
}

export function IconTarget(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" {...STROKE} />
      <circle cx="12" cy="12" r="4.5" {...STROKE} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </Svg>
  )
}

export function IconPuzzle(p: IconProps) {
  return (
    <Svg {...p}>
      <path
        fill="currentColor"
        d="M10 3a2 2 0 0 1 2 2v1h3.5A1.5 1.5 0 0 1 17 7.5V11h1a2 2 0 1 1 0 4h-1v3.5a1.5 1.5 0 0 1-1.5 1.5H12v-1a2 2 0 1 0-4 0v1H4.5A1.5 1.5 0 0 1 3 18.5V15h1a2 2 0 1 0 0-4H3V7.5A1.5 1.5 0 0 1 4.5 6H8V5a2 2 0 0 1 2-2Z"
      />
    </Svg>
  )
}

// chess.com's default avatar: a grey pawn silhouette on a darker tile.
export function PawnAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" fill="#5b5957" />
      <path
        fill="#8b8987"
        d="M20 8a5 5 0 0 0-3 9c-2 1.2-3 3-3 5h4c-.3 3.5-1.8 6.5-4.5 8.5-.8.6-1.3 1.5-1.3 2.5V40h15.6v-7c0-1-.5-1.9-1.3-2.5-2.7-2-4.2-5-4.5-8.5h4c0-2-1-3.8-3-5a5 5 0 0 0-3-9Z"
      />
    </svg>
  )
}
