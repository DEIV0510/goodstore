import { cliente, exigirBackend } from '@/lib/supabase'
import type { Customer, Order, OrderItem, OrderStatus, Platform } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Pedidos y clientes.
//
// Hoy la venta se cierra por WhatsApp, así que la tienda pública no crea
// pedidos sola: los registra el administrador cuando la conversación termina en
// una compra. Toda la maquinaria queda lista para automatizarlo después.
//
// Sin base de datos conectada devuelve listas vacías. Un pedido de ejemplo
// falsearía las cifras del panel, que es justo lo que no puede pasar.
// ─────────────────────────────────────────────────────────────────────────────

export const ESTADOS_PEDIDO: { id: OrderStatus; label: string; tono: string }[] = [
  { id: 'pendiente', label: 'Pendiente', tono: 'ambar' },
  { id: 'confirmado', label: 'Confirmado', tono: 'azul' },
  { id: 'preparando', label: 'Preparando', tono: 'azul' },
  { id: 'enviado', label: 'Enviado', tono: 'azul' },
  { id: 'entregado', label: 'Entregado', tono: 'verde' },
  { id: 'cancelado', label: 'Cancelado', tono: 'rojo' },
]

export const etiquetaEstado = (e: OrderStatus) =>
  ESTADOS_PEDIDO.find((x) => x.id === e)?.label ?? e

// ── Clientes ─────────────────────────────────────────────────────────────────

interface FilaCliente {
  id: string
  name: string
  whatsapp: string
  email: string | null
  city: string | null
  notes: string | null
  created_at: string
}

const clienteDesdeFila = (f: FilaCliente): Customer => ({
  id: f.id,
  name: f.name,
  whatsapp: f.whatsapp,
  email: f.email,
  city: f.city,
  notes: f.notes,
  createdAt: f.created_at,
})

export type ClienteInput = Pick<Customer, 'name' | 'whatsapp'> &
  Partial<Pick<Customer, 'email' | 'city' | 'notes'>>

/**
 * Devuelve los clientes con sus totales calculados a partir de los pedidos.
 * No se guardan duplicados en la tabla: si un pedido cambia, el total cambia
 * solo y nunca queda desincronizado.
 */
export async function listarClientes(): Promise<Customer[]> {
  const db = await cliente()
  if (!db) return []

  const [{ data: clientes, error: e1 }, { data: pedidos, error: e2 }] =
    await Promise.all([
      db
        .from('customers')
        .select('id, name, whatsapp, email, city, notes, created_at')
        .order('created_at', { ascending: false }),
      db.from('orders').select('customer_id, total, status, created_at'),
    ])
  if (e1) throw e1
  if (e2) throw e2

  const resumen = new Map<string, { n: number; total: number; ultimo: string | null }>()
  for (const p of pedidos ?? []) {
    const id = p.customer_id as string | null
    if (!id) continue
    const acumulado = resumen.get(id) ?? { n: 0, total: 0, ultimo: null }
    acumulado.n += 1
    // Un pedido cancelado no cuenta como dinero comprado.
    if (p.status !== 'cancelado') acumulado.total += (p.total as number) ?? 0
    const fecha = p.created_at as string
    if (!acumulado.ultimo || fecha > acumulado.ultimo) acumulado.ultimo = fecha
    resumen.set(id, acumulado)
  }

  return (clientes as unknown as FilaCliente[]).map((f) => {
    const r = resumen.get(f.id)
    return {
      ...clienteDesdeFila(f),
      orderCount: r?.n ?? 0,
      totalSpent: r?.total ?? 0,
      lastOrderAt: r?.ultimo ?? null,
    }
  })
}

export async function obtenerCliente(id: string): Promise<Customer | null> {
  const db = await cliente()
  if (!db) return null
  const { data, error } = await db
    .from('customers')
    .select('id, name, whatsapp, email, city, notes, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? clienteDesdeFila(data as unknown as FilaCliente) : null
}

export async function crearCliente(entrada: ClienteInput): Promise<Customer> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('customers')
    .insert({
      name: entrada.name,
      whatsapp: entrada.whatsapp,
      email: entrada.email ?? null,
      city: entrada.city ?? null,
      notes: entrada.notes ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return clienteDesdeFila(data as unknown as FilaCliente)
}

export async function actualizarCliente(
  id: string,
  entrada: Partial<ClienteInput>
): Promise<Customer> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('customers')
    .update(entrada)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return clienteDesdeFila(data as unknown as FilaCliente)
}

export async function eliminarCliente(id: string): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('customers').delete().eq('id', id)
  if (error) throw error
}

/** Reutiliza el cliente si ya existe ese WhatsApp; si no, lo crea. */
export async function clientePorWhatsapp(
  whatsapp: string,
  nombre: string
): Promise<Customer> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('customers')
    .select('id, name, whatsapp, email, city, notes, created_at')
    .eq('whatsapp', whatsapp)
    .maybeSingle()
  if (error) throw error
  if (data) return clienteDesdeFila(data as unknown as FilaCliente)
  return crearCliente({ name: nombre, whatsapp })
}

// ── Pedidos ──────────────────────────────────────────────────────────────────

interface FilaPedido {
  id: string
  code: string
  customer_id: string | null
  status: OrderStatus
  payment_method: string | null
  channel: string
  subtotal: number
  shipping: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
  customers: FilaCliente | null
  order_items: {
    id: string
    product_id: string | null
    name_snapshot: string
    platform_snapshot: string | null
    image_snapshot: string | null
    unit_price: number
    qty: number
  }[]
}

