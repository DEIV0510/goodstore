import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Pie fijo (por ejemplo, el resumen del carrito). */
  footer?: ReactNode
  side?: 'right' | 'left'
  labelId?: string
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Panel lateral accesible: bloquea el scroll del fondo, atrapa el foco,
 * cierra con Escape y devuelve el foco al elemento que lo abrió.
 */
export default function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  labelId = 'drawer-title',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement as HTMLElement

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
    const prevOverflow = document.body.style.overflow
    const prevPadding = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (scrollBarWidth > 0) document.body.style.paddingRight = `${scrollBarWidth}px`

    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }, 60)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPadding
      opener.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 h-full w-full animate-fade-in cursor-default bg-ink-900/80 backdrop-blur-sm"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className={`absolute inset-y-0 flex w-[min(420px,92vw)] flex-col border-white/10 bg-ink-800 shadow-2xl ${
          side === 'right'
            ? 'right-0 animate-slide-left border-l'
            : 'left-0 animate-slide-left border-r'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <h2 id={labelId} className="font-display text-base font-extrabold uppercase tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={`Cerrar ${title.toLowerCase()}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-white/10 bg-ink-700/60 p-4 pb-safe">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
