import { MESSAGES, site, waLink } from '@/data/site'
import { platformShort } from '@/data/taxonomy'
import { cop } from './format'
import type { CartEntry, Product } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes con los que la tienda abre WhatsApp.
//
// El encabezado de cada mensaje sale de las plantillas que el administrador
// edita en /admin/whatsapp. El detalle (líneas de producto, totales, datos del
// formulario) se arma aquí, porque depende de lo que el cliente eligió.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rellena los huecos de una plantilla del panel.
 * Un hueco que no se reconoce se deja tal cual: así se ve el error al probar,
 * en vez de mandarle al cliente un mensaje con un vacío inexplicable.
 */
export const rellenar = (plantilla: string, valores: Record<string, string>) =>
  plantilla.replace(/\{(\w+)\}/g, (todo, clave: string) => valores[clave] ?? todo)

/** Mensaje para consultar por un producto puntual. */
export const productMessage = (p: Product) =>
  waLink(
    rellenar(MESSAGES.product, {
      producto: p.name,
      plataforma: platformShort(p.platform),
      // El precio va con paréntesis incluidos para que la plantilla pueda
      // escribirse como "{producto} — {plataforma}{precio}" y siga leyéndose
      // bien cuando el producto no tiene precio publicado.
      precio: p.price !== null ? ` (${cop(p.price)})` : '',
    })
  )

/** Mensaje del carrito completo, con total aproximado cuando aplica. */
export const cartMessage = (entries: CartEntry[]) => {
  const lines = entries.map((e) => {
    const qty = e.qty > 1 ? ` x${e.qty}` : ''
    const price =
      e.product.price !== null
        ? ` — ${cop(e.product.price * e.qty)}`
        : ' — Consultar precio'
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
    `${MESSAGES.cart}\n\n` +
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
    `${MESSAGES.used}\n\n` +
      `• Nombre: ${data.nombre}\n` +
      `• WhatsApp: ${data.whatsapp}\n` +
      `• Plataforma: ${data.plataforma}\n` +
      `• Juego: ${data.juego}\n` +
      `• Estado: ${data.estado}\n` +
      `• Fotografías: ${data.fotos || 'Las envío por este chat'}\n` +
      (data.comentario ? `• Comentario: ${data.comentario}\n` : '') +
      `\n¿Me confirman si les interesa y en cuánto lo reciben?`
  )

/** Se lee al pintar, así refleja el número que esté configurado. */
export const phoneHref = () => `tel:+${site.whatsappIntl}`
