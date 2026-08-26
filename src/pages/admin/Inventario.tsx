import {
  AlertTriangle,
  Boxes,
  Loader2,
  Minus,
  PackageCheck,
  PackageX,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { actualizarStock, listarProductos } from '@/services/catalogo'
import {
  estaAgotado,
  guardarUmbralStockBajo,
  leerUmbralStockBajo,
  tieneStockBajo,
} from '@/services/metricas'
import {
  BotonGuardar,
  Cargando,
  Cifra,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
} from '@/components/admin/UI'
import { Buscador, Tabla, type Columna } from '@/components/admin/Tabla'
import { useConfirmar } from '@/components/admin/Modal'
import { useAvisos } from '@/components/admin/Avisos'
import { normalize, pluralize } from '@/lib/format'
import { platformShort } from '@/data/taxonomy'
import type { Product } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Inventario.
//
// Pantalla de trabajo rápido: se llega con el conteo físico en la mano y se
// ajusta fila por fila. Por eso cada cambio se guarda solo —al soltar el campo o
// al pulsar +/−— en lugar de acumularse tras un botón «guardar» al final: nadie
// hace veinte ajustes y luego confía en que no se le perdió ninguno.
//
// Sin base de datos conectada la lectura funciona (catálogo incluido en el
// paquete) pero la escritura falla con un mensaje claro. En ese caso la fila
// vuelve a su valor anterior: es preferible ver el fallo a creer que se guardó.
// ─────────────────────────────────────────────────────────────────────────────

type EstadoStock = 'disponible' | 'bajo' | 'agotado' | 'sinConfirmar'
type Filtro = 'todos' | EstadoStock

const ETIQUETA_ESTADO: Record<
  EstadoStock,
  { texto: string; tono: 'verde' | 'ambar' | 'rojo' | 'gris' }
> = {
  disponible: { texto: 'Disponible', tono: 'verde' },
  bajo: { texto: 'Stock bajo', tono: 'ambar' },
  agotado: { texto: 'Agotado', tono: 'rojo' },
  sinConfirmar: { texto: 'Por confirmar', tono: 'gris' },
}

/** Al ordenar por estado se ven primero las filas que piden atención. */
const ORDEN_ESTADO: Record<EstadoStock, number> = {
  agotado: 0,
  bajo: 1,
  sinConfirmar: 2,
  disponible: 3,
}

/** Tope del umbral. Por encima de esto toda la tienda saldría en «stock bajo». */
const UMBRAL_MAX = 9999
const AVISO_UMBRAL = `Escribe un número entero entre 0 y ${UMBRAL_MAX}.`

const umbralValido = (texto: string) => {
  const n = Number(texto)
  return texto.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= UMBRAL_MAX
}

/** Lo guardado puede venir de una versión sin tope; se ajusta al rango válido. */
const umbralInicial = () => Math.min(Math.floor(leerUmbralStockBajo()), UMBRAL_MAX)

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: 'todos', texto: 'Todos' },
  { id: 'disponible', texto: 'Disponibles' },
  { id: 'bajo', texto: 'Stock bajo' },
  { id: 'agotado', texto: 'Agotados' },
  { id: 'sinConfirmar', texto: 'Sin confirmar' },
]

/** stock null = disponibilidad sin confirmar; nunca se cuenta como agotado. */
function estadoDe(producto: Product, umbral: number): EstadoStock {
  if (producto.stock === null) return 'sinConfirmar'
  if (estaAgotado(producto)) return 'agotado'
  return tieneStockBajo(producto, umbral) ? 'bajo' : 'disponible'
}

const FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function fechaCorta(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : FECHA.format(d)
}

/** Copia el mapa sin esa clave. Devuelve el mismo objeto si no estaba, para no
 *  provocar un repintado que no cambia nada. */
function sinClave<T>(mapa: Record<string, T>, clave: string): Record<string, T> {
  if (!(clave in mapa)) return mapa
  const copia = { ...mapa }
  delete copia[clave]
  return copia
}

