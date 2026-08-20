import { Check, Info, X, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/StoreContext'

const ICONS = {
  success: Check,
  info: Info,
  error: AlertTriangle,
}

const TONES = {
  success: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200',
  info: 'border-blue-300/35 bg-blue-500/20 text-blue-100',
  error: 'border-alert-500/40 bg-alert-500/15 text-red-200',
}

export default function Toasts() {
  const { toasts, dismissToast } = useStore()

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-24 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-28 sm:items-end"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-center gap-3 rounded-xl border border-white/12 bg-ink-700/95 p-2.5 pr-3 shadow-card-hover backdrop-blur"
          >
            {t.image ? (
              <img
                src={t.image}
                alt=""
                className="h-11 w-9 shrink-0 rounded-md object-contain"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${TONES[t.tone]}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-white/90">
              {t.message}
            </p>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Cerrar notificación"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
