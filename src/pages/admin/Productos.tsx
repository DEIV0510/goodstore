import {
  Copy,
  ExternalLink,
  PackageOpen,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAvisos } from '@/components/admin/Avisos'
import { useConfirmar } from '@/components/admin/Modal'
import { Buscador, Tabla, type Columna } from '@/components/admin/Tabla'
import {
  Cargando,
  Encabezado,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
  Selector,
} from '@/components/admin/UI'
import { PLATFORMS, platformShort } from '@/data/taxonomy'
import { useAuth } from '@/hooks/useAuth'
import { cop, normalize, pluralize, priceLabel } from '@/lib/format'
import { puedeBorrar } from '@/services/autenticacion'
import { duplicarProducto, eliminarProducto, listarProductos } from '@/services/catalogo'
import { estaAgotado, leerUmbralStockBajo, tieneStockBajo } from '@/services/metricas'
import type { Category, Platform, Product, ProductStatus } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Listado de productos.
//
// Es la pantalla que más se usa del panel, así que el filtrado ocurre entero en
// memoria: el catálogo completo son unos cientos de fichas y una consulta por
// tecleo al servidor haría la búsqueda más lenta, no más rápida.
//
// Aquí no se edita nada salvo duplicar y eliminar. Cambiar campos es trabajo
// del formulario, que es donde se validan.
// ─────────────────────────────────────────────────────────────────────────────

type FiltroPlataforma = 'todas' | Platform
type FiltroCategoria = 'todas' | Category
type FiltroEstado = 'todos' | ProductStatus
type FiltroDisponibilidad = 'todas' | 'disponible' | 'agotado'

/**
 * `taxonomy` solo expone la categoría en singular y para la tarjeta de la
 * tienda (`typeLabel`). El panel necesita el plural para los filtros y la
 * columna, así que la lista vive aquí, junto a lo único que la usa.
 */
const CATEGORIAS: { id: Category; etiqueta: string }[] = [
  { id: 'videojuegos', etiqueta: 'Videojuegos' },
  { id: 'consolas', etiqueta: 'Consolas' },
  { id: 'accesorios', etiqueta: 'Accesorios' },
]

const etiquetaCategoria = (c: Category) =>
  CATEGORIAS.find((x) => x.id === c)?.etiqueta ?? c

const ESTADOS: { id: ProductStatus; etiqueta: string; tono: 'verde' | 'ambar' | 'gris' }[] = [
  { id: 'publicado', etiqueta: 'Publicado', tono: 'verde' },
  { id: 'borrador', etiqueta: 'Borrador', tono: 'ambar' },
  { id: 'archivado', etiqueta: 'Archivado', tono: 'gris' },
]

const estadoDe = (s: ProductStatus) => ESTADOS.find((e) => e.id === s)

/**
 * Botón de solo icono. `.adm-icono` mide 36 px, que se lee bien en una tabla
 * densa pero se queda corto para el dedo: el pseudoelemento amplía la zona
 * pulsable hasta 44 px sin ocupar más espacio en pantalla.
 */
const BOTON_ICONO = "adm-icono relative before:absolute before:-inset-1 before:content-['']"

// ── Piezas de celda ──────────────────────────────────────────────────────────

/** Iniciales del título, para cuando el producto todavía no tiene fotografía. */
function iniciales(nombre: string) {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? '')
    .join('')
  return letras.toUpperCase() || '?'
}

