import { site } from '@/data/site'

/** Monograma GG. Se usa en header, footer y estados vacíos. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  const G = (cx: number, cy: number, r: number, color: string, w: number) => {
    const sx = (cx + r * Math.cos(-0.62)).toFixed(2)
    const sy = (cy + r * Math.sin(-0.62)).toFixed(2)
    return (
      <path
        d={`M ${sx} ${sy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} L ${(cx + r * 0.05).toFixed(2)} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }

  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ggBadge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#161EB4" />
          <stop offset="0.5" stopColor="#070A78" />
          <stop offset="1" stopColor="#050745" />
        </linearGradient>
      </defs>
      <rect
        x="1.75"
        y="1.75"
        width="92.5"
        height="92.5"
        rx="25"
        fill="url(#ggBadge)"
        stroke="#FFF000"
        strokeWidth="3.5"
      />
      <g transform="translate(0,-2)">
        {G(31, 45, 13.5, '#FFFFFF', 7)}
        {G(63, 45, 13.5, '#050745', 12)}
        {G(63, 45, 13.5, '#FFF000', 7)}
      </g>
      <rect x="34" y="74" width="28" height="4.5" rx="2.25" fill="#FF1717" />
    </svg>
  )
}

interface LogoProps {
  className?: string
  markClassName?: string
  /** Oculta el texto y deja solo el monograma. */
  markOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function Logo({
  className = '',
  markClassName,
  markOnly = false,
  size = 'md',
}: LogoProps) {
  const word = {
    sm: 'text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-2xl sm:text-3xl',
  }[size]
  const sub = {
    sm: 'text-[7px]',
    md: 'text-[8px]',
    lg: 'text-[10px]',
  }[size]
  const mark =
    markClassName ?? { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-12 w-12' }[size]

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={`${mark} shrink-0`} />
      {!markOnly && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display font-black tracking-tight text-white ${word}`}
            style={{ fontStretch: '115%' }}
          >
            GOOD <span className="text-gold-500">GAME</span>
          </span>
          <span
            className={`mt-1 font-display font-bold uppercase tracking-[.42em] text-white/45 ${sub}`}
          >
            {site.tagline}
          </span>
        </span>
      )}
    </span>
  )
}
