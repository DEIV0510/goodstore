import { AlertCircle, ClipboardList, Eye, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAvisos } from '@/components/admin/Avisos'
import { Modal, useConfirmar } from '@/components/admin/Modal'
import { Buscador, Tabla, type Columna } from '@/components/admin/Tabla'
import {
  AreaTexto,
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
  Selector,
  type Tono,
} from '@/components/admin/UI'
import { platformShort } from '@/data/taxonomy'
import { useAuth } from '@/hooks/useAuth'
import { cop, normalize, pluralize, priceLabel } from '@/lib/format'
import { normalizarWhatsapp } from '@/services/ajustes'
import { puedeBorrar } from '@/services/autenticacion'
import { listarProductos } from '@/services/catalogo'
import {
  ESTADOS_PEDIDO,
  actualizarCliente,
  clientePorWhatsapp,
  crearPedido,
  eliminarPedido,
  etiquetaEstado,
  listarPedidos,
  type LineaNueva,
} from '@/services/pedidos'
import type { Order, OrderStatus, Product } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Listado de pedidos.
//
// La tienda pública no genera pedidos: la venta se cierra hablando por WhatsApp
// y es el administrador quien la anota aquí cuando el cliente confirma. Por eso
// esta pantalla es sobre todo un formulario de registro, no una bandeja de
// entrada: nada llega solo.
//
// Registrar el pedido es lo que alimenta las ventas del panel y la ficha del
// cliente. Si nadie registra nada, las cifras se quedan en cero — que es la
// verdad — en vez de inventarse un movimiento.
// ─────────────────────────────────────────────────────────────────────────────

type FiltroEstado = 'todos' | OrderStatus

const tonoEstado = (estado: OrderStatus): Tono =>
  (ESTADOS_PEDIDO.find((e) => e.id === estado)?.tono as Tono | undefined) ?? 'gris'

/** Artículos del pedido: importa cuántas unidades, no cuántas líneas. */
const articulos = (pedido: Order) => pedido.items.reduce((n, i) => n + i.qty, 0)

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

/**
 * `.adm-icono` mide 36 px: se lee bien en una tabla densa pero se queda corto
 * para el dedo. El pseudoelemento amplía la zona pulsable hasta 44 px sin
 * ocupar más espacio en pantalla.
 */
const BOTON_ICONO = "adm-icono relative before:absolute before:-inset-1 before:content-['']"

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

/**
 * La portada es decorativa dentro de la fila: el nombre está justo al lado y
 * repetirlo obligaría al lector de pantalla a anunciar dos veces lo mismo.
 */
