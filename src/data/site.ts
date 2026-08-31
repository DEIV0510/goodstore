import type { Settings, WhatsappSettings } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Datos del negocio que la tienda muestra.
//
// Los valores de aquí son los del brief del cliente y sirven de punto de
// partida. Cuando hay base de datos conectada, `configurarSitio()` los sustituye
// por lo que el administrador haya guardado en el panel.
//
// Se conserva la forma de objeto plano (`site.city`, `MESSAGES.general`) para no
// tener que tocar los quince componentes que ya la usan. Como la lectura ocurre
// al pintar, y el proveedor del catálogo cambia de estado justo al aplicar la
// configuración, la tienda se repinta con los valores nuevos.
//
// Reglas del negocio que NO se pueden romper desde el panel:
//   · el WhatsApp por omisión es el 3508271637 y ningún otro;
//   · no hay dirección exacta, solo ciudad y departamento;
//   · una red social sin enlace no se pinta: nunca se inventa una cuenta.
// ─────────────────────────────────────────────────────────────────────────────

export interface RedSocial {
  name: string
  url: string
}

const POR_OMISION = {
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

  email: '',
  logoUrl: '/brand/logo.svg',

  /** Pendientes de que el negocio las abra. Vacío = el pie no pinta iconos. */
  socials: [] as RedSocial[],

  /**
   * Pago en línea con enlace de cobro. Es de MONTO ABIERTO: el cliente escribe
   * el total en la pasarela, así que la tienda se lo copia al portapapeles para
   * que no lo teclee mal. Sin enlace no se ofrece, aunque esté activado.
   */
  pago: {
    activo: true,
    modo: 'enlace' as 'enlace' | 'checkout',
    proveedor: 'Nequi',
    enlace: 'https://checkout.nequi.wompi.co/l/xT7STl',
    nota: '',
  },

  url: 'https://goodgamecol.shop',
}

export const site = { ...POR_OMISION }

const PLANTILLAS_POR_OMISION = {
  general: 'Hola GOOD GAME 🎮, quiero información sobre los videojuegos disponibles.',
  catalog: 'Hola GOOD GAME 🎮, quiero ver el catálogo completo y saber precios.',
  consoles:
    'Hola GOOD GAME 🎮, quiero saber qué consolas tienen disponibles y sus precios.',
  accessories:
    'Hola GOOD GAME 🎮, quiero saber qué controles y accesorios tienen disponibles.',
  shipping: 'Hola GOOD GAME 🎮, quiero saber cómo funcionan los envíos a mi ciudad.',
  product:
    'Hola GOOD GAME 🎮, quiero este juego:\n\n• {producto} — {plataforma}{precio}\n\n¿Me confirmas disponibilidad, precio y envío?',
  cart: 'Hola GOOD GAME, estoy interesado en comprar:',
  used: 'Hola GOOD GAME 🎮, quiero vender o entregar un juego usado.',
}

/** Mensajes con los que la tienda abre WhatsApp. Se leen al pintar. */
export const MESSAGES = { ...PLANTILLAS_POR_OMISION }

/** Formatea un número colombiano para mostrarlo: 3508271637 → 350 827 1637. */
function paraMostrar(numero: string): string {
  const d = numero.replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : numero
}

const NOMBRE_RED: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

/**
 * Aplica lo que el administrador guardó en el panel.
 * La llama el proveedor del catálogo cada vez que carga la configuración.
 */
export function configurarSitio(ajustes: Settings, whatsapp: WhatsappSettings): void {
  const digitos = whatsapp.number.replace(/\D/g, '')
  const nacional = digitos.startsWith('57') ? digitos.slice(2) : digitos
  const valido = nacional.length === 10

  Object.assign(site, {
    name: ajustes.company.name || POR_OMISION.name,
    tagline: ajustes.company.tagline || POR_OMISION.tagline,
    claim: ajustes.company.claim || POR_OMISION.claim,

    // Si el número guardado no tiene diez dígitos se conserva el oficial: es
    // preferible a publicar un enlace de WhatsApp que no lleva a ninguna parte.
    whatsapp: valido ? nacional : POR_OMISION.whatsapp,
    whatsappIntl: valido ? `57${nacional}` : POR_OMISION.whatsappIntl,
    whatsappDisplay: valido ? paraMostrar(nacional) : POR_OMISION.whatsappDisplay,

    city: ajustes.company.city || POR_OMISION.city,
    region: ajustes.company.region || POR_OMISION.region,
    country: ajustes.company.country || POR_OMISION.country,
    locationLabel: ajustes.company.locationLabel || POR_OMISION.locationLabel,
    shippingLabel: ajustes.company.shippingLabel || POR_OMISION.shippingLabel,
    email: ajustes.company.email || '',
    logoUrl: ajustes.company.logoUrl || POR_OMISION.logoUrl,

    // Solo las que tienen enlace: un campo vacío no pinta icono.
    socials: Object.entries(ajustes.socials)
      .filter(([, url]) => typeof url === 'string' && url.trim() !== '')
      .map(([clave, url]) => ({ name: NOMBRE_RED[clave] ?? clave, url: url.trim() })),

    // Cada modo tiene su propio requisito, y si no se cumple el pago en línea
    // se apaga aunque el interruptor esté encendido: es preferible a enseñar un
    // botón que no lleva a ninguna parte.
    //
    //   checkout — hacen falta la llave pública Y el secreto (que el servidor
    //              confirma con hasIntegrity, sin enseñarlo nunca);
    //   enlace   — hace falta el enlace de cobro.
    pago: {
      activo:
        ajustes.payments.enabled &&
        (ajustes.payments.mode === 'checkout'
          ? ajustes.payments.publicKey.trim() !== '' && ajustes.payments.hasIntegrity
          : ajustes.payments.link.trim() !== ''),
      modo: ajustes.payments.mode === 'checkout' ? 'checkout' : 'enlace',
      proveedor: ajustes.payments.provider.trim() || POR_OMISION.pago.proveedor,
      enlace: ajustes.payments.link.trim(),
      nota: ajustes.payments.note.trim(),
    },
  })

  Object.assign(MESSAGES, whatsapp.templates)
}

export const waLink = (message: string) =>
  `https://wa.me/${site.whatsappIntl}?text=${encodeURIComponent(message)}`
