import { site, waLink } from '@/data/site'
import { platformShort } from '@/data/taxonomy'
import { cop } from './format'
import type { CartEntry, Product } from '@/types'

/** Mensaje para consultar por un producto puntual. */
export const productMessage = (p: Product) => {
  const price = p.price !== null ? ` (${cop(p.price)})` : ''
  return waLink(
    `Hola GOOD GAME 🎮, quiero este juego:\n\n` +
      `• ${p.name} — ${platformShort(p.platform)}${price}\n\n` +
      `¿Me confirmas disponibilidad, precio y envío?`
  )
}

/** Mensaje del carrito completo, con total aproximado cuando aplica. */
export const cartMessage = (entries: CartEntry[]) => {
  const lines = entries.map((e) => {
    const qty = e.qty > 1 ? ` x${e.qty}` : ''
    const price = e.product.price !== null ? ` — ${cop(e.product.price * e.qty)}` : ' — Consultar precio'
    return `• ${e.product.name} (${platformShort(e.product.platform)})${qty}${price}`
  })

  const withPrice = entries.filter((e) => e.product.price !== null)
  const total = withPrice.reduce((sum, e) => sum + (e.product.price as number) * e.qty, 0)
  const pending = entries.length - withPrice.length

  let totalLine = ''
  if (withPrice.length > 0) {
    totalLine = `\nTotal aproximado: ${cop(total)}`
    if (pending > 0) {
      totalLine += `\n(${pending} producto${pending > 1 ? 's' : ''} sin precio publicado)`
    }
  } else {
    totalLine = '\nTodos los productos están pendientes de precio.'
  }

  return waLink(
    `Hola GOOD GAME, estoy interesado en comprar:\n\n` +
      lines.join('\n') +
      `\n${totalLine}\n\n` +
      `Quisiera confirmar disponibilidad y envío.`
  )
}

/** Mensaje del formulario de venta / entrega de juegos usados. */
export const usedGameMessage = (data: {
  nombre: string
  whatsapp: string
  plataforma: string
  juego: string
  estado: string
  fotos: string
  comentario: string
}) =>
  waLink(
    `Hola GOOD GAME 🎮, quiero vender o entregar un juego usado.\n\n` +
      `• Nombre: ${data.nombre}\n` +
      `• WhatsApp: ${data.whatsapp}\n` +
      `• Plataforma: ${data.plataforma}\n` +
      `• Juego: ${data.juego}\n` +
      `• Estado: ${data.estado}\n` +
      `• Fotografías: ${data.fotos || 'Las envío por este chat'}\n` +
      (data.comentario ? `• Comentario: ${data.comentario}\n` : '') +
      `\n¿Me confirman si les interesa y en cuánto lo reciben?`
  )

export const phoneHref = `tel:+${site.whatsappIntl}`
