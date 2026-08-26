import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de datos del panel.
//
// Tres detalles que suelen fallar y aquí no:
//   · el orden se anuncia con `aria-sort`, así que un lector de pantalla dice
//     por qué columna está ordenada la tabla;
//   · en móvil no se rompe: la tabla se sustituye por tarjetas, que es legible,
//     en vez de dejar un desplazamiento horizontal ciego;
//   · pagina sola. El catálogo tiene 318 productos: pintarlos todos de golpe
//     deja una página de veintitrés mil píxeles de alto, con sus 318 imágenes,
//     que además va a peor a medida que crezca el negocio.
// ─────────────────────────────────────────────────────────────────────────────

export interface Columna<T> {
  clave: string
  titulo: string
  /** Contenido de la celda. */
  celda: (fila: T) => ReactNode
  /** Valor para ordenar. Si falta, la columna no es ordenable. */
  orden?: (fila: T) => string | number
  /** Clases extra de la celda (por ejemplo alineación a la derecha). */
  className?: string
  /** Se oculta en la vista de tarjetas de móvil (útil para acciones). */
  soloTabla?: boolean
}

export interface Ordenamiento {
  clave: string
  dir: 'asc' | 'desc'
}

export function Tabla<T>({
  datos,
  columnas,
  claveFila,
  ordenInicial,
  vacio,
  /** Contenido de la tarjeta en móvil. Si falta, se apilan las columnas. */
  tarjetaMovil,
  /** Filas por página. 0 lo desactiva (listas cortas que se ven de una vez). */
  porPagina = 25,
}: {
  datos: T[]
  columnas: Columna<T>[]
  claveFila: (fila: T) => string
  ordenInicial?: Ordenamiento
  vacio?: ReactNode
  tarjetaMovil?: (fila: T) => ReactNode
  porPagina?: number
}) {
  const [orden, setOrden] = useState<Ordenamiento | null>(ordenInicial ?? null)
  const [pagina, setPagina] = useState(1)

  const ordenados = useMemo(() => {
    if (!orden) return datos
    const col = columnas.find((c) => c.clave === orden.clave)
    if (!col?.orden) return datos
    const factor = orden.dir === 'asc' ? 1 : -1
    return [...datos].sort((a, b) => {
      const va = col.orden!(a)
      const vb = col.orden!(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * factor
    })
  }, [datos, columnas, orden])

  function alternar(clave: string) {
    setOrden((o) =>
      o?.clave === clave
        ? { clave, dir: o.dir === 'asc' ? 'desc' : 'asc' }
        : { clave, dir: 'asc' }
    )
    // Reordenar cambia qué hay en cada página: quedarse en la 7 desorienta.
    setPagina(1)
  }

  const paginado = porPagina > 0 && ordenados.length > porPagina
  const totalPaginas = paginado ? Math.ceil(ordenados.length / porPagina) : 1
  // Se ajusta en vez de fiarse del estado: al filtrar, la página en la que
  // estabas puede haber dejado de existir.
  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = paginado ? (paginaActual - 1) * porPagina : 0
  const visibles = paginado ? ordenados.slice(desde, desde + porPagina) : ordenados

  // Al cambiar el número de resultados (un filtro, una búsqueda) se vuelve al
  // principio: seguir en la última página de la lista anterior no tiene sentido.
  useEffect(() => {
    setPagina(1)
  }, [datos.length])

  if (datos.length === 0 && vacio) return <>{vacio}</>

  return (
    <>
      {/* ── Escritorio y tablet ────────────────────────────────────────────
          `relative` no es decorativo: sin él, un descendiente con posición
          absoluta (por ejemplo un texto `sr-only` dentro de una celda) toma
          como referencia el documento entero, se escapa de este contenedor y
          estira la página a lo ancho aunque la tabla sí esté desplazándose
          por dentro.                                                        */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="adm-tabla">
          <thead>
            <tr>
              {columnas.map((c) => {
                const activa = orden?.clave === c.clave
                const Flecha = !c.orden
                  ? null
                  : !activa
                    ? ArrowUpDown
                    : orden.dir === 'asc'
                      ? ArrowUp
                      : ArrowDown
                return (
                  <th
                    key={c.clave}
                    scope="col"
                    className={c.className}
                    aria-sort={
                      !c.orden
                        ? undefined
                        : activa
                          ? orden.dir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                    }
                  >
                    {c.orden ? (
                      <button
                        type="button"
                        onClick={() => alternar(c.clave)}
                        className={`inline-flex items-center gap-1.5 transition-colors hover:text-slate-900 ${
                          activa ? 'text-slate-900' : ''
                        }`}
                      >
                        {c.titulo}
                        {Flecha && <Flecha className="h-3 w-3" aria-hidden="true" />}
                      </button>
                    ) : (
                      c.titulo
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila) => (
              <tr key={claveFila(fila)}>
                {columnas.map((c) => (
                  <td key={c.clave} className={c.className}>
                    {c.celda(fila)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Móvil: tarjetas ──────────────────────────────────────────────── */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {visibles.map((fila) => (
          <li key={claveFila(fila)} className="px-4 py-3">
            {tarjetaMovil ? (
              tarjetaMovil(fila)
            ) : (
              <dl className="space-y-1.5">
                {columnas
                  .filter((c) => !c.soloTabla)
                  .map((c) => (
                    <div key={c.clave} className="flex items-start justify-between gap-3">
                      <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                        {c.titulo}
                      </dt>
                      <dd className="min-w-0 text-right text-[13px] text-slate-700">
                        {c.celda(fila)}
                      </dd>
                    </div>
                  ))}
              </dl>
            )}
          </li>
        ))}
      </ul>

      {paginado && (
        <nav
          className="flex flex-col items-center gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-between"
          aria-label="Paginación de resultados"
        >
          {/* aria-live: al cambiar de página, un lector de pantalla anuncia
              dónde está sin que haya que buscarlo. */}
          <p className="adm-num text-[12.5px] text-slate-500" aria-live="polite">
            Mostrando {desde + 1}–{Math.min(desde + porPagina, ordenados.length)} de{' '}
            {ordenados.length}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPagina(paginaActual - 1)}
              disabled={paginaActual === 1}
              aria-label="Página anterior"
              className="adm-icono disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            {paginasVisibles(paginaActual, totalPaginas).map((n, i) =>
              n === null ? (
                <span key={`salto-${i}`} className="px-1.5 text-slate-400" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPagina(n)}
                  aria-label={`Página ${n} de ${totalPaginas}`}
                  aria-current={n === paginaActual ? 'page' : undefined}
                  className={`adm-num h-9 min-w-[36px] rounded-lg px-2 text-[13px] font-semibold transition-colors ${
                    n === paginaActual
                      ? 'bg-ink-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {n}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setPagina(paginaActual + 1)}
              disabled={paginaActual === totalPaginas}
              aria-label="Página siguiente"
              className="adm-icono disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </>
  )
}

/**
 * Números de página a mostrar, con saltos (null) cuando hay muchas.
 * Con 13 páginas y estando en la 7: 1 … 6 7 8 … 13.
 */
function paginasVisibles(actual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const paginas = new Set([1, total, actual, actual - 1, actual + 1])
  const ordenadas = [...paginas].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)

  const salida: (number | null)[] = []
  let anterior = 0
  for (const n of ordenadas) {
    if (anterior && n - anterior > 1) salida.push(null)
    salida.push(n)
    anterior = n
  }
  return salida
}

/** Buscador reutilizable para las pantallas de listado. */
export function Buscador({
  valor,
  onChange,
  placeholder = 'Buscar…',
  etiqueta,
}: {
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  etiqueta: string
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta}
        className="adm-input pl-9"
      />
    </div>
  )
}
