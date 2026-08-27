import { api } from '@/lib/api'
import { products as semilla } from '@/data/products'
import { categories as categoriasSemilla } from '@/data/categories'
import { coverBySlug } from '@/data/covers'
import type { CategoryCard, Product, ProductInput } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Productos y categorías.
//
// Única puerta de entrada a los datos del catálogo: la usan por igual la tienda
// pública y el panel. Por eso un cambio hecho en /admin se ve en la tienda sin
// que haya dos copias que se puedan desincronizar.
//
// El servidor devuelve el JSON ya con la forma del modelo de la interfaz, así
// que aquí no hay traducción de campos: eso se hace una sola vez, en PHP
// (public/api/nucleo/salidas.php).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catálogo incluido en el paquete, como red de seguridad.
 *
 * Si la API no responde —PHP caído, archivos a medio subir, sin red— la tienda
 * muestra el catálogo que se publicó con la última versión del sitio. Puede
 * traer algún precio viejo, pero eso es infinitamente mejor que una tienda en
 * blanco.
 *
 * Solo lo usa la tienda pública. El panel NO cae aquí a propósito: si algo
 * falla al administrar, el administrador tiene que verlo, no ponerse a
 * trabajar encima de datos que no son los de verdad.
 */
const catalogoSemilla: Product[] = semilla.map((s, i) => ({
  ...s,
  id: s.id || `semilla-${i}`,
  sku: null,
  status: 'publicado' as const,
  onSale: s.oldPrice !== null && s.price !== null && s.oldPrice > s.price,
  newRelease: false,
  bestSeller: false,
  views: 0,
}))

export const catalogoDeRespaldo = (): Product[] => catalogoSemilla

export const categoriasDeRespaldo = (): CategoryCard[] =>
  categoriasSemilla.map((c, i) => ({
    id: c.id,
    slug: c.id,
    title: c.title,
    subtitle: c.subtitle,
    description: '',
    href: c.href,
    imageUrl: null,
    coverSlugs: [],
    covers: c.covers,
    sortOrder: i,
    active: true,
    soon: Boolean(c.soon),
  }))

// ── Productos ────────────────────────────────────────────────────────────────

export interface OpcionesCatalogo {
  /** El panel necesita ver también borradores y archivados. */
  incluirNoPublicados?: boolean
}

export async function listarProductos(
  opciones: OpcionesCatalogo = {}
): Promise<Product[]> {
  const r = await api<{ productos: Product[] }>('productos', {
    parametros: { todos: opciones.incluirNoPublicados ? 1 : undefined },
  })
  return r.productos
}

export async function obtenerProducto(slug: string): Promise<Product | null> {
  const r = await api<{ productos: Product[] }>('productos', {
    parametros: { todos: 1 },
  })
  return r.productos.find((p) => p.slug === slug) ?? null
}

export async function obtenerProductoPorId(id: string): Promise<Product | null> {
  try {
    const r = await api<{ producto: Product }>(`productos/${encodeURIComponent(id)}`)
    return r.producto
  } catch (e) {
    // Un 404 aquí no es un fallo: significa que ese producto no existe, y quien
    // llama ya sabe qué hacer con un null.
    if ((e as { http?: number }).http === 404) return null
    throw e
  }
}

/** Suma una vista. Silenciosa: que falle no debe romper la ficha del producto. */
export async function registrarVista(slug: string): Promise<void> {
  try {
    await api(`productos/${encodeURIComponent(slug)}/vista`, { metodo: 'POST' })
  } catch {
    /* la métrica es secundaria */
  }
}

export async function crearProducto(entrada: ProductInput): Promise<Product> {
  const r = await api<{ producto: Product }>('productos', {
    metodo: 'POST',
    cuerpo: entrada,
  })
  return r.producto
}

export async function actualizarProducto(
  id: string,
  entrada: Partial<ProductInput>
): Promise<Product> {
  const r = await api<{ producto: Product }>(`productos/${encodeURIComponent(id)}`, {
    metodo: 'PATCH',
    cuerpo: entrada,
  })
  return r.producto
}

export async function eliminarProducto(id: string): Promise<void> {
  await api(`productos/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

/** Copia un producto como borrador, para no publicar algo a medio llenar. */
export async function duplicarProducto(id: string): Promise<Product> {
  const r = await api<{ producto: Product }>(
    `productos/${encodeURIComponent(id)}/duplicar`,
    { metodo: 'POST' }
  )
  return r.producto
}

export async function actualizarStock(
  id: string,
  stock: number | null
): Promise<Product> {
  const r = await api<{ producto: Product }>(
    `productos/${encodeURIComponent(id)}/stock`,
    { metodo: 'PATCH', cuerpo: { stock } }
  )
  return r.producto
}

/** Marca o desmarca destacados en bloque desde la pantalla de contenido. */
export async function fijarDestacados(ids: string[]): Promise<void> {
  await api('productos/destacados', { metodo: 'POST', cuerpo: { ids } })
}

// ── Categorías ───────────────────────────────────────────────────────────────

export type CategoriaInput = Omit<CategoryCard, 'id' | 'covers'>

export async function listarCategorias(
  opciones: { incluirInactivas?: boolean } = {}
): Promise<CategoryCard[]> {
  const r = await api<{ categorias: CategoryCard[] }>('categorias', {
    parametros: { todas: opciones.incluirInactivas ? 1 : undefined },
  })
  return r.categorias
}

export async function crearCategoria(entrada: CategoriaInput): Promise<CategoryCard> {
  const r = await api<{ categoria: CategoryCard }>('categorias', {
    metodo: 'POST',
    cuerpo: entrada,
  })
  return r.categoria
}

export async function actualizarCategoria(
  id: string,
  entrada: Partial<CategoriaInput>
): Promise<CategoryCard> {
  const r = await api<{ categoria: CategoryCard }>(
    `categorias/${encodeURIComponent(id)}`,
    { metodo: 'PATCH', cuerpo: entrada }
  )
  return r.categoria
}

export async function eliminarCategoria(id: string): Promise<void> {
  await api(`categorias/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
}

export async function reordenarCategorias(ids: string[]): Promise<void> {
  await api('categorias/orden', { metodo: 'POST', cuerpo: { ids } })
}

/** Resuelve la portada de un producto por su slug (para las categorías). */
export { coverBySlug }
