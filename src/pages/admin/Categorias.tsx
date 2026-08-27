import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock3,
  FolderTree,
  ImageOff,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  AreaTexto,
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
  Interruptor,
} from '@/components/admin/UI'
import { Modal, useConfirmar } from '@/components/admin/Modal'
import { useAvisos } from '@/components/admin/Avisos'
import { SubirUna } from '@/components/admin/Imagenes'
import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
  listarCategorias,
  reordenarCategorias,
  type CategoriaInput,
} from '@/services/catalogo'
import { puedeBorrar } from '@/services/autenticacion'
import { useAuth } from '@/hooks/useAuth'
import { coverBySlug } from '@/data/covers'
import { normalize, pluralize } from '@/lib/format'
import type { CategoryCard } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Categorías navegables.
//
// Son las tarjetas de "Explora por categoría" de la portada: atajos hacia una
// parte del catálogo. NO son el tipo de producto (videojuegos / consolas /
// accesorios), que se elige en la ficha de cada producto. Confundir ambas cosas
// es el error habitual, así que la pantalla lo aclara desde el encabezado.
//
// El orden de esta lista es el orden en que se ven en la portada, y por eso se
// cambia con flechas y se guarda de inmediato.
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que el formulario mantiene mientras se edita. */
interface Borrador {
  title: string
  slug: string
  subtitle: string
  description: string
  href: string
  imageUrl: string | null
  /** Texto separado por comas; se parte a lista solo al guardar. */
  coverSlugs: string
  active: boolean
  soon: boolean
}

const BORRADOR_VACIO: Borrador = {
  title: '',
  slug: '',
  subtitle: '',
  description: '',
  href: '',
  imageUrl: null,
  coverSlugs: '',
  active: true,
  soon: false,
}

