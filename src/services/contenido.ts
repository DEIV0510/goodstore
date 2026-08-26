import { cliente, exigirBackend } from '@/lib/supabase'
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
// nada inventado: si la base de datos está vacía, la tienda se ve igual que
// ahora y el panel muestra ese mismo texto listo para editar.
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
  // El banner promocional solo aparece cuando el negocio crea uno y lo activa.
  banner: true,
}

export const CONTENIDO_POR_OMISION: SiteContent = {
  hero: HERO_POR_OMISION,
  benefits: BENEFICIOS_POR_OMISION,
  sections: SECCIONES_POR_OMISION,
}

// ── Portada ──────────────────────────────────────────────────────────────────

export async function obtenerContenido(): Promise<SiteContent> {
  const db = await cliente()
  if (!db) return CONTENIDO_POR_OMISION

  const { data, error } = await db.from('site_content').select('key, value')
  if (error) throw error

  const mapa = new Map((data ?? []).map((f) => [f.key as string, f.value]))
  return {
    hero: { ...HERO_POR_OMISION, ...((mapa.get('hero') as object) ?? {}) },
    benefits: (mapa.get('benefits') as BenefitContent[]) ?? BENEFICIOS_POR_OMISION,
    sections: { ...SECCIONES_POR_OMISION, ...((mapa.get('sections') as object) ?? {}) },
  }
}

export async function guardarContenido(
  clave: 'hero' | 'benefits' | 'sections',
  valor: unknown
): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db
    .from('site_content')
    .upsert({ key: clave, value: valor }, { onConflict: 'key' })
  if (error) throw error
}

// ── Banners ──────────────────────────────────────────────────────────────────

interface FilaBanner {
  id: string
  title: string
  subtitle: string | null
  image_url: string | null
  cta_label: string | null
  cta_href: string | null
  starts_at: string | null
  ends_at: string | null
  active: boolean
  sort_order: number
}

const bannerDesdeFila = (f: FilaBanner): Banner => ({
  id: f.id,
  title: f.title,
  subtitle: f.subtitle ?? '',
  imageUrl: f.image_url,
  ctaLabel: f.cta_label ?? '',
  ctaHref: f.cta_href ?? '/catalogo',
  startsAt: f.starts_at,
  endsAt: f.ends_at,
  active: f.active,
  sortOrder: f.sort_order,
})

export type BannerInput = Omit<Banner, 'id'>

function bannerHaciaFila(b: Partial<BannerInput>) {
  const fila: Record<string, unknown> = {}
  if ('title' in b) fila.title = b.title
  if ('subtitle' in b) fila.subtitle = b.subtitle
  if ('imageUrl' in b) fila.image_url = b.imageUrl
  if ('ctaLabel' in b) fila.cta_label = b.ctaLabel
  if ('ctaHref' in b) fila.cta_href = b.ctaHref
  if ('startsAt' in b) fila.starts_at = b.startsAt
  if ('endsAt' in b) fila.ends_at = b.endsAt
  if ('active' in b) fila.active = b.active
  if ('sortOrder' in b) fila.sort_order = b.sortOrder
  return fila
}

/**
 * Sin base de datos no hay banners: es contenido que solo existe si alguien lo
 * crea desde el panel. Devolver uno de ejemplo sería inventar una promoción.
 */
export async function listarBanners(
  opciones: { todos?: boolean } = {}
): Promise<Banner[]> {
  const db = await cliente()
  if (!db) return []

  let consulta = db
    .from('banners')
    .select(
      'id, title, subtitle, image_url, cta_label, cta_href, starts_at, ends_at, active, sort_order'
    )
    .order('sort_order', { ascending: true })

  if (!opciones.todos) consulta = consulta.eq('active', true)

  const { data, error } = await consulta
  if (error) throw error

  const banners = (data as unknown as FilaBanner[]).map(bannerDesdeFila)
  if (opciones.todos) return banners

  // La ventana de fechas también se filtra en la base de datos, pero se repite
  // aquí para que la vista previa del panel se comporte igual.
  const ahora = Date.now()
  return banners.filter(
    (b) =>
      (!b.startsAt || Date.parse(b.startsAt) <= ahora) &&
      (!b.endsAt || Date.parse(b.endsAt) >= ahora)
  )
}

