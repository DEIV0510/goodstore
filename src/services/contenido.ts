import { api } from '@/lib/api'
import { faq as faqSemilla } from '@/data/faq'
import type {
  Banner,
  BenefitContent,
  FaqItem,
  HeroContent,
  SectionToggles,
  SiteContent,
} from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Contenido editable de la tienda: portada, banners y preguntas frecuentes.
//
// Los valores por omisión son EXACTAMENTE los que hoy están publicados. No hay
// nada inventado: mientras la base de datos no tenga nada guardado, la tienda
// se ve igual que siempre y el panel muestra ese mismo texto listo para editar.
// ─────────────────────────────────────────────────────────────────────────────

export const HERO_POR_OMISION: HeroContent = {
  eyebrow: '',
  title: 'Tu próximo juego',
  highlight: 'empieza aquí.',
  subtitle:
    'Videojuegos, consolas y accesorios para llevar tu experiencia gaming al siguiente nivel.',
  primaryLabel: 'Ver catálogo',
  primaryHref: '/catalogo',
  secondaryLabel: 'Comprar por WhatsApp',
  coverSlugs: [
    'the-legend-of-zelda-breath-of-the-wild-switch',
    'ghost-of-tsushima-ps4',
    'elden-ring-ps5',
    'god-of-war-ragnarok-ps5',
    'pokemon-scarlet-switch',
  ],
}

/** Los iconos se nombran como en lucide-react; el panel ofrece una lista. */
export const BENEFICIOS_POR_OMISION: BenefitContent[] = [
  { icon: 'Truck', title: 'Envíos nacionales', description: 'Medellín y toda Colombia' },
  {
    icon: 'Gamepad2',
    title: 'Amplio catálogo',
    description: 'PlayStation y Nintendo Switch',
  },
  {
    icon: 'RefreshCw',
    title: 'Videojuegos usados',
    description: 'Compra, venta y parte de pago',
  },
  {
    icon: 'MessageCircle',
    title: 'Atención por WhatsApp',
    description: 'Te asesoramos directo',
  },
]

export const SECCIONES_POR_OMISION: SectionToggles = {
  destacados: true,
  categorias: true,
  usados: true,
  playstation: true,
  nintendo: true,
  consolas: true,
  confianza: true,
  whatsapp: true,
  faq: true,
  // El banner solo aparece cuando el negocio crea uno y lo activa.
  banner: true,
}

export const CONTENIDO_POR_OMISION: SiteContent = {
  hero: HERO_POR_OMISION,
  benefits: BENEFICIOS_POR_OMISION,
  sections: SECCIONES_POR_OMISION,
}

/** Preguntas de respaldo si la API no responde. */
export const faqDeRespaldo = (): FaqItem[] =>
  faqSemilla.map((f, i) => ({
    id: `semilla-faq-${i}`,
    question: f.q,
    answer: f.a,
    sortOrder: i,
    active: true,
  }))

/**
 * Mezcla lo guardado sobre lo que viene por omisión.
 *
 * Se hace por secciones y no de golpe para que, si el panel guardó solo el
 * hero, los beneficios y las secciones no se queden vacíos.
 */
export function fusionarContenido(guardado: Record<string, unknown>): SiteContent {
  return {
    hero: { ...HERO_POR_OMISION, ...((guardado.hero as object) ?? {}) },
    benefits: Array.isArray(guardado.benefits)
      ? (guardado.benefits as BenefitContent[])
      : BENEFICIOS_POR_OMISION,
    sections: { ...SECCIONES_POR_OMISION, ...((guardado.sections as object) ?? {}) },
  }
}

// ── Portada ──────────────────────────────────────────────────────────────────

export async function obtenerContenido(): Promise<SiteContent> {
  const r = await api<{ contenido: Record<string, unknown> }>('contenido')
  return fusionarContenido(r.contenido ?? {})
}

export async function guardarContenido(
  clave: 'hero' | 'benefits' | 'sections',
  valor: unknown
): Promise<void> {
  await api(`contenido/${clave}`, { metodo: 'PUT', cuerpo: { valor } })
}

// ── Banners ──────────────────────────────────────────────────────────────────

export type BannerInput = Omit<Banner, 'id'>

export async function listarBanners(
  opciones: { todos?: boolean } = {}
): Promise<Banner[]> {
  const r = await api<{ banners: Banner[] }>('banners', {
    parametros: { todos: opciones.todos ? 1 : undefined },
  })
  return r.banners
}

export async function crearBanner(entrada: BannerInput): Promise<Banner> {
  const r = await api<{ banner: Banner }>('banners', { metodo: 'POST', cuerpo: entrada })
  return r.banner
}

export async function actualizarBanner(
  id: string,
  entrada: Partial<BannerInput>
): Promise<Banner> {
  const r = await api<{ banner: Banner }>(`banners/${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    cuerpo: entrada,
  })
  return r.banner
}

export async function eliminarBanner(id: string): Promise<void> {
  await api(`banners/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

// ── Preguntas frecuentes ─────────────────────────────────────────────────────

export type FaqInput = Omit<FaqItem, 'id'>

export async function listarFaq(
  opciones: { todas?: boolean } = {}
): Promise<FaqItem[]> {
  const r = await api<{ preguntas: FaqItem[] }>('preguntas', {
    parametros: { todas: opciones.todas ? 1 : undefined },
  })
  return r.preguntas
}

export async function crearFaq(entrada: FaqInput): Promise<FaqItem> {
  const r = await api<{ pregunta: FaqItem }>('preguntas', {
    metodo: 'POST',
    cuerpo: entrada,
  })
  return r.pregunta
}

export async function actualizarFaq(
  id: string,
  entrada: Partial<FaqInput>
): Promise<FaqItem> {
  const r = await api<{ pregunta: FaqItem }>(`preguntas/${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    cuerpo: entrada,
  })
  return r.pregunta
}

export async function eliminarFaq(id: string): Promise<void> {
  await api(`preguntas/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

export async function reordenarFaq(ids: string[]): Promise<void> {
  await api('preguntas/orden', { metodo: 'POST', cuerpo: { ids } })
}
