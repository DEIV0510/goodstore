import { products } from './products'

/**
 * Resuelve la portada de un producto a partir de su slug.
 *
 * Las secciones decorativas (categorías, banner de usados) apuntaban antes al
 * nombre del archivo de imagen. Cada vez que se corregía el nombre de un juego
 * el archivo cambiaba y esos enlaces se rompían en silencio. Referenciar por
 * slug evita el problema: si el producto deja de existir, se omite y ya.
 */
const porSlug = new Map(products.map((p) => [p.slug, p]))

export function coverBySlug(slug: string): string | null {
  return porSlug.get(slug)?.images[0] ?? null
}

/** Devuelve solo las portadas que existen, en el orden pedido. */
export function coversBySlug(slugs: string[]): string[] {
  return slugs.map(coverBySlug).filter((x): x is string => x !== null)
}
