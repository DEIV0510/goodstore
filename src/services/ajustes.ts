import { cliente, exigirBackend } from '@/lib/supabase'
import { site } from '@/data/site'
import type { Settings, WhatsappSettings } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Configuración general y mensajes de WhatsApp.
//
// Los valores por omisión salen del brief del negocio (src/data/site.ts). Dos
// reglas que NO se pueden romper desde aquí:
//
//   • El WhatsApp es el 3508271637 y ningún otro.
//   • No hay dirección exacta: solo "Itagüí, Antioquia, Colombia".
//   • Las redes sociales están pendientes: van vacías y la tienda no pinta el
//     icono de una red sin enlace. Nunca se inventa una cuenta.
// ─────────────────────────────────────────────────────────────────────────────

export const AJUSTES_POR_OMISION: Settings = {
  company: {
    name: site.name,
    tagline: site.tagline,
    claim: site.claim,
    logoUrl: '/brand/logo.svg',
    description:
      'Tienda de videojuegos, consolas y accesorios en Itagüí, Antioquia. Envíos a Medellín y toda Colombia.',
    city: site.city,
    region: site.region,
    country: site.country,
    locationLabel: site.locationLabel,
    shippingLabel: site.shippingLabel,
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
}

export const WHATSAPP_POR_OMISION: WhatsappSettings = {
  number: site.whatsapp,
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

/** Mezcla superficial por sección, para que un ajuste guardado a medias no borre el resto. */
function fusionar<T extends object>(base: T, guardado: unknown): T {
  if (!guardado || typeof guardado !== 'object') return base
  return { ...base, ...(guardado as object) } as T
}

export async function obtenerAjustes(): Promise<Settings> {
  const db = await cliente()
  if (!db) return AJUSTES_POR_OMISION

  const { data, error } = await db.from('settings').select('key, value')
  if (error) throw error

  const mapa = new Map((data ?? []).map((f) => [f.key as string, f.value]))
  return {
    company: fusionar(AJUSTES_POR_OMISION.company, mapa.get('company')),
    socials: fusionar(AJUSTES_POR_OMISION.socials, mapa.get('socials')),
    shipping: fusionar(AJUSTES_POR_OMISION.shipping, mapa.get('shipping')),
    seo: fusionar(AJUSTES_POR_OMISION.seo, mapa.get('seo')),
  }
}

export async function guardarAjustes(
  clave: keyof Settings,
  valor: unknown
): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db
    .from('settings')
    .upsert({ key: clave, value: valor }, { onConflict: 'key' })
  if (error) throw error
}

export async function obtenerWhatsapp(): Promise<WhatsappSettings> {
  const db = await cliente()
  if (!db) return WHATSAPP_POR_OMISION

  const { data, error } = await db.from('whatsapp_settings').select('key, value')
  if (error) throw error

  const mapa = new Map((data ?? []).map((f) => [f.key as string, f.value]))
  const numero = (mapa.get('number') as { value?: string } | string | undefined) ?? null

  return {
    number:
      (typeof numero === 'string' ? numero : numero?.value) ||
      WHATSAPP_POR_OMISION.number,
    templates: fusionar(WHATSAPP_POR_OMISION.templates, mapa.get('templates')),
  }
}

export async function guardarWhatsapp(ajustes: WhatsappSettings): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('whatsapp_settings').upsert(
    [
      { key: 'number', value: { value: ajustes.number } },
      { key: 'templates', value: ajustes.templates },
    ],
    { onConflict: 'key' }
  )
  if (error) throw error
}

/** Deja el número en formato internacional para los enlaces wa.me. */
export function normalizarWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  if (digitos.startsWith('57')) return digitos
  return `57${digitos}`
}
