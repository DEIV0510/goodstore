// ─────────────────────────────────────────────────────────────────────────────
// Modelo de datos de GOOD GAME.
//
// Es la forma que comparten la tienda pública y el panel de administración. La
// fuente puede ser la base de datos o el catálogo incluido en el paquete: la
// interfaz no distingue entre una y otra.
// ─────────────────────────────────────────────────────────────────────────────

export type Platform = 'ps5' | 'ps4' | 'switch' | 'switch2' | 'xbox'

export type Category = 'videojuegos' | 'consolas' | 'accesorios'

export type Genre =
  | 'accion'
  | 'aventura'
  | 'rpg'
  | 'terror'
  | 'deportes'
  | 'carreras'
  | 'familiar'
  | 'plataformas'
  | 'lucha'

/** 'consultar' = el negocio aún no confirmó si la copia es nueva o usada. */
export type Condition = 'nuevo' | 'usado' | 'consultar'

/** Región del disco o cartucho. Afecta idioma y compatibilidad. */
export type Region = 'america' | 'europa' | 'japon' | 'asia'

/** Solo 'publicado' se ve en la tienda. */
export type ProductStatus = 'publicado' | 'borrador' | 'archivado'

export interface Product {
  id: string
  name: string
  slug: string
  platform: Platform
  category: Category
  /** null cuando no se pudo clasificar el título con certeza. */
  genre: Genre | null
  condition: Condition
  region: Region | null
  /** null → se muestra "Consultar precio" */
  price: number | null
  /** Precio anterior tachado. Solo se muestra si es mayor que `price`. */
  oldPrice: number | null
  /** null → disponibilidad a confirmar (se muestra como disponible). 0 → agotado. */
  stock: number | null
  /** Vacío → la web dibuja una portada de marca con el título. */
  images: string[]
  imageSize?: { w: number; h: number }
  /** Cadena vacía cuando no hay una descripción verificada del título. */
  description: string
  featured: boolean
  tags: string[]
  /** Aclaración honesta cuando algo no se pudo confirmar. */
  note?: string

  // ── Campos que administra el panel ─────────────────────────────────────────
  sku?: string | null
  status: ProductStatus
  onSale: boolean
  newRelease: boolean
  bestSeller: boolean
  views: number
  createdAt?: string
  updatedAt?: string
}

/** Lo que el formulario del panel envía al guardar. */
export type ProductInput = Omit<Product, 'id' | 'views' | 'createdAt' | 'updatedAt'>

export interface CartLine {
  slug: string
  qty: number
}

export interface CartEntry {
  product: Product
  qty: number
}

export type SortKey = 'destacados' | 'recientes' | 'precio-asc' | 'precio-desc' | 'nombre'

export interface Filters {
  platforms: Platform[]
  conditions: Condition[]
  genres: Genre[]
  regions: Region[]
  priceRanges: string[]
  availability: ('disponible' | 'agotado')[]
  query: string
  sort: SortKey
}

// ─────────────────────────────────────────────────────────────────────────────
// Categorías navegables (las tarjetas de "Explora por categoría")
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryCard {
  id: string
  slug: string
  title: string
  subtitle: string
  description: string
  href: string
  /** Imagen propia subida desde el panel. Tiene prioridad sobre `covers`. */
  imageUrl: string | null
  /** Portadas reales de productos, referenciadas por slug. */
  coverSlugs: string[]
  /** Resueltas a rutas de imagen para pintarlas. */
  covers: string[]
  sortOrder: number
  active: boolean
  /** Categoría anunciada sin inventario confirmado. */
  soon: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Administración
// ─────────────────────────────────────────────────────────────────────────────

export type AdminRole = 'super_admin' | 'admin' | 'editor'
export type AdminStatus = 'activo' | 'suspendido'

export interface AdminProfile {
  id: string
  email: string
  name: string
  role: AdminRole
  status: AdminStatus
  lastLoginAt: string | null
  createdAt: string
}

export type OrderStatus =
  | 'pendiente'
  | 'confirmado'
  | 'preparando'
  | 'enviado'
  | 'entregado'
  | 'cancelado'

export interface Customer {
  id: string
  name: string
  whatsapp: string
  email: string | null
  city: string | null
  notes: string | null
  createdAt: string
  /** Se calculan a partir de los pedidos, no se guardan duplicados. */
  orderCount?: number
  totalSpent?: number
  lastOrderAt?: string | null
}

export interface OrderItem {
  id: string
  productId: string | null
  name: string
  platform: Platform | null
  image: string | null
  unitPrice: number
  qty: number
}

export interface Order {
  id: string
  code: string
  customerId: string | null
  customer?: Customer | null
  status: OrderStatus
  paymentMethod: string | null
  channel: string
  subtotal: number
  shipping: number
  total: number
  notes: string | null
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

export interface Banner {
  id: string
  title: string
  subtitle: string
  imageUrl: string | null
  ctaLabel: string
  ctaHref: string
  startsAt: string | null
  endsAt: string | null
  active: boolean
  sortOrder: number
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  sortOrder: number
  active: boolean
}

/** Bloques de la portada que el panel puede editar. */
export interface HeroContent {
  eyebrow: string
  title: string
  highlight: string
  subtitle: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  /** Slugs de las portadas del abanico. */
  coverSlugs: string[]
}

export interface BenefitContent {
  icon: string
  title: string
  description: string
}

/** Interruptores de secciones de la portada. */
export interface SectionToggles {
  destacados: boolean
  categorias: boolean
  usados: boolean
  playstation: boolean
  nintendo: boolean
  consolas: boolean
  confianza: boolean
  whatsapp: boolean
  faq: boolean
  banner: boolean
}

export interface SiteContent {
  hero: HeroContent
  benefits: BenefitContent[]
  sections: SectionToggles
}

export interface SocialLinks {
  instagram: string
  facebook: string
  tiktok: string
  youtube: string
}

export interface ShippingSettings {
  coverage: string[]
  freeFrom: number | null
  flatRate: number | null
  carrier: string
  notes: string
}

export interface SeoSettings {
  title: string
  description: string
  keywords: string
  ogImage: string
}

export interface CompanySettings {
  name: string
  tagline: string
  claim: string
  logoUrl: string
  description: string
  city: string
  region: string
  country: string
  locationLabel: string
  shippingLabel: string
  email: string
  currency: string
}

export interface Settings {
  company: CompanySettings
  socials: SocialLinks
  shipping: ShippingSettings
  seo: SeoSettings
}

/** Plantillas de mensaje según el contexto desde el que se escribe. */
export interface WhatsappSettings {
  number: string
  templates: {
    general: string
    catalog: string
    /** Admite {producto}, {plataforma} y {precio}. */
    product: string
    cart: string
    used: string
    consoles: string
    accessories: string
    shipping: string
  }
}

export type AuditAction = 'crear' | 'actualizar' | 'eliminar' | 'acceso'

export interface AuditEntry {
  id: number
  actorId: string | null
  actorName: string
  action: AuditAction
  entity: string
  entityId: string | null
  label: string
  detail: Record<string, { antes: unknown; ahora: unknown }>
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel: métricas
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  products: number
  available: number
  soldOut: number
  lowStock: number
  units: number
  inventoryValue: number
  orders: number
  sales: number
  customers: number
  views: number
  draft: number
}

export interface SeriesPoint {
  label: string
  value: number
}
