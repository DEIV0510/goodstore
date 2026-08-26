import { CalendarClock, Copy, Images, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAvisos } from '@/components/admin/Avisos'
import { SubirUna } from '@/components/admin/Imagenes'
import { Modal, useConfirmar } from '@/components/admin/Modal'
import {
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
  Interruptor,
} from '@/components/admin/UI'
import {
  actualizarBanner,
  crearBanner,
  eliminarBanner,
  listarBanners,
  type BannerInput,
} from '@/services/contenido'
import type { Banner } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Banners de la portada.
//
// Cada tarjeta muestra el banner tal y como se verá en la tienda, no una fila
// de tabla: quien lo edita necesita ver el contraste real del texto sobre su
// imagen antes de publicarlo.
//
// Los banners son opcionales. Sin base de datos conectada la lista llega vacía
// y eso es correcto: una promoción de ejemplo sería un dato inventado.
// ─────────────────────────────────────────────────────────────────────────────

type TonoEstado = 'verde' | 'azul' | 'gris'

/**
 * El estado no se guarda: se deduce de `active` y de la ventana de fechas, que
 * es la misma regla que aplica la tienda al pedir los banners visibles.
 */
function estadoDe(b: Banner): { etiqueta: string; tono: TonoEstado } {
  const ahora = Date.now()
  if (!b.active) return { etiqueta: 'Inactivo', tono: 'gris' }
  if (b.endsAt && Date.parse(b.endsAt) < ahora) return { etiqueta: 'Caducado', tono: 'gris' }
  if (b.startsAt && Date.parse(b.startsAt) > ahora)
    return { etiqueta: 'Programado', tono: 'azul' }
  return { etiqueta: 'Activo', tono: 'verde' }
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const fechaLegible = (iso: string) => {
  const f = new Date(iso)
  return Number.isNaN(f.getTime()) ? '—' : FORMATO_FECHA.format(f)
}

function rangoLegible(b: Banner): string {
  if (b.startsAt && b.endsAt)
    return `Del ${fechaLegible(b.startsAt)} al ${fechaLegible(b.endsAt)}`
  if (b.startsAt) return `Desde el ${fechaLegible(b.startsAt)}`
  if (b.endsAt) return `Hasta el ${fechaLegible(b.endsAt)}`
  return 'Sin límite de fechas'
}

const dosDigitos = (n: number) => String(n).padStart(2, '0')

/**
 * `datetime-local` no acepta un ISO con zona horaria: hay que darle la hora
 * LOCAL recortada a minutos. Pasarle el ISO tal cual deja el campo vacío o
 * pinta la hora en UTC, cinco horas por delante de Colombia.
 */
function aCampoLocal(iso: string | null): string {
  if (!iso) return ''
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return ''
  return (
    `${f.getFullYear()}-${dosDigitos(f.getMonth() + 1)}-${dosDigitos(f.getDate())}` +
    `T${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`
  )
}

/** El camino inverso: lo que se teclea es hora local y se guarda en ISO. */
function aIso(valor: string): string | null {
  if (!valor) return null
  const f = new Date(valor)
  return Number.isNaN(f.getTime()) ? null : f.toISOString()
}

interface Borrador {
  title: string
  subtitle: string
  imageUrl: string | null
  ctaLabel: string
  ctaHref: string
  inicio: string
  fin: string
  active: boolean
}

const BORRADOR_VACIO: Borrador = {
  title: '',
  subtitle: '',
  imageUrl: null,
  ctaLabel: '',
  ctaHref: '/catalogo',
  inicio: '',
  fin: '',
  active: true,
}

const borradorDesde = (b: Banner): Borrador => ({
  title: b.title,
  subtitle: b.subtitle,
  imageUrl: b.imageUrl,
  ctaLabel: b.ctaLabel,
  ctaHref: b.ctaHref,
  inicio: aCampoLocal(b.startsAt),
  fin: aCampoLocal(b.endsAt),
  active: b.active,
})

export default function Banners() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()

  const [banners, setBanners] = useState<Banner[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<Banner | null>(null)
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO)
  const [errores, setErrores] = useState<{ title?: string; fin?: string }>({})
  const [guardando, setGuardando] = useState(false)
  /** Id del banner que se está copiando, para no crear dos copias con doble clic. */
  const [duplicando, setDuplicando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      // `todos: true` trae también los inactivos y los caducados: el panel los
      // administra, la tienda solo ve los vigentes.
      setBanners(await listarBanners({ todos: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los banners')
    } finally {
      setCargando(false)
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])

  /** Los nuevos se ponen al final para no reordenar lo que ya está publicado. */
  const siguienteOrden = () =>
    banners.reduce((mayor, b) => Math.max(mayor, b.sortOrder), -1) + 1

  function abrirNuevo() {
    setEditando(null)
    setBorrador(BORRADOR_VACIO)
    setErrores({})
    setAbierto(true)
  }

  function abrirEdicion(b: Banner) {
    setEditando(b)
    setBorrador(borradorDesde(b))
    setErrores({})
    setAbierto(true)
  }

  /**
   * Tiene que ser estable entre renders. `Modal` rearma su efecto de foco cada
   * vez que cambia `onCerrar`; con una función nueva en cada render el efecto
   * se reiniciaba en cada tecla y el foco saltaba fuera del campo que se estaba
   * escribiendo.
   */
  const cerrar = useCallback(() => {
    if (guardando) return
    setAbierto(false)
  }, [guardando])

  const cambiar = (parcial: Partial<Borrador>) =>
    setBorrador((b) => ({ ...b, ...parcial }))

  async function guardar(e: FormEvent) {
    e.preventDefault()

    const problemas: { title?: string; fin?: string } = {}
    if (!borrador.title.trim()) problemas.title = 'Escribe el título del banner.'

    const inicio = aIso(borrador.inicio)
    const fin = aIso(borrador.fin)
    if (inicio && fin && Date.parse(fin) <= Date.parse(inicio))
      problemas.fin = 'La fecha de fin debe ser posterior a la de inicio.'

    setErrores(problemas)
    if (Object.keys(problemas).length > 0) return

    const entrada: BannerInput = {
      title: borrador.title.trim(),
      subtitle: borrador.subtitle.trim(),
      imageUrl: borrador.imageUrl,
      ctaLabel: borrador.ctaLabel.trim(),
      // Un botón sin destino no lleva a ninguna parte; el catálogo es el
      // destino sensato por omisión.
      ctaHref: borrador.ctaHref.trim() || '/catalogo',
      startsAt: inicio,
      endsAt: fin,
      active: borrador.active,
      sortOrder: editando ? editando.sortOrder : siguienteOrden(),
    }

    setGuardando(true)
    try {
      if (editando) {
        const actualizado = await actualizarBanner(editando.id, entrada)
        setBanners((lista) => lista.map((b) => (b.id === actualizado.id ? actualizado : b)))
        avisos.exito('Banner actualizado.')
      } else {
        const creado = await crearBanner(entrada)
        setBanners((lista) => [...lista, creado])
        avisos.exito('Banner creado.')
      }
      setAbierto(false)
    } catch (err) {
      // Sin base de datos esto lanza a propósito: el aviso lo explica.
      avisos.error(err)
    } finally {
      setGuardando(false)
    }
  }

  /**
   * No hay `duplicarBanner` en el servicio, así que la copia se arma aquí.
   * Se crea SIEMPRE inactiva: duplicar es preparar algo, no publicar dos
   * promociones iguales en la portada.
   */
  async function duplicar(b: Banner) {
    // Sin este cierre, dos clics seguidos crean dos copias y ambas calculan el
    // mismo `sortOrder` a partir de la lista todavía sin actualizar.
    if (duplicando) return
    setDuplicando(b.id)
    try {
      const copia = await crearBanner({
        title: `${b.title} (copia)`,
        subtitle: b.subtitle,
        imageUrl: b.imageUrl,
        ctaLabel: b.ctaLabel,
        ctaHref: b.ctaHref,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        active: false,
        sortOrder: siguienteOrden(),
      })
      setBanners((lista) => [...lista, copia])
      avisos.exito('Banner duplicado. La copia queda inactiva hasta que la revises.')
    } catch (err) {
      avisos.error(err)
    } finally {
      setDuplicando(null)
    }
  }

  async function borrar(b: Banner) {
    const seguro = await confirmar({
      titulo: 'Eliminar banner',
      mensaje: `Se eliminará «${b.title}». Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar banner',
      peligroso: true,
    })
    if (!seguro) return

    try {
      await eliminarBanner(b.id)
      setBanners((lista) => lista.filter((x) => x.id !== b.id))
      avisos.exito('Banner eliminado.')
    } catch (err) {
      avisos.error(err)
    }
  }

  if (cargando) return <Cargando texto="Cargando banners…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  return (
    <>
      <Encabezado titulo="Banners" descripcion="Franjas promocionales de la portada.">
        <button type="button" onClick={abrirNuevo} className="adm-btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Crear banner
        </button>
      </Encabezado>

      {banners.length === 0 ? (
        <div className="adm-card">
          <EstadoVacio
            icono={Images}
            titulo="Aún no has creado ningún banner"
            descripcion="Los banners son opcionales: si no hay ninguno activo, la portada simplemente no muestra esa franja."
          >
            <button type="button" onClick={abrirNuevo} className="adm-btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Crear banner
            </button>
          </EstadoVacio>
        </div>
      ) : (
        <ul className="space-y-4">
          {banners.map((b) => {
            const estado = estadoDe(b)
            return (
              <li key={b.id} className="adm-card overflow-hidden">
                {/* Vista previa: reproduce los colores de la tienda para poder
                    juzgar el contraste del texto sobre la imagen real. */}
                <div className="relative bg-ink-900">
                  {b.imageUrl && (
                    <img
                      src={b.imageUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div
                    className="absolute inset-0 bg-[linear-gradient(100deg,rgba(7,12,66,.95)_0%,rgba(7,12,66,.78)_48%,rgba(7,12,66,.42)_100%)]"
                    aria-hidden="true"
                  />
                  <div className="relative flex min-h-[172px] flex-col justify-center gap-3.5 px-5 py-6 sm:min-h-[196px] sm:px-8">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-black leading-tight text-white sm:text-2xl">
                        {b.title}
                      </p>
                      {b.subtitle && (
                        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-white/75 sm:text-[14.5px]">
                          {b.subtitle}
                        </p>
                      )}
                    </div>
                    {b.ctaLabel && (
                      /* Es un dibujo del botón, no un botón: no debe recibir
                         foco ni navegar desde el panel. */
                      <span className="inline-flex w-fit items-center rounded-lg bg-gold-500 px-4 py-2.5 font-display text-[12.5px] font-black uppercase tracking-wide text-ink-900">
                        {b.ctaLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Etiqueta tono={estado.tono}>{estado.etiqueta}</Etiqueta>
                      {!b.imageUrl && <Etiqueta tono="gris">Sin imagen</Etiqueta>}
                      {b.ctaLabel && <Etiqueta tono="azul">Enlace: {b.ctaHref}</Etiqueta>}
                    </div>
                    <p className="adm-num mt-2 flex items-start gap-1.5 text-[12.5px] text-slate-500">
                      <CalendarClock
                        className="mt-px h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {rangoLegible(b)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEdicion(b)}
                      className="adm-btn-suave"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void duplicar(b)}
                      disabled={duplicando !== null}
                      className="adm-btn-suave disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => void borrar(b)}
                      className="adm-btn-fantasma text-alert-600 hover:bg-red-50 hover:text-alert-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        abierto={abierto}
        onCerrar={cerrar}
        titulo={editando ? 'Editar banner' : 'Crear banner'}
        descripcion="La franja aparece bajo el encabezado de la portada."
        ancho="lg"
        pie={
          <>
            <button
              type="button"
              onClick={cerrar}
              disabled={guardando}
              className="adm-btn-suave"
            >
              Cancelar
            </button>
            {/* El botón vive en el pie, fuera del <form>: `form` lo reconecta. */}
            <BotonGuardar form="form-banner" guardando={guardando}>
              {editando ? 'Guardar cambios' : 'Crear banner'}
            </BotonGuardar>
          </>
        }
      >
        <form id="form-banner" onSubmit={guardar} className="space-y-4" noValidate>
          <Entrada
            label="Título"
            requerido
            value={borrador.title}
            onChange={(e) => cambiar({ title: e.target.value })}
            error={errores.title}
            placeholder="Envío gratis en compras superiores a $200.000"
            maxLength={80}
          />

          <Entrada
            label="Subtítulo"
            value={borrador.subtitle}
            onChange={(e) => cambiar({ subtitle: e.target.value })}
            ayuda="Opcional. Una línea corta que amplíe el título."
            placeholder="Solo por este mes en toda Colombia"
            maxLength={140}
          />

          <SubirUna
            url={borrador.imageUrl}
            onChange={(url) => cambiar({ imageUrl: url })}
            carpeta="banners"
            label="Imagen de fondo"
            proporcion="aspect-[21/9]"
            ayuda="Opcional. Si no subes ninguna, la franja usa el azul de la marca. El texto va encima, así que evita imágenes con letras."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada
              label="Etiqueta del botón"
              value={borrador.ctaLabel}
              onChange={(e) => cambiar({ ctaLabel: e.target.value })}
              ayuda="Déjala vacía para que la franja no muestre botón."
              placeholder="Ver catálogo"
              maxLength={30}
            />
            <Entrada
              label="Enlace del botón"
              value={borrador.ctaHref}
              onChange={(e) => cambiar({ ctaHref: e.target.value })}
              ayuda="Ruta de la tienda (/catalogo) o dirección completa."
              placeholder="/catalogo"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada
              label="Fecha de inicio"
              type="datetime-local"
              value={borrador.inicio}
              onChange={(e) => cambiar({ inicio: e.target.value })}
              ayuda="Déjalas vacías para que el banner esté siempre visible mientras esté activo."
            />
            <Entrada
              label="Fecha de fin"
              type="datetime-local"
              value={borrador.fin}
              onChange={(e) => cambiar({ fin: e.target.value })}
              error={errores.fin}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <Interruptor
              activo={borrador.active}
              onChange={(v) => cambiar({ active: v })}
              label="Activo"
              descripcion="Un banner inactivo se guarda pero no se publica en la portada."
            />
          </div>
        </form>
      </Modal>
    </>
  )
}
