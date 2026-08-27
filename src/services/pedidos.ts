import { api } from '@/lib/api'
import type { Customer, Order, OrderStatus, Platform } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Pedidos y clientes.
//
// Hoy la venta se cierra por WhatsApp, así que la tienda pública no crea
// pedidos sola: los registra el administrador cuando la conversación termina en
// una compra. Toda la maquinaria queda lista para automatizarlo después.
//
// El servidor es quien calcula subtotales y totales sumando las líneas. Nunca
// se acepta el total que mande el navegador: sería como dejar que el cliente
// ponga el precio.
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

export type ClienteInput = Pick<Customer, 'name' | 'whatsapp'> &
  Partial<Pick<Customer, 'email' | 'city' | 'notes'>>

/**
 * Los totales de cada cliente (pedidos, dinero, último pedido) los calcula el
 * servidor a partir de la tabla de pedidos, no se guardan por duplicado: así
 * nunca quedan desincronizados si un pedido cambia.
 */
export async function listarClientes(): Promise<Customer[]> {
  const r = await api<{ clientes: Customer[] }>('clientes')
  return r.clientes
}

export async function obtenerCliente(id: string): Promise<Customer | null> {
  try {
    const r = await api<{ cliente: Customer }>(`clientes/${encodeURIComponent(id)}`)
    return r.cliente
  } catch (e) {
    if ((e as { http?: number }).http === 404) return null
    throw e
  }
}

export async function crearCliente(entrada: ClienteInput): Promise<Customer> {
  const r = await api<{ cliente: Customer }>('clientes', {
    metodo: 'POST',
    cuerpo: entrada,
  })
  return r.cliente
}

export async function actualizarCliente(
  id: string,
  entrada: Partial<ClienteInput>
): Promise<Customer> {
  const r = await api<{ cliente: Customer }>(`clientes/${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    cuerpo: entrada,
  })
  return r.cliente
}

export async function eliminarCliente(id: string): Promise<void> {
  await api(`clientes/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

/** Reutiliza el cliente si ya existe ese WhatsApp; si no, lo crea. */
export async function clientePorWhatsapp(
  whatsapp: string,
  nombre: string
): Promise<Customer> {
  const r = await api<{ cliente: Customer }>('clientes/buscar', {
    metodo: 'POST',
    cuerpo: { whatsapp, name: nombre },
  })
  return r.cliente
}

// ── Pedidos ──────────────────────────────────────────────────────────────────

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

export async function listarPedidos(): Promise<Order[]> {
  const r = await api<{ pedidos: Order[] }>('pedidos')
  return r.pedidos
}

export async function obtenerPedido(id: string): Promise<Order | null> {
  try {
    const r = await api<{ pedido: Order }>(`pedidos/${encodeURIComponent(id)}`)
    return r.pedido
  } catch (e) {
    if ((e as { http?: number }).http === 404) return null
    throw e
  }
}

export async function crearPedido(entrada: PedidoInput): Promise<Order> {
  const r = await api<{ pedido: Order }>('pedidos', { metodo: 'POST', cuerpo: entrada })
  return r.pedido
}

export async function cambiarEstadoPedido(
  id: string,
  estado: OrderStatus
): Promise<void> {
  await api(`pedidos/${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    cuerpo: { status: estado },
  })
}

export async function actualizarPedido(
  id: string,
  cambios: Partial<Pick<Order, 'notes' | 'paymentMethod' | 'shipping' | 'status'>>
): Promise<void> {
  // Si cambia el envío, el servidor recalcula el total: si no, el pedido
  // quedaría con un total que no cuadra con sus propias cifras.
  await api(`pedidos/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: cambios })
}

export async function eliminarPedido(id: string): Promise<void> {
  await api(`pedidos/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}