/**
 * Portada en miniatura. Va con alt vacío a propósito: el nombre del producto
 * está justo al lado y repetirlo solo estorba a quien usa lector de pantalla.
 * Sin foto se dibuja la plataforma; jamás la carátula de otro juego.
 */
function Miniatura({ producto }: { producto: Product }) {
  const [falla, setFalla] = useState(false)
  const foto = producto.images[0]

  if (!foto || falla) {
    return (
      <span
        className="grid h-11 w-9 shrink-0 place-items-center rounded border border-slate-200 bg-slate-100 px-0.5 text-center text-[8.5px] font-bold uppercase leading-tight text-slate-400"
        aria-hidden="true"
      >
        {platformShort(producto.platform)}
      </span>
    )
  }

  return (
    <img
      src={foto}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFalla(true)}
      className="h-11 w-9 shrink-0 rounded border border-slate-200 bg-slate-100 object-cover"
    />
  )
}

export default function Inventario() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()

  const [productos, setProductos] = useState<Product[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [umbral, setUmbral] = useState(umbralInicial)
  const [umbralTexto, setUmbralTexto] = useState(() => String(umbralInicial()))

  const [errorUmbral, setErrorUmbral] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  /** Texto en curso de cada campo de stock; se descarta al confirmar el cambio. */
  const [edicion, setEdicion] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<Record<string, boolean>>({})

  // Filas con una petición viva y valor al que debe llegar cada una. Van en
  // referencias y no en el estado porque hay que consultarlos dentro del mismo
  // evento que los cambia: el estado aún no se ha repintado y dos pulsaciones
  // seguidas partirían del mismo número.
  const enVuelo = useRef<Set<string>>(new Set())
  const objetivo = useRef<Record<string, number>>({})

  // Cada carga lleva su número. Solo la última pedida puede escribir en la
  // pantalla: si se pulsa «Actualizar» dos veces, una respuesta lenta podría
  // llegar detrás de una rápida y dejar la tabla con el conteo viejo.
  const peticion = useRef(0)
  const yaCargado = useRef(false)

  const cargar = useCallback(
    async (silencioso = false) => {
      const token = ++peticion.current
      if (silencioso) setRefrescando(true)
      else setCargando(true)
      setError(null)
      try {
        // Incluye borradores y archivados: el stock existe aunque el producto no
        // esté publicado todavía. La fila lo marca para que no haya confusión.
        const lista = await listarProductos({ incluirNoPublicados: true })
        if (token !== peticion.current) return
        setProductos(lista)
        yaCargado.current = true
      } catch (e) {
        if (token !== peticion.current) return
        // Con una tabla ya en pantalla, un fallo al refrescar no la borra: se
        // avisa y se sigue trabajando con lo último que sí se pudo cargar.
        if (yaCargado.current) avisos.error(e)
        else {
          setError(
            e instanceof Error ? e.message : 'No se pudieron cargar los productos'
          )
        }
      } finally {
        if (token === peticion.current) {
          setCargando(false)
          setRefrescando(false)
        }
      }
    },
    [avisos]
  )

  useEffect(() => {
    void cargar()
  }, [cargar])

  // ── Guardado del stock ─────────────────────────────────────────────────────

  /** Manda a la base el valor apuntado en `objetivo` hasta que deje de moverse. */
  const enviarStock = useCallback(
    async (id: string, anterior: number | null) => {
      enVuelo.current.add(id)
      setGuardando((g) => ({ ...g, [id]: true }))

      try {
        let enviado = objetivo.current[id]
        let actualizado = await actualizarStock(id, enviado)
        // Las pulsaciones que llegaron mientras se guardaba no se pierden: se
        // manda el último valor pedido en vez de descartar el clic.
        while (objetivo.current[id] !== undefined && objetivo.current[id] !== enviado) {
          enviado = objetivo.current[id]
          actualizado = await actualizarStock(id, enviado)
        }
        // La respuesta trae updatedAt, así que la columna de fecha queda al día.
        setProductos((prev) => prev.map((p) => (p.id === id ? actualizado : p)))
      } catch (e) {
        setProductos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, stock: anterior } : p))
        )
        avisos.error(e)
      } finally {
        delete objetivo.current[id]
        enVuelo.current.delete(id)
        setGuardando((g) => sinClave(g, id))
      }
    },
    [avisos]
  )

  /**
   * Punto de entrada único para cambiar el stock de una fila: fija el valor al
   * que debe llegar y, si no hay ya una petición viva, la lanza.
   */
  const pedirStock = useCallback(
    (producto: Product, valor: number) => {
      const id = producto.id
      setEdicion((e) => sinClave(e, id))

      // El valor de partida es el último pedido, no el del repintado: dos
      // pulsaciones seguidas tienen que sumar dos, no una.
      const actual = objetivo.current[id] ?? producto.stock
      if (valor === actual) return

      objetivo.current[id] = valor
      // Optimista: la cifra cambia ya. Ajustar inventario es un goteo de cambios
      // pequeños y esperar al servidor en cada uno se hace eterno.
      setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, stock: valor } : p)))

      // Si la fila ya está guardando, esa petición recogerá este valor al
      // terminar; lanzar otra en paralelo podría aplicarlas en desorden.
      if (enVuelo.current.has(id)) return
      void enviarStock(id, producto.stock)
    },
    [enviarStock]
  )

  function ajustar(producto: Product, delta: number) {
    const base = objetivo.current[producto.id] ?? producto.stock ?? 0
    pedirStock(producto, Math.max(0, base + delta))
  }

  function confirmarEdicion(producto: Product) {
    const texto = edicion[producto.id]
    if (texto === undefined) return

    const limpio = texto.trim()
    // Campo vacío = no tocar nada. Vaciarlo sin querer no debe borrar un conteo,
    // y volver a «Por confirmar» se decide en la ficha del producto, no aquí.
    if (limpio === '') {
      setEdicion((e) => sinClave(e, producto.id))
      return
    }

    const n = Number(limpio)
    if (!Number.isFinite(n)) {
      setEdicion((e) => sinClave(e, producto.id))
      return
    }
    pedirStock(producto, Math.max(0, Math.floor(n)))
  }

  async function marcarAgotado(producto: Product) {
    if (producto.stock === 0) return
    const ok = await confirmar({
      titulo: 'Marcar como agotado',
      mensaje: `«${producto.name}» quedará en 0 unidades y la tienda dejará de ofrecerlo. Puedes volver a subir el stock cuando quieras.`,
      confirmar: 'Marcar agotado',
      cancelar: 'Cancelar',
      peligroso: true,
    })
    if (!ok) return
    pedirStock(producto, 0)
  }

  // ── Umbral de aviso ────────────────────────────────────────────────────────

  function cambiarUmbral(texto: string) {
    setUmbralTexto(texto)
    const valido = umbralValido(texto)
    // Con el campo a medio escribir (vacío) no se regaña a nadie todavía.
    setErrorUmbral(valido || texto.trim() === '' ? null : AVISO_UMBRAL)
    // Los estados de la tabla se recalculan mientras se escribe; el botón solo
    // decide si el número sobrevive a recargar la página.
    if (valido) setUmbral(Math.floor(Number(texto)))
  }

  function guardarUmbral(e: FormEvent) {
    e.preventDefault()
    if (!umbralValido(umbralTexto)) {
      setErrorUmbral(AVISO_UMBRAL)
      return
    }
    const valor = Math.floor(Number(umbralTexto))
    setErrorUmbral(null)
    setUmbral(valor)
    setUmbralTexto(String(valor))
    guardarUmbralStockBajo(valor)
    avisos.exito(
      valor === 0
        ? 'Aviso de stock bajo desactivado.'
        : `Avisaremos con ${pluralize(valor, 'unidad', 'unidades')} o menos.`
    )
  }

  // ── Datos derivados ────────────────────────────────────────────────────────

  // Las cifras de arriba resumen TODO el catálogo, no lo que filtra el buscador.
  const resumen = useMemo(() => {
    const cuenta: Record<EstadoStock, number> = {
      disponible: 0,
      bajo: 0,
      agotado: 0,
      sinConfirmar: 0,
    }
    for (const p of productos) cuenta[estadoDe(p, umbral)]++
    return cuenta
  }, [productos, umbral])

  const encontrados = useMemo(() => {
    const q = normalize(busqueda)
    if (!q) return productos
    return productos.filter(
      (p) => normalize(p.name).includes(q) || normalize(p.sku ?? '').includes(q)
    )
  }, [productos, busqueda])

  // Los contadores de las pestañas cuentan sobre lo encontrado: si uno dice 3,
  // al pulsarlo salen 3 filas y no otra cifra distinta.
  const conteos = useMemo(() => {
    const c: Record<Filtro, number> = {
      todos: encontrados.length,
      disponible: 0,
      bajo: 0,
      agotado: 0,
      sinConfirmar: 0,
    }
    for (const p of encontrados) c[estadoDe(p, umbral)]++
    return c
  }, [encontrados, umbral])

  const visibles = useMemo(
    () =>
      filtro === 'todos'
        ? encontrados
        : encontrados.filter((p) => estadoDe(p, umbral) === filtro),
    [encontrados, filtro, umbral]
  )

  if (cargando) return <Cargando texto="Cargando el inventario…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  // ── Piezas de fila ─────────────────────────────────────────────────────────
  //
  // Son funciones que devuelven JSX, NO componentes. Si fueran componentes
  // definidos aquí dentro, React los trataría como un tipo nuevo en cada
  // repintado, desmontaría el campo de stock y se perdería el foco al escribir.

  const controlStock = (p: Product) => {
    const ocupada = Boolean(guardando[p.id])
    const texto = edicion[p.id] ?? (p.stock === null ? '' : String(p.stock))
    const enCero = (p.stock ?? 0) <= 0

    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => ajustar(p, -1)}
          disabled={enCero}
          aria-label={`Quitar una unidad de ${p.name}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>

        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={texto}
          placeholder="—"
          aria-label={`Unidades en stock de ${p.name}`}
          onChange={(e) => {
            const v = e.target.value
            setEdicion((x) => ({ ...x, [p.id]: v }))
          }}
          onBlur={() => confirmarEdicion(p)}
          onKeyDown={(e) => {
            // Enter no envía ningún formulario: saca el foco, y salir del campo
            // es justo lo que dispara el guardado.
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
            // Escape descarta lo tecleado y devuelve el valor guardado.
            if (e.key === 'Escape') setEdicion((x) => sinClave(x, p.id))
          }}
          className="adm-num h-11 w-[68px] shrink-0 rounded-lg border border-slate-300 bg-white text-center text-[14px] font-semibold text-slate-900 transition-colors hover:border-slate-400 focus:border-blue-500 focus:outline-none sm:h-9 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <button
          type="button"
          onClick={() => ajustar(p, 1)}
          aria-label={`Añadir una unidad a ${p.name}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 sm:h-9 sm:w-9"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Hueco fijo: el indicador aparece y desaparece sin mover los botones. */}
        <span className="grid w-4 shrink-0 place-items-center" aria-hidden="true">
          {ocupada && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />}
        </span>
      </div>
    )
  }

  const botonAgotado = (p: Product) => (
    <button
      type="button"
      onClick={() => void marcarAgotado(p)}
      disabled={p.stock === 0}
      className="adm-btn-fantasma adm-btn-sm whitespace-nowrap"
    >
      <PackageX className="h-3.5 w-3.5" aria-hidden="true" />
      Marcar como agotado
    </button>
  )

  const columnas: Columna<Product>[] = [
    {
      clave: 'producto',
      titulo: 'Producto',
      orden: (p) => p.name,
      celda: (p) => (
        <div className="flex items-center gap-2.5">
          <Miniatura producto={p} />
          <div className="min-w-0 max-w-[300px]">
            <p className="truncate font-semibold text-slate-800" title={p.name}>
              {p.name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
              <span>{platformShort(p.platform)}</span>
              {p.status !== 'publicado' && (
                <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-px text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                  {p.status === 'borrador' ? 'Borrador' : 'Archivado'}
                </span>
              )}
            </p>
          </div>
        </div>
      ),
    },
    {
      clave: 'sku',
      titulo: 'SKU',
      orden: (p) => p.sku?.trim() ?? '',
      celda: (p) => <span className="adm-num text-slate-600">{p.sku?.trim() || '—'}</span>,
    },
    {
      clave: 'stock',
      titulo: 'Stock',
      // «Por confirmar» (null) se ordena antes que el cero: son las dos filas que
      // hay que mirar primero cuando se ordena por unidades.
      orden: (p) => p.stock ?? -1,
      celda: controlStock,
      className: 'w-[196px]',
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      orden: (p) => ORDEN_ESTADO[estadoDe(p, umbral)],
      celda: (p) => {
        const e = ETIQUETA_ESTADO[estadoDe(p, umbral)]
        return <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
      },
    },
    {
      clave: 'actualizado',
      titulo: 'Última actualización',
      orden: (p) => p.updatedAt ?? '',
      celda: (p) => (
        <span className="adm-num whitespace-nowrap text-slate-500">
          {fechaCorta(p.updatedAt)}
        </span>
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      soloTabla: true,
      className: 'text-right',
      celda: botonAgotado,
    },
  ]

  const tarjetaMovil = (p: Product) => {
    const e = ETIQUETA_ESTADO[estadoDe(p, umbral)]
    return (
      <div className="space-y-2.5">
        <div className="flex items-start gap-2.5">
          <Miniatura producto={p} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold leading-snug text-slate-800">
              {p.name}
            </p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {platformShort(p.platform)} · SKU {p.sku?.trim() || '—'}
              {p.status !== 'publicado' &&
                (p.status === 'borrador' ? ' · Borrador' : ' · Archivado')}
            </p>
          </div>
          <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {controlStock(p)}
          {botonAgotado(p)}
        </div>

        <p className="text-[11.5px] text-slate-400">
          Actualizado: {fechaCorta(p.updatedAt)}
        </p>
      </div>
    )
  }

  const catalogoVacio = (
    <EstadoVacio
      icono={Boxes}
      titulo="Todavía no hay productos"
      descripcion="Cuando cargues productos al catálogo podrás ajustar aquí sus unidades sin entrar a cada ficha."
    >
      <Link to="/admin/productos/nuevo" className="adm-btn-primary adm-btn-sm">
        Crear producto
      </Link>
    </EstadoVacio>
  )

  const sinResultados = (
    <EstadoVacio
      icono={Search}
      titulo="Ningún producto coincide"
      descripcion="Prueba con otro nombre o con otro estado de stock."
    >
      <button
        type="button"
        onClick={() => {
          setBusqueda('')
          setFiltro('todos')
        }}
        className="adm-btn-suave adm-btn-sm"
      >
        Quitar los filtros
      </button>
    </EstadoVacio>
  )

  return (
    <>
      <Encabezado
        titulo="Inventario"
        descripcion="Ajusta las unidades disponibles sin entrar a cada ficha."
      >
        {/* Refresco silencioso: vaciar la pantalla entera para volver a pintar
            lo mismo haría perder de vista la fila que se estaba ajustando. */}
        <button
          type="button"
          onClick={() => void cargar(true)}
          disabled={refrescando}
          className="adm-btn-suave adm-btn-sm"
        >
          <RefreshCw
            className={`h-4 w-4 ${refrescando ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {refrescando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </Encabezado>

      {/* Un único anuncio para el lector de pantalla; una región por fila sería
          un ruido continuo mientras se ajusta el inventario. */}
      <p className="sr-only" role="status">
        {Object.keys(guardando).length > 0 ? 'Guardando el stock…' : ''}
      </p>

      {/* ── Resumen ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra
          icono={PackageCheck}
          etiqueta="Disponibles"
          valor={resumen.disponible}
          tono="verde"
          nota={
            umbral === 0
              ? 'Con al menos una unidad'
              : `Con más de ${pluralize(umbral, 'unidad', 'unidades')}`
          }
        />
        <Cifra
          icono={AlertTriangle}
          etiqueta="Stock bajo"
          valor={resumen.bajo}
          tono="ambar"
          nota={
            umbral === 0
              ? 'Aviso desactivado con el umbral en 0'
              : `Con ${pluralize(umbral, 'unidad', 'unidades')} o menos`
          }
        />
        <Cifra
          icono={PackageX}
          etiqueta="Agotados"
          valor={resumen.agotado}
          tono="rojo"
          nota="En cero: la tienda no los ofrece"
        />
      </div>

      {/* ── Umbral de aviso ──────────────────────────────────────────────── */}
      <section className="adm-card-pad mt-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="adm-titulo text-[15px]">Aviso de stock bajo</h2>
            <p className="adm-sub mt-1 max-w-md">
              Los estados de la tabla se recalculan al instante al cambiar el número.
              Se listan todos los productos del catálogo, incluidos los borradores.
            </p>
          </div>

          <div className="shrink-0">
            {/* noValidate: el aviso lo damos nosotros en español y junto al
                campo, no el globo del navegador en su propio idioma. */}
            <form
              onSubmit={guardarUmbral}
              noValidate
              className="flex flex-wrap items-end gap-2"
            >
              <Entrada
                id="umbral-stock"
                label="Avisar cuando el stock sea igual o menor que"
                type="number"
                inputMode="numeric"
                min={0}
                max={UMBRAL_MAX}
                step={1}
                value={umbralTexto}
                onChange={(e) => cambiarUmbral(e.target.value)}
                error={errorUmbral ?? undefined}
                aria-describedby="umbral-ayuda"
                className="w-24 text-center"
              />
              <BotonGuardar>Guardar</BotonGuardar>
            </form>
            <p id="umbral-ayuda" className="adm-ayuda">
              Se guarda en este navegador.
            </p>
          </div>
        </div>
      </section>

      {/* ── Listado ──────────────────────────────────────────────────────── */}
      <section className="adm-card mt-3 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Buscador
              valor={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar por nombre o SKU…"
              etiqueta="Buscar un producto del inventario"
            />
            <p className="text-[12.5px] text-slate-500">
              {pluralize(visibles.length, 'producto', 'productos')} en la vista
            </p>
          </div>

          <div
            role="group"
            aria-label="Filtrar por estado del stock"
            className="flex flex-wrap gap-1.5"
          >
            {FILTROS.map((f) => {
              const activo = filtro === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id)}
                  // aria-pressed dice cuál está activo sin depender del color.
                  aria-pressed={activo}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors sm:min-h-[36px] ${
                    activo
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {f.texto}
                  <span
                    className={`adm-num rounded px-1.5 py-px text-[11.5px] font-bold ${
                      activo ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {conteos[f.id]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <Tabla
          datos={visibles}
          columnas={columnas}
          claveFila={(p) => p.id}
          ordenInicial={{ clave: 'producto', dir: 'asc' }}
          tarjetaMovil={tarjetaMovil}
          vacio={productos.length === 0 ? catalogoVacio : sinResultados}
        />
      </section>
    </>
  )
}
