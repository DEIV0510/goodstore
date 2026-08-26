import {
  AlertCircle,
  ArrowRight,
  LogIn,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Cargando,
  Encabezado,
  ErrorEstado,
  EstadoVacio,
  Selector,
} from '@/components/admin/UI'
import { pluralize } from '@/lib/format'
import { ETIQUETA_CAMPO, ETIQUETA_ENTIDAD, describirEntrada, listarHistorial } from '@/services/equipo'
import type { AuditEntry } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Historial de cambios.
//
// Esta pantalla no calcula nada: solo muestra lo que la base de datos ya grabó
// por su cuenta (disparadores de 0003_auditoria.sql). Por eso no se puede
// editar ni borrar una línea desde aquí — un registro que se puede retocar no
// sirve para averiguar quién tocó qué.
//
// El filtro por tipo de elemento se manda al servidor, no se aplica en el
// navegador: si se filtrara aquí, buscar «pedido» solo miraría dentro de los
// últimos movimientos ya descargados y parecería que no hay ninguno.
// El de acción sí se aplica aquí, porque el servicio no lo admite.
// ─────────────────────────────────────────────────────────────────────────────

type Accion = AuditEntry['action']

/** Cuántos movimientos se piden de una vez; «Ver más» sube de tramo en tramo. */
const TRAMO = 100

const ESTILO_ACCION: Record<Accion, { punto: string; icono: LucideIcon }> = {
  crear: { punto: 'border-emerald-200 bg-emerald-50 text-emerald-600', icono: Plus },
  actualizar: { punto: 'border-blue-200 bg-blue-50 text-blue-600', icono: Pencil },
  eliminar: { punto: 'border-red-200 bg-red-50 text-alert-600', icono: Trash2 },
  acceso: { punto: 'border-slate-200 bg-slate-100 text-slate-500', icono: LogIn },
}

const OPCIONES_ACCION: { valor: string; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todas las acciones' },
  { valor: 'crear', etiqueta: 'Creaciones' },
  { valor: 'actualizar', etiqueta: 'Cambios' },
  { valor: 'eliminar', etiqueta: 'Eliminaciones' },
  { valor: 'acceso', etiqueta: 'Accesos' },
]

const OPCIONES_ENTIDAD: { valor: string; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todos los elementos' },
  ...Object.entries(ETIQUETA_ENTIDAD).map(([clave, nombre]) => ({
    valor: clave,
    etiqueta: nombre.charAt(0).toUpperCase() + nombre.slice(1),
  })),
]

/** Fecha completa para el `title`: es el dato exacto detrás del «hace un rato». */
function fechaExacta(iso: string): string {
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return ''
  return f.toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })
}

/**
 * «hace 5 minutos», «ayer», o la fecha completa si ya es vieja.
 *
 * Los días se cuentan por calendario y no por múltiplos de 24 horas: algo de
 * anoche a las 11 pasó «ayer» aunque hayan transcurrido menos de un día.
 */
function fechaRelativa(iso: string): string {
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return 'fecha desconocida'

  const segundos = (Date.now() - f.getTime()) / 1000
  // Un reloj adelantado en el navegador daría diferencias negativas.
  if (segundos < 60) return 'hace un momento'

  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `hace ${pluralize(minutos, 'minuto', 'minutos')}`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${pluralize(horas, 'hora', 'horas')}`

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dia = new Date(f)
  dia.setHours(0, 0, 0, 0)
  const dias = Math.round((hoy.getTime() - dia.getTime()) / 86_400_000)

  if (dias <= 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`

  return f.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Más allá de esto el valor se corta: una descripción entera rompe la lista. */
const LARGO_MAXIMO = 120

const recortar = (t: string) => (t.length > LARGO_MAXIMO ? `${t.slice(0, LARGO_MAXIMO)}…` : t)

/** Traduce a algo legible el valor crudo que guardó la auditoría. */
function mostrarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '(vacío)'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (typeof valor === 'number') return new Intl.NumberFormat('es-CO').format(valor)
  if (Array.isArray(valor)) {
    if (valor.length === 0) return '(vacío)'
    return recortar(valor.map((v) => String(v)).join(', '))
  }
  if (typeof valor === 'object') return recortar(JSON.stringify(valor))
  return recortar(String(valor))
}

