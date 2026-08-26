import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ═════════════════════════════════════════════════════════════════════════════
// GOOD GAME · Carga inicial de la base de datos
//
//   npm run sembrar
//
// Sube a Supabase el catálogo REAL que hoy tiene la tienda: los 318 productos
// del inventario del negocio, las categorías de la portada y las preguntas
// frecuentes. No inventa ni un solo dato: todo sale de src/data/.
//
// Es idempotente: se puede ejecutar las veces que haga falta. Cada producto se
// identifica por su slug, así que volver a ejecutarlo actualiza en vez de
// duplicar.
//
// NO siembra la configuración (ajustes, WhatsApp, contenido de la portada) a
// propósito: la aplicación ya trae esos valores por omisión y los mezcla con lo
// que haya en la base. Duplicarlos aquí crearía dos fuentes de verdad que
// tarde o temprano se contradicen.
//
// CREDENCIALES
//   VITE_SUPABASE_URL      se lee de .env
//   SUPABASE_SERVICE_KEY   se pasa por línea de comandos, NUNCA en .env
//
// La clave de servicio se salta todas las políticas de seguridad: es la única
// forma de cargar datos antes de que exista el primer administrador, y por eso
// vive solo en la terminal el rato que dura el proceso.
// ═════════════════════════════════════════════════════════════════════════════

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── Credenciales ─────────────────────────────────────────────────────────────

function leerEnv() {
  const archivo = path.join(raiz, '.env')
  if (!fs.existsSync(archivo)) return {}
  const salida = {}
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) salida[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return salida
}

const env = { ...leerEnv(), ...process.env }
const URL = env.VITE_SUPABASE_URL
const CLAVE = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

if (!URL) {
  console.error(
    '\n✗ Falta VITE_SUPABASE_URL.\n' +
      '  Copia .env.example como .env y pon ahí la URL de tu proyecto Supabase.\n'
  )
  process.exit(1)
}
if (!CLAVE) {
  console.error(
    '\n✗ Falta la clave de servicio.\n\n' +
      '  La encuentras en Supabase → Project Settings → API → service_role.\n' +
      '  NO la guardes en .env. Pásala solo al ejecutar:\n\n' +
      '    Windows (PowerShell):\n' +
      '      $env:SUPABASE_SERVICE_KEY="eyJ..."; npm run sembrar\n\n' +
      '    macOS y Linux:\n' +
      '      SUPABASE_SERVICE_KEY="eyJ..." npm run sembrar\n'
  )
  process.exit(1)
}

const db = createClient(URL, CLAVE, { auth: { persistSession: false } })

// ── Lectura de los datos del proyecto ────────────────────────────────────────
//
// Los datos viven en archivos .ts que Node no sabe ejecutar. En vez de meter un
// compilador entero para tres archivos, se les quitan las anotaciones de tipo
// (que son justo lo que Node no entiende) y se importan como módulos normales.
// Es acotado y verificable: si el recorte fallara, la importación reventaría
// aquí mismo en vez de subir datos a medias.

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'gg-sembrar-'))

async function importarSinTipos(rutaRelativa, transformar = (s) => s) {
  const origen = fs.readFileSync(path.join(raiz, rutaRelativa), 'utf8')
  const limpio = transformar(
    origen
      // import type / export type: solo existen para el compilador
      .replace(/^\s*import\s+type\s+.*$/gm, '')
      .replace(/^\s*export\s+type\s+.*$/gm, '')
      // interfaces completas
      .replace(/^export\s+interface\s+\w+\s*\{[\s\S]*?^\}$/gm, '')
      // anotación del array exportado: "export const x: T[] = [" → "export const x = ["
      .replace(/(export\s+const\s+\w+)\s*:\s*[^=]+=/g, '$1 =')
  )
  const destino = path.join(temporal, path.basename(rutaRelativa).replace(/\.ts$/, '.mjs'))
  fs.writeFileSync(destino, limpio)
  return import(pathToFileURL(destino).href)
}

const { products: semilla } = await importarSinTipos('src/data/products.ts')

