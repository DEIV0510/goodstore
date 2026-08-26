import { cliente, exigirBackend } from '@/lib/supabase'
import { products as semilla } from '@/data/products'
import { categories as categoriasSemilla } from '@/data/categories'
import { coverBySlug } from '@/data/covers'
import type {
  CategoryCard,
  Product,
  ProductInput,
  ProductStatus,
} from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Productos y categorías.
//
// Única puerta de entrada a los datos del catálogo: la usan por igual la tienda
// pública y el panel. Si mañana cambia el backend, se cambia aquí y nada más.
//
// Sin base de datos conectada devuelve el catálogo incluido en el paquete, que
// es el mismo que hoy está publicado. Las funciones de escritura, en cambio,
// fallan con un mensaje claro: no tiene sentido "guardar" en el aire.
// ─────────────────────────────────────────────────────────────────────────────

const COLUMNAS =
  'id, slug, name, platform, category, genre, condition, region, price, old_price, ' +
  'stock, sku, images, image_w, image_h, description, note, tags, featured, on_sale, ' +
  'new_release, best_seller, status, sort_index, views, created_at, updated_at'

interface FilaProducto {
  id: string
  slug: string
  name: string
  platform: Product['platform']
  category: Product['category']
  genre: Product['genre']
  condition: Product['condition']
  region: Product['region']
  price: number | null
  old_price: number | null
  stock: number | null
  sku: string | null
  images: string[] | null
  image_w: number | null
  image_h: number | null
  description: string | null
  note: string | null
  tags: string[] | null
  featured: boolean
  on_sale: boolean
  new_release: boolean
  best_seller: boolean
  status: ProductStatus
  sort_index: number
  views: number
  created_at: string
  updated_at: string
}

/** Fila de la base de datos → producto de la interfaz. */
function desdeFila(f: FilaProducto): Product {
  return {
    id: f.id,
    slug: f.slug,
    name: f.name,
    platform: f.platform,
    category: f.category,
    genre: f.genre,
    condition: f.condition,
    region: f.region,
    price: f.price,
    oldPrice: f.old_price,
    stock: f.stock,
    sku: f.sku,
    images: f.images ?? [],
    imageSize:
      f.image_w && f.image_h ? { w: f.image_w, h: f.image_h } : undefined,
    description: f.description ?? '',
    note: f.note ?? undefined,
    tags: f.tags ?? [],
    featured: f.featured,
    onSale: f.on_sale,
    newRelease: f.new_release,
    bestSeller: f.best_seller,
    status: f.status,
    views: f.views,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }
}

/**
 * Producto de la interfaz → fila de la base de datos.
 *
 * Solo traduce las propiedades PRESENTES en el objeto. Así una edición parcial
 * (por ejemplo, solo el stock) no pisa el resto de columnas con null.
 */
function haciaFila(p: Partial<ProductInput>) {
  const fila: Record<string, unknown> = {}
  if ('slug' in p) fila.slug = p.slug
  if ('name' in p) fila.name = p.name
  if ('platform' in p) fila.platform = p.platform
  if ('category' in p) fila.category = p.category
  if ('genre' in p) fila.genre = p.genre
  if ('condition' in p) fila.condition = p.condition
  if ('region' in p) fila.region = p.region
  if ('price' in p) fila.price = p.price
  if ('oldPrice' in p) fila.old_price = p.oldPrice
  if ('stock' in p) fila.stock = p.stock
  if ('sku' in p) fila.sku = p.sku ?? null
  if ('images' in p) fila.images = p.images
  if ('imageSize' in p) {
    fila.image_w = p.imageSize?.w ?? null
    fila.image_h = p.imageSize?.h ?? null
  }
  if ('description' in p) fila.description = p.description
  if ('note' in p) fila.note = p.note ?? null
  if ('tags' in p) fila.tags = p.tags
  if ('featured' in p) fila.featured = p.featured
  if ('onSale' in p) fila.on_sale = p.onSale
  if ('newRelease' in p) fila.new_release = p.newRelease
  if ('bestSeller' in p) fila.best_seller = p.bestSeller
  if ('status' in p) fila.status = p.status
  return fila
}