export default function Historial() {
  const [entradas, setEntradas] = useState<AuditEntry[]>([])
  // `cargando` solo cubre la primera visita; los cambios de filtro no vacían la
  // pantalla, se marcan con `aria-busy` sobre la lista que ya está puesta.
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [entidad, setEntidad] = useState('')
  const [accion, setAccion] = useState('')
  const [limite, setLimite] = useState(TRAMO)

  // Cada consulta se numera. Cambiar de filtro dispara otra sin esperar a la
  // anterior, y la vieja puede llegar después: sin este número, la respuesta
  // atrasada pisaría la lista del filtro que está puesto ahora.
  const peticion = useRef(0)

  const cargar = useCallback(async () => {
    const mia = ++peticion.current
    setRefrescando(true)
    setError(null)
    try {
      const datos = await listarHistorial({ limite, entidad: entidad || undefined })
      if (peticion.current !== mia) return
      setEntradas(datos)
    } catch (e) {
      if (peticion.current !== mia) return
      setError(e instanceof Error ? e.message : 'No se pudo cargar el historial')
    } finally {
      if (peticion.current === mia) {
        setRefrescando(false)
        setCargando(false)
      }
    }
  }, [entidad, limite])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(
    () => (accion ? entradas.filter((e) => e.action === accion) : entradas),
    [entradas, accion]
  )

  const hayFiltro = entidad !== '' || accion !== ''

  /** El servidor devolvió justo el tope pedido: es probable que haya más. */
  const puedeVerMas = entradas.length >= limite

  // El filtro de acción se aplica aquí, sobre lo ya descargado, así que puede
  // dejar la lista vacía aunque el servidor tenga más movimientos. Por eso este
  // botón también aparece en el estado vacío: si solo estuviera bajo la lista,
  // filtrar por «Eliminaciones» sin ninguna en el primer tramo dejaría a la
  // persona encerrada, sin forma de seguir buscando hacia atrás.
  const botonVerMas = puedeVerMas ? (
    <button
      type="button"
      onClick={() => setLimite((l) => l + TRAMO)}
      disabled={refrescando}
      className="adm-btn-suave adm-btn-sm"
    >
      {refrescando ? 'Cargando…' : 'Ver movimientos más antiguos'}
    </button>
  ) : null

  if (cargando) return <Cargando texto="Cargando historial…" />
  // La pantalla entera solo se cede al error cuando no hay nada que enseñar. Si
  // ya hay movimientos en pantalla y lo que falla es un cambio de filtro o un
  // «ver más», borrarlos para poner un recuadro rojo se lleva por delante lo que
  // la persona estaba leyendo; en ese caso el aviso va encima de la lista.
  if (error && entradas.length === 0) {
    return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />
  }

  return (
    <>
      <Encabezado
        titulo="Historial"
        descripcion="Todo lo que se cambia en el panel queda registrado aquí."
      />

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-alert-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold leading-relaxed text-red-900">
              No se pudieron traer los movimientos: {error}
            </p>
            <p className="text-[12.5px] leading-relaxed text-red-700">
              Abajo sigue lo último que se cargó bien.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={refrescando}
            className="adm-btn-suave adm-btn-sm"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <section className="adm-card-pad">
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <Selector
            id="filtro-entidad"
            label="Tipo de elemento"
            value={entidad}
            opciones={OPCIONES_ENTIDAD}
            onChange={(e) => {
              setEntidad(e.target.value)
              // Cambiar de filtro empieza de cero: arrastrar un tope alto de la
              // consulta anterior descargaría de más sin que nadie lo pidiera.
              setLimite(TRAMO)
            }}
          />
          <Selector
            id="filtro-accion"
            label="Acción"
            value={accion}
            opciones={OPCIONES_ACCION}
            onChange={(e) => setAccion(e.target.value)}
          />
        </div>

        <p className="mt-3 text-[12.5px] text-slate-500" aria-live="polite">
          {pluralize(visibles.length, 'movimiento', 'movimientos')}
          {hayFiltro && ' con estos filtros'}
        </p>
      </section>

      {/* ── Línea de tiempo ─────────────────────────────────────────────────── */}
      <div className="adm-card mt-4" aria-busy={refrescando}>
        {visibles.length === 0 ? (
          <EstadoVacio
            icono={ScrollText}
            titulo={hayFiltro ? 'Nada con esos filtros' : 'Todavía no hay movimientos'}
            descripcion={
              !hayFiltro
                ? 'Aquí van apareciendo, uno debajo de otro, todos los cambios que se hagan desde el panel: quién los hizo y cuándo.'
                : puedeVerMas
                  ? 'Ninguno de los movimientos cargados coincide, pero quedan más atrás: cárgalos con el botón de abajo, prueba con otro tipo de elemento o quita los filtros.'
                  : 'Prueba con otro tipo de elemento o quita el filtro de acción para ver todo el historial.'
            }
          >
            {hayFiltro && (
              <button
                type="button"
                onClick={() => {
                  setEntidad('')
                  setAccion('')
                  setLimite(TRAMO)
                }}
                className="adm-btn-suave adm-btn-sm"
              >
                Quitar los filtros
              </button>
            )}
            {botonVerMas}
          </EstadoVacio>
        ) : (
          <>
            <ol className="p-4 sm:p-5">
              {visibles.map((e, i) => {
                const estilo = ESTILO_ACCION[e.action]
                const Icono = estilo.icono
                // `?? {}` por si la fila viniera sin detalle: el tipo lo da por
                // seguro, pero la columna de la base admite nulo.
                const cambios: [string, { antes: unknown; ahora: unknown }][] =
                  Object.entries(e.detail ?? {})
                const ultimo = i === visibles.length - 1

                return (
                  <li key={e.id} className="flex gap-3">
                    {/* Punto y línea vertical: la línea no se dibuja bajo el
                        último, si no quedaría colgando en el vacío. */}
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${estilo.punto}`}
                      >
                        <Icono className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      {!ultimo && (
                        <span className="mt-1 w-px flex-1 bg-slate-200" aria-hidden="true" />
                      )}
                    </div>

                    <div className={`min-w-0 flex-1 ${ultimo ? '' : 'pb-5'}`}>
                      <p className="text-[13.5px] leading-relaxed text-slate-600">
                        <strong className="font-semibold text-slate-900">
                          {e.actorName || 'Alguien'}
                        </strong>{' '}
                        {describirEntrada(e)}
                      </p>

                      <time
                        dateTime={e.createdAt}
                        title={fechaExacta(e.createdAt)}
                        className="adm-num mt-0.5 block text-[12px] text-slate-400"
                      >
                        {fechaRelativa(e.createdAt)}
                      </time>

                      {e.action === 'actualizar' && cambios.length > 0 && (
                        <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50">
                          <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-[12.5px] font-semibold text-slate-600 hover:text-slate-900">
                            Ver los cambios ({cambios.length})
                          </summary>
                          <ul className="space-y-2.5 border-t border-slate-200 px-3 py-2.5">
                            {cambios.map(([campo, valores]) => (
                              <li key={campo}>
                                <p className="text-[12px] font-semibold text-slate-700">
                                  {ETIQUETA_CAMPO[campo] ?? campo}
                                </p>
                                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
                                  {/* El tachado, no el color, es lo que dice
                                      cuál de los dos valores es el viejo. */}
                                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through decoration-red-300">
                                    <span className="sr-only">Antes: </span>
                                    {mostrarValor(valores.antes)}
                                  </span>
                                  <ArrowRight
                                    className="h-3 w-3 shrink-0 text-slate-400"
                                    aria-hidden="true"
                                  />
                                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                                    <span className="sr-only">Ahora: </span>
                                    {mostrarValor(valores.ahora)}
                                  </span>
                                </p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>

            {botonVerMas && (
              <div className="border-t border-slate-200 p-4 text-center">{botonVerMas}</div>
            )}
          </>
        )}
      </div>
    </>
  )
}
