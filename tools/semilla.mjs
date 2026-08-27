import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ═════════════════════════════════════════════════════════════════════════════
// GOOD GAME · Generador de la semilla
//
//   npm run semilla    (se ejecuta solo dentro de `npm run build`)
//
// Escribe `public/api/semilla.json` con el catálogo real del negocio: los 318
// productos, las 6 categorías y las 9 preguntas frecuentes.
//
// La API lo lee UNA vez, la primera que alguien abre el sitio, y carga la base
// de datos sola. Por eso no existe ningún paso manual de "importar el
// catálogo": se publica el sitio y ya está todo dentro.
//
// No inventa nada: todo sale de src/data/.
// ═════════════════════════════════════════════════════════════════════════════

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── Lectura de los datos del proyecto ────────────────────────────────────────
//
// Los datos viven en archivos .ts que Node no sabe ejecutar. En vez de meter un
// compilador entero para tres archivos, se les quitan las anotaciones de tipo
// —que es justo lo que Node no entiende— y se importan como módulos normales.
// Es acotado y verificable: si el recorte fallara, la importación reventaría
// aquí mismo en vez de escribir una semilla a medias.

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-semilla-'))

async function importarSinTipos(rutaRelativa, transformar = (s) => s) {
  const origen = fs.readFileSync(path.join(raiz, rutaRelativa), 'utf8')
  const limpio = transformar(
    origen
      .replace(/^\s*import\s+type\s+.*$/gm, '')
      .replace(/^\s*export\s+type\s+.*$/gm, '')
      .replace(/^export\s+interface\s+\w+\s*\{[\s\S]*?^\}$/gm, '')
      // "export const x: T[] = [" -> "export const x = ["
      .replace(/(export\s+const\s+\w+)\s*:\s*[^=]+=/g, '$1 =')
  )
  const destino = path.join(temporal, path.basename(rutaRelativa).replace(/\.ts$/, '.mjs'))
  fs.writeFileSync(destino, limpio)
  return import(pathToFileURL(destino).href)
}

const { products: productos } = await importarSinTipos('src/data/products.ts')

const { categories: categorias } = await importarSinTipos('src/data/categories.ts', (s) =>
  s
    // covers.ts resuelve slugs a rutas de imagen leyendo el catálogo. Aquí
    // interesa lo contrario: quedarse con los SLUGS, que es lo que guarda la
    // base de datos. Quitando la llamada, queda el array literal.
    .replace(/^\s*import\s+\{\s*coversBySlug\s*\}.*$/gm, '')
    .replace(/coversBySlug\(/g, '(')
)

const { faq: preguntas } = await importarSinTipos('src/data/faq.ts')

fs.rmSync(temporal, { recursive: true, force: true })

// ── Escritura ────────────────────────────────────────────────────────────────

const semilla = {
  generado: new Date().toISOString(),
  productos: productos.map((p) => ({
    slug: p.slug,
    name: p.name,
    platform: p.platform,
    category: p.category,
    genre: p.genre,
    condition: p.condition,
    region: p.region,
    // Los null se conservan tal cual: significan "sin confirmar", que no es lo
    // mismo que cero. La tienda muestra "Consultar precio".
    price: p.price,
    oldPrice: p.oldPrice,
    stock: p.stock,
    images: p.images ?? [],
    imageSize: p.imageSize ?? null,
    description: p.description ?? '',
    note: p.note ?? null,
    tags: p.tags ?? [],
    featured: Boolean(p.featured),
  })),
  categorias: categorias.map((c) => ({
    slug: c.id,
    title: c.title,
    subtitle: c.subtitle ?? '',
    href: c.href,
    coverSlugs: Array.isArray(c.covers) ? c.covers : [],
    soon: Boolean(c.soon),
  })),
  preguntas: preguntas.map((f) => ({ question: f.q, answer: f.a })),
}

const destino = path.join(raiz, 'public/api/semilla.json')
fs.mkdirSync(path.dirname(destino), { recursive: true })
fs.writeFileSync(destino, JSON.stringify(semilla))

const kb = (fs.statSync(destino).size / 1024).toFixed(0)
console.log(
  `  semilla.json listo: ${semilla.productos.length} productos, ` +
    `${semilla.categorias.length} categorias, ${semilla.preguntas.length} preguntas (${kb} kB)`
)
