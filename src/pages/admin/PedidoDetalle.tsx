import {
  ArrowLeft,
  Check,
  ClipboardList,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  PackageOpen,
  Trash2,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAvisos } from '@/components/admin/Avisos'
import { useConfirmar } from '@/components/admin/Modal'
import { Tabla, type Columna } from '@/components/admin/Tabla'
import {
  AreaTexto,
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
  type Tono,
} from '@/components/admin/UI'
import { platformShort } from '@/data/taxonomy'
import { useAuth } from '@/hooks/useAuth'
import { cop } from '@/lib/format'
import { normalizarWhatsapp } from '@/services/ajustes'
import { puedeBorrar } from '@/services/autenticacion'
import {
  ESTADOS_PEDIDO,
  actualizarPedido,
  cambiarEstadoPedido,
  eliminarPedido,
  etiquetaEstado,
  obtenerPedido,
} from '@/services/pedidos'
import type { Order, OrderItem, OrderStatus } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Detalle de un pedido.
//
// Lo que se guarda aquí es el pedido tal como se acordó: las líneas conservan
// el nombre, la plataforma, la portada y el precio del momento de la venta. Si
// mañana el producto sube de precio o se retira del catálogo, este pedido sigue
// contando lo que de verdad pasó.
//
// Por eso las líneas no se editan desde esta pantalla: reescribirlas sería
// falsear una venta cerrada. Lo que sí cambia es el estado, el envío y las
// notas, que son datos de la gestión y no de la venta.
// ─────────────────────────────────────────────────────────────────────────────

const tonoEstado = (estado: OrderStatus): Tono =>
  (ESTADOS_PEDIDO.find((e) => e.id === estado)?.tono as Tono | undefined) ?? 'gris'

const fechaLarga = (iso: string) => {
  const f = new Date(iso)
  const dia = f.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const hora = f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  return `${dia} a las ${hora}`
}

/** El canal se guarda en minúscula; aquí se muestra como se escribe. */
const etiquetaCanal = (canal: string) =>
  canal === 'whatsapp' ? 'WhatsApp' : canal || 'Sin canal'

/** Iniciales del título, para cuando la línea no guardó portada. */
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

const COLUMNAS_LINEAS: Columna<OrderItem>[] = [
  {
    clave: 'producto',
    titulo: 'Producto',
    celda: (l) => (
      <div className="flex items-center gap-3">
        <Miniatura url={l.image} nombre={l.name} />
        <div className="min-w-0 max-w-[300px]">
          <span className="block truncate font-semibold text-slate-900">{l.name}</span>
          <span className="block text-[12px] text-slate-400">
            {l.platform ? platformShort(l.platform) : 'Sin plataforma'}
          </span>
        </div>
      </div>
    ),
  },
  {
    clave: 'unitario',
    titulo: 'Precio unitario',
    className: 'text-right',
    celda: (l) => <span className="adm-num text-slate-600">{cop(l.unitPrice)}</span>,
  },
  {
    clave: 'cantidad',
    titulo: 'Cantidad',
    className: 'text-right',
    celda: (l) => <span className="adm-num text-slate-600">{l.qty}</span>,
  },
  {
    clave: 'subtotal',
    titulo: 'Subtotal',
    className: 'text-right',
    celda: (l) => (
      <span className="adm-num font-semibold text-slate-900">
        {cop(l.unitPrice * l.qty)}
      </span>
    ),
  },
]