function Miniatura({ producto }: { producto: Product }) {
  const fuente = producto.images[0]

  // La imagen es decorativa dentro de la fila: el nombre del producto ya está
  // en la celda de al lado y repetirlo obligaría al lector de pantalla a
  // anunciar dos veces lo mismo.
  if (fuente) {
    return (
      <img
        src={fuente}
        alt=""
        loading="lazy"
        width={40}
        height={52}
        className="h-[52px] w-10 shrink-0 rounded bg-slate-100 object-contain"
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="grid h-[52px] w-10 shrink-0 place-items-center rounded bg-slate-100 font-display text-[11px] font-bold text-slate-400"
    >
      {iniciales(producto.name)}
    </span>
  )
}

/**
 * Stock. Cada estado lleva su propia palabra además del color, porque el color
 * solo no distingue nada para quien no lo percibe.
 *
 * La cifra suelta se acompaña de un "en stock" oculto a la vista: en la tabla
 * el encabezado de la columna ya da el contexto, pero en la tarjeta de móvil no
 * hay encabezado y un lector de pantalla anunciaría solo un número sin decir de
 * qué.
 *
 * `stock === null` no es "disponible": es "todavía no se contó". Se dice tal
 * cual en vez de pintar un verde que afirmaría algo que nadie ha confirmado.
 */
function EtiquetaStock({ producto, umbral }: { producto: Product; umbral: number }) {
  if (producto.stock === null) return <Etiqueta tono="gris">Por confirmar</Etiqueta>
  if (estaAgotado(producto)) return <Etiqueta tono="rojo">Agotado</Etiqueta>
  if (tieneStockBajo(producto, umbral)) {
    return (
      <Etiqueta tono="ambar">
        <span className="adm-num">{producto.stock}</span>
        <span className="sr-only">en stock</span> · Bajo
      </Etiqueta>
    )
  }
  return (
    <Etiqueta tono="verde">
      <span className="adm-num">{producto.stock}</span>
      <span className="sr-only">en stock</span>
    </Etiqueta>
  )
}

function CeldaPrecio({ producto }: { producto: Product }) {
  // El precio anterior solo se muestra si de verdad es mayor: al revés sería
  // anunciar un descuento que no existe.
  const conRebaja =
    producto.price !== null &&
    producto.oldPrice !== null &&
    producto.oldPrice > producto.price

  return (
    <div className="adm-num leading-tight">
      {conRebaja && (
        <span className="block text-[11.5px] text-slate-400 line-through">
          {cop(producto.oldPrice as number)}
        </span>
      )}
      <span
        className={
          producto.price === null
            ? 'text-[13px] text-slate-500'
            : 'font-semibold text-slate-900'
        }
      >
        {priceLabel(producto.price)}
      </span>
    </div>
  )
}

function Acciones({
  producto,
  puedeEliminar,
  ocupado,
  onDuplicar,
  onEliminar,
}: {
  producto: Product
  puedeEliminar: boolean
  ocupado: boolean
  onDuplicar: () => void
  onEliminar: () => void
}) {
  const publicado = producto.status === 'publicado'

  return (
    <div className="flex items-center justify-end gap-1">
      <a
        href={`/producto/${producto.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className={BOTON_ICONO}
        aria-label={`Ver «${producto.name}» en la tienda (se abre en una pestaña nueva)`}
        title={
          publicado
            ? 'Ver en la tienda'
            : 'Ver en la tienda — al no estar publicado puede que todavía no aparezca'
        }
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>

      <Link
        to={`/admin/productos/${producto.id}`}
        className={BOTON_ICONO}
        aria-label={`Editar «${producto.name}»`}
        title="Editar"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Link>

      <button
        type="button"
        onClick={onDuplicar}
        disabled={ocupado}
        className={`${BOTON_ICONO} disabled:pointer-events-none disabled:opacity-40`}
        aria-label={`Duplicar «${producto.name}»`}
        title="Duplicar"
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
      </button>

      {puedeEliminar && (
        <button
          type="button"
          onClick={onEliminar}
          disabled={ocupado}
          className={`${BOTON_ICONO} hover:bg-red-50 hover:text-alert-600 disabled:pointer-events-none disabled:opacity-40`}
          aria-label={`Eliminar «${producto.name}»`}
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function Productos() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()
  const navegar = useNavigate()
  const { perfil } = useAuth()

  // El servidor vuelve a comprobar el permiso: esto solo evita ofrecer un botón
  // que iba a fallar.
  const puedeEliminar = puedeBorrar(perfil?.role)

  const [productos, setProductos] = useState<Product[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Id de la fila con una operación en curso: bloquea el doble clic. */
  const [ocupado, setOcupado] = useState<string | null>(null)

  // El umbral de stock bajo lo fija la pantalla de inventario y se guarda en el
  // navegador. Se lee una sola vez: no cambia mientras esta pantalla está abierta.
  const [umbral] = useState(leerUmbralStockBajo)

  const [texto, setTexto] = useState('')
  const [plataforma, setPlataforma] = useState<FiltroPlataforma>('todas')
  const [estado, setEstado] = useState<FiltroEstado>('todos')
  const [disponibilidad, setDisponibilidad] = useState<FiltroDisponibilidad>('todas')
  const [categoria, setCategoria] = useState<FiltroCategoria>('todas')

  useEffect(() => {
    document.title = 'Productos · Panel GOOD GAME'
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      // Con borradores y archivados: el panel administra todo el catálogo, no
      // solo lo que hoy se ve en la tienda.
      setProductos(await listarProductos({ incluirNoPublicados: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los productos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const duplicar = useCallback(
    async (producto: Product) => {
      setOcupado(producto.id)
      try {
        const copia = await duplicarProducto(producto.id)
        avisos.exito('Se creó una copia como borrador.')
        // Se abre la copia: casi siempre lo siguiente es cambiarle el nombre.
        // La fila se queda bloqueada a propósito hasta que la pantalla se
        // desmonta, para que un segundo clic no cree una copia de la copia.
        navegar(`/admin/productos/${copia.id}`)
      } catch (e) {
        avisos.error(e)
        setOcupado(null)
      }
    },
    [avisos, navegar]
  )

  const eliminar = useCallback(
    async (producto: Product) => {
      const seguro = await confirmar({
        titulo: 'Eliminar producto',
        mensaje: `«${producto.name}» se borrará del catálogo y dejará de verse en la tienda. Esta acción no se puede deshacer.`,
        confirmar: 'Eliminar producto',
      })
      if (!seguro) return

      setOcupado(producto.id)
      try {
        await eliminarProducto(producto.id)
        // Se quita la fila de la lista que ya está en memoria en vez de volver
        // a pedir el catálogo entero. Recargar devolvía la pantalla al estado
        // de carga, y eso desmonta la tabla: se perdía en silencio la columna
        // por la que estaba ordenada, se cerraba la barra de filtros y el
        // desplazamiento saltaba al principio. El borrado ya lo confirmó el
        // servidor, así que la lista local queda igual de fiel.
        setProductos((antes) => antes.filter((p) => p.id !== producto.id))
        avisos.exito(`Se eliminó «${producto.name}».`)
      } catch (e) {
        avisos.error(e)
      } finally {
        setOcupado(null)
      }
    },
    [avisos, confirmar]
  )

  const filtrados = useMemo(() => {
    const busqueda = normalize(texto)

    return productos.filter((p) => {
      if (plataforma !== 'todas' && p.platform !== plataforma) return false
      if (categoria !== 'todas' && p.category !== categoria) return false
      if (estado !== 'todos' && p.status !== estado) return false
      if (disponibilidad === 'disponible' && estaAgotado(p)) return false
      if (disponibilidad === 'agotado' && !estaAgotado(p)) return false
      if (!busqueda) return true

      // `normalize` quita las tildes de los dos lados, así que "pokemon"
      // encuentra "Pokémon". El SKU es opcional y puede venir nulo.
      return (
        normalize(p.name).includes(busqueda) ||
        normalize(p.slug).includes(busqueda) ||
        normalize(p.sku ?? '').includes(busqueda)
      )
    })
  }, [productos, texto, plataforma, categoria, estado, disponibilidad])

  const hayFiltros =
    texto.trim() !== '' ||
    plataforma !== 'todas' ||
    categoria !== 'todas' ||
    estado !== 'todos' ||
    disponibilidad !== 'todas'

  const limpiar = useCallback(() => {
    setTexto('')
    setPlataforma('todas')
    setCategoria('todas')
    setEstado('todos')
    setDisponibilidad('todas')
  }, [])

  const columnas = useMemo<Columna<Product>[]>(
    () => [
      {
        clave: 'imagen',
        titulo: 'Imagen',
        className: 'w-[64px]',
        celda: (p) => <Miniatura producto={p} />,
      },
      {
        clave: 'nombre',
        titulo: 'Producto',
        orden: (p) => p.name,
        celda: (p) => (
          <div className="min-w-0 max-w-[320px]">
            <Link
              to={`/admin/productos/${p.id}`}
              className="block truncate font-semibold text-slate-900 hover:text-blue-700 hover:underline"
            >
              {p.name}
            </Link>
            <span className="block truncate text-[12px] text-slate-400">{p.slug}</span>
          </div>
        ),
      },
      {
        clave: 'plataforma',
        titulo: 'Plataforma',
        orden: (p) => platformShort(p.platform),
        celda: (p) => <Etiqueta tono="azul">{platformShort(p.platform)}</Etiqueta>,
      },
      {
        clave: 'categoria',
        titulo: 'Categoría',
        orden: (p) => etiquetaCategoria(p.category),
        celda: (p) => (
          <span className="whitespace-nowrap text-slate-600">
            {etiquetaCategoria(p.category)}
          </span>
        ),
      },
      {
        clave: 'precio',
        titulo: 'Precio',
        className: 'text-right',
        // Los productos sin precio se agrupan al principio en orden ascendente:
        // el -1 los deja juntos en vez de repartirlos entre las cifras reales.
        orden: (p) => p.price ?? -1,
        celda: (p) => <CeldaPrecio producto={p} />,
      },
      {
        clave: 'stock',
        titulo: 'Stock',
        className: 'text-right',
        orden: (p) => p.stock ?? -1,
        celda: (p) => (
          <div className="flex justify-end">
            <EtiquetaStock producto={p} umbral={umbral} />
          </div>
        ),
      },
      {
        clave: 'estado',
        titulo: 'Estado',
        orden: (p) => estadoDe(p.status)?.etiqueta ?? p.status,
        celda: (p) => {
          const e = estadoDe(p.status)
          return <Etiqueta tono={e?.tono ?? 'gris'}>{e?.etiqueta ?? p.status}</Etiqueta>
        },
      },
      {
        clave: 'acciones',
        titulo: 'Acciones',
        className: 'text-right',
        soloTabla: true,
        celda: (p) => (
          <Acciones
            producto={p}
            puedeEliminar={puedeEliminar}
            ocupado={ocupado === p.id}
            onDuplicar={() => void duplicar(p)}
            onEliminar={() => void eliminar(p)}
          />
        ),
      },
    ],
    [duplicar, eliminar, ocupado, puedeEliminar, umbral]
  )

  const tarjetaMovil = useCallback(
    (p: Product) => (
      <div className="flex gap-3">
        <Miniatura producto={p} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/admin/productos/${p.id}`}
                className="block truncate text-[14px] font-bold text-slate-900"
              >
                {p.name}
              </Link>
              <span className="block truncate text-[12px] text-slate-400">{p.slug}</span>
            </div>
            <span className="shrink-0">
              <Etiqueta tono={estadoDe(p.status)?.tono ?? 'gris'}>
                {estadoDe(p.status)?.etiqueta ?? p.status}
              </Etiqueta>
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Etiqueta tono="azul">{platformShort(p.platform)}</Etiqueta>
            <EtiquetaStock producto={p} umbral={umbral} />
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <CeldaPrecio producto={p} />
            <Acciones
              producto={p}
              puedeEliminar={puedeEliminar}
              ocupado={ocupado === p.id}
              onDuplicar={() => void duplicar(p)}
              onEliminar={() => void eliminar(p)}
            />
          </div>
        </div>
      </div>
    ),
    [duplicar, eliminar, ocupado, puedeEliminar, umbral]
  )

  if (cargando) return <Cargando texto="Cargando el catálogo…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  const catalogoVacio = productos.length === 0
  const sinPublicar = productos.filter((p) => p.status !== 'publicado').length

  const descripcion =
    `${pluralize(productos.length, 'producto en el catálogo', 'productos en el catálogo')}.` +
    (sinPublicar > 0 ? ` ${sinPublicar} sin publicar.` : '')

  // Dos vacíos distintos: no es lo mismo un catálogo recién estrenado que un
  // filtro demasiado estrecho, y la salida de cada situación tampoco lo es.
  const vacio = catalogoVacio ? (
    <EstadoVacio
      icono={PackagePlus}
      titulo="Todavía no hay productos"
      descripcion="Agrega el primero para empezar a construir el catálogo. Podrás dejarlo como borrador hasta que esté listo para la tienda."
    >
      <Link to="/admin/productos/nuevo" className="adm-btn-primary adm-btn-sm">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Agregar producto
      </Link>
    </EstadoVacio>
  ) : (
    <EstadoVacio
      icono={PackageOpen}
      titulo="Ningún producto coincide"
      descripcion="Prueba con otro texto de búsqueda o quita alguno de los filtros para ver más resultados."
    >
      <button type="button" onClick={limpiar} className="adm-btn-suave adm-btn-sm">
        Limpiar filtros
      </button>
    </EstadoVacio>
  )

  return (
    <>
      <Encabezado titulo="Productos" descripcion={descripcion}>
        <Link to="/admin/productos/nuevo" className="adm-btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar producto
        </Link>
      </Encabezado>

      {/* Sin catálogo no hay nada que filtrar: la barra solo sería ruido. */}
      {!catalogoVacio && (
        <div className="adm-card mb-4 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* `Buscador` no expone un id propio, así que la etiqueta visible se
                asocia envolviendo el campo: la asociación implícita vale igual. */}
            <label className="block">
              <span className="adm-label">Buscar producto</span>
              <Buscador
                valor={texto}
                onChange={setTexto}
                etiqueta="Buscar producto"
                placeholder="Nombre, slug o SKU…"
              />
            </label>

            <Selector
              label="Plataforma"
              value={plataforma}
              onChange={(e) => setPlataforma(e.target.value as FiltroPlataforma)}
              opciones={[
                { valor: 'todas', etiqueta: 'Todas las plataformas' },
                ...PLATFORMS.map((p) => ({ valor: p.id, etiqueta: p.label })),
              ]}
            />

            <Selector
              label="Categoría"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as FiltroCategoria)}
              opciones={[
                { valor: 'todas', etiqueta: 'Todas las categorías' },
                ...CATEGORIAS.map((c) => ({ valor: c.id, etiqueta: c.etiqueta })),
              ]}
            />

            <Selector
              label="Publicación"
              value={estado}
              onChange={(e) => setEstado(e.target.value as FiltroEstado)}
              opciones={[
                { valor: 'todos', etiqueta: 'Todos los estados' },
                ...ESTADOS.map((s) => ({ valor: s.id, etiqueta: s.etiqueta })),
              ]}
            />

            <Selector
              label="Disponibilidad"
              value={disponibilidad}
              onChange={(e) => setDisponibilidad(e.target.value as FiltroDisponibilidad)}
              opciones={[
                { valor: 'todas', etiqueta: 'Toda la disponibilidad' },
                // "Disponible" es todo lo que no está en cero, y ahí entran los
                // productos sin contar. Se dice en la propia opción para que
                // nadie lea la lista filtrada como existencias confirmadas.
                { valor: 'disponible', etiqueta: 'Disponible o por confirmar' },
                { valor: 'agotado', etiqueta: 'Agotado' },
              ]}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="adm-num text-[12.5px] text-slate-500" aria-live="polite">
              Mostrando {filtrados.length} de {productos.length}
            </p>
            {hayFiltros && (
              <button type="button" onClick={limpiar} className="adm-btn-fantasma adm-btn-sm">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      <div className="adm-card overflow-hidden">
        <Tabla
          datos={filtrados}
          columnas={columnas}
          claveFila={(p) => p.id}
          ordenInicial={{ clave: 'nombre', dir: 'asc' }}
          vacio={vacio}
          tarjetaMovil={tarjetaMovil}
        />
      </div>
    </>
  )
}