/**
 * Semilla → producto completo.
 * El catálogo incluido no trae los campos que solo administra el panel, así que
 * se rellenan con valores neutros: publicado, sin etiquetas de marketing y sin
 * vistas. Nunca se inventa un precio, un stock ni una disponibilidad.
 */
function desdeSemilla(s: (typeof semilla)[number], i: number): Product {
  return {
    ...s,
    id: s.id || `semilla-${i}`,
    sku: null,
    status: 'publicado',
    onSale: s.oldPrice !== null && s.price !== null && s.oldPrice > s.price,
    newRelease: false,
    bestSeller: false,
    views: 0,
  }
}

const catalogoSemilla: Product[] = semilla.map(desdeSemilla)

// ── Lectura ──────────────────────────────────────────────────────────────────

export interface OpcionesCatalogo {
  /** El panel necesita ver también borradores y archivados. */
  incluirNoPublicados?: boolean
}

export async function listarProductos(
  opciones: OpcionesCatalogo = {}
): Promise<Product[]> {
  const db = await cliente()
  if (!db) {
    return opciones.incluirNoPublicados
      ? catalogoSemilla
      : catalogoSemilla.filter((p) => p.status === 'publicado')
  }

  let consulta = db
    .from('products')
    .select(COLUMNAS)
    .order('sort_index', { ascending: true })
    .order('name', { ascending: true })

  if (!opciones.incluirNoPublicados) {
    consulta = consulta.eq('status', 'publicado')
  }

  const { data, error } = await consulta
  if (error) throw error
  return (data as unknown as FilaProducto[]).map(desdeFila)
}

export async function obtenerProducto(slug: string): Promise<Product | null> {
  const db = await cliente()
  if (!db) {
    return catalogoSemilla.find((p) => p.slug === slug) ?? null
  }
  const { data, error } = await db
    .from('products')
    .select(COLUMNAS)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ? desdeFila(data as unknown as FilaProducto) : null
}

export async function obtenerProductoPorId(id: string): Promise<Product | null> {
  const db = await cliente()
  if (!db) return catalogoSemilla.find((p) => p.id === id) ?? null
  const { data, error } = await db
    .from('products')
    .select(COLUMNAS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? desdeFila(data as unknown as FilaProducto) : null
}

/** Suma una vista. Silenciosa: que falle no debe romper la ficha. */
export async function registrarVista(slug: string): Promise<void> {
  const db = await cliente()
  if (!db) return
  try {
    await db.rpc('gg_registrar_vista', { p_slug: slug })
  } catch {
    /* la métrica es secundaria */
  }
}

// ── Escritura ────────────────────────────────────────────────────────────────

export async function crearProducto(entrada: ProductInput): Promise<Product> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('products')
    .insert(haciaFila(entrada))
    .select(COLUMNAS)
    .single()
  if (error) throw error
  return desdeFila(data as unknown as FilaProducto)
}

export async function actualizarProducto(
  id: string,
  entrada: Partial<ProductInput>
): Promise<Product> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('products')
    .update(haciaFila(entrada))
    .eq('id', id)
    .select(COLUMNAS)
    .single()
  if (error) throw error
  return desdeFila(data as unknown as FilaProducto)
}

export async function eliminarProducto(id: string): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('products').delete().eq('id', id)
  if (error) throw error
}

/** Copia un producto como borrador, para no publicar algo a medio llenar. */
export async function duplicarProducto(id: string): Promise<Product> {
  const original = await obtenerProductoPorId(id)
  if (!original) throw new Error('No se encontró el producto que quieres duplicar')

  const base = `${original.slug}-copia`
  let slug = base
  let intento = 2
  while (await obtenerProducto(slug)) {
    slug = `${base}-${intento++}`
  }

  return crearProducto({
    ...original,
    slug,
    name: `${original.name} (copia)`,
    status: 'borrador',
    featured: false,
  })
}

