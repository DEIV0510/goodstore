import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  eyebrow?: string
  title: string
  description?: string
  linkTo?: string
  linkLabel?: string
  id?: string
  align?: 'left' | 'center'
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  linkTo,
  linkLabel = 'Ver todo',
  id,
  align = 'left',
}: Props) {
  return (
    <div
      className={`mb-7 flex flex-col gap-4 sm:mb-9 ${
        align === 'center'
          ? 'items-center text-center'
          : 'sm:flex-row sm:items-end sm:justify-between'
      }`}
    >
      <div className={align === 'center' ? 'max-w-2xl' : 'max-w-2xl'}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2
          id={id}
          className="mt-2.5 text-balance font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-[2.1rem]"
          style={{ fontStretch: '110%' }}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-pretty text-sm leading-relaxed text-white/60 sm:text-base">
            {description}
          </p>
        )}
      </div>

      {linkTo && (
        <Link
          to={linkTo}
          className="group inline-flex shrink-0 items-center gap-1.5 self-start text-sm font-bold text-gold-500 transition-colors hover:text-gold-400 sm:self-auto"
        >
          {linkLabel}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  )
}
