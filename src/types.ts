// ─────────────────────────────────────────────────────────────────────────────
// Modelo de datos de la tienda.
// Está pensado para poder migrar a Firebase / Supabase / WooCommerce sin tocar
// la interfaz: basta con que la fuente devuelva objetos con esta forma.
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
  regions: Region[]
  priceRanges: string[]
  availability: ('disponible' | 'agotado')[]
  query: string
  sort: SortKey
}
