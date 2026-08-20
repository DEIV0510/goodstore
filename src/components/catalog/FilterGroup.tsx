import { ChevronDown, Check } from 'lucide-react'
import { useState } from 'react'

export interface Option {
  id: string
  label: string
  count: number
}

interface Props {
  title: string
  options: Option[]
  selected: string[]
  onToggle: (id: string) => void
  /** Nota mostrada cuando ninguna opción tiene resultados. */
  emptyNote?: string
  defaultOpen?: boolean
}

/**
 * Grupo de filtros con contadores reales. Las opciones sin resultados quedan
 * deshabilitadas en lugar de desaparecer, para que se vea que el filtro existe
 * y por qué no arroja nada.
 */
export default function FilterGroup({
  title,
  options,
  selected,
  onToggle,
  emptyNote,
  defaultOpen = true,
}: Props) {
  const allZero = options.every((o) => o.count === 0)
  const [open, setOpen] = useState(defaultOpen && !allZero)
  const groupId = `filtro-${title.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="border-b border-white/[.08] py-3.5 last:border-b-0">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={groupId}
          className="flex w-full items-center justify-between gap-2 py-1 text-left"
        >
          <span className="font-display text-xs font-extrabold uppercase tracking-[.16em] text-white/85">
            {title}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-white/45 transition-transform duration-300 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </h3>

      <div id={groupId} hidden={!open} className="mt-2 space-y-0.5">
        {options.map((o) => {
          const checked = selected.includes(o.id)
          const disabled = o.count === 0 && !checked
          return (
            <label
              key={o.id}
              className={`flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                disabled
                  ? 'cursor-not-allowed opacity-40'
                  : checked
                    ? 'bg-gold-500/10'
                    : 'hover:bg-white/[.06]'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(o.id)}
              />
              <span
                aria-hidden="true"
                className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors ${
                  checked
                    ? 'border-gold-500 bg-gold-500 text-ink-900'
                    : 'border-white/25 bg-white/[.04]'
                }`}
              >
                {checked && <Check className="h-3 w-3" strokeWidth={3.5} />}
              </span>
              <span
                className={`flex-1 text-[13px] font-medium ${
                  checked ? 'text-gold-500' : 'text-white/75'
                }`}
              >
                {o.label}
              </span>
              <span className="tabular text-2xs font-semibold text-white/35">{o.count}</span>
            </label>
          )
        })}

        {allZero && emptyNote && (
          <p className="mt-1.5 rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-2 text-2xs leading-relaxed text-white/45">
            {emptyNote}
          </p>
        )}
      </div>
    </div>
  )
}