const tarjetaLinea = (l: OrderItem) => (
  <div className="flex items-center gap-3">
    <Miniatura url={l.image} nombre={l.name} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13.5px] font-semibold text-slate-900">{l.name}</p>
      <p className="adm-num text-[12px] text-slate-500">
        {l.qty} × {cop(l.unitPrice)}
        {l.platform ? ` · ${platformShort(l.platform)}` : ''}
      </p>
    </div>
    <span className="adm-num shrink-0 text-[13.5px] font-bold text-slate-900">
      {cop(l.unitPrice * l.qty)}
    </span>
  </div>
)

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function PedidoDetalle() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const avisos = useAvisos()
  const confirmar = useConfirmar()
  const { perfil, apiViva } = useAuth()

  const puedeEliminar = puedeBorrar(perfil?.role)

  const [pedido, setPedido] = useState<Order | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Estado que se está aplicando: bloquea la fila entera mientras viaja. */
  const [cambiando, setCambiando] = useState<OrderStatus | null>(null)
  const [notas, setNotas] = useState('')
  const [envio, setEnvio] = useState('')
  const [guardandoNotas, setGuardandoNotas] = useState(false)
  const [guardandoEnvio, setGuardandoEnvio] = useState(false)
  const [borrando, setBorrando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const encontrado = await obtenerPedido(id)
      setPedido(encontrado)
      // Los campos editables parten siempre de lo guardado, no de lo tecleado
      // antes: tras recargar no puede quedar un valor a medias en pantalla.
      setNotas(encontrado?.notes ?? '')
      setEnvio(encontrado ? String(encontrado.shipping) : '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el pedido')
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    document.title = pedido
      ? `Pedido ${pedido.code} · Panel GOOD GAME`
      : 'Pedido · Panel GOOD GAME'
  }, [pedido])

  const cambiarEstado = useCallback(
    async (nuevo: OrderStatus) => {
      if (!pedido || nuevo === pedido.status) return

      // Cancelar es lo único que borra una venta ya contada de las métricas;
      // el resto del flujo avanza sin fricción porque equivocarse se arregla
      // pulsando otro estado.
      if (nuevo === 'cancelado') {
        const seguro = await confirmar({
          titulo: 'Cancelar el pedido',
          mensaje: `El pedido ${pedido.code} dejará de contar como venta en las cifras del panel. Podrás devolverlo a otro estado, pero mientras tanto no suma.`,
          confirmar: 'Sí, cancelar',
          cancelar: 'Volver',
        })
        if (!seguro) return
      }

      setCambiando(nuevo)
      try {
        await cambiarEstadoPedido(pedido.id, nuevo)
        // Se toca solo el estado sobre el pedido más reciente: si mientras
        // viajaba la petición se guardaron las notas, escribir la copia de
        // antes las devolvería a como estaban.
        setPedido((p) => (p ? { ...p, status: nuevo } : p))
        avisos.exito(`Pedido marcado como «${etiquetaEstado(nuevo)}».`)
      } catch (e) {
        avisos.error(e)
      } finally {
        setCambiando(null)
      }
    },
    [avisos, confirmar, pedido]
  )

  async function guardarNotas(e: FormEvent) {
    e.preventDefault()
    if (!pedido) return

    setGuardandoNotas(true)
    try {
      const limpias = notas.trim() || null
      await actualizarPedido(pedido.id, { notes: limpias })
      setPedido((p) => (p ? { ...p, notes: limpias } : p))
      // El campo se iguala a lo guardado: si no, unos espacios al final dejarían
      // el botón activo como si quedara algo por guardar.
      setNotas(limpias ?? '')
      avisos.exito('Notas guardadas.')
    } catch (err) {
      avisos.error(err)
    } finally {
      setGuardandoNotas(false)
    }
  }

  async function guardarEnvio(e: FormEvent) {
    e.preventDefault()
    if (!pedido) return

    setGuardandoEnvio(true)
    try {
      await actualizarPedido(pedido.id, { shipping: Math.max(0, Number(envio) || 0) })
      // El total lo recalcula el servicio a partir del subtotal guardado, así
      // que se relee el pedido en vez de adivinar la cifra aquí.
      //
      // Se relee a mano en vez de llamar a `cargar()`: aquella iguala también
      // las notas a lo guardado, y si el usuario tenía notas escritas sin
      // guardar, actualizar el envío se las borraría sin avisar.
      const actualizado = await obtenerPedido(pedido.id)
      if (actualizado) {
        setPedido(actualizado)
        setEnvio(String(actualizado.shipping))
      }
      avisos.exito('Envío actualizado y total recalculado.')
    } catch (err) {
      avisos.error(err)
    } finally {
      setGuardandoEnvio(false)
    }
  }

  async function eliminar() {
    if (!pedido) return

    const seguro = await confirmar({
      titulo: 'Eliminar pedido',
      mensaje: `El pedido ${pedido.code} y sus líneas se borrarán del historial de ventas. El cliente y sus otras compras no se tocan. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar pedido',
    })
    if (!seguro) return

    setBorrando(true)
    try {
      await eliminarPedido(pedido.id)
      avisos.exito(`Se eliminó el pedido ${pedido.code}.`)
      navegar('/admin/pedidos', { replace: true })
    } catch (e) {
      avisos.error(e)
      setBorrando(false)
    }
  }

  if (cargando) return <Cargando texto="Cargando el pedido…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  if (!pedido) {
    return (
      <div className="adm-card">
        <EstadoVacio
          icono={ClipboardList}
          titulo="No encontramos este pedido"
          descripcion={
            apiViva
              ? 'Puede que se haya eliminado o que el enlace esté equivocado. Vuelve al listado para verlos todos.'
              : 'Todavía no hay base de datos conectada, así que aún no existe ningún pedido guardado.'
          }
        >
          <Link to="/admin/pedidos" className="adm-btn-suave adm-btn-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a pedidos
          </Link>
        </EstadoVacio>
      </div>
    )
  }

  const cliente = pedido.customer ?? null
  const envioCambiado = Math.max(0, Number(envio) || 0) !== pedido.shipping
  const notasCambiadas = notas !== (pedido.notes ?? '')

  return (
    <>
      <Encabezado
        titulo={pedido.code}
        descripcion={`Registrado el ${fechaLarga(pedido.createdAt)} · Canal: ${etiquetaCanal(
          pedido.channel
        )}`}
      >
        <span className="flex items-center">
          <Etiqueta tono={tonoEstado(pedido.status)}>{etiquetaEstado(pedido.status)}</Etiqueta>
        </span>
        <Link to="/admin/pedidos" className="adm-btn-suave adm-btn-sm">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a pedidos
        </Link>
      </Encabezado>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* ── Estado ────────────────────────────────────────────────────── */}
          <section className="adm-card-pad">
            <h2 className="adm-titulo text-[15px]">Estado del pedido</h2>
            <p className="adm-sub mt-0.5">
              Marca en qué punto va la entrega. El cliente no lo ve: sirve para que el
              equipo sepa qué falta por hacer.
            </p>

            <div
              role="group"
              aria-label="Cambiar el estado del pedido"
              className="mt-3 flex flex-wrap gap-2"
            >
              {ESTADOS_PEDIDO.map((e) => {
                const actual = e.id === pedido.status
                const destructivo = e.id === 'cancelado'
                const enCurso = cambiando === e.id

                // El estado activo lleva marca de verificación además del
                // color: quien no distingue el relleno igual sabe cuál es.
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={actual}
                    disabled={cambiando !== null || actual}
                    onClick={() => void cambiarEstado(e.id)}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors disabled:cursor-default sm:min-h-[38px] ${
                      actual
                        ? destructivo
                          ? 'border-alert-600 bg-alert-600 text-white'
                          : 'border-ink-900 bg-ink-900 text-white'
                        : destructivo
                          ? 'border-red-200 bg-white text-alert-600 hover:bg-red-50 disabled:opacity-45'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-45'
                    }`}
                  >
                    {enCurso ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      actual && <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {e.label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Productos ─────────────────────────────────────────────────── */}
          <section className="adm-card overflow-hidden">
            <div className="border-b border-slate-200 p-4 sm:px-5">
              <h2 className="adm-titulo text-[15px]">Productos</h2>
              <p className="adm-sub mt-0.5">
                Nombres y precios tal como estaban el día de la venta. Cambiar el catálogo
                después no altera este pedido.
              </p>
            </div>

            <Tabla
              datos={pedido.items}
              columnas={COLUMNAS_LINEAS}
              claveFila={(l) => l.id}
              tarjetaMovil={tarjetaLinea}
              vacio={
                <EstadoVacio
                  icono={PackageOpen}
                  titulo="Este pedido no tiene líneas"
                  descripcion="Se registró sin productos. Puedes eliminarlo y volver a registrarlo con lo que se vendió."
                />
              }
            />

            {/* ── Envío y totales ─────────────────────────────────────────── */}
            <div className="border-t border-slate-200 bg-slate-50 p-4 sm:px-5">
              <form
                onSubmit={guardarEnvio}
                className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end"
              >
                <div className="sm:w-44">
                  <Entrada
                    label="Envío cobrado"
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    value={envio}
                    onChange={(ev) => setEnvio(ev.target.value)}
                    className="adm-num"
                  />
                </div>
                <button
                  type="submit"
                  disabled={guardandoEnvio || !envioCambiado}
                  className="adm-btn-oscuro adm-btn-sm sm:mb-0.5"
                >
                  {guardandoEnvio && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {guardandoEnvio ? 'Guardando…' : 'Actualizar envío'}
                </button>
              </form>

              <dl className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-600">Subtotal</dt>
                  <dd className="adm-num font-semibold text-slate-800">
                    {cop(pedido.subtotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-600">Envío</dt>
                  <dd className="adm-num font-semibold text-slate-800">
                    {cop(pedido.shipping)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-1.5">
                  <dt className="font-bold text-slate-900">Total</dt>
                  <dd className="adm-num text-[16px] font-bold text-slate-900">
                    {cop(pedido.total)}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {/* ── Notas ─────────────────────────────────────────────────────── */}
          <form onSubmit={guardarNotas} className="adm-card-pad">
            <h2 className="adm-titulo text-[15px]">Notas</h2>
            <p className="adm-sub mb-3 mt-0.5">
              Solo se ven en el panel. El cliente nunca las lee.
            </p>

            <AreaTexto
              label="Anotaciones del pedido"
              value={notas}
              onChange={(ev) => setNotas(ev.target.value)}
              rows={4}
              ayuda="Dirección de entrega, acuerdos de la conversación, lo que convenga recordar."
            />

            <div className="mt-3 flex justify-end">
              <BotonGuardar
                guardando={guardandoNotas}
                disabled={!notasCambiadas}
                className="adm-btn-sm"
              >
                Guardar notas
              </BotonGuardar>
            </div>
          </form>
        </div>

        {/* ── Columna lateral ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          <section className="adm-card-pad">
            <h2 className="adm-titulo text-[15px]">Cliente</h2>

            {!cliente ? (
              <p className="adm-sub mt-2">
                Este pedido no tiene ningún cliente asociado, así que no suma a ninguna
                ficha ni aparece en el historial de compras de nadie.
              </p>
            ) : (
              // El icono va dentro del <dt> para que cada pareja del <dl> siga
              // siendo dt + dd y la lista de definiciones no se rompa.
              <dl className="mt-3 space-y-3 text-[13.5px]">
                <div>
                  <dt className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                    <User className="h-3.5 w-3.5" aria-hidden="true" />
                    Nombre
                  </dt>
                  <dd className="mt-0.5 break-words font-semibold text-slate-900">
                    {cliente.name}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    WhatsApp
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`https://wa.me/${normalizarWhatsapp(cliente.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-num font-semibold text-blue-700 hover:underline"
                      aria-label={`Escribirle a ${cliente.name} por WhatsApp (se abre en una pestaña nueva)`}
                    >
                      {cliente.whatsapp}
                    </a>
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    Correo
                  </dt>
                  <dd className="mt-0.5 break-words text-slate-700">
                    {cliente.email ? (
                      <a
                        href={`mailto:${cliente.email}`}
                        className="text-blue-700 hover:underline"
                      >
                        {cliente.email}
                      </a>
                    ) : (
                      <span className="text-slate-400">Sin correo registrado</span>
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Ciudad
                  </dt>
                  <dd className="mt-0.5 text-slate-700">
                    {cliente.city || (
                      <span className="text-slate-400">Sin ciudad registrada</span>
                    )}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          {puedeEliminar && (
            <section className="adm-card border-red-200 p-4 sm:p-5">
              <h2 className="font-display text-[14px] font-bold text-slate-900">
                Eliminar este pedido
              </h2>
              <p className="adm-sub mt-1">
                Se borran el pedido y sus líneas, y las ventas del panel dejan de contarlo.
                El cliente y sus otras compras no se tocan.
              </p>
              <button
                type="button"
                onClick={() => void eliminar()}
                disabled={borrando}
                className="adm-btn-peligro adm-btn-sm mt-3"
              >
                {borrando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {borrando ? 'Eliminando…' : 'Eliminar pedido'}
              </button>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
