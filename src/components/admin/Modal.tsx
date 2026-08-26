import { X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

// ─────────────────────────────────────────────────────────────────────────────
// Ventanas modales y confirmaciones.
//
// Un modal mal hecho es una trampa para quien navega con teclado. Este:
//   · atrapa el tabulador dentro mientras está abierto,
//   · cierra con Escape y con clic en el fondo,
//   · devuelve el foco al botón que lo abrió,
//   · bloquea el desplazamiento de la página de debajo.
// ─────────────────────────────────────────────────────────────────────────────

const SELECTOR_FOCO =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  ancho = 'md',
  children,
  pie,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: string
  ancho?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
  pie?: ReactNode
}) {
  const caja = useRef<HTMLDivElement>(null)
  const anterior = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!abierto) return

    anterior.current = document.activeElement as HTMLElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // El foco entra al modal, no se queda detrás en la página.
    const t = window.setTimeout(() => {
      const primero = caja.current?.querySelector<HTMLElement>(SELECTOR_FOCO)
      ;(primero ?? caja.current)?.focus()
    }, 30)

    function alPulsar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCerrar()
        return
      }
      if (e.key !== 'Tab' || !caja.current) return

      const focoables = [...caja.current.querySelectorAll<HTMLElement>(SELECTOR_FOCO)].filter(
        (el) => el.offsetParent !== null
      )
      if (focoables.length === 0) return

      const primero = focoables[0]
      const ultimo = focoables[focoables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPulsar, true)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', alPulsar, true)
      document.body.style.overflow = overflow
      anterior.current?.focus?.()
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  const anchos = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }[ancho]

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Velo: aísla el contenido de debajo y cierra al pulsarlo. */}
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onCerrar}
        className="absolute inset-0 cursor-default bg-blue-950/60 backdrop-blur-[2px] animate-fade-in"
      />
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:rounded-2xl sm:animate-scale-in ${anchos}`}
      >
        <header className="flex items-start gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[16px] font-bold text-slate-900">{titulo}</h2>
            {descripcion && (
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="adm-icono -mr-1 -mt-1"
            aria-label="Cerrar ventana"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {pie && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {pie}
          </footer>
        )}
      </div>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmación de acciones destructivas
//
// Nada que borre datos se ejecuta con un solo clic. Se pide confirmación
// escribiendo el texto de la acción, no un "aceptar" reflejo.
// ─────────────────────────────────────────────────────────────────────────────

interface PeticionConfirmar {
  titulo: string
  mensaje: string
  confirmar?: string
  cancelar?: string
  peligroso?: boolean
}

type Resolver = (v: boolean) => void

const ConfirmarContext = createContext<
  ((p: PeticionConfirmar) => Promise<boolean>) | null
>(null)

export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [peticion, setPeticion] = useState<PeticionConfirmar | null>(null)
  const resolver = useRef<Resolver | null>(null)

  const pedir = useCallback((p: PeticionConfirmar) => {
    setPeticion(p)
    return new Promise<boolean>((res) => {
      resolver.current = res
    })
  }, [])

  const responder = useCallback((valor: boolean) => {
    resolver.current?.(valor)
    resolver.current = null
    setPeticion(null)
  }, [])

  return (
    <ConfirmarContext.Provider value={pedir}>
      {children}
      <Modal
        abierto={peticion !== null}
        onCerrar={() => responder(false)}
        titulo={peticion?.titulo ?? ''}
        ancho="sm"
        pie={
          <>
            <button
              type="button"
              onClick={() => responder(false)}
              className="adm-btn-suave adm-btn-sm"
            >
              {peticion?.cancelar ?? 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={() => responder(true)}
              className={`adm-btn-sm ${
                peticion?.peligroso === false ? 'adm-btn-primary' : 'adm-btn-peligro'
              }`}
            >
              {peticion?.confirmar ?? 'Eliminar'}
            </button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-slate-600">{peticion?.mensaje}</p>
      </Modal>
    </ConfirmarContext.Provider>
  )
}

/**
 * Uso:
 *   const confirmar = useConfirmar()
 *   if (await confirmar({ titulo: '…', mensaje: '…' })) { … }
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirmar() {
  const ctx = useContext(ConfirmarContext)
  if (!ctx) throw new Error('useConfirmar debe usarse dentro de <ConfirmarProvider>')
  return ctx
}
