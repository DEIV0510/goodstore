// ─────────────────────────────────────────────────────────────────────────────
// Modelo de datos de la tienda.
// Está pensado para poder migrar a Firebase / Supabase / WooCommerce sin tocar
// la interfaz: basta con que la fuente devuelva objetos con esta forma.
// ─────────────────────────────────────────────────────────────────────────────

export type Platform = 'ps5' | 'ps4' | 'switch'

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

export interface Product {
  id: string
  name: string
  slug: string
  platform: Platform
  category: Category
  genre: Genre
  condition: Condition
  /** null → se muestra "Consultar precio" */
  price: number | null
  /** Precio anterior tachado. Solo se muestra si es mayor que `price`. */
  oldPrice: number | null
  /** null → disponibilidad a confirmar (se muestra como disponible). 0 → agotado. */
  stock: number | null
  images: string[]
  imageSize?: { w: number; h: number }
  description: string
  featured: boolean
  tags: string[]
  /** Aclaración honesta cuando algo no se pudo confirmar desde la foto. */
  note?: string
}

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
  priceRanges: string[]
  availability: ('disponible' | 'agotado')[]
  query: string
  sort: SortKey
}
