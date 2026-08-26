import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { mensajeDeError } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Avisos del panel.
//
// Van en una región `aria-live="polite"`: los lee el lector de pantalla sin
// robar el foco de donde esté trabajando la persona.
// ─────────────────────────────────────────────────────────────────────────────

export type TonoAviso = 'exito' | 'error' | 'aviso' | 'info'

interface Aviso {
  id: number
  tono: TonoAviso
  mensaje: string
  /** Acción para deshacer, cuando la operación lo permite. */
  deshacer?: { etiqueta: string; alPulsar: () => void }
}

interface ValorAvisos {
  exito: (mensaje: string, deshacer?: Aviso['deshacer']) => void
  error: (algo: unknown) => void
  aviso: (mensaje: string) => void
  info: (mensaje: string) => void
}

const AvisosContext = createContext<ValorAvisos | null>(null)

const DURACION: Record<TonoAviso, number> = {
  exito: 3500,
  info: 3500,
  aviso: 5000,
  // Los errores se quedan más tiempo: hay que poder leerlos y actuar.
  error: 7000,
}

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const contador = useRef(0)

  const cerrar = useCallback((id: number) => {
    setAvisos((a) => a.filter((x) => x.id !== id))
  }, [])

  const empujar = useCallback(
    (tono: TonoAviso, mensaje: string, deshacer?: Aviso['deshacer']) => {
      const id = ++contador.current
      // Máximo tres a la vez: una pila creciente tapa la interfaz.
      setAvisos((a) => [...a.slice(-2), { id, tono, mensaje, deshacer }])
      window.setTimeout(() => cerrar(id), DURACION[tono])
    },
    [cerrar]
  )

  const valor = useMemo<ValorAvisos>(
    () => ({
      exito: (m, d) => empujar('exito', m, d),
      // Acepta cualquier error y lo traduce a algo legible en español.
      error: (algo) => empujar('error', mensajeDeError(algo)),
      aviso: (m) => empujar('aviso', m),
      info: (m) => empujar('info', m),
    }),
    [empujar]
  )

  const ICONOS = {
    exito: CheckCircle2,
    error: XCircle,
    aviso: AlertTriangle,
    info: Info,
  }
  const TONOS: Record<TonoAviso, string> = {
    exito: 'border-emerald-200 bg-white text-emerald-600',
    error: 'border-red-200 bg-white text-alert-600',
    aviso: 'border-amber-200 bg-white text-amber-600',
    info: 'border-blue-200 bg-white text-blue-600',
  }

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-4 z-[120] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end"
        aria-live="polite"
        aria-atomic="false"
      >
        {avisos.map((a) => {
          const Icono = ICONOS[a.tono]
          return (
            <div
              key={a.id}
              role={a.tono === 'error' ? 'alert' : undefined}
              className={`pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border p-3 shadow-lg ${TONOS[a.tono]}`}
            >
              <Icono className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-slate-700">
                {a.mensaje}
              </p>
              {a.deshacer && (
                <button
                  type="button"
                  onClick={() => {
                    a.deshacer?.alPulsar()
                    cerrar(a.id)
                  }}
                  className="shrink-0 rounded-md px-2 py-1 text-[12.5px] font-bold text-blue-700 hover:bg-blue-50"
                >
                  {a.deshacer.etiqueta}
                </button>
              )}
              <button
                type="button"
                onClick={() => cerrar(a.id)}
                aria-label="Cerrar aviso"
                className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </AvisosContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAvisos() {
  const ctx = useContext(AvisosContext)
  if (!ctx) throw new Error('useAvisos debe usarse dentro de <AvisosProvider>')
  return ctx
}