const FORMA_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** "Nintendo Switch 2" → "nintendo-switch-2". */
function aSlug(texto: string): string {
  return normalize(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Texto con comas → lista de slugs limpia y sin repetidos. */
function partirSlugs(texto: string): string[] {
  const lista = texto
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(lista)]
}

/** Identificador estable de cada flecha, para devolverle el foco tras mover. */
const idFlecha = (id: string, direccion: -1 | 1) =>
  `cat-${id}-${direccion === -1 ? 'subir' : 'bajar'}`

export default function Categorias() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()
  const { perfil, apiViva } = useAuth()
  const puedeEliminar = puedeBorrar(perfil?.role)

  const [categorias, setCategorias] = useState<CategoryCard[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<CategoryCard | null>(null)
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [reordenando, setReordenando] = useState(false)

  /**
   * En alta el slug se deriva del título hasta que alguien lo escribe a mano;
   * a partir de ahí se respeta. En edición nunca se regenera solo: el slug ya
   * puede estar en enlaces publicados.
   */
  const [slugManual, setSlugManual] = useState(false)

  // Al reordenar, la tarjeta cambia de sitio en el DOM y el foco se pierde.
  // Se guarda a qué botón hay que devolverlo una vez repintada la lista.
  const focoPendiente = useRef<string | null>(null)

  // El modal vuelve a montar su trampa de foco cada vez que `onCerrar` cambia
  // de identidad. Si `cerrar` se redefiniera en cada render, el foco saltaría
  // solo al escribir en el formulario, así que se consulta el estado de
  // guardado por referencia y la función se queda fija.
  const guardandoRef = useRef(false)
  useEffect(() => {
    guardandoRef.current = guardando
  }, [guardando])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      // El panel administra también las ocultas; la portada solo verá las activas.
      setCategorias(await listarCategorias({ incluirInactivas: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las categorías')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    // Mientras se guarda el nuevo orden las flechas están desactivadas, y un
    // botón desactivado no admite foco: se espera a que vuelvan a estarlo.
    if (reordenando || !focoPendiente.current) return
    const destino = document.getElementById(focoPendiente.current)
    focoPendiente.current = null
    destino?.focus()
  }, [categorias, reordenando])

  // Slugs de portada resueltos en vivo, para no descubrir una errata en la web.
  // `coverBySlug` es la MISMA función que usa la tienda: lo que aquí no aparece
  // tampoco se dibujará en la portada.
  const portadasElegidas = useMemo(
    () => partirSlugs(borrador.coverSlugs).map((slug) => ({ slug, url: coverBySlug(slug) })),
    [borrador.coverSlugs]
  )
  const portadasPerdidas = portadasElegidas.filter((p) => p.url === null)

  const activas = categorias.filter((c) => c.active).length

  // ── Alta y edición ─────────────────────────────────────────────────────────

  function abrirNueva() {
    setEditando(null)
    setBorrador(BORRADOR_VACIO)
    setSlugManual(false)
    setErrores({})
    setAbierto(true)
  }

  function abrirEdicion(c: CategoryCard) {
    setEditando(c)
    setBorrador({
      title: c.title,
      slug: c.slug,
      subtitle: c.subtitle,
      description: c.description,
      href: c.href,
      imageUrl: c.imageUrl,
      coverSlugs: c.coverSlugs.join(', '),
      active: c.active,
      soon: c.soon,
    })
    setSlugManual(true)
    setErrores({})
    setAbierto(true)
  }

  const cerrar = useCallback(() => {
    if (guardandoRef.current) return
    setAbierto(false)
  }, [])

  /** Un error que sigue ahí después de corregir el campo desinforma. */
  function limpiarError(campo: keyof Borrador) {
    setErrores((e) => (e[campo] ? { ...e, [campo]: '' } : e))
  }

  function validar(b: Borrador): Record<string, string> {
    const fallos: Record<string, string> = {}

    if (!b.title.trim()) fallos.title = 'Escribe el título que se verá en la tarjeta.'

    const slug = b.slug.trim()
    if (!slug) {
      fallos.slug = 'El slug identifica la categoría; no puede quedar vacío.'
    } else if (!FORMA_SLUG.test(slug)) {
      fallos.slug = 'Solo minúsculas, números y guiones. Ejemplo: nintendo-switch'
    } else if (categorias.some((c) => c.slug === slug && c.id !== editando?.id)) {
      // Se avisa aquí para no depender del choque de clave única de la base.
      fallos.slug = 'Ya hay otra categoría con ese slug.'
    }

    // Una tarjeta que no lleva a ninguna parte no sirve de nada en la portada.
    const href = b.href.trim()
    if (!href) {
      fallos.href = 'Indica a dónde lleva la tarjeta.'
    } else if (!href.startsWith('/') && !/^https?:\/\//i.test(href)) {
      fallos.href =
        'Empieza por «/» para una ruta de la tienda, o por https:// si es un enlace externo.'
    }

    return fallos
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    const fallos = validar(borrador)
    setErrores(fallos)
    if (Object.keys(fallos).length > 0) return

    const entrada: CategoriaInput = {
      slug: borrador.slug.trim(),
      title: borrador.title.trim(),
      subtitle: borrador.subtitle.trim(),
      description: borrador.description.trim(),
      href: borrador.href.trim(),
      imageUrl: borrador.imageUrl,
      coverSlugs: portadasElegidas.map((p) => p.slug),
      // Al crear se va al final: cambiar el orden es una decisión aparte.
      sortOrder: editando ? editando.sortOrder : categorias.length,
      active: borrador.active,
      soon: borrador.soon,
    }

    setGuardando(true)
    try {
      if (editando) {
        const actualizada = await actualizarCategoria(editando.id, entrada)
        setCategorias((lista) =>
          lista.map((c) => (c.id === actualizada.id ? actualizada : c))
        )
        avisos.exito(`Categoría «${actualizada.title}» actualizada.`)
      } else {
        const creada = await crearCategoria(entrada)
        setCategorias((lista) => [...lista, creada])
        avisos.exito(`Categoría «${creada.title}» creada.`)
      }
      setAbierto(false)
    } catch (e) {
      // Sin base de datos conectada esto falla a propósito; el aviso lo explica.
      avisos.error(e)
    } finally {
      setGuardando(false)
    }
  }

  // ── Orden ──────────────────────────────────────────────────────────────────

  async function mover(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion
    if (destino < 0 || destino >= categorias.length) return

    const anterior = categorias
    const copia = [...categorias]
    const [movida] = copia.splice(indice, 1)
    copia.splice(destino, 0, movida)
    // El sortOrder local se recalcula para que coincida con lo que se envía.
    const reordenadas = copia.map((c, i) => ({ ...c, sortOrder: i }))

    // Si la tarjeta queda en un extremo su flecha se desactiva, así que el foco
    // pasa a la flecha contraria en lugar de caerse al principio de la página.
    const enExtremo =
      (direccion === -1 && destino === 0) ||
      (direccion === 1 && destino === reordenadas.length - 1)
    focoPendiente.current = idFlecha(
      movida.id,
      enExtremo ? ((direccion * -1) as -1 | 1) : direccion
    )

    setCategorias(reordenadas)
    setReordenando(true)
    try {
      await reordenarCategorias(reordenadas.map((c) => c.id))
    } catch (e) {
      // Si el guardado falla se vuelve al orden real: la pantalla no puede
      // mostrar una posición que la portada no tiene.
      setCategorias(anterior)
      avisos.error(e)
    } finally {
      setReordenando(false)
    }
  }

  // ── Baja ───────────────────────────────────────────────────────────────────

  async function borrar(c: CategoryCard) {
    const seguro = await confirmar({
      titulo: `Eliminar «${c.title}»`,
      mensaje:
        `La tarjeta «${c.title}» desaparecerá de "Explora por categoría" en la portada. ` +
        'Los productos no se borran: siguen en el catálogo y se pueden encontrar por los filtros. ' +
        'Si solo quieres esconderla un tiempo, apaga el interruptor «Activa» y edítala.',
      confirmar: 'Eliminar categoría',
      peligroso: true,
    })
    if (!seguro) return

    try {
      await eliminarCategoria(c.id)
      setCategorias((lista) => lista.filter((x) => x.id !== c.id))
      avisos.exito(`Categoría «${c.title}» eliminada.`)
    } catch (e) {
      avisos.error(e)
    }
  }

  // ── Pintado ────────────────────────────────────────────────────────────────

  if (cargando) return <Cargando texto="Cargando categorías…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  return (
    <>
      <Encabezado
        titulo="Categorías"
        descripcion={
          'Son las tarjetas de «Explora por categoría» de la portada: cada una es un atajo hacia ' +
          'una parte del catálogo. No son el tipo de producto (videojuegos, consolas, accesorios), ' +
          'que se elige dentro de la ficha de cada producto.'
        }
      >
        <button type="button" onClick={abrirNueva} className="adm-btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar categoría
        </button>
      </Encabezado>

      {!apiViva && (
        <div className="adm-card mb-4 flex items-start gap-3 border-amber-200 bg-amber-50 p-3.5">
          <AlertTriangle
            className="mt-px h-[18px] w-[18px] shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <p className="text-[13px] leading-relaxed text-amber-800">
            Estas son las categorías que vienen con la tienda. Sin base de datos conectada se
            pueden consultar, pero cualquier cambio fallará al guardar.
          </p>
        </div>
      )}

      {categorias.length === 0 ? (
        <div className="adm-card">
          <EstadoVacio
            icono={FolderTree}
            titulo="Todavía no hay categorías"
            descripcion="Sin tarjetas, la sección «Explora por categoría» no aparece en la portada. Crea la primera para guiar a quien entra."
          >
            <button type="button" onClick={abrirNueva} className="adm-btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Agregar categoría
            </button>
          </EstadoVacio>
        </div>
      ) : (
        <>
          <p className="adm-sub mb-3">
            {pluralize(categorias.length, 'categoría', 'categorías')} ·{' '}
            {activas === categorias.length
              ? 'todas visibles en la portada'
              : `${activas} visibles en la portada`}
            . Se muestran en este mismo orden.
          </p>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categorias.map((c, i) => (
              <li key={c.id} className="adm-card flex flex-col overflow-hidden">
                <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                  <Portada categoria={c} />
                  <span className="absolute left-2 top-2 grid h-6 min-w-[24px] place-items-center rounded-md bg-white/95 px-1.5 text-[11.5px] font-bold text-slate-600 shadow-sm">
                    {/* Un número suelto no dice nada a quien no ve la rejilla. */}
                    <span className="sr-only">
                      Posición {i + 1} de {categorias.length}
                    </span>
                    <span className="adm-num" aria-hidden="true">
                      {i + 1}
                    </span>
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Etiqueta tono={c.active ? 'verde' : 'gris'}>
                      {c.active ? 'Activa' : 'Oculta'}
                    </Etiqueta>
                    {c.soon && (
                      <Etiqueta tono="ambar">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        Próximamente
                      </Etiqueta>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="adm-titulo text-[15px] leading-snug">{c.title}</h2>
                    {c.subtitle && <p className="adm-sub mt-0.5 line-clamp-2">{c.subtitle}</p>}
                  </div>

                  <p className="mt-auto flex items-center gap-1.5 pt-1 text-[12.5px] text-slate-500">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="sr-only">Lleva a</span>
                    <span className="truncate">{c.href}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1 border-t border-slate-200 bg-slate-50/70 px-2.5 py-2">
                  <button type="button" onClick={() => abrirEdicion(c)} className="adm-btn-suave">
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Editar
                  </button>

                  <span className="flex-1" />

                  {/* Botones de solo icono: 44 px en táctil, 40 en escritorio, para
                      igualar la altura del botón «Editar» de al lado. */}
                  <button
                    type="button"
                    id={idFlecha(c.id, -1)}
                    onClick={() => void mover(i, -1)}
                    disabled={i === 0 || reordenando}
                    aria-label={`Subir «${c.title}» una posición`}
                    className="adm-icono h-11 w-11 disabled:pointer-events-none disabled:opacity-30 sm:h-10 sm:w-10"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    id={idFlecha(c.id, 1)}
                    onClick={() => void mover(i, 1)}
                    disabled={i === categorias.length - 1 || reordenando}
                    aria-label={`Bajar «${c.title}» una posición`}
                    className="adm-icono h-11 w-11 disabled:pointer-events-none disabled:opacity-30 sm:h-10 sm:w-10"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>

                  {/* Solo se ofrece a quien puede borrar; la base lo vuelve a comprobar. */}
                  {puedeEliminar && (
                    <button
                      type="button"
                      onClick={() => void borrar(c)}
                      aria-label={`Eliminar la categoría «${c.title}»`}
                      className="adm-icono h-11 w-11 hover:bg-red-50 hover:text-alert-600 sm:h-10 sm:w-10"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        abierto={abierto}
        onCerrar={cerrar}
        ancho="lg"
        titulo={editando ? `Editar «${editando.title}»` : 'Agregar categoría'}
        descripcion="Así se verá la tarjeta en la sección «Explora por categoría» de la portada."
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
            {/* Vive en el pie del modal, fuera del <form>: `form` lo conecta igual. */}
            <BotonGuardar form="form-categoria" guardando={guardando}>
              {editando ? 'Guardar cambios' : 'Crear categoría'}
            </BotonGuardar>
          </>
        }
      >
        <form id="form-categoria" onSubmit={(e) => void guardar(e)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada
              label="Título"
              requerido
              value={borrador.title}
              error={errores.title}
              placeholder="PlayStation 5"
              onChange={(e) => {
                const title = e.target.value
                limpiarError('title')
                setBorrador((b) => ({
                  ...b,
                  title,
                  slug: slugManual ? b.slug : aSlug(title),
                }))
              }}
            />
            <Entrada
              label="Slug"
              requerido
              value={borrador.slug}
              error={errores.slug}
              placeholder="playstation-5"
              ayuda={
                editando
                  ? 'Identifica la categoría. Cámbialo solo si es necesario.'
                  : 'Se genera solo desde el título. Puedes escribirlo a mano.'
              }
              onChange={(e) => {
                setSlugManual(true)
                limpiarError('slug')
                setBorrador((b) => ({ ...b, slug: e.target.value }))
              }}
            />
          </div>

          <Entrada
            label="Subtítulo"
            value={borrador.subtitle}
            placeholder="Los lanzamientos más recientes"
            ayuda="Una línea corta bajo el título de la tarjeta."
            onChange={(e) => setBorrador((b) => ({ ...b, subtitle: e.target.value }))}
          />

          <AreaTexto
            label="Descripción"
            value={borrador.description}
            placeholder="Para qué sirve esta categoría."
            ayuda="Texto interno de apoyo. No se muestra en la tarjeta de la portada."
            onChange={(e) => setBorrador((b) => ({ ...b, description: e.target.value }))}
          />

          <Entrada
            label="Enlace"
            requerido
            value={borrador.href}
            error={errores.href}
            placeholder="/catalogo?plataforma=ps5"
            ayuda="A dónde lleva la tarjeta. Ej: /catalogo?plataforma=ps5"
            onChange={(e) => {
              limpiarError('href')
              setBorrador((b) => ({ ...b, href: e.target.value }))
            }}
          />

          <SubirUna
            url={borrador.imageUrl}
            onChange={(imageUrl) => setBorrador((b) => ({ ...b, imageUrl }))}
            carpeta="categorias"
            label="Imagen de la categoría"
            proporcion="aspect-[16/9]"
            ayuda="Opcional. Si no pones ninguna, se usan portadas reales de productos."
          />

          <div>
            <Entrada
              label="Portadas por slug"
              value={borrador.coverSlugs}
              placeholder="elden-ring-ps5, god-of-war-ragnarok-ps5"
              ayuda="Slugs de productos separados por comas"
              onChange={(e) => setBorrador((b) => ({ ...b, coverSlugs: e.target.value }))}
            />

            {portadasElegidas.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {portadasElegidas.map((p) =>
                  p.url ? (
                    <li
                      key={p.slug}
                      className="w-14 overflow-hidden rounded-md border border-slate-200 bg-white"
                    >
                      <img
                        src={p.url}
                        alt={`Portada de ${p.slug}`}
                        loading="lazy"
                        className="aspect-[3/4] w-full object-cover"
                      />
                    </li>
                  ) : (
                    <li
                      key={p.slug}
                      className="grid aspect-[3/4] w-14 place-items-center rounded-md border border-dashed border-amber-300 bg-amber-50 px-1 text-center text-[10px] font-semibold leading-tight text-amber-700"
                    >
                      Sin portada
                    </li>
                  )
                )}
              </ul>
            )}

            {portadasPerdidas.length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-amber-700">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  No hay ningún producto con {portadasPerdidas.length === 1 ? 'el slug' : 'los slugs'}{' '}
                  {portadasPerdidas.map((p) => `«${p.slug}»`).join(', ')}. Se guardan igual, pero
                  la portada no dibujará esa carátula hasta que el slug coincida con el del
                  producto.
                </span>
              </p>
            )}
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
            <Interruptor
              activo={borrador.active}
              onChange={(active) => setBorrador((b) => ({ ...b, active }))}
              label="Activa"
              descripcion="Apagada, la tarjeta deja de verse en la portada sin borrarse."
            />
            <Interruptor
              activo={borrador.soon}
              onChange={(soon) => setBorrador((b) => ({ ...b, soon }))}
              label="Próximamente"
              descripcion="Para una categoría anunciada cuyo inventario aún no está confirmado."
            />
          </div>
        </form>
      </Modal>
    </>
  )
}

/**
 * Imagen de la tarjeta, en el mismo orden de prioridad que usa la tienda:
 * imagen propia → portadas reales apiladas → marcador neutro. Nunca se rellena
 * con la carátula de un juego que no pertenece a la categoría.
 */
function Portada({ categoria }: { categoria: CategoryCard }) {
  if (categoria.imageUrl) {
    return (
      <img
        src={categoria.imageUrl}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
    )
  }

  if (categoria.covers.length > 0) {
    return (
      <span className="flex h-full w-full items-center justify-center" aria-hidden="true">
        {categoria.covers.slice(0, 3).map((src, i) => (
          <span
            // La misma portada puede repetirse si el slug está dos veces en la
            // base: la posición mantiene la clave única.
            key={`${src}-${i}`}
            className="relative block w-[22%] overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
            style={{
              marginLeft: i === 0 ? 0 : '-5%',
              zIndex: 3 - i,
              transform: `rotate(${(i - 1) * 5}deg)`,
            }}
          >
            <img src={src} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
          </span>
        ))}
      </span>
    )
  }

  return (
    <span className="grid h-full w-full place-items-center text-slate-300">
      <ImageOff className="h-7 w-7" aria-hidden="true" />
      <span className="sr-only">Categoría sin imagen</span>
    </span>
  )
}