function Miniatura({ url, nombre }: { url: string | null; nombre: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        width={32}
        height={44}
        className="h-11 w-8 shrink-0 rounded bg-slate-100 object-contain"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="grid h-11 w-8 shrink-0 place-items-center rounded bg-slate-100 font-display text-[10px] font-bold text-slate-400"
    >
      {iniciales(nombre)}
    </span>
  )
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function Pedidos() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()
  const { perfil } = useAuth()

  // El servidor vuelve a comprobar el permiso: esto solo evita ofrecer un botón
  // que iba a fallar.
  const puedeEliminar = puedeBorrar(perfil?.role)

  const [pedidos, setPedidos] = useState<Order[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Id del pedido con una operación en curso: bloquea el doble clic. */
  const [ocupado, setOcupado] = useState<string | null>(null)

  const [texto, setTexto] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstado>('todos')

  // ── Formulario de registro ─────────────────────────────────────────────────
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [lineas, setLineas] = useState<LineaNueva[]>([])
  const [buscaProducto, setBuscaProducto] = useState('')
  const [envio, setEnvio] = useState('')
  const [estadoNuevo, setEstadoNuevo] = useState<OrderStatus>('pendiente')
  const [metodoPago, setMetodoPago] = useState('')
  const [notas, setNotas] = useState('')
  const [errores, setErrores] = useState<{
    nombre?: string
    whatsapp?: string
    lineas?: string
  }>({})

  /** null = el catálogo todavía no se ha pedido. */
  const [productos, setProductos] = useState<Product[] | null>(null)

  useEffect(() => {
    document.title = 'Pedidos · Panel GOOD GAME'
  }, [])

  /**
   * `silencioso` refresca la lista sin sustituir la pantalla por el cargador.
   * Se usa después de registrar o eliminar: parpadear la tabla entera por un
   * cambio de una fila hace perder el sitio donde se estaba trabajando.
   */
  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true)
    setError(null)
    try {
      setPedidos(await listarPedidos())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pedidos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // El catálogo solo hace falta dentro del formulario, así que se pide la
  // primera vez que se abre y no al entrar en el listado.
  useEffect(() => {
    if (!abierto || productos !== null) return
    void (async () => {
      try {
        // Con borradores y archivados: un pedido puede incluir algo que hoy no
        // esté publicado en la tienda.
        setProductos(await listarProductos({ incluirNoPublicados: true }))
      } catch (e) {
        avisos.error(e)
        setProductos([])
      }
    })()
  }, [abierto, productos, avisos])

  const limpiarFormulario = useCallback(() => {
    setNombre('')
    setWhatsapp('')
    setCiudad('')
    setLineas([])
    setBuscaProducto('')
    setEnvio('')
    setEstadoNuevo('pendiente')
    setMetodoPago('')
    setNotas('')
    setErrores({})
  }, [])

  const cerrarModal = useCallback(() => {
    // Mientras se guarda no se cierra: el pedido podría quedar a medias sin que
    // nadie vea el resultado.
    if (guardando) return
    setAbierto(false)
    limpiarFormulario()
  }, [guardando, limpiarFormulario])

  // ── Líneas del pedido ──────────────────────────────────────────────────────

  const resultados = useMemo(() => {
    const busqueda = normalize(buscaProducto)
    // Con una sola letra el catálogo entero cabría en la lista y no ayudaría.
    if (!productos || busqueda.length < 2) return []
    return productos
      .filter(
        (p) =>
          normalize(p.name).includes(busqueda) || normalize(p.sku ?? '').includes(busqueda)
      )
      .slice(0, 8)
  }, [productos, buscaProducto])

  const anadirLinea = useCallback((producto: Product) => {
    setLineas((previas) => {
      // Añadir dos veces el mismo título es pedir dos unidades, no dos líneas.
      const repetida = previas.some((l) => l.productId === producto.id)
      if (repetida) {
        return previas.map((l) =>
          l.productId === producto.id ? { ...l, qty: l.qty + 1 } : l
        )
      }
      return [
        ...previas,
        {
          productId: producto.id,
          name: producto.name,
          platform: producto.platform,
          image: producto.images[0] ?? null,
          // Un producto sin precio publicado entra en cero y se escribe a mano:
          // el precio se pactó en la conversación, no lo sabe el catálogo.
          unitPrice: producto.price ?? 0,
          qty: 1,
        },
      ]
    })
    setErrores((e) => ({ ...e, lineas: undefined }))
    setBuscaProducto('')
  }, [])

  const cambiarLinea = useCallback((indice: number, cambios: Partial<LineaNueva>) => {
    setLineas((previas) =>
      previas.map((l, i) => (i === indice ? { ...l, ...cambios } : l))
    )
  }, [])

  const quitarLinea = useCallback((indice: number) => {
    setLineas((previas) => previas.filter((_, i) => i !== indice))
  }, [])

  const subtotal = lineas.reduce((n, l) => n + l.unitPrice * l.qty, 0)
  const envioNumero = Math.max(0, Number(envio) || 0)
  const total = subtotal + envioNumero

  async function registrar(e: FormEvent) {
    e.preventDefault()

    const fallos: typeof errores = {}
    if (!nombre.trim()) fallos.nombre = 'Escribe el nombre del cliente.'
    const digitos = whatsapp.replace(/\D/g, '')
    if (!digitos) fallos.whatsapp = 'Escribe el WhatsApp del cliente.'
    else if (digitos.length < 10)
      fallos.whatsapp = 'El número debe tener los 10 dígitos del celular.'
    if (lineas.length === 0) fallos.lineas = 'Añade al menos un producto al pedido.'

    setErrores(fallos)
    if (Object.keys(fallos).length > 0) return

    setGuardando(true)
    try {
      // El número se guarda siempre en formato internacional. Si se guardara
      // tal cual se teclea, el mismo cliente entraría dos veces por escribir
      // una vez "3105490250" y otra "+57 310 549 0250".
      const cliente = await clientePorWhatsapp(normalizarWhatsapp(whatsapp), nombre.trim())

      // La ficha del cliente se completa con lo que se sepa hoy: si ya existía
      // sin ciudad, este pedido la aporta en vez de perderla.
      const ciudadLimpia = ciudad.trim()
      if (ciudadLimpia && cliente.city !== ciudadLimpia) {
        await actualizarCliente(cliente.id, { city: ciudadLimpia })
      }

      await crearPedido({
        customerId: cliente.id,
        status: estadoNuevo,
        paymentMethod: metodoPago.trim() || null,
        // Hoy no hay otro canal de venta; el campo queda listo para cuando lo haya.
        channel: 'whatsapp',
        shipping: envioNumero,
        notes: notas.trim() || null,
        items: lineas,
      })

      avisos.exito('Pedido registrado.')
      setAbierto(false)
      limpiarFormulario()
      await cargar(true)
    } catch (err) {
      // Sin base de datos conectada, `crearPedido` falla a propósito. El aviso
      // explica por qué en vez de fingir que se guardó.
      avisos.error(err)
    } finally {
      setGuardando(false)
    }
  }

  // ── Listado ────────────────────────────────────────────────────────────────

  const eliminar = useCallback(
    async (pedido: Order) => {
      const seguro = await confirmar({
        titulo: 'Eliminar pedido',
        mensaje: `El pedido ${pedido.code} y sus ${pluralize(
          articulos(pedido),
          'artículo',
          'artículos'
        )} se borrarán del historial de ventas. Esta acción no se puede deshacer.`,
        confirmar: 'Eliminar pedido',
      })
      if (!seguro) return

      setOcupado(pedido.id)
      try {
        await eliminarPedido(pedido.id)
        avisos.exito(`Se eliminó el pedido ${pedido.code}.`)
        await cargar(true)
      } catch (e) {
        avisos.error(e)
      } finally {
        setOcupado(null)
      }
    },
    [avisos, cargar, confirmar]
  )

  const conteos = useMemo(() => {
    const mapa = new Map<OrderStatus, number>()
    for (const p of pedidos) mapa.set(p.status, (mapa.get(p.status) ?? 0) + 1)
    return mapa
  }, [pedidos])

  const filtrados = useMemo(() => {
    const busqueda = normalize(texto)
    return pedidos.filter((p) => {
      if (filtro !== 'todos' && p.status !== filtro) return false
      if (!busqueda) return true
      return (
        normalize(p.code).includes(busqueda) ||
        normalize(p.customer?.name ?? '').includes(busqueda) ||
        normalize(p.customer?.whatsapp ?? '').includes(busqueda)
      )
    })
  }, [pedidos, filtro, texto])

  const columnas = useMemo<Columna<Order>[]>(
    () => [
      {
        clave: 'codigo',
        titulo: 'Código',
        orden: (p) => p.code,
        celda: (p) => (
          <Link
            to={`/admin/pedidos/${p.id}`}
            className="font-mono text-[12.5px] font-bold text-blue-700 hover:underline"
          >
            {p.code}
          </Link>
        ),
      },
      {
        clave: 'cliente',
        titulo: 'Cliente',
        orden: (p) => p.customer?.name ?? '',
        celda: (p) =>
          p.customer ? (
            <div className="min-w-0 max-w-[220px]">
              <span className="block truncate font-semibold text-slate-900">
                {p.customer.name}
              </span>
              <span className="adm-num block truncate text-[12px] text-slate-400">
                {p.customer.whatsapp}
              </span>
            </div>
          ) : (
            <span className="text-[13px] text-slate-400">Sin cliente asociado</span>
          ),
      },
      {
        clave: 'fecha',
        titulo: 'Fecha',
        orden: (p) => p.createdAt,
        celda: (p) => (
          <span className="adm-num whitespace-nowrap text-slate-600">
            {fechaCorta(p.createdAt)}
          </span>
        ),
      },
      {
        clave: 'articulos',
        titulo: 'Productos',
        className: 'text-right',
        orden: (p) => articulos(p),
        celda: (p) => (
          <span className="adm-num whitespace-nowrap text-slate-600">
            {pluralize(articulos(p), 'artículo', 'artículos')}
          </span>
        ),
      },
      {
        clave: 'total',
        titulo: 'Total',
        className: 'text-right',
        orden: (p) => p.total,
        celda: (p) => (
          <span className="adm-num font-semibold text-slate-900">{cop(p.total)}</span>
        ),
      },
      {
        clave: 'estado',
        titulo: 'Estado',
        orden: (p) => etiquetaEstado(p.status),
        celda: (p) => (
          <Etiqueta tono={tonoEstado(p.status)}>{etiquetaEstado(p.status)}</Etiqueta>
        ),
      },
      {
        clave: 'pago',
        titulo: 'Método de pago',
        orden: (p) => p.paymentMethod ?? '',
        celda: (p) =>
          p.paymentMethod ? (
            <span className="whitespace-nowrap text-slate-600">{p.paymentMethod}</span>
          ) : (
            // El guion evita que la celda parezca rota; el texto oculto dice en
            // voz alta lo que el guion solo insinúa.
            <span className="text-slate-400">
              <span aria-hidden="true">—</span>
              <span className="sr-only">Sin anotar</span>
            </span>
          ),
      },
      {
        clave: 'acciones',
        titulo: 'Acciones',
        className: 'text-right',
        soloTabla: true,
        celda: (p) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              to={`/admin/pedidos/${p.id}`}
              className={BOTON_ICONO}
              aria-label={`Ver el pedido ${p.code}`}
              title="Ver detalle"
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </Link>
            {puedeEliminar && (
              <button
                type="button"
                onClick={() => void eliminar(p)}
                disabled={ocupado === p.id}
                className={`${BOTON_ICONO} hover:bg-red-50 hover:text-alert-600 disabled:pointer-events-none disabled:opacity-40`}
                aria-label={`Eliminar el pedido ${p.code}`}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [eliminar, ocupado, puedeEliminar]
  )

  const tarjetaMovil = useCallback(
    (p: Order) => (
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/admin/pedidos/${p.id}`}
            className="font-mono text-[13px] font-bold text-blue-700"
          >
            {p.code}
          </Link>
          <span className="shrink-0">
            <Etiqueta tono={tonoEstado(p.status)}>{etiquetaEstado(p.status)}</Etiqueta>
          </span>
        </div>

        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-slate-900">
            {p.customer?.name ?? 'Sin cliente asociado'}
          </p>
          <p className="adm-num text-[12px] text-slate-500">
            {fechaCorta(p.createdAt)} · {pluralize(articulos(p), 'artículo', 'artículos')}
            {p.paymentMethod ? ` · ${p.paymentMethod}` : ''}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="adm-num text-[15px] font-bold text-slate-900">
            {cop(p.total)}
          </span>
          <div className="flex items-center gap-1">
            <Link
              to={`/admin/pedidos/${p.id}`}
              className={BOTON_ICONO}
              aria-label={`Ver el pedido ${p.code}`}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </Link>
            {puedeEliminar && (
              <button
                type="button"
                onClick={() => void eliminar(p)}
                disabled={ocupado === p.id}
                className={`${BOTON_ICONO} hover:bg-red-50 hover:text-alert-600 disabled:pointer-events-none disabled:opacity-40`}
                aria-label={`Eliminar el pedido ${p.code}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    ),
    [eliminar, ocupado, puedeEliminar]
  )

  const pestanas: { id: FiltroEstado; etiqueta: string; cuenta: number }[] = [
    { id: 'todos', etiqueta: 'Todos', cuenta: pedidos.length },
    ...ESTADOS_PEDIDO.map((e) => ({
      id: e.id as FiltroEstado,
      etiqueta: e.label,
      cuenta: conteos.get(e.id) ?? 0,
    })),
  ]

  const botonRegistrar = (
    <button type="button" onClick={() => setAbierto(true)} className="adm-btn-primary">
      <Plus className="h-4 w-4" aria-hidden="true" />
      Registrar pedido
    </button>
  )

  // ── Formulario de registro (se pinta siempre para no duplicarlo) ───────────
  const formulario = (
    <Modal
      abierto={abierto}
      onCerrar={cerrarModal}
      titulo="Registrar pedido"
      descripcion="Anota la venta que acabas de cerrar por WhatsApp. Los totales se calculan solos."
      ancho="xl"
      pie={
        <>
          <button
            type="button"
            onClick={cerrarModal}
            disabled={guardando}
            className="adm-btn-suave adm-btn-sm"
          >
            Cancelar
          </button>
          <BotonGuardar form="form-pedido" guardando={guardando} className="adm-btn-sm">
            Registrar pedido
          </BotonGuardar>
        </>
      }
    >
      {/* noValidate: el aviso lo damos nosotros en español y junto al campo. Si
          validara el navegador, su burbuja saldría en el idioma del navegador y
          el error de «añade al menos un producto» nunca llegaría a mostrarse. */}
      <form id="form-pedido" onSubmit={registrar} className="space-y-6" noValidate>
        {/* ── Cliente ───────────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-3 font-display text-[14px] font-bold text-slate-900">
            Cliente
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada
              label="Nombre"
              requerido
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              error={errores.nombre}
              autoComplete="off"
              placeholder="Nombre y apellido"
            />
            <Entrada
              label="WhatsApp"
              requerido
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              error={errores.whatsapp}
              ayuda="Si ese número ya compró antes, el pedido se suma a su ficha."
              autoComplete="off"
              placeholder="3001234567"
            />
            <Entrada
              label="Ciudad"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              ayuda="Opcional. Sirve para saber a dónde se envía."
              autoComplete="off"
            />
          </div>
        </section>

        {/* ── Productos ─────────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-3 font-display text-[14px] font-bold text-slate-900">
            Productos
          </h3>

          <Entrada
            label="Buscar en el catálogo"
            type="search"
            value={buscaProducto}
            onChange={(e) => setBuscaProducto(e.target.value)}
            ayuda="Escribe al menos dos letras del nombre o del SKU y pulsa el resultado para añadirlo."
            autoComplete="off"
            placeholder="Nombre del juego, consola o accesorio…"
          />

          {productos === null && (
            <p className="mt-2 text-[13px] text-slate-500" role="status">
              Cargando el catálogo…
            </p>
          )}

          {productos !== null && normalize(buscaProducto).length >= 2 && (
            <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {resultados.length === 0 ? (
                <li className="px-3 py-3 text-[13px] text-slate-500">
                  Ningún producto del catálogo coincide con «{buscaProducto}».
                </li>
              ) : (
                resultados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => anadirLinea(p)}
                      className="flex min-h-[44px] w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50"
                    >
                      <Miniatura url={p.images[0] ?? null} nombre={p.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-800">
                          {p.name}
                        </span>
                        <span className="block text-[12px] text-slate-500">
                          {platformShort(p.platform)} · {priceLabel(p.price)}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {lineas.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {lineas.map((l, i) => {
                const clave = l.productId ?? `linea-${i}`
                return (
                  <li key={clave} className="p-3">
                    <div className="flex items-start gap-3">
                      <Miniatura url={l.image} nombre={l.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-slate-900">
                          {l.name}
                        </p>
                        <p className="text-[12px] text-slate-500">
                          {l.platform ? platformShort(l.platform) : 'Sin plataforma'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => quitarLinea(i)}
                        className={`${BOTON_ICONO} hover:bg-red-50 hover:text-alert-600`}
                        aria-label={`Quitar «${l.name}» del pedido`}
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <div>
                        <label
                          htmlFor={`precio-${clave}`}
                          className="adm-label mb-1 text-[12px]"
                        >
                          Precio unitario
                        </label>
                        <input
                          id={`precio-${clave}`}
                          type="number"
                          min={0}
                          step={1000}
                          inputMode="numeric"
                          value={l.unitPrice}
                          // Seleccionar al enfocar: si no, teclear sobre un 0
                          // deja "01000" en vez de reemplazar la cifra.
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            cambiarLinea(i, {
                              unitPrice: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="adm-input adm-num"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`cantidad-${clave}`}
                          className="adm-label mb-1 text-[12px]"
                        >
                          Cantidad
                        </label>
                        <input
                          id={`cantidad-${clave}`}
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={l.qty}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            cambiarLinea(i, {
                              qty: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                            })
                          }
                          className="adm-input adm-num"
                        />
                      </div>
                      <p className="col-span-2 text-right text-[13px] sm:col-span-1 sm:pb-3">
                        <span className="text-slate-500">Subtotal </span>
                        <span className="adm-num font-bold text-slate-900">
                          {cop(l.unitPrice * l.qty)}
                        </span>
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {errores.lineas && (
            <p className="adm-error" role="alert">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {errores.lineas}
            </p>
          )}
        </section>

        {/* ── Cobro ─────────────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-3 font-display text-[14px] font-bold text-slate-900">Cobro</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Entrada
              label="Envío"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={envio}
              onChange={(e) => setEnvio(e.target.value)}
              ayuda="Déjalo vacío si no se cobró."
              className="adm-num"
            />
            <Selector
              label="Estado del pedido"
              value={estadoNuevo}
              onChange={(e) => setEstadoNuevo(e.target.value as OrderStatus)}
              opciones={ESTADOS_PEDIDO.map((e) => ({
                valor: e.id,
                etiqueta: e.label,
              }))}
            />
            <Entrada
              label="Método de pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              ayuda="Como lo pagó el cliente."
              autoComplete="off"
              placeholder="Efectivo, transferencia…"
            />
          </div>

          <dl className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Subtotal</dt>
              <dd className="adm-num font-semibold text-slate-800">{cop(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Envío</dt>
              <dd className="adm-num font-semibold text-slate-800">{cop(envioNumero)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-1.5">
              <dt className="font-bold text-slate-900">Total</dt>
              <dd className="adm-num text-[15px] font-bold text-slate-900">{cop(total)}</dd>
            </div>
          </dl>
        </section>

        {/* ── Notas ─────────────────────────────────────────────────────── */}
        <section>
          <AreaTexto
            label="Notas del pedido"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            ayuda="Lo que convenga recordar: dirección, hora de entrega, acuerdos de la conversación."
          />
        </section>
      </form>
    </Modal>
  )

  if (cargando) return <Cargando texto="Cargando los pedidos…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  const sinPedidos = pedidos.length === 0

  // Dos vacíos distintos: no es lo mismo no haber registrado nunca un pedido
  // que tener un filtro demasiado estrecho, y la salida tampoco es la misma.
  const vacio = sinPedidos ? (
    <EstadoVacio
      icono={ClipboardList}
      titulo="Aún no hay pedidos registrados"
      descripcion="Cuando cierres una venta por WhatsApp, regístrala aquí para llevar el control de ventas y clientes."
    >
      {botonRegistrar}
    </EstadoVacio>
  ) : (
    <EstadoVacio
      icono={Search}
      titulo="Ningún pedido coincide"
      descripcion="Prueba con otro texto de búsqueda o vuelve a la pestaña «Todos» para ver el historial completo."
    >
      <button
        type="button"
        onClick={() => {
          setTexto('')
          setFiltro('todos')
        }}
        className="adm-btn-suave adm-btn-sm"
      >
        Quitar filtros
      </button>
    </EstadoVacio>
  )

  return (
    <>
      <Encabezado
        titulo="Pedidos"
        descripcion="La venta se cierra por WhatsApp: aquí se registra cada pedido para llevar el control de ventas, clientes y entregas. Nada se anota solo."
      >
        {botonRegistrar}
      </Encabezado>

      {/* Sin pedidos no hay nada que filtrar: la barra solo sería ruido. */}
      {!sinPedidos && (
        <div className="adm-card mb-4 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div
              role="group"
              aria-label="Filtrar pedidos por estado"
              className="flex flex-wrap gap-1.5"
            >
              {pestanas.map((t) => {
                const activa = filtro === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => setFiltro(t.id)}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors sm:min-h-[36px] ${
                      activa
                        ? 'border-ink-900 bg-ink-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {t.etiqueta}
                    <span
                      className={`adm-num rounded-full px-1.5 text-[11px] font-bold ${
                        activa ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.cuenta}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* `Buscador` no expone un id propio, así que la etiqueta visible se
                asocia envolviendo el campo: la asociación implícita vale igual. */}
            <label className="block lg:w-72">
              <span className="adm-label">Buscar pedido</span>
              <Buscador
                valor={texto}
                onChange={setTexto}
                etiqueta="Buscar pedido"
                placeholder="Código o nombre del cliente…"
              />
            </label>
          </div>

          <p
            className="adm-num mt-3 border-t border-slate-100 pt-3 text-[12.5px] text-slate-500"
            aria-live="polite"
          >
            Mostrando {filtrados.length} de {pedidos.length}
          </p>
        </div>
      )}

      <div className="adm-card overflow-hidden">
        <Tabla
          datos={filtrados}
          columnas={columnas}
          claveFila={(p) => p.id}
          ordenInicial={{ clave: 'fecha', dir: 'desc' }}
          vacio={vacio}
          tarjetaMovil={tarjetaMovil}
        />
      </div>

      {formulario}
    </>
  )
}
