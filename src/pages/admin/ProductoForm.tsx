import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  PackageX,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
  obtenerProductoPorId,
} from '@/services/catalogo'
import {
  AreaTexto,
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Interruptor,
  Selector,
} from '@/components/admin/UI'
import { GestorImagenes } from '@/components/admin/Imagenes'
import { useAvisos } from '@/components/admin/Avisos'
import { useConfirmar } from '@/components/admin/Modal'
import { useAuth } from '@/hooks/useAuth'
import { puedeBorrar } from '@/services/autenticacion'
import { normalize } from '@/lib/format'
import { CONDITIONS, GENRES, PLATFORMS, REGIONS } from '@/data/taxonomy'
import type {
  Category,
  Condition,
  Genre,
  Platform,
  Product,
  ProductInput,
  ProductStatus,
  Region,
} from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Alta y edición de un producto.
//
// Es la pantalla que define lo que ve el cliente, así que el criterio de todo
// el formulario es el mismo del resto del proyecto: lo que no está confirmado
// se deja vacío. Un precio vacío se muestra como "Consultar precio", un stock
// vacío como disponibilidad por confirmar y una descripción vacía no se
// inventa. Nada de rellenar huecos con texto de relleno.
//
// La misma ruta sirve para crear (/admin/productos/nuevo) y para editar
// (/admin/productos/:id); lo único que cambia es si `useParams` trae un id.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado del formulario.
 *
 * Los números viven como TEXTO mientras se edita: un `<input type="number">`
 * vacío no es 0, es "sin dato", y esa diferencia es justo la que distingue
 * "agotado" de "disponibilidad por confirmar". Se convierten al guardar.
 *
 * Género y región usan '' en lugar de null por el mismo motivo técnico: el
 * valor de un `<option>` siempre es una cadena.
 */
interface Borrador {
  nombre: string
  slug: string
  descripcion: string
  nota: string
  plataforma: Platform
  categoria: Category
  genero: Genre | ''
  condicion: Condition
  region: Region | ''
  precio: string
  precioAnterior: string
  existencias: string
  sku: string
  imagenes: string[]
  medida?: { w: number; h: number }
  publicacion: ProductStatus
  destacado: boolean
  enOferta: boolean
  nuevoLanzamiento: boolean
  masVendido: boolean
  etiquetas: string[]
}

const BORRADOR_VACIO: Borrador = {
  nombre: '',
  slug: '',
  descripcion: '',
  nota: '',
  plataforma: 'ps5',
  categoria: 'videojuegos',
  genero: '',
  // Un producto nuevo nace "por confirmar" y como borrador: afirmar que algo
  // es nuevo o publicarlo a medio llenar sería inventar información.
  condicion: 'consultar',
  region: '',
  precio: '',
  precioAnterior: '',
  existencias: '',
  sku: '',
  imagenes: [],
  medida: undefined,
  publicacion: 'borrador',
  destacado: false,
  enOferta: false,
  nuevoLanzamiento: false,
  masVendido: false,
  etiquetas: [],
}

// `taxonomy.ts` no exporta la lista de categorías (solo sus etiquetas para las
// tarjetas), así que las opciones del selector se declaran aquí.
const CATEGORIAS: { valor: Category; etiqueta: string }[] = [
  { valor: 'videojuegos', etiqueta: 'Videojuegos' },
  { valor: 'consolas', etiqueta: 'Consolas' },
  { valor: 'accesorios', etiqueta: 'Accesorios' },
]

const PUBLICACIONES: { valor: ProductStatus; etiqueta: string }[] = [
  { valor: 'publicado', etiqueta: 'Publicado' },
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'archivado', etiqueta: 'Archivado' },
]