export async function crearBanner(entrada: BannerInput): Promise<Banner> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('banners')
    .insert(bannerHaciaFila(entrada))
    .select()
    .single()
  if (error) throw error
  return bannerDesdeFila(data as unknown as FilaBanner)
}

export async function actualizarBanner(
  id: string,
  entrada: Partial<BannerInput>
): Promise<Banner> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('banners')
    .update(bannerHaciaFila(entrada))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return bannerDesdeFila(data as unknown as FilaBanner)
}

export async function eliminarBanner(id: string): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('banners').delete().eq('id', id)
  if (error) throw error
}

// ── Preguntas frecuentes ─────────────────────────────────────────────────────

interface FilaFaq {
  id: string
  question: string
  answer: string
  sort_order: number
  active: boolean
}

const faqDesdeFila = (f: FilaFaq): FaqItem => ({
  id: f.id,
  question: f.question,
  answer: f.answer,
  sortOrder: f.sort_order,
  active: f.active,
})

const faqDeSemilla: FaqItem[] = faqSemilla.map((f, i) => ({
  id: `semilla-faq-${i}`,
  question: f.q,
  answer: f.a,
  sortOrder: i,
  active: true,
}))

/** Preguntas de respaldo, por el mismo motivo que `catalogoDeRespaldo`. */
export const faqDeRespaldo = (): FaqItem[] => faqDeSemilla

export async function listarFaq(
  opciones: { todas?: boolean } = {}
): Promise<FaqItem[]> {
  const db = await cliente()
  if (!db) return faqDeSemilla

  let consulta = db
    .from('faq')
    .select('id, question, answer, sort_order, active')
    .order('sort_order', { ascending: true })

  if (!opciones.todas) consulta = consulta.eq('active', true)

  const { data, error } = await consulta
  if (error) throw error
  return (data as unknown as FilaFaq[]).map(faqDesdeFila)
}

export type FaqInput = Omit<FaqItem, 'id'>

const faqHaciaFila = (f: Partial<FaqInput>) => {
  const fila: Record<string, unknown> = {}
  if ('question' in f) fila.question = f.question
  if ('answer' in f) fila.answer = f.answer
  if ('sortOrder' in f) fila.sort_order = f.sortOrder
  if ('active' in f) fila.active = f.active
  return fila
}

export async function crearFaq(entrada: FaqInput): Promise<FaqItem> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('faq')
    .insert(faqHaciaFila(entrada))
    .select()
    .single()
  if (error) throw error
  return faqDesdeFila(data as unknown as FilaFaq)
}

export async function actualizarFaq(
  id: string,
  entrada: Partial<FaqInput>
): Promise<FaqItem> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('faq')
    .update(faqHaciaFila(entrada))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return faqDesdeFila(data as unknown as FilaFaq)
}

export async function eliminarFaq(id: string): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('faq').delete().eq('id', id)
  if (error) throw error
}

export async function reordenarFaq(ids: string[]): Promise<void> {
  const db = await exigirBackend()
  const resultados = await Promise.all(
    ids.map((id, i) => db.from('faq').update({ sort_order: i }).eq('id', id))
  )
  // El cliente de Supabase NO rechaza la promesa cuando la consulta falla:
  // resuelve con `{ error }`. Sin esta comprobación un reordenamiento fallido
  // pasaba por bueno y el panel se quedaba mostrando un orden que la base de
  // datos nunca llegó a guardar.
  const fallo = resultados.find((r) => r.error)
  if (fallo?.error) throw fallo.error
}
