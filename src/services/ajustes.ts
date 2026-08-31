import { api } from '@/lib/api'
import type { Settings, WhatsappSettings } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Configuración general y mensajes de WhatsApp.
//
// Los valores por omisión salen del brief del negocio. Tres reglas que NO se
// pueden romper desde aquí, y que el servidor también hace cumplir:
//
//   • El WhatsApp es el 3508271637 y ningún otro.
//   • No hay dirección exacta: solo "Itagüí, Antioquia, Colombia".
//   • Las redes sociales están pendientes: van vacías, y la tienda no pinta el
//     icono de una red sin enlace. Nunca se inventa una cuenta.
// ─────────────────────────────────────────────────────────────────────────────

export const AJUSTES_POR_OMISION: Settings = {
  company: {
    name: 'GOOD GAME',
    tagline: 'GAME STORE',
    claim: 'Videojuegos · Consolas · Accesorios',
    logoUrl: '/brand/logo.svg',
    description:
      'Tienda de videojuegos, consolas y accesorios en Itagüí, Antioquia. Envíos a Medellín y toda Colombia.',
    city: 'Itagüí',
    region: 'Antioquia',
    country: 'Colombia',
    locationLabel: 'Itagüí, Antioquia, Colombia',
    shippingLabel: 'Envíos a Medellín y toda Colombia',
    email: '',
    currency: 'COP',
  },
  socials: { instagram: '', facebook: '', tiktok: '', youtube: '' },
  shipping: {
    coverage: ['Medellín', 'Antioquia', 'Toda Colombia'],
    // Sin tarifas: el negocio todavía no las definió y no se inventan.
    freeFrom: null,
    flatRate: null,
    carrier: '',
    notes: 'El costo del envío se confirma por WhatsApp según la ciudad.',
  },
  seo: {
    title: 'GOOD GAME | Videojuegos, Consolas y Accesorios',
    description:
      'Compra videojuegos, consolas y accesorios en GOOD GAME. Encuentra títulos para PlayStation y Nintendo Switch, juegos usados y más. Envíos a Medellín y toda Colombia.',
    keywords:
      'videojuegos, PlayStation, Nintendo Switch, juegos usados, Itagüí, Medellín, Colombia',
    ogImage: '/og-image.png',
  },
  // Enlace de cobro entregado por el negocio, a nombre de «Good game david
  // correa». Es de MONTO ABIERTO: el cliente escribe el total en la pasarela,
  // porque Wompi descarta cualquier importe que se le pase por la dirección.
  payments: {
    enabled: true,
    provider: 'Nequi',
    link: 'https://checkout.nequi.wompi.co/l/xT7STl',
    note: '',
  },
}

export const WHATSAPP_POR_OMISION: WhatsappSettings = {
  number: '3508271637',
  templates: {
    general: 'Hola GOOD GAME 🎮, quiero información sobre los videojuegos disponibles.',
    catalog: 'Hola GOOD GAME 🎮, quiero ver el catálogo completo y saber precios.',
    product:
      'Hola GOOD GAME 🎮, quiero este juego:\n\n• {producto} — {plataforma}{precio}\n\n¿Me confirmas disponibilidad, precio y envío?',
    cart: 'Hola GOOD GAME, estoy interesado en comprar:',
    used: 'Hola GOOD GAME 🎮, quiero vender o entregar un juego usado.',
    consoles:
      'Hola GOOD GAME 🎮, quiero saber qué consolas tienen disponibles y sus precios.',
    accessories:
      'Hola GOOD GAME 🎮, quiero saber qué controles y accesorios tienen disponibles.',
    shipping: 'Hola GOOD GAME 🎮, quiero saber cómo funcionan los envíos a mi ciudad.',
  },
}

/** Mezcla por secciones, para que un ajuste guardado a medias no borre el resto. */
function fusionar<T extends object>(base: T, guardado: unknown): T {
  if (!guardado || typeof guardado !== 'object') return base
  return { ...base, ...(guardado as object) } as T
}

export function fusionarAjustes(guardado: Record<string, unknown>): Settings {
  return {
    company: fusionar(AJUSTES_POR_OMISION.company, guardado.company),
    socials: fusionar(AJUSTES_POR_OMISION.socials, guardado.socials),
    shipping: fusionar(AJUSTES_POR_OMISION.shipping, guardado.shipping),
    seo: fusionar(AJUSTES_POR_OMISION.seo, guardado.seo),
    payments: fusionar(AJUSTES_POR_OMISION.payments, guardado.payments),
  }
}

export function fusionarWhatsapp(guardado: Record<string, unknown>): WhatsappSettings {
  const numero = guardado.number
  return {
    number: (typeof numero === 'string' && numero) || WHATSAPP_POR_OMISION.number,
    templates: fusionar(WHATSAPP_POR_OMISION.templates, guardado.templates),
  }
}

// ── Lectura y escritura ──────────────────────────────────────────────────────

export async function obtenerAjustes(): Promise<Settings> {
  const r = await api<{ ajustes: Record<string, unknown> }>('ajustes')
  return fusionarAjustes(r.ajustes ?? {})
}

export async function guardarAjustes(
  clave: keyof Settings,
  valor: unknown
): Promise<void> {
  await api(`ajustes/${clave}`, { metodo: 'PUT', cuerpo: { valor } })
}

export async function obtenerWhatsapp(): Promise<WhatsappSettings> {
  const r = await api<{ whatsapp: Record<string, unknown> }>('whatsapp')
  return fusionarWhatsapp(r.whatsapp ?? {})
}

export async function guardarWhatsapp(ajustes: WhatsappSettings): Promise<void> {
  await api('whatsapp', { metodo: 'PUT', cuerpo: ajustes })
}

/** Deja el número en formato internacional para los enlaces wa.me. */
export function normalizarWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  if (digitos.startsWith('57')) return digitos
  return `57${digitos}`
}
