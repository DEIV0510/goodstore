import { AlertCircle, Loader2, type LucideIcon } from 'lucide-react'
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Piezas básicas del panel.
//
// Existen para que todas las pantallas se comporten igual en lo que suele
// hacerse mal: etiquetas siempre visibles, errores junto al campo que los
// provoca, y superficies táctiles que no bajan de 44 px.
// ─────────────────────────────────────────────────────────────────────────────

// ── Encabezado de pantalla ───────────────────────────────────────────────────

export function Encabezado({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion?: string
  /** Acciones de la pantalla (normalmente un botón principal). */
  children?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {titulo}
        </h1>
        {descripcion && (
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-slate-500">
            {descripcion}
          </p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </header>
  )
}

// ── Campos de formulario ─────────────────────────────────────────────────────

interface BaseCampo {
  label: string
  error?: string
  ayuda?: string
  requerido?: boolean
}

/** Envuelve cualquier control con su etiqueta, su ayuda y su error. */
export function Campo({
  label,
  error,
  ayuda,
  requerido,
  htmlFor,
  children,
}: BaseCampo & { htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="adm-label">
        {label}
        {requerido && (
          <span className="ml-1 text-alert-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {ayuda && !error && <p className="adm-ayuda">{ayuda}</p>}
      {error && (
        <p className="adm-error" role="alert">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export const Entrada = forwardRef<
  HTMLInputElement,
  BaseCampo & InputHTMLAttributes<HTMLInputElement>
>(function Entrada({ label, error, ayuda, requerido, className = '', ...props }, ref) {
  const auto = useId()
  const id = props.id ?? auto
  return (
    <Campo label={label} error={error} ayuda={ayuda} requerido={requerido} htmlFor={id}>
      <input
        {...props}
        id={id}
        ref={ref}
        required={requerido}
        aria-invalid={error ? true : undefined}
        className={`adm-input ${error ? 'adm-input-error' : ''} ${className}`}
      />
    </Campo>
  )
})

export const AreaTexto = forwardRef<
  HTMLTextAreaElement,
  BaseCampo & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AreaTexto({ label, error, ayuda, requerido, className = '', ...props }, ref) {
  const auto = useId()
  const id = props.id ?? auto
  return (
    <Campo label={label} error={error} ayuda={ayuda} requerido={requerido} htmlFor={id}>
      <textarea
        {...props}
        id={id}
        ref={ref}
        required={requerido}
        aria-invalid={error ? true : undefined}
        className={`adm-textarea ${error ? 'adm-input-error' : ''} ${className}`}
      />
    </Campo>
  )
})

export function Selector({
  label,
  error,
  ayuda,
  requerido,
  opciones,
  className = '',
  ...props
}: BaseCampo &
  SelectHTMLAttributes<HTMLSelectElement> & {
    opciones: { valor: string; etiqueta: string }[]
  }) {
  const auto = useId()
  const id = props.id ?? auto
  return (
    <Campo label={label} error={error} ayuda={ayuda} requerido={requerido} htmlFor={id}>
      <select
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        className={`adm-select ${error ? 'adm-input-error' : ''} ${className}`}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </Campo>
  )
}

/** Interruptor de encendido/apagado con etiqueta pulsable. */
export function Interruptor({
  activo,
  onChange,
  label,
  descripcion,
  disabled,
}: {
  activo: boolean
  onChange: (v: boolean) => void
  label: string
  descripcion?: string
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-start gap-3 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!activo)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          activo ? 'bg-blue-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            activo ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-slate-800">{label}</span>
        {descripcion && (
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-slate-500">
            {descripcion}
          </span>
        )}
      </span>
    </label>
  )
}

// ── Estados de pantalla ──────────────────────────────────────────────────────

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div
      className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-slate-400"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <p className="text-[13px] font-medium">{texto}</p>
    </div>
  )
}

export function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
  children,
}: {
  icono: LucideIcon
  titulo: string
  descripcion: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icono className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="font-display text-[15px] font-bold text-slate-800">{titulo}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
          {descripcion}
        </p>
      </div>
      {children}
    </div>
  )
}

export function ErrorEstado({
  mensaje,
  onReintentar,
}: {
  mensaje: string
  onReintentar?: () => void
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center"
      role="alert"
    >
      <AlertCircle className="h-6 w-6 text-alert-600" aria-hidden="true" />
      <div>
        <p className="font-display text-[15px] font-bold text-red-900">
          No se pudieron cargar los datos
        </p>
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-red-700">
          {mensaje}
        </p>
      </div>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="adm-btn-suave adm-btn-sm">
          Reintentar
        </button>
      )}
    </div>
  )
}

// ── Indicadores ──────────────────────────────────────────────────────────────

export type Tono = 'verde' | 'ambar' | 'rojo' | 'azul' | 'gris'

export function Etiqueta({
  tono = 'gris',
  children,
}: {
  tono?: Tono
  children: ReactNode
}) {
  return <span className={`adm-chip-${tono}`}>{children}</span>
}

/** Ficha de cifra del panel. `nota` explica de dónde sale el número. */
export function Cifra({
  icono: Icono,
  etiqueta,
  valor,
  nota,
  tono = 'azul',
}: {
  icono: LucideIcon
  etiqueta: string
  valor: string | number
  nota?: string
  tono?: Tono
}) {
  const fondos: Record<Tono, string> = {
    azul: 'bg-blue-50 text-blue-700',
    verde: 'bg-emerald-50 text-emerald-700',
    ambar: 'bg-amber-50 text-amber-700',
    rojo: 'bg-red-50 text-alert-600',
    gris: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="adm-card flex items-start gap-3 p-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${fondos[tono]}`}>
        <Icono className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          {etiqueta}
        </p>
        <p className="adm-num mt-0.5 font-display text-xl font-bold leading-none text-slate-900">
          {valor}
        </p>
        {nota && <p className="mt-1 text-[12px] leading-snug text-slate-400">{nota}</p>}
      </div>
    </div>
  )
}

/** Botón con estado de envío: se bloquea y muestra el giro mientras trabaja. */
export function BotonGuardar({
  guardando,
  children = 'Guardar',
  ...props
}: { guardando?: boolean } & InputHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...(props as object)}
      disabled={guardando || props.disabled}
      className={`adm-btn-primary ${props.className ?? ''}`}
    >
      {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {guardando ? 'Guardando…' : children}
    </button>
  )
}
