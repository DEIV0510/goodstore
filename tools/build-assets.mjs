// ─────────────────────────────────────────────────────────────────────────────
// build-assets.mjs
// 1. Convierte los recortes de tools/crops/*.png a WebP optimizado en
//    public/games/<slug>.webp
// 2. Genera src/data/products.ts a partir de tools/catalog.mjs + descriptions.mjs
//
// Ejecutar con:  npm run images
// ─────────────────────────────────────────────────────────────────────────────
import sharp from './sharp.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { SHEETS, ROWS, RETIRADOS } from './catalog.mjs'
import { DESCRIPCIONES } from './descriptions.mjs'

const OUT_IMG = path.resolve('public/games')
const OUT_DATA = path.resolve('src/data/products.ts')
fs.mkdirSync(OUT_IMG, { recursive: true })
fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true })

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' y ')
    .replace(/\+/g, ' mas ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 72)

const PLATFORM_LABEL = { ps5: 'PS5', ps4: 'PS4', switch: 'Nintendo Switch' }

const items = []
const seen = new Set()

for (const [cropId, name, genre, featured = false, note] of ROWS) {
  const sheet = cropId.split('-')[0]
  const platform = SHEETS[sheet]
  if (!platform) throw new Error(`Hoja desconocida: ${sheet}`)

  const slug = `${slugify(name)}-${platform}`
  if (seen.has(slug)) throw new Error(`Slug duplicado: ${slug} (${cropId})`)
  seen.add(slug)

  const src = path.resolve('tools/crops', `${cropId}.png`)
  if (!fs.existsSync(src)) throw new Error(`Falta el recorte ${src}`)

  await sharp(src).webp({ quality: 82, effort: 6 }).toFile(path.join(OUT_IMG, `${slug}.webp`))
  const meta = await sharp(src).metadata()

  const desc = DESCRIPCIONES[cropId]
  if (!desc) throw new Error(`Falta descripción para ${cropId} (${name})`)

  items.push({
    id: cropId,
    name,
    slug,
    platform,
    genre,
    featured: Boolean(featured),
    note: note || null,
    image: `/games/${slug}.webp`,
    width: meta.width,
    height: meta.height,
    description: desc,
  })
}

// ── Emitir src/data/products.ts ──────────────────────────────────────────────
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const body = items
  .map(
    (p) => `  {
    id: '${p.id}',
    name: '${esc(p.name)}',
    slug: '${p.slug}',
    platform: '${p.platform}',
    category: 'videojuegos',
    genre: '${p.genre}',
    condition: 'consultar',
    price: null,
    oldPrice: null,
    stock: null,
    images: ['${p.image}'],
    imageSize: { w: ${p.width}, h: ${p.height} },
    description: '${esc(p.description)}',
    featured: ${p.featured},
    tags: ['${PLATFORM_LABEL[p.platform]}'],${p.note ? `\n    note: '${esc(p.note)}',` : ''}
  },`
  )
  .join('\n')

const header = `// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO GOOD GAME — fuente de verdad de los productos
//
// Generado a partir de las fotografías reales del negocio.
// A partir de aquí, EDITA ESTE ARCHIVO directamente para administrar la tienda.
//
// CÓMO ADMINISTRAR:
//   • Poner precio      → price: 189000        (número entero, sin puntos)
//   • Precio tachado    → oldPrice: 220000     (se muestra el descuento solo si price < oldPrice)
//   • Sin precio        → price: null          (se muestra "Consultar precio")
//   • Marcar agotado    → stock: 0
//   • Disponible        → stock: null (consultar) o un número (ej. 3)
//   • Estado real       → condition: 'nuevo' | 'usado' | 'consultar'
//   • Destacar en home  → featured: true
//   • Añadir producto   → copia un bloque, cambia id/slug/name y pon la imagen en public/games/
//
// Los campos price / stock / condition vienen sin datos porque el negocio no los
// entregó todavía. La tienda funciona igual: cada producto abre WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────
import type { Product } from '@/types'

export const products: Product[] = [
${body}
]

// Títulos marcados con una X roja en las fotografías originales.
// No se publican como disponibles. Para reactivar uno, muévelo al array de
// arriba y reemplaza su fotografía (la original tiene la marca encima).
export const retirados = [
${RETIRADOS.map(([id, name, plat]) => `  { id: '${id}', name: '${esc(name)}', platform: '${plat}' },`).join('\n')}
]
`

fs.writeFileSync(OUT_DATA, header)
console.log(`✔ ${items.length} imágenes WebP → public/games/`)
console.log(`✔ src/data/products.ts generado`)
console.log(`  · Switch: ${items.filter((i) => i.platform === 'switch').length}`)
console.log(`  · PS4:    ${items.filter((i) => i.platform === 'ps4').length}`)
console.log(`  · PS5:    ${items.filter((i) => i.platform === 'ps5').length}`)
console.log(`  · Destacados: ${items.filter((i) => i.featured).length}`)
console.log(`  · Retirados (X roja): ${RETIRADOS.length}`)

// ── Sitemap ─────────────────────────────────────────────────────────────────
// Se regenera junto con el catálogo para que nunca quede desactualizado.
// Cambia SITE_URL cuando el dominio definitivo esté listo.
const SITE_URL = 'https://goodgame.com.co'
const staticRoutes = ['/', '/catalogo', '/usados', '/favoritos']
const urls = [
  ...staticRoutes.map((r) => ({ loc: r, priority: r === '/' ? '1.0' : '0.8', freq: 'weekly' })),
  ...items.map((p) => ({ loc: `/producto/${p.slug}`, priority: '0.6', freq: 'monthly' })),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`
fs.writeFileSync(path.resolve('public/sitemap.xml'), sitemap)
console.log(`✔ public/sitemap.xml (${urls.length} URLs)`)
