import {
  ArrowUpRight,
  CalendarDays,
  Eye,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  ShoppingBag,
  StickyNote,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

import { useAvisos } from '@/components/admin/Avisos'
import { Modal, useConfirmar } from '@/components/admin/Modal'
import { Buscador, Tabla, type Columna } from '@/components/admin/Tabla'
import {
  AreaTexto,
  BotonGuardar,
  Cargando,
  Cifra,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
} from '@/components/admin/UI'
import { useAuth } from '@/hooks/useAuth'
import { cop, normalize, pluralize } from '@/lib/format'
import { normalizarWhatsapp } from '@/services/ajustes'
import { puedeBorrar } from '@/services/autenticacion'
import {
  ESTADOS_PEDIDO,
  actualizarCliente,
  crearCliente,
  eliminarCliente,
  etiquetaEstado,
  listarClientes,
  listarPedidos,
  type ClienteInput,
} from '@/services/pedidos'
import type { Customer, Order } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Clientes.
//
// La ficha del cliente no guarda ni el número de pedidos, ni lo que ha gastado,
// ni la fecha de su última compra: esas tres cifras las calcula
// `listarClientes()` sobre los pedidos reales. Por eso aquí nunca se escriben —
// se leen y ya. Si un pedido se anula, el total baja solo y no queda un dato
// viejo mintiendo en la tabla.
//
// El WhatsApp es la clave única del cliente, así que se normaliza SIEMPRE antes
// de guardar: sin eso, «300 123 4567» y «+57 300 123 4567» crearían dos fichas
// distintas de la misma persona y el histórico de compras quedaría partido.
// ─────────────────────────────────────────────────────────────────────────────

type TonoChip = 'verde' | 'ambar' | 'rojo' | 'azul' | 'gris'

interface FormCliente {
  nombre: string
  whatsapp: string
  email: string
  ciudad: string
  notas: string
}

interface ErroresCliente {
  nombre?: string
  whatsapp?: string
  email?: string
}

const FORM_VACIO: FormCliente = { nombre: '', whatsapp: '', email: '', ciudad: '', notas: '' }

const ID_FORM = 'form-cliente'

/** 573001234567 → «+57 300 123 4567». Si el número no cuadra, se muestra tal cual. */
function mostrarWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  if (digitos.length === 12 && digitos.startsWith('57')) {
    const n = digitos.slice(2)
    return `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return numero
}

/** Fecha corta en español. Devuelve «—» cuando no hay dato, nunca «Invalid Date». */
function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return '—'
  return f.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** ESTADOS_PEDIDO declara `tono` como string suelto; aquí se acota al chip. */
function tonoEstado(estado: Order['status']): TonoChip {
  return (ESTADOS_PEDIDO.find((e) => e.id === estado)?.tono ?? 'gris') as TonoChip
}

function validar(form: FormCliente): ErroresCliente {
  const errores: ErroresCliente = {}

  if (!form.nombre.trim()) errores.nombre = 'Escribe el nombre del cliente.'

  const digitos = form.whatsapp.replace(/\D/g, '')
  if (!digitos) errores.whatsapp = 'Escribe el número de WhatsApp.'
  else if (digitos.length < 10) {
    errores.whatsapp = 'El número está incompleto: faltan dígitos del celular.'
  }

  // El correo es opcional, pero uno mal escrito es peor que ninguno.
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errores.email = 'Ese correo no parece válido.'
  }

  return errores
}

/** Par etiqueta/valor de la ficha del cliente. */
function Dato({
  icono: Icono,
  etiqueta,
  children,
}: {
  icono: LucideIcon
  etiqueta: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icono className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">
          {etiqueta}
        </p>
        <div className="break-words text-[13.5px] text-slate-700">{children}</div>
      </div>
    </div>
  )
}

export default function Clientes() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()
  const { perfil } = useAuth()
  const puedeEliminar = puedeBorrar(perfil?.role)

  const [clientes, setClientes] = useState<Customer[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  // Los pedidos solo hacen falta dentro de la ficha, así que se traen la primera
  // vez que se abre una y se reutilizan. Pedir el histórico completo al entrar a
  // la pantalla sería una descarga que la mayoría de visitas no llega a usar.
  const [pedidos, setPedidos] = useState<Order[] | null>(null)
  const [estadoPedidos, setEstadoPedidos] = useState<'inactivo' | 'cargando' | 'error'>('inactivo')

  // Se guarda el id, no el objeto: así la ficha abierta refleja cualquier
  // recarga de la lista (y se cierra sola si el cliente se elimina).
  const [verPerfilId, setVerPerfilId] = useState<string | null>(null)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<FormCliente>(FORM_VACIO)
  const [errores, setErrores] = useState<ErroresCliente>({})
  const [guardando, setGuardando] = useState(false)

  // El modal vuelve a montar su trampa de foco cada vez que `onCerrar` cambia de
  // identidad. Si estas funciones se redefinieran en cada render, el foco
  // saltaría fuera del formulario con cada tecla, así que se quedan fijas y el
  // estado de guardado se consulta por referencia.
  const guardandoRef = useRef(false)
  useEffect(() => {
    guardandoRef.current = guardando
  }, [guardando])

  const cerrarPerfil = useCallback(() => setVerPerfilId(null), [])

  const cerrarFormulario = useCallback(() => {
    // Mientras se guarda no se cierra: la ficha quedaría a medias sin que nadie
    // vea si el cambio entró o falló.
    if (guardandoRef.current) return
    setFormAbierto(false)
  }, [])

  /**
   * `silencioso` refresca la lista sin sustituir la pantalla por el cargador.
   * Se usa después de guardar o eliminar: parpadear la tabla entera por un
   * cambio de una fila hace perder el sitio donde se estaba trabajando.
   */
  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true)
    setError(null)
    try {
      setClientes(await listarClientes())
      // Los totales acaban de recalcularse: el caché de pedidos ya no es de fiar.
      setPedidos(null)
      setEstadoPedidos('inactivo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const cargarPedidos = useCallback(async () => {
    setEstadoPedidos('cargando')
    try {
      setPedidos(await listarPedidos())
      setEstadoPedidos('inactivo')
    } catch (e) {
      avisos.error(e)
      setEstadoPedidos('error')
    }
  }, [avisos])

  const abrirPerfil = useCallback(
    (id: string) => {
      setVerPerfilId(id)
      if (pedidos === null && estadoPedidos !== 'cargando') void cargarPedidos()
    },
    [pedidos, estadoPedidos, cargarPedidos]
  )

  function abrirNuevo() {
    setEditandoId(null)
    setFormulario(FORM_VACIO)
    setErrores({})
    setFormAbierto(true)
  }

  function abrirEdicion(c: Customer) {
    setEditandoId(c.id)
    setFormulario({
      nombre: c.name,
      whatsapp: c.whatsapp,
      email: c.email ?? '',
      ciudad: c.city ?? '',
      notas: c.notes ?? '',
    })
    setErrores({})
    setFormAbierto(true)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const fallos = validar(formulario)
    setErrores(fallos)
    if (Object.keys(fallos).length > 0) return

    // Las cinco claves coinciden con los nombres de columna, que es lo que el
    // servicio manda tal cual a la base. Renombrar alguna aquí rompería el alta.
    const entrada: ClienteInput = {
      name: formulario.nombre.trim(),
      whatsapp: normalizarWhatsapp(formulario.whatsapp),
      email: formulario.email.trim() || null,
      city: formulario.ciudad.trim() || null,
      notes: formulario.notas.trim() || null,
    }

    setGuardando(true)
    try {
      if (editandoId) {
        await actualizarCliente(editandoId, entrada)
        avisos.exito('Cliente actualizado.')
      } else {
        await crearCliente(entrada)
        avisos.exito(`Se agregó a ${entrada.name}.`)
      }
      setFormAbierto(false)
      await cargar(true)
    } catch (err) {
      // Sin base de datos conectada esto lanza a propósito; el aviso lo explica.
      avisos.error(err)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(c: Customer) {
    const nPedidos = c.orderCount ?? 0
    const arrastre =
      nPedidos > 0
        ? ` Sus ${pluralize(nPedidos, 'pedido', 'pedidos')} no se borran: quedan registrados sin cliente asociado.`
        : ''

    const confirmado = await confirmar({
      titulo: `¿Eliminar a ${c.name}?`,
      mensaje: `Se borra la ficha del cliente y no se puede deshacer.${arrastre}`,
      confirmar: 'Eliminar cliente',
    })
    if (!confirmado) return

    try {
      await eliminarCliente(c.id)
      avisos.exito(`Se eliminó a ${c.name}.`)
      if (verPerfilId === c.id) setVerPerfilId(null)
      await cargar(true)
    } catch (err) {
      avisos.error(err)
    }
  }

  const resumen = useMemo(() => {
    let conPedidos = 0
    let comprado = 0
    for (const c of clientes) {
      if ((c.orderCount ?? 0) > 0) conPedidos += 1
      comprado += c.totalSpent ?? 0
    }
    return { conPedidos, comprado }
  }, [clientes])

  const filtrados = useMemo(() => {
    const q = normalize(busqueda)
    if (!q) return clientes
    // Los dígitos se comparan aparte para que «300 123» encuentre igual a quien
    // tiene el número guardado como 573001234567.
    const digitos = q.replace(/\D/g, '')
    return clientes.filter((c) => {
      if (normalize(c.name).includes(q)) return true
      if (c.city && normalize(c.city).includes(q)) return true
      if (c.email && normalize(c.email).includes(q)) return true
      return digitos.length > 0 && c.whatsapp.replace(/\D/g, '').includes(digitos)
    })
  }, [clientes, busqueda])

  const clientePerfil = verPerfilId ? (clientes.find((c) => c.id === verPerfilId) ?? null) : null
  const pedidosDelPerfil = useMemo(
    () =>
      clientePerfil && pedidos ? pedidos.filter((p) => p.customerId === clientePerfil.id) : [],
    [clientePerfil, pedidos]
  )

  const columnas: Columna<Customer>[] = [
    {
      clave: 'cliente',
      titulo: 'Cliente',
      orden: (c) => normalize(c.name),
      celda: (c) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{c.name}</p>
          {c.email && <p className="truncate text-[12px] text-slate-500">{c.email}</p>}
        </div>
      ),
    },
    {
      clave: 'whatsapp',
      titulo: 'WhatsApp',
      orden: (c) => c.whatsapp,
      celda: (c) => (
        <a
          href={`https://wa.me/${normalizarWhatsapp(c.whatsapp)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Escribir a ${c.name} por WhatsApp`}
          className="inline-flex items-center gap-1.5 rounded font-medium text-blue-700 hover:text-blue-800 hover:underline"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="adm-num whitespace-nowrap">{mostrarWhatsapp(c.whatsapp)}</span>
        </a>
      ),
    },
    {
      clave: 'ciudad',
      titulo: 'Ciudad',
      orden: (c) => normalize(c.city ?? ''),
      celda: (c) => c.city || <span className="text-slate-400">—</span>,
    },
    {
      clave: 'pedidos',
      titulo: 'Pedidos',
      className: 'text-center',
      orden: (c) => c.orderCount ?? 0,
      celda: (c) => <span className="adm-num font-semibold">{c.orderCount ?? 0}</span>,
    },
    {
      clave: 'total',
      titulo: 'Total comprado',
      className: 'text-right',
      orden: (c) => c.totalSpent ?? 0,
      celda: (c) => (
        <span className="adm-num font-semibold text-slate-900">{cop(c.totalSpent ?? 0)}</span>
      ),
    },
    {
      clave: 'ultimo',
      titulo: 'Último pedido',
      orden: (c) => c.lastOrderAt ?? '',
      celda: (c) => <span className="adm-num whitespace-nowrap">{fechaCorta(c.lastOrderAt)}</span>,
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      className: 'text-right',
      soloTabla: true,
      celda: (c) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => abrirPerfil(c.id)}
            className="adm-icono"
            aria-label={`Ver el perfil de ${c.name}`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => abrirEdicion(c)}
            className="adm-icono"
            aria-label={`Editar a ${c.name}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          {puedeEliminar && (
            <button
              type="button"
              onClick={() => void eliminar(c)}
              className="adm-icono hover:bg-red-50 hover:text-alert-600"
              aria-label={`Eliminar a ${c.name}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ),
    },
  ]

  if (cargando) return <Cargando texto="Cargando clientes…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  return (
    <>
      <Encabezado
        titulo="Clientes"
        descripcion="Quién te compra y cuánto. Los pedidos y los totales se calculan solos a partir de los pedidos registrados; la lista empieza por los clientes más recientes."
      >
        <button type="button" onClick={abrirNuevo} className="adm-btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar cliente
        </button>
      </Encabezado>

      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra icono={Users} etiqueta="Clientes" valor={clientes.length} nota="Fichas registradas" />
        <Cifra
          icono={ShoppingBag}
          etiqueta="Con pedidos"
          valor={resumen.conPedidos}
          nota="Han comprado al menos una vez"
          tono="verde"
        />
        <Cifra
          icono={Wallet}
          etiqueta="Total comprado"
          valor={cop(resumen.comprado)}
          nota="Suma de los pedidos no cancelados de estos clientes"
        />
      </div>

      {clientes.length === 0 ? (
        <div className="adm-card mt-4">
          <EstadoVacio
            icono={Users}
            titulo="Todavía no hay clientes"
            descripcion="Los clientes se crean solos al registrar un pedido, o puedes añadirlos a mano."
          >
            <button type="button" onClick={abrirNuevo} className="adm-btn-primary">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Agregar cliente
            </button>
          </EstadoVacio>
        </div>
      ) : (
        <div className="adm-card mt-4 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <Buscador
              valor={busqueda}
              onChange={setBusqueda}
              placeholder="Nombre, WhatsApp o ciudad…"
              etiqueta="Buscar clientes por nombre, WhatsApp, ciudad o correo"
            />
            <p className="adm-num shrink-0 text-[12.5px] text-slate-500" aria-live="polite">
              {pluralize(filtrados.length, 'cliente', 'clientes')}
              {filtrados.length !== clientes.length && ` de ${clientes.length}`}
            </p>
          </div>

          <Tabla
            datos={filtrados}
            columnas={columnas}
            claveFila={(c) => c.id}
            vacio={
              <div className="px-5 py-12 text-center">
                <p className="text-[13.5px] font-semibold text-slate-700">
                  Ningún cliente coincide con «{busqueda}»
                </p>
                <p className="mt-1 text-[13px] text-slate-500">
                  Prueba con parte del nombre o con los últimos dígitos del celular.
                </p>
              </div>
            }
            tarjetaMovil={(c) => (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{c.name}</p>
                    {c.email && <p className="truncate text-[12px] text-slate-500">{c.email}</p>}
                    <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                      {c.city || 'Sin ciudad'}
                    </p>
                  </div>
                  <Etiqueta tono={(c.orderCount ?? 0) > 0 ? 'azul' : 'gris'}>
                    {pluralize(c.orderCount ?? 0, 'pedido', 'pedidos')}
                  </Etiqueta>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <a
                    href={`https://wa.me/${normalizarWhatsapp(c.whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Escribir a ${c.name} por WhatsApp`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-medium text-blue-700"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="adm-num">{mostrarWhatsapp(c.whatsapp)}</span>
                  </a>
                  <span className="adm-num shrink-0 text-[14px] font-bold text-slate-900">
                    {cop(c.totalSpent ?? 0)}
                  </span>
                </div>

                <p className="text-[12px] text-slate-400">
                  Último pedido: <span className="adm-num">{fechaCorta(c.lastOrderAt)}</span>
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => abrirPerfil(c.id)}
                    className="adm-btn-suave flex-1"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    Ver perfil
                  </button>
                  <button type="button" onClick={() => abrirEdicion(c)} className="adm-btn-suave">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Editar
                  </button>
                  {puedeEliminar && (
                    <button
                      type="button"
                      onClick={() => void eliminar(c)}
                      className="adm-btn-suave text-alert-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* ── Ficha del cliente ───────────────────────────────────────────────── */}
      <Modal
        abierto={clientePerfil !== null}
        onCerrar={cerrarPerfil}
        titulo={clientePerfil?.name ?? 'Cliente'}
        descripcion={
          clientePerfil ? `Cliente desde ${fechaCorta(clientePerfil.createdAt)}` : undefined
        }
        ancho="lg"
        pie={
          <>
            <button type="button" onClick={cerrarPerfil} className="adm-btn-suave adm-btn-sm">
              Cerrar
            </button>
            {clientePerfil && (
              <button
                type="button"
                onClick={() => {
                  const c = clientePerfil
                  setVerPerfilId(null)
                  abrirEdicion(c)
                }}
                className="adm-btn-oscuro adm-btn-sm"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Editar cliente
              </button>
            )}
          </>
        }
      >
        {clientePerfil && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Dato icono={MessageCircle} etiqueta="WhatsApp">
                <a
                  href={`https://wa.me/${normalizarWhatsapp(clientePerfil.whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Escribir a ${clientePerfil.name} por WhatsApp`}
                  className="adm-num font-medium text-blue-700 hover:underline"
                >
                  {mostrarWhatsapp(clientePerfil.whatsapp)}
                </a>
              </Dato>
              <Dato icono={Mail} etiqueta="Correo">
                {clientePerfil.email ? (
                  <a
                    href={`mailto:${clientePerfil.email}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {clientePerfil.email}
                  </a>
                ) : (
                  <span className="text-slate-400">Sin correo</span>
                )}
              </Dato>
              <Dato icono={MapPin} etiqueta="Ciudad">
                {clientePerfil.city || <span className="text-slate-400">Sin ciudad</span>}
              </Dato>
              <Dato icono={CalendarDays} etiqueta="Último pedido">
                <span className="adm-num">{fechaCorta(clientePerfil.lastOrderAt)}</span>
              </Dato>
            </div>

            {clientePerfil.notes && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Dato icono={StickyNote} etiqueta="Notas internas">
                  <p className="whitespace-pre-wrap leading-relaxed">{clientePerfil.notes}</p>
                </Dato>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
                  Pedidos
                </p>
                <p className="adm-num mt-0.5 font-display text-xl font-bold text-slate-900">
                  {clientePerfil.orderCount ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
                  Total comprado
                </p>
                <p className="adm-num mt-0.5 font-display text-xl font-bold text-slate-900">
                  {cop(clientePerfil.totalSpent ?? 0)}
                </p>
              </div>
            </div>

            <div>
              <h3 className="adm-titulo text-[15px]">Sus pedidos</h3>

              {/* `pedidos === null` es «todavía no se han pedido», no «no tiene
                  ninguno»: sin esta distinción la ficha afirmaría que el cliente
                  no ha comprado nunca antes de haber mirado. */}
              {estadoPedidos === 'cargando' || (pedidos === null && estadoPedidos !== 'error') ? (
                <Cargando texto="Cargando pedidos…" />
              ) : estadoPedidos === 'error' ? (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
                  <p className="text-[13px] text-red-800">
                    No se pudieron cargar los pedidos de este cliente.
                  </p>
                  <button
                    type="button"
                    onClick={() => void cargarPedidos()}
                    className="adm-btn-suave adm-btn-sm mt-3"
                  >
                    Reintentar
                  </button>
                </div>
              ) : pedidosDelPerfil.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-[13px] text-slate-500">
                  Este cliente todavía no tiene pedidos registrados.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {pedidosDelPerfil.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/admin/pedidos/${p.id}`}
                        onClick={cerrarPerfil}
                        className="flex min-h-[56px] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="adm-num block truncate text-[13.5px] font-semibold text-slate-900">
                            {p.code}
                          </span>
                          <span className="adm-num block text-[12px] text-slate-500">
                            {fechaCorta(p.createdAt)} · {pluralize(p.items.length, 'artículo', 'artículos')}
                          </span>
                        </span>
                        <Etiqueta tono={tonoEstado(p.status)}>{etiquetaEstado(p.status)}</Etiqueta>
                        <span className="adm-num shrink-0 text-[13.5px] font-bold text-slate-900">
                          {cop(p.total)}
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Alta y edición ──────────────────────────────────────────────────── */}
      <Modal
        abierto={formAbierto}
        onCerrar={cerrarFormulario}
        titulo={editandoId ? 'Editar cliente' : 'Agregar cliente'}
        descripcion="El WhatsApp identifica al cliente: no puede repetirse en dos fichas."
        ancho="md"
        pie={
          <>
            <button
              type="button"
              onClick={cerrarFormulario}
              disabled={guardando}
              className="adm-btn-suave adm-btn-sm"
            >
              Cancelar
            </button>
            {/* El pie vive fuera del <form>, así que el botón se enlaza por id. */}
            <BotonGuardar form={ID_FORM} guardando={guardando} className="adm-btn-sm">
              {editandoId ? 'Guardar cambios' : 'Agregar cliente'}
            </BotonGuardar>
          </>
        }
      >
        <form id={ID_FORM} onSubmit={guardar} className="space-y-4" noValidate>
          <Entrada
            id="cliente-nombre"
            label="Nombre"
            requerido
            value={formulario.nombre}
            onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))}
            error={errores.nombre}
            autoComplete="name"
            placeholder="Nombre y apellido"
          />

          <Entrada
            id="cliente-whatsapp"
            label="WhatsApp"
            requerido
            type="tel"
            inputMode="tel"
            value={formulario.whatsapp}
            onChange={(e) => setFormulario((f) => ({ ...f, whatsapp: e.target.value }))}
            error={errores.whatsapp}
            ayuda="Solo el celular: se guarda con el indicativo 57 aunque no lo escribas."
            placeholder="3001234567"
          />

          <Entrada
            id="cliente-email"
            label="Correo electrónico"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={formulario.email}
            onChange={(e) => setFormulario((f) => ({ ...f, email: e.target.value }))}
            error={errores.email}
            ayuda="Opcional."
            placeholder="cliente@ejemplo.com"
          />

          <Entrada
            id="cliente-ciudad"
            label="Ciudad"
            value={formulario.ciudad}
            onChange={(e) => setFormulario((f) => ({ ...f, ciudad: e.target.value }))}
            ayuda="Opcional. Sirve para coordinar el envío."
            placeholder="Itagüí"
          />

          <AreaTexto
            id="cliente-notas"
            label="Notas internas"
            value={formulario.notas}
            onChange={(e) => setFormulario((f) => ({ ...f, notas: e.target.value }))}
            ayuda="Opcional. Solo las ve el equipo: preferencias, acuerdos, avisos."
            placeholder="Prefiere que le escriban por la tarde."
          />
        </form>
      </Modal>
    </>
  )
}
