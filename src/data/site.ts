// ─────────────────────────────────────────────────────────────────────────────
// Datos oficiales del negocio. Único lugar donde se edita esta información.
// Nada de lo que hay aquí es inventado: todo viene del brief del cliente.
// ─────────────────────────────────────────────────────────────────────────────

export const site = {
  name: 'GOOD GAME',
  tagline: 'GAME STORE',
  claim: 'Videojuegos · Consolas · Accesorios',

  /** WhatsApp oficial entregado por el negocio. */
  whatsapp: '3508271637',
  whatsappIntl: '573508271637',
  whatsappDisplay: '350 827 1637',

  /** Ubicación general. El negocio pidió NO publicar dirección exacta. */
  city: 'Itagüí',
  region: 'Antioquia',
  country: 'Colombia',
  locationLabel: 'Itagüí, Antioquia, Colombia',
  shippingLabel: 'Envíos a Medellín y toda Colombia',

  /**
   * Redes sociales: el negocio las tiene PENDIENTES.
   * Cuando existan, agrega objetos { name, url, icon } y el footer las mostrará
   * automáticamente. No inventes cuentas.
   */
  socials: [] as { name: string; url: string }[],

  url: 'https://goodgamecol.shop',
} as const

export const waLink = (message: string) =>
  `https://wa.me/${site.whatsappIntl}?text=${encodeURIComponent(message)}`

export const MESSAGES = {
  general: 'Hola GOOD GAME 🎮, quiero información sobre los videojuegos disponibles.',
  catalog: 'Hola GOOD GAME 🎮, quiero ver el catálogo completo y saber precios.',
  consoles:
    'Hola GOOD GAME 🎮, quiero saber qué consolas tienen disponibles y sus precios.',
  accessories:
    'Hola GOOD GAME 🎮, quiero saber qué controles y accesorios tienen disponibles.',
  shipping: 'Hola GOOD GAME 🎮, quiero saber cómo funcionan los envíos a mi ciudad.',
} as const