const { categories: categoriasSemilla } = await importarSinTipos(
  'src/data/categories.ts',
  (s) =>
    s
      // covers.ts resuelve slugs a rutas de imagen leyendo el catálogo. Aquí
      // interesa justo lo contrario: quedarse con los SLUGS, que es lo que
      // guarda la base de datos. Quitando la llamada queda el array literal.
      .replace(/^\s*import\s+\{\s*coversBySlug\s*\}.*$/gm, '')
      .replace(/coversBySlug\(/g, '(')
)

const { faq: faqSemilla } = await importarSinTipos('src/data/faq.ts')

fs.rmSync(temporal, { recursive: true, force: true })

console.log('\n═══ GOOD GAME · carga inicial ═══\n')
console.log(`  proyecto   ${URL}`)
console.log(`  productos  ${semilla.length}`)
console.log(`  categorías ${categoriasSemilla.length}`)
console.log(`  preguntas  ${faqSemilla.length}\n`)

// ── Productos ────────────────────────────────────────────────────────────────

const filasProductos = semilla.map((p, i) => ({
  slug: p.slug,
  name: p.name,
  platform: p.platform,
  category: p.category,
  genre: p.genre,
  condition: p.condition,
  region: p.region,
  price: p.price,
  old_price: p.oldPrice,
  stock: p.stock,
  images: p.images ?? [],
  image_w: p.imageSize?.w ?? null,
  image_h: p.imageSize?.h ?? null,
  description: p.description ?? '',
  note: p.note ?? null,
  tags: p.tags ?? [],
  featured: Boolean(p.featured),
  // Marca de oferta deducida del propio dato, no inventada: solo si hay un
  // precio anterior mayor que el actual.
  on_sale: p.oldPrice !== null && p.price !== null && p.oldPrice > p.price,
  new_release: false,
  best_seller: false,
  status: 'publicado',
  // Conserva el orden del catálogo actual, que ya está trabajado.
  sort_index: i,
}))

const LOTE = 100
let subidos = 0

for (let i = 0; i < filasProductos.length; i += LOTE) {
  const lote = filasProductos.slice(i, i + LOTE)
  const { error } = await db.from('products').upsert(lote, { onConflict: 'slug' })
  if (error) {
    console.error(`\n✗ Error subiendo productos (lote ${i / LOTE + 1}):`, error.message)
    process.exit(1)
  }
  subidos += lote.length
  process.stdout.write(`\r  productos… ${subidos}/${filasProductos.length}`)
}
console.log(`\r  ✔ productos   ${subidos}                    `)

// ── Categorías ───────────────────────────────────────────────────────────────

const filasCategorias = categoriasSemilla.map((c, i) => ({
  slug: c.id,
  title: c.title,
  subtitle: c.subtitle ?? '',
  description: '',
  href: c.href,
  image_url: null,
  cover_slugs: Array.isArray(c.covers) ? c.covers : [],
  sort_order: i,
  active: true,
  soon: Boolean(c.soon),
}))

const { error: errorCategorias } = await db
  .from('categories')
  .upsert(filasCategorias, { onConflict: 'slug' })
if (errorCategorias) {
  console.error('\n✗ Error subiendo categorías:', errorCategorias.message)
  process.exit(1)
}
console.log(`  ✔ categorías  ${filasCategorias.length}`)

// ── Preguntas frecuentes ─────────────────────────────────────────────────────
//
// No tienen una clave natural con la que hacer upsert, así que se reemplazan
// enteras. Es seguro porque solo se ejecuta a mano y son nueve preguntas: si el
// negocio ya las editó, volver a sembrar las devuelve al texto original.

const { count: yaHayFaq } = await db
  .from('faq')
  .select('id', { count: 'exact', head: true })

if (yaHayFaq && yaHayFaq > 0) {
  console.log(`  · preguntas   ya hay ${yaHayFaq}, se dejan como están`)
} else {
  const { error: errorFaq } = await db.from('faq').insert(
    faqSemilla.map((f, i) => ({
      question: f.q,
      answer: f.a,
      sort_order: i,
      active: true,
    }))
  )
  if (errorFaq) {
    console.error('\n✗ Error subiendo preguntas:', errorFaq.message)
    process.exit(1)
  }
  console.log(`  ✔ preguntas   ${faqSemilla.length}`)
}

// ── Comprobación ─────────────────────────────────────────────────────────────

const { count: totalProductos } = await db
  .from('products')
  .select('id', { count: 'exact', head: true })

console.log('\n─────────────────────────────────────')
console.log(`  La base de datos tiene ${totalProductos} productos.`)
console.log('\n  Siguiente paso: crea tu usuario en')
console.log('  Supabase → Authentication → Users.')
console.log('  El primero que se registre queda como super administrador.\n')