const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** "The Last of Us Parte II" → "the-last-of-us-parte-ii" */
function generarSlug(texto: string): string {
  return normalize(texto) // minúsculas, sin tildes y sin espacios en los bordes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Texto vacío → null (sin dato). Cualquier otra cosa → número, aunque sea NaN. */
function aNumero(texto: string): number | null {
  const limpio = texto.trim()
  return limpio === '' ? null : Number(limpio)
}

function desdeProducto(p: Product): Borrador {
  return {
    nombre: p.name,
    slug: p.slug,
    descripcion: p.description ?? '',
    nota: p.note ?? '',
    plataforma: p.platform,
    categoria: p.category,
    genero: p.genre ?? '',
    condicion: p.condition,
    region: p.region ?? '',
    precio: p.price === null ? '' : String(p.price),
    precioAnterior: p.oldPrice === null ? '' : String(p.oldPrice),
    existencias: p.stock === null ? '' : String(p.stock),
    sku: p.sku ?? '',
    imagenes: p.images ?? [],
    medida: p.imageSize,
    publicacion: p.status,
    destacado: p.featured,
    enOferta: p.onSale,
    nuevoLanzamiento: p.newRelease,
    masVendido: p.bestSeller,
    etiquetas: p.tags ?? [],
  }
}

function haciaEntrada(b: Borrador): ProductInput {
  return {
    name: b.nombre.trim(),
    slug: b.slug.trim(),
    platform: b.plataforma,
    category: b.categoria,
    genre: b.genero === '' ? null : b.genero,
    condition: b.condicion,
    region: b.region === '' ? null : b.region,
    price: aNumero(b.precio),
    oldPrice: aNumero(b.precioAnterior),
    stock: aNumero(b.existencias),
    images: b.imagenes,
    imageSize: b.medida,
    description: b.descripcion.trim(),
    // Vacío → undefined y no cadena vacía: en la base de datos queda null y la
    // ficha no pinta un párrafo de aclaración en blanco.
    note: b.nota.trim() || undefined,
    featured: b.destacado,
    tags: b.etiquetas,
    sku: b.sku.trim() || null,
    status: b.publicacion,
    onSale: b.enOferta,
    newRelease: b.nuevoLanzamiento,
    bestSeller: b.masVendido,
  }
}

// ── Validación ───────────────────────────────────────────────────────────────

type ClaveError = 'nombre' | 'slug' | 'precio' | 'precioAnterior' | 'existencias'

type Errores = Partial<Record<ClaveError, string>>

/** Orden visual de los campos: define a cuál se lleva el foco al fallar. */
const ORDEN_CAMPOS: ClaveError[] = [
  'nombre',
  'slug',
  'precio',
  'precioAnterior',
  'existencias',
]

function validar(b: Borrador): Errores {
  const e: Errores = {}

  if (!b.nombre.trim()) e.nombre = 'Escribe el nombre del producto.'

  const slug = b.slug.trim()
  if (!slug) {
    e.slug = 'La dirección web no puede quedar vacía.'
  } else if (!SLUG_VALIDO.test(slug)) {
    e.slug = 'Usa solo minúsculas, números y guiones. Ejemplo: elden-ring-ps5.'
  }

  const precio = aNumero(b.precio)
  if (precio !== null && !Number.isFinite(precio)) {
    e.precio = 'Escribe un precio válido o deja el campo vacío.'
  } else if (precio !== null && precio < 0) {
    e.precio = 'El precio no puede ser negativo.'
  }

  const anterior = aNumero(b.precioAnterior)
  if (anterior !== null && !Number.isFinite(anterior)) {
    e.precioAnterior = 'Escribe un precio válido o deja el campo vacío.'
  } else if (anterior !== null && anterior < 0) {
    e.precioAnterior = 'El precio anterior no puede ser negativo.'
  } else if (
    anterior !== null &&
    precio !== null &&
    Number.isFinite(precio) &&
    anterior <= precio
  ) {
    // Un "antes" que no es mayor que el "ahora" no es un descuento: la tienda
    // no lo tacharía y el dato quedaría mintiendo en la ficha.
    e.precioAnterior = 'Debe ser mayor que el precio actual para mostrarse tachado.'
  }

  // El texto habla de "stock" y no de "existencias" para decir lo mismo que la
  // etiqueta del campo y que el resto del panel (Productos e Inventario).
  const stock = aNumero(b.existencias)
  if (stock !== null && !Number.isFinite(stock)) {
    e.existencias = 'Escribe una cantidad válida o deja el campo vacío.'
  } else if (stock !== null && stock < 0) {
    e.existencias = 'El stock no puede ser negativo.'
  } else if (stock !== null && !Number.isInteger(stock)) {
    e.existencias = 'El stock se cuenta en unidades enteras.'
  }

  return e
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProductoForm() {
  const { id } = useParams<{ id: string }>()
  const esAlta = !id

  const navegar = useNavigate()
  const avisos = useAvisos()
  const confirmar = useConfirmar()
  const { perfil } = useAuth()

  const [producto, setProducto] = useState<Product | null>(null)
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO)
  /** Copia del estado tal y como se cargó: es la referencia de "sin cambios". */
  const [inicial, setInicial] = useState<Borrador>(BORRADOR_VACIO)
  const [errores, setErrores] = useState<Errores>({})
  const [cargando, setCargando] = useState(!esAlta)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [etiquetaNueva, setEtiquetaNueva] = useState('')

  // Una vez que alguien escribe el slug a mano, deja de seguir al nombre.
  const slugManual = useRef(false)

  // Cada carga lleva su número de turno. Si se pide otro producto antes de que
  // llegue la respuesta anterior, la vieja se descarta: si no, la ficha lenta
  // pisaría a la rápida y el formulario mostraría datos de otro producto.
  const turnoCarga = useRef(0)

  const refNombre = useRef<HTMLInputElement>(null)
  const refSlug = useRef<HTMLInputElement>(null)
  const refPrecio = useRef<HTMLInputElement>(null)
  const refPrecioAnterior = useRef<HTMLInputElement>(null)
  const refExistencias = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    const turno = ++turnoCarga.current

    // Alta y edición son la MISMA pantalla, y el enrutador la reutiliza al
    // saltar de /admin/productos/:id a /admin/productos/nuevo (por ejemplo con
    // el botón "atrás" del navegador). Sin este reinicio, el alta arrancaría
    // con el producto anterior ya escrito dentro.
    if (!id) {
      slugManual.current = false
      setProducto(null)
      setBorrador(BORRADOR_VACIO)
      setInicial(BORRADOR_VACIO)
      setErrores({})
      setError(null)
      setCargando(false)
      return
    }

    setCargando(true)
    setError(null)
    try {
      const p = await obtenerProductoPorId(id)
      // Llegó tarde: ya se está cargando otra cosa.
      if (turno !== turnoCarga.current) return
      const b = p ? desdeProducto(p) : BORRADOR_VACIO
      slugManual.current = false
      setProducto(p)
      setBorrador(b)
      setInicial(b)
      setErrores({})
    } catch (e) {
      if (turno !== turnoCarga.current) return
      setError(e instanceof Error ? e.message : 'No se pudo cargar el producto')
    } finally {
      if (turno === turnoCarga.current) setCargando(false)
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    document.title = esAlta
      ? 'Nuevo producto · Panel GOOD GAME'
      : 'Editar producto · Panel GOOD GAME'
  }, [esAlta])

  // Comparar el objeto completo es más fiable que ir marcando cada campo: no
  // hay forma de olvidarse de uno al añadirlo al formulario.
  const hayCambios = useMemo(
    () => JSON.stringify(borrador) !== JSON.stringify(inicial),
    [borrador, inicial]
  )

  // Recargar o cerrar la pestaña con trabajo a medias pide confirmación al
  // navegador. Los saltos DENTRO del panel no se pueden interceptar sin un
  // enrutador de datos, así que el aviso propio va en el botón "Cancelar".
  useEffect(() => {
    if (!hayCambios) return
    function alSalir(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [hayCambios])

  const cambiar = useCallback((parcial: Partial<Borrador>, aLimpiar: ClaveError[] = []) => {
    setBorrador((b) => ({ ...b, ...parcial }))
    // El error deja de tener sentido en cuanto la persona toca el campo.
    if (aLimpiar.length > 0) {
      setErrores((e) => {
        const copia = { ...e }
        for (const clave of aLimpiar) delete copia[clave]
        return copia
      })
    }
  }, [])

  function alEscribirNombre(valor: string) {
    setBorrador((b) => ({
      ...b,
      nombre: valor,
      // El slug se genera solo al crear. En edición NUNCA se regenera: cambiarlo
      // rompe los enlaces que ya se compartieron por WhatsApp o redes.
      slug: esAlta && !slugManual.current ? generarSlug(valor) : b.slug,
    }))
    setErrores((e) => {
      const copia = { ...e }
      delete copia.nombre
      delete copia.slug
      return copia
    })
  }

  // ── Etiquetas ──────────────────────────────────────────────────────────────

  function anadirEtiqueta() {
    const limpia = etiquetaNueva.trim().replace(/\s+/g, ' ')
    if (!limpia) return
    // Se compara sin tildes ni mayúsculas para no acabar con "Acción" y
    // "accion" como si fueran dos etiquetas distintas.
    if (borrador.etiquetas.some((e) => normalize(e) === normalize(limpia))) {
      avisos.aviso('Esa etiqueta ya está en la lista.')
      setEtiquetaNueva('')
      return
    }
    cambiar({ etiquetas: [...borrador.etiquetas, limpia] })
    setEtiquetaNueva('')
  }

  function alTeclearEtiqueta(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    // Sin esto, el Enter del campo de etiquetas enviaría el formulario entero.
    e.preventDefault()
    anadirEtiqueta()
  }

  function quitarEtiqueta(etiqueta: string) {
    cambiar({ etiquetas: borrador.etiquetas.filter((e) => e !== etiqueta) })
  }

  // ── Imágenes ───────────────────────────────────────────────────────────────

  /**
   * La medida guardada describe a la PORTADA, no a "alguna" imagen. En cuanto
   * la primera deja de ser la misma —se borró, se reordenó o no queda ninguna—
   * ese tamaño ya no describe nada y la ficha reservaría un hueco equivocado.
   *
   * La excepción es partir de cero: ahí el gestor acaba de medir la portada
   * justo antes de avisar del cambio, y descartarla borraría el dato bueno.
   *
   * Se calcula dentro del actualizador y no con `borrador` de fuera porque el
   * gestor encadena `onMedida` y `onChange`: leer el estado de la vuelta
   * anterior daría la lista antigua.
   */
  function alCambiarImagenes(urls: string[]) {
    setBorrador((b) => ({
      ...b,
      imagenes: urls,
      medida:
        b.imagenes.length === 0 || urls[0] === b.imagenes[0] ? b.medida : undefined,
    }))
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  async function volver() {
    if (hayCambios) {
      const seguro = await confirmar({
        titulo: 'Salir sin guardar',
        mensaje:
          'Hiciste cambios que todavía no se han guardado. Si sales ahora se pierden.',
        confirmar: 'Salir sin guardar',
        cancelar: 'Seguir editando',
      })
      if (!seguro) return
    }
    navegar('/admin/productos')
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()

    const fallos = validar(borrador)
    setErrores(fallos)

    const refs: Record<ClaveError, { current: HTMLInputElement | null }> = {
      nombre: refNombre,
      slug: refSlug,
      precio: refPrecio,
      precioAnterior: refPrecioAnterior,
      existencias: refExistencias,
    }
    const primero = ORDEN_CAMPOS.find((clave) => fallos[clave])
    if (primero) {
      // Llevar el foco al primer campo que falla evita la búsqueda a ciegas en
      // un formulario que no cabe entero en pantalla.
      refs[primero].current?.focus()
      refs[primero].current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    setGuardando(true)
    try {
      const entrada = haciaEntrada(borrador)
      if (esAlta) {
        await crearProducto(entrada)
        avisos.exito('Producto creado.')
      } else {
        await actualizarProducto(id as string, entrada)
        avisos.exito('Cambios guardados.')
      }
      // Se iguala la referencia antes de navegar para que el aviso de salida no
      // salte con el trabajo ya guardado.
      setInicial(borrador)
      navegar('/admin/productos')
    } catch (err) {
      // Sin base de datos conectada esto lanza a propósito. El aviso lo explica
      // y la pantalla se queda como está: nadie pierde lo que escribió.
      avisos.error(err)
    } finally {
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!producto) return
    const seguro = await confirmar({
      titulo: 'Eliminar producto',
      mensaje: `Se eliminará «${producto.name}» del catálogo. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      peligroso: true,
    })
    if (!seguro) return

    try {
      await eliminarProducto(producto.id)
      avisos.exito('Producto eliminado.')
      navegar('/admin/productos')
    } catch (err) {
      avisos.error(err)
    }
  }

  // ── Estados de carga ───────────────────────────────────────────────────────

  if (cargando) return <Cargando texto="Cargando el producto…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  if (!esAlta && !producto) {
    return (
      <div className="adm-card">
        <EstadoVacio
          icono={PackageX}
          titulo="No encontramos este producto"
          descripcion="Puede que se haya eliminado o que la dirección esté mal escrita."
        >
          <Link to="/admin/productos" className="adm-btn-suave adm-btn-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a productos
          </Link>
        </EstadoVacio>
      </div>
    )
  }

  const puedeEliminar = !esAlta && puedeBorrar(perfil?.role)

  return (
    <form onSubmit={enviar} noValidate>
      <Encabezado
        titulo={esAlta ? 'Nuevo producto' : 'Editar producto'}
        descripcion={
          esAlta
            ? 'Lo que rellenes aquí es exactamente lo que verá el cliente. Deja vacío lo que todavía no esté confirmado.'
            : `Estás editando «${producto?.name}».`
        }
      >
        <button type="button" onClick={() => void volver()} className="adm-btn-fantasma">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver
        </button>
      </Encabezado>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start lg:gap-5">
        {/* ── Contenido ────────────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2 lg:space-y-5">
          {/* A) Información */}
          <section className="adm-card-pad" aria-labelledby="tit-informacion">
            <h2 id="tit-informacion" className="adm-titulo text-[15px]">
              Información
            </h2>
            <p className="adm-sub mt-0.5">
              El nombre y la dirección web son lo único obligatorio para guardar.
            </p>

            <div className="mt-4 space-y-4">
              <Entrada
                ref={refNombre}
                id="producto-nombre"
                label="Nombre"
                requerido
                value={borrador.nombre}
                onChange={(e) => alEscribirNombre(e.target.value)}
                placeholder="Ej: EA Sports FC 25"
                error={errores.nombre}
                autoComplete="off"
              />

              <Entrada
                ref={refSlug}
                id="producto-slug"
                label="Dirección web (slug)"
                requerido
                value={borrador.slug}
                onChange={(e) => {
                  slugManual.current = true
                  cambiar({ slug: e.target.value }, ['slug'])
                }}
                placeholder="ea-sports-fc-25"
                spellCheck={false}
                autoComplete="off"
                error={errores.slug}
                ayuda={
                  esAlta
                    ? 'Se usa en la dirección: /producto/mi-slug. Se genera solo a partir del nombre hasta que lo edites.'
                    : 'Se usa en la dirección: /producto/mi-slug. Si lo cambias, los enlaces que ya compartiste dejarán de funcionar.'
                }
              />

              <AreaTexto
                id="producto-descripcion"
                label="Descripción"
                value={borrador.descripcion}
                onChange={(e) => cambiar({ descripcion: e.target.value })}
                rows={5}
                placeholder="De qué trata el juego, qué incluye la caja, en qué estado está…"
                ayuda="Si no tienes una descripción verificada, déjala vacía. La tienda no muestra texto inventado."
              />

              <Entrada
                id="producto-nota"
                label="Nota aclaratoria"
                value={borrador.nota}
                onChange={(e) => cambiar({ nota: e.target.value })}
                placeholder="Ej: región por confirmar con el proveedor"
                ayuda="Aclaración honesta cuando algo del producto no se pudo confirmar. Se muestra en la ficha."
              />
            </div>
          </section>

          {/* B) Clasificación */}
          <section className="adm-card-pad" aria-labelledby="tit-clasificacion">
            <h2 id="tit-clasificacion" className="adm-titulo text-[15px]">
              Clasificación
            </h2>
            <p className="adm-sub mt-0.5">
              Decide en qué filtros del catálogo aparece el producto.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Selector
                id="producto-plataforma"
                label="Plataforma"
                requerido
                value={borrador.plataforma}
                onChange={(e) => cambiar({ plataforma: e.target.value as Platform })}
                opciones={PLATFORMS.map((p) => ({ valor: p.id, etiqueta: p.label }))}
              />

              <Selector
                id="producto-categoria"
                label="Categoría"
                requerido
                value={borrador.categoria}
                onChange={(e) => cambiar({ categoria: e.target.value as Category })}
                opciones={CATEGORIAS}
              />

              <Selector
                id="producto-genero"
                label="Género"
                value={borrador.genero}
                onChange={(e) => cambiar({ genero: e.target.value as Genre | '' })}
                opciones={[
                  // Primera opción vacía: preferimos "sin clasificar" antes que
                  // colgarle al título un género que no le corresponde.
                  { valor: '', etiqueta: 'Sin clasificar' },
                  ...GENRES.map((g) => ({ valor: g.id, etiqueta: g.label })),
                ]}
                ayuda="Solo se usa en videojuegos."
              />

              <Selector
                id="producto-condicion"
                label="Estado del producto"
                value={borrador.condicion}
                onChange={(e) => cambiar({ condicion: e.target.value as Condition })}
                opciones={CONDITIONS.map((c) => ({ valor: c.id, etiqueta: c.label }))}
                ayuda="Nuevo, usado o pendiente de confirmar con el proveedor."
              />

              <Selector
                id="producto-region"
                label="Región"
                value={borrador.region}
                onChange={(e) => cambiar({ region: e.target.value as Region | '' })}
                opciones={[
                  { valor: '', etiqueta: 'Por confirmar' },
                  ...REGIONS.map((r) => ({ valor: r.id, etiqueta: r.label })),
                ]}
                ayuda="Afecta al idioma y a la compatibilidad del disco o cartucho."
              />

              <Entrada
                id="producto-sku"
                label="SKU"
                value={borrador.sku}
                onChange={(e) => cambiar({ sku: e.target.value })}
                placeholder="Código interno"
                spellCheck={false}
                autoComplete="off"
                ayuda="Tu código interno. No se muestra en la tienda."
              />
            </div>
          </section>

          {/* C) Precio e inventario */}
          <section className="adm-card-pad" aria-labelledby="tit-precio">
            <h2 id="tit-precio" className="adm-titulo text-[15px]">
              Precio e inventario
            </h2>
            <p className="adm-sub mt-0.5">
              Un campo vacío no es un cero: significa que el dato está sin confirmar.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Entrada
                ref={refPrecio}
                id="producto-precio"
                label="Precio (COP)"
                type="number"
                inputMode="numeric"
                min={0}
                className="adm-num"
                value={borrador.precio}
                onChange={(e) =>
                  // Cambiar el precio puede arreglar o romper la comparación con
                  // el precio anterior, así que se limpian los dos errores.
                  cambiar({ precio: e.target.value }, ['precio', 'precioAnterior'])
                }
                placeholder="189000"
                error={errores.precio}
                ayuda="Déjalo vacío para que la tienda muestre «Consultar precio»."
              />

              <Entrada
                ref={refPrecioAnterior}
                id="producto-precio-anterior"
                label="Precio anterior (COP)"
                type="number"
                inputMode="numeric"
                min={0}
                className="adm-num"
                value={borrador.precioAnterior}
                onChange={(e) =>
                  cambiar({ precioAnterior: e.target.value }, ['precio', 'precioAnterior'])
                }
                placeholder="Sin descuento"
                error={errores.precioAnterior}
                ayuda="Solo se muestra tachado si es mayor que el precio actual."
              />

              <Entrada
                ref={refExistencias}
                id="producto-stock"
                label="Stock"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className="adm-num"
                value={borrador.existencias}
                onChange={(e) => cambiar({ existencias: e.target.value }, ['existencias'])}
                placeholder="Sin confirmar"
                error={errores.existencias}
                ayuda="0 = agotado. Vacío = disponibilidad por confirmar."
              />
            </div>
          </section>

          {/* D) Imágenes */}
          <section className="adm-card-pad" aria-labelledby="tit-imagenes">
            <h2 id="tit-imagenes" className="adm-titulo text-[15px]">
              Imágenes
            </h2>
            <p className="adm-sub mt-0.5 mb-4">
              Usa fotos reales del producto. Nunca la carátula de otro juego.
            </p>

            <GestorImagenes
              imagenes={borrador.imagenes}
              onChange={alCambiarImagenes}
              onMedida={(m) => cambiar({ medida: m })}
            />
          </section>
        </div>

        {/* ── Lateral ──────────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:space-y-5">
          {/* E) Publicación */}
          <section className="adm-card-pad" aria-labelledby="tit-publicacion">
            <h2 id="tit-publicacion" className="adm-titulo text-[15px]">
              Publicación
            </h2>

            <div className="mt-4 space-y-4">
              <Selector
                id="producto-estado"
                label="Estado"
                value={borrador.publicacion}
                onChange={(e) => cambiar({ publicacion: e.target.value as ProductStatus })}
                opciones={PUBLICACIONES}
                ayuda="Solo «publicado» aparece en la tienda."
              />

              {hayCambios && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-medium leading-snug text-amber-800">
                  <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                  Tienes cambios sin guardar.
                </p>
              )}

              <div className="space-y-2">
                <BotonGuardar guardando={guardando} className="w-full">
                  {esAlta ? 'Crear producto' : 'Guardar cambios'}
                </BotonGuardar>

                <button
                  type="button"
                  onClick={() => void volver()}
                  className="adm-btn-suave w-full"
                >
                  Cancelar
                </button>

                {/* El enlace usa el slug GUARDADO, no el del formulario: si se
                    acaba de editar sin guardar, esa dirección aún no existe. */}
                {!esAlta && producto?.status === 'publicado' && (
                  <a
                    href={`/producto/${producto.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver «${producto.name}» en la tienda (se abre en una pestaña nueva)`}
                    className="adm-btn-fantasma w-full"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Ver en la tienda
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* F) Marketing */}
          <section className="adm-card-pad" aria-labelledby="tit-marketing">
            <h2 id="tit-marketing" className="adm-titulo text-[15px]">
              Marketing
            </h2>
            <p className="adm-sub mt-0.5">Dónde y cómo se resalta el producto.</p>

            <div className="mt-4 space-y-3.5">
              <Interruptor
                activo={borrador.destacado}
                onChange={(v) => cambiar({ destacado: v })}
                label="Destacado"
                descripcion="Aparece en «Videojuegos destacados» de la portada."
              />
              <Interruptor
                activo={borrador.enOferta}
                onChange={(v) => cambiar({ enOferta: v })}
                label="En oferta"
                descripcion="Marca la ficha como oferta. El precio tachado depende del precio anterior."
              />
              <Interruptor
                activo={borrador.nuevoLanzamiento}
                onChange={(v) => cambiar({ nuevoLanzamiento: v })}
                label="Nuevo lanzamiento"
                descripcion="Para títulos recién salidos."
              />
              <Interruptor
                activo={borrador.masVendido}
                onChange={(v) => cambiar({ masVendido: v })}
                label="Más vendido"
                descripcion="Úsalo solo si de verdad es de los que más salen."
              />
            </div>
          </section>

          {/* G) Etiquetas */}
          <section className="adm-card-pad" aria-labelledby="tit-etiquetas">
            <h2 id="tit-etiquetas" className="adm-titulo text-[15px]">
              Etiquetas
            </h2>
            <p className="adm-sub mt-0.5">
              Palabras sueltas que ayudan a encontrar el producto en el buscador.
            </p>

            <div className="mt-4">
              <label htmlFor="producto-etiqueta" className="adm-label">
                Añadir etiqueta
              </label>
              <div className="flex gap-2">
                <input
                  id="producto-etiqueta"
                  type="text"
                  value={etiquetaNueva}
                  onChange={(e) => setEtiquetaNueva(e.target.value)}
                  onKeyDown={alTeclearEtiqueta}
                  placeholder="Ej: multijugador"
                  autoComplete="off"
                  aria-describedby="producto-etiqueta-ayuda"
                  className="adm-input min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={anadirEtiqueta}
                  disabled={!etiquetaNueva.trim()}
                  aria-label="Añadir la etiqueta"
                  className="adm-btn-suave shrink-0 px-3"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p id="producto-etiqueta-ayuda" className="adm-ayuda">
                Pulsa Enter o el botón de añadir.
              </p>

              {/* Los chips miden 44 px de alto en táctil y se compactan con
                  ratón: la misma escala que usan los botones del panel. */}
              {borrador.etiquetas.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {borrador.etiquetas.map((etiqueta) => (
                    <li
                      key={etiqueta}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-3 pr-1 sm:min-h-[34px]"
                    >
                      <span className="text-[12.5px] font-semibold text-blue-800">
                        {etiqueta}
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarEtiqueta(etiqueta)}
                        aria-label={`Quitar la etiqueta ${etiqueta}`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-800 sm:h-7 sm:w-7"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Zona destructiva: aparte del resto y solo para quien puede borrar. */}
          {puedeEliminar && (
            <section className="adm-card border-red-200 p-4 sm:p-5" aria-labelledby="tit-eliminar">
              <h2 id="tit-eliminar" className="adm-titulo text-[15px]">
                Eliminar producto
              </h2>
              <p className="adm-sub mt-0.5">
                Se borra del catálogo para siempre. Si solo quieres ocultarlo, cámbialo a
                «archivado».
              </p>
              <button
                type="button"
                onClick={() => void borrar()}
                className="adm-btn-peligro adm-btn-sm mt-3 w-full"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Eliminar producto
              </button>
            </section>
          )}
        </aside>
      </div>
    </form>
  )
}