const SELECT_PEDIDO =
  'id, code, customer_id, status, payment_method, channel, subtotal, shipping, total, ' +
  'notes, created_at, updated_at, ' +
  'customers ( id, name, whatsapp, email, city, notes, created_at ), ' +
  'order_items ( id, product_id, name_snapshot, platform_snapshot, image_snapshot, unit_price, qty )'

function pedidoDesdeFila(f: FilaPedido): Order {
  return {
    id: f.id,
    code: f.code,
    customerId: f.customer_id,
    customer: f.customers ? clienteDesdeFila(f.customers) : null,
    status: f.status,
    paymentMethod: f.payment_method,
    channel: f.channel,
    subtotal: f.subtotal,
    shipping: f.shipping,
    total: f.total,
    notes: f.notes,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
    items: (f.order_items ?? []).map(
      (i): OrderItem => ({
        id: i.id,
        productId: i.product_id,
        name: i.name_snapshot,
        platform: (i.platform_snapshot as Platform | null) ?? null,
        image: i.image_snapshot,
        unitPrice: i.unit_price,
        qty: i.qty,
      })
    ),
  }
}

export async function listarPedidos(): Promise<Order[]> {
  const db = await cliente()
  if (!db) return []
  const { data, error } = await db
    .from('orders')
    .select(SELECT_PEDIDO)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as FilaPedido[]).map(pedidoDesdeFila)
}

export async function obtenerPedido(id: string): Promise<Order | null> {
  const db = await cliente()
  if (!db) return null
  const { data, error } = await db
    .from('orders')
    .select(SELECT_PEDIDO)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? pedidoDesdeFila(data as unknown as FilaPedido) : null
}

export interface LineaNueva {
  productId: string | null
  name: string
  platform: Platform | null
  image: string | null
  unitPrice: number
  qty: number
}

export interface PedidoInput {
  customerId: string | null
  status: OrderStatus
  paymentMethod: string | null
  channel: string
  shipping: number
  notes: string | null
  items: LineaNueva[]
}

/** Código legible y ordenable: GG-250825-4821. */
function generarCodigo(): string {
  const f = new Date()
  const fecha = [
    String(f.getFullYear()).slice(2),
    String(f.getMonth() + 1).padStart(2, '0'),
    String(f.getDate()).padStart(2, '0'),
  ].join('')
  const azar = String(Math.floor(Math.random() * 9000) + 1000)
  return `GG-${fecha}-${azar}`
}

export async function crearPedido(entrada: PedidoInput): Promise<Order> {
  const db = await exigirBackend()

  const subtotal = entrada.items.reduce((n, i) => n + i.unitPrice * i.qty, 0)
  const total = subtotal + (entrada.shipping || 0)

  const { data: pedido, error } = await db
    .from('orders')
    .insert({
      code: generarCodigo(),
      customer_id: entrada.customerId,
      status: entrada.status,
      payment_method: entrada.paymentMethod,
      channel: entrada.channel,
      subtotal,
      shipping: entrada.shipping || 0,
      total,
      notes: entrada.notes,
    })
    .select('id')
    .single()
  if (error) throw error

  if (entrada.items.length > 0) {
    const { error: errorLineas } = await db.from('order_items').insert(
      entrada.items.map((i) => ({
        order_id: pedido.id,
        product_id: i.productId,
        name_snapshot: i.name,
        platform_snapshot: i.platform,
        image_snapshot: i.image,
        unit_price: i.unitPrice,
        qty: i.qty,
      }))
    )
    // Si las líneas fallan, el pedido vacío no sirve: se retira.
    if (errorLineas) {
      await db.from('orders').delete().eq('id', pedido.id)
      throw errorLineas
    }
  }

  const creado = await obtenerPedido(pedido.id as string)
  if (!creado) throw new Error('El pedido se creó pero no se pudo leer de vuelta')
  return creado
}

export async function cambiarEstadoPedido(
  id: string,
  estado: OrderStatus
): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('orders').update({ status: estado }).eq('id', id)
  if (error) throw error
}

export async function actualizarPedido(
  id: string,
  cambios: Partial<Pick<Order, 'notes' | 'paymentMethod' | 'shipping' | 'status'>>
): Promise<void> {
  const db = await exigirBackend()
  const fila: Record<string, unknown> = {}
  if ('notes' in cambios) fila.notes = cambios.notes
  if ('paymentMethod' in cambios) fila.payment_method = cambios.paymentMethod
  if ('status' in cambios) fila.status = cambios.status

  // Cambiar el envío obliga a recalcular el total: si no, el pedido quedaría
  // con un total que no cuadra con sus propias cifras.
  if ('shipping' in cambios) {
    const envio = cambios.shipping ?? 0
    const { data, error: errorLectura } = await db
      .from('orders')
      .select('subtotal')
      .eq('id', id)
      .single()
    if (errorLectura) throw errorLectura
    fila.shipping = envio
    fila.total = ((data?.subtotal as number) ?? 0) + envio
  }

  const { error } = await db.from('orders').update(fila).eq('id', id)
  if (error) throw error
}

export async function eliminarPedido(id: string): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('orders').delete().eq('id', id)
  if (error) throw error
}