export async function actualizarStock(
  id: string,
  stock: number | null
): Promise<Product> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('products')
    .update({ stock })
    .eq('id', id)
    .select(COLUMNAS)
    .single()
  if (error) throw error
  return desdeFila(data as unknown as FilaProducto)
}

/** Marca o desmarca destacados en bloque desde la pantalla de contenido. */
export async function fijarDestacados(ids: string[]): Promise<void> {
  const db = await exigirBackend()
  const { error: apagar } = await db
    .from('products')
    .update({ featured: false })
    .eq('featured', true)
  if (apagar) throw apagar
  if (ids.length === 0) return
  const { error } = await db.from('products').update({ featured: true }).in('id', ids)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// Categorías
// ─────────────────────────────────────────────────────────────────────────────

interface FilaCategoria {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  href: string
  image_url: string | null
  cover_slugs: string[] | null
  sort_order: number
  active: boolean
  soon: boolean
}

function categoriaDesdeFila(f: FilaCategoria): CategoryCard {
  const slugs = f.cover_slugs ?? []
  return {
    id: f.id,
    slug: f.slug,
    title: f.title,
    subtitle: f.subtitle ?? '',
    description: f.description ?? '',
    href: f.href,
    imageUrl: f.image_url,
    coverSlugs: slugs,
    covers: slugs.map(coverBySlug).filter((x): x is string => x !== null),
    sortOrder: f.sort_order,
    active: f.active,
    soon: f.soon,
  }
}

const categoriasDeSemilla: CategoryCard[] = categoriasSemilla.map((c, i) => ({
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

export async function listarCategorias(
  opciones: { incluirInactivas?: boolean } = {}
): Promise<CategoryCard[]> {
  const db = await cliente()
  if (!db) {
    return opciones.incluirInactivas
      ? categoriasDeSemilla
      : categoriasDeSemilla.filter((c) => c.active)
  }

  let consulta = db
    .from('categories')
    .select(
      'id, slug, title, subtitle, description, href, image_url, cover_slugs, sort_order, active, soon'
    )
    .order('sort_order', { ascending: true })

  if (!opciones.incluirInactivas) consulta = consulta.eq('active', true)

  const { data, error } = await consulta
  if (error) throw error
  return (data as unknown as FilaCategoria[]).map(categoriaDesdeFila)
}

export type CategoriaInput = Omit<CategoryCard, 'id' | 'covers'>

function categoriaHaciaFila(c: Partial<CategoriaInput>) {
  const fila: Record<string, unknown> = {}
  if ('slug' in c) fila.slug = c.slug
  if ('title' in c) fila.title = c.title
  if ('subtitle' in c) fila.subtitle = c.subtitle
  if ('description' in c) fila.description = c.description
  if ('href' in c) fila.href = c.href
  if ('imageUrl' in c) fila.image_url = c.imageUrl
  if ('coverSlugs' in c) fila.cover_slugs = c.coverSlugs
  if ('sortOrder' in c) fila.sort_order = c.sortOrder
  if ('active' in c) fila.active = c.active
  if ('soon' in c) fila.soon = c.soon
  return fila
}

export async function crearCategoria(entrada: CategoriaInput): Promise<CategoryCard> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('categories')
    .insert(categoriaHaciaFila(entrada))
    .select()
    .single()
  if (error) throw error
  return categoriaDesdeFila(data as unknown as FilaCategoria)
}

export async function actualizarCategoria(
  id: string,
  entrada: Partial<CategoriaInput>
): Promise<CategoryCard> {
  const db = await exigirBackend()
  const { data, error } = await db
    .from('categories')
    .update(categoriaHaciaFila(entrada))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return categoriaDesdeFila(data as unknown as FilaCategoria)
}

export async function eliminarCategoria(id: string): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function reordenarCategorias(ids: string[]): Promise<void> {
  const db = await exigirBackend()
  await Promise.all(
    ids.map((id, i) => db.from('categories').update({ sort_order: i }).eq('id', id))
  )
}
