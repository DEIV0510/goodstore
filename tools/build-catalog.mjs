import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import sharp from './sharp.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { buildInventory, norm } from './inventory.mjs'
import { FOTOS, ACCESORIOS } from './fotos.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// build-catalog.mjs — Genera el catálogo de la tienda.
//
//   inventario del negocio (Excel)  +  fotografías recortadas  +  géneros y
//   descripciones revisadas   →   src/data/products.ts  +  public/games/*.webp
//
// Ejecutar con:  npm run catalogo
// ─────────────────────────────────────────────────────────────────────────────

const OUT_IMG = path.resolve('../public/games')
const OUT_DATA = path.resolve('../src/data/products.ts')

// ── Nombres: el Excel viene con mayúsculas inconsistentes ───────────────────
const MINUS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'a', 'al', 'en',
  'of', 'the', 'and', 'in', 'for', 'to', 'on', 'at', 'by', 'from',
  'into', 'onto', 'or', 'nor', 'but', 'as', 'with', 'over', 'up', 'off',
])

/**
 * Erratas claras del Excel sobre títulos que existen de verdad.
 * Se corrigen porque el nombre del producto es lo que el cliente busca en
 * Google y en el buscador de la tienda. Clave = nombre normalizado del Excel.
 */
const ERRATAS = {
  'assasin s creed origins': "Assassin's Creed Origins",
  'assasin s creed the ezio collection': "Assassin's Creed: The Ezio Collection",
  'assasin s creed 3': "Assassin's Creed III",
  'elden ring nightrein': 'Elden Ring Nightreign',
  'kirby star alliance': 'Kirby Star Allies',
  'disco elisium': 'Disco Elysium',
  'streths of rage 4': 'Streets of Rage 4',
  'ever foward': 'Ever Forward',
  moonscar: 'Moonscars',
  'yoshi and the misterious book': 'Yoshi and the Mysterious Book',
  'animal crossign new horizons': 'Animal Crossing: New Horizons',
  'animal crossing new horizons': 'Animal Crossing: New Horizons',
  'spiderman goty': "Marvel's Spider-Man GOTY",
  'spiderman miles morales': "Marvel's Spider-Man: Miles Morales",
  'spiderman version standard': "Marvel's Spider-Man",
  'spider man 2': "Marvel's Spider-Man 2",
  'pokémon shining pearl brillant diamont': 'Pokémon Brilliant Diamond + Shining Pearl',
  'woo long': 'Wo Long: Fallen Dynasty',
  'mario party jamboree': 'Super Mario Party Jamboree',
  'the hunter call of the wild': 'theHunter: Call of the Wild',
  'super mario bros deluxe': 'New Super Mario Bros. U Deluxe',
  'resident evil réquiem': 'Resident Evil Requiem',
  'megaman star force legacy collection': 'Mega Man Star Force Legacy Collection',
  'guardianes de la galaxia': "Marvel's Guardianes de la Galaxia",
  'gears of war': 'Gears of War',
  'nier automata': 'NieR: Automata',
}

/** Siglas y numerales romanos que van siempre en mayúscula. */
const TAL_CUAL = new Set([
  'GTA', 'RPG', 'HD', 'PS4', 'PS5', 'NBA', 'FC', 'DX', 'JP', 'EU', 'USA', 'CTR', 'GOTY',
  'VS', '2D', '3D', '2K', '2K25', 'SD', 'GB', 'XIV', 'XVI', 'XIII', 'XII', 'XI', 'IX',
  'VIII', 'VII', 'VI', 'IV', 'III', 'II', 'X', 'V',
])

/** Palabras con mayúscula interna que no se deben tocar. */
const ESTILIZADAS = { microsd: 'MicroSD', thehunter: 'theHunter', 'f.i.s.t.': 'F.I.S.T.' }

/**
 * El Excel viene con mayúsculas inconsistentes ("Ghost of tsushima",
 * "ATTACK ON TITAN 1", "woo long"). En una tienda eso se ve descuidado, así que
 * se normaliza a formato título respetando siglas y numerales romanos.
 */
const erratasAplicadas = []

function tituloBonito(raw) {
  const corregido = ERRATAS[norm(raw)]
  if (corregido) {
    erratasAplicadas.push(`${raw} → ${corregido}`)
    return corregido
  }
  return raw
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      const soloLetras = w.replace(/[^A-Za-z0-9.]/g, '')
      const clave = soloLetras.toLowerCase()
      if (ESTILIZADAS[clave]) return w.replace(soloLetras, ESTILIZADAS[clave])
      if (soloLetras.length > 1 && TAL_CUAL.has(soloLetras.toUpperCase())) {
        return w.replace(soloLetras, soloLetras.toUpperCase())
      }
      const bajo = w.toLowerCase()
      if (i > 0 && MINUS.has(bajo)) return bajo
      // Respeta guiones internos: "z-a" → "Z-A"
      return bajo.replace(/(^|[-–/])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
    })
    .join(' ')
}

/** Los paréntesis del Excel son avisos reales para el comprador. */
const NOTAS = {
  'sin mapa': 'No incluye el mapa de tela original.',
  'codigos vigentes': 'Los códigos incluidos están vigentes.',
  'no incluye llavero': 'No incluye el llavero de la edición.',
  promocion: 'Producto en promoción.',
  liquidacion: 'Producto en liquidación.',
  'vouchers posiblemente usados': 'Los vouchers incluidos podrían estar ya usados.',
  'playstation hits': 'Edición PlayStation Hits.',
  'steelbook con juego': 'Incluye caja metálica (steelbook) con el juego.',
}

function separarNota(raw) {
  const m = raw.match(/^(.*?)\s*[（(]\s*([^)）]+)\s*[)）]\s*(.*)$/)
  if (!m) return { limpio: raw.trim(), nota: null }
  const dentro = m[2].trim()
  const clave = norm(dentro)
  const nota = NOTAS[clave] ?? dentro.charAt(0).toUpperCase() + dentro.slice(1)
  const limpio = (m[1] + ' ' + m[3]).replace(/\s+/g, ' ').replace(/\s*-\s*$/, '').trim()
  return { limpio, nota }
}

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
    .slice(0, 68)

const PLATFORM_LABEL = {
  ps5: 'PS5',
  ps4: 'PS4',
  switch: 'Nintendo Switch',
  switch2: 'Nintendo Switch 2',
  xbox: 'Xbox',
}

// ── Destacados: títulos reconocibles y con fotografía real ──────────────────
const DESTACADOS = new Set([
  'elden ring|ps5',
  'god of war ragnarök|ps5',
  'hogwarts legacy|ps5',
  'baldur\'s gate 3|ps5',
  'demon\'s souls|ps5',
  'final fantasy rebirth|ps5',
  'doom: the dark ages|ps5',
  'ghost of tsushima director\'s cut|ps5',
  'the last of us 2|ps4',
  'red dead redemption 2 (sin mapa)|ps4',
  'sekiro|ps4',
  'spiderman miles morales|ps4',
  'ghost of tsushima|ps4',
  'mario kart 8 deluxe|switch',
  'the legend of zelda breath of the wild|switch',
  'super mario odyssey|switch',
  'pokémon scarlet|switch',
  'super smash bros ultimate|switch',
  'pokémon legends z-a switch 2 edition|switch2',
])

// ── Clasificación (género + descripción) revisada ───────────────────────────
const clasif = JSON.parse(fs.readFileSync('_clasificacion.json', 'utf8'))
const porTitulo = new Map(clasif.map((c) => [norm(c.titulo) + '|' + c.plataforma, c]))

// ─────────────────────────────────────────────────────────────────────────────
const inventario = buildInventory()

// 1. Resolver la fotografía de cada producto y el nombre del archivo
const cropDeProducto = new Map()
for (const p of inventario) {
  const clave = p.name.toLowerCase() + '|' + p.platform
  const crop = FOTOS[clave]
  if (crop) cropDeProducto.set(p, crop)
}

// Una misma foto puede servir a varios productos: el archivo se nombra con el
// primer producto (sin distinguir estado) para no duplicar imágenes.
const archivoDeCrop = new Map()
for (const [p, crop] of cropDeProducto) {
  const base = slugify(separarNota(tituloBonito(p.name)).limpio) + '-' + p.platform
  if (!archivoDeCrop.has(crop) || base < archivoDeCrop.get(crop)) archivoDeCrop.set(crop, base)
}

// 2. Generar las imágenes
fs.rmSync(OUT_IMG, { recursive: true, force: true })
fs.mkdirSync(OUT_IMG, { recursive: true })
const tamañoDeCrop = new Map()
for (const [crop, base] of archivoDeCrop) {
  const src = path.resolve('crops', `${crop}.png`)
  if (!fs.existsSync(src)) throw new Error(`Falta el recorte ${src}`)
  await sharp(src).webp({ quality: 82, effort: 6 }).toFile(path.join(OUT_IMG, `${base}.webp`))
  const meta = await sharp(src).metadata()
  tamañoDeCrop.set(crop, { w: meta.width, h: meta.height })
}

// 3. Construir los productos
const usados = new Set()
const productos = []
const sinClasificar = []

for (const p of inventario) {
  const claveInv = p.name.toLowerCase() + '|' + p.platform
  const { limpio, nota } = separarNota(tituloBonito(p.name))

  // slug único: se añade el estado, y la región si aún choca
  let slug = slugify(limpio) + '-' + p.platform
  if (usados.has(slug)) slug += '-' + p.condition
  if (usados.has(slug) && p.region) slug += '-' + p.region
  let n = 2
  while (usados.has(slug)) slug = `${slugify(limpio)}-${p.platform}-${n++}`
  usados.add(slug)

  const c = porTitulo.get(norm(p.name) + '|' + p.platform)
  const genero = c && c.genero !== 'desconocido' ? c.genero : null
  if (!genero) sinClasificar.push(`${p.name} [${p.platform}]`)

  const crop = cropDeProducto.get(p)
  const archivo = crop ? archivoDeCrop.get(crop) : null

  productos.push({
    id: 'inv-' + p.rows[0],
    name: limpio,
    slug,
    platform: p.platform,
    category: ACCESORIOS.has(claveInv) ? 'accesorios' : 'videojuegos',
    genre: genero,
    condition: p.condition,
    region: p.region,
    price: p.price,
    oldPrice: null,
    stock: p.stock,
    images: archivo ? [`/games/${archivo}.webp`] : [],
    imageSize: crop ? tamañoDeCrop.get(crop) : null,
    description: c?.descripcion || '',
    featured: DESTACADOS.has(claveInv),
    tags: [PLATFORM_LABEL[p.platform]],
    note: nota,
  })
}

// 4. Emitir src/data/products.ts
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const cuerpo = productos
  .map(
    (p) => `  {
    id: '${p.id}',
    name: '${esc(p.name)}',
    slug: '${p.slug}',
    platform: '${p.platform}',
    category: '${p.category}',
    genre: ${p.genre ? `'${p.genre}'` : 'null'},
    condition: '${p.condition}',
    region: ${p.region ? `'${p.region}'` : 'null'},
    price: ${p.price},
    oldPrice: null,
    stock: ${p.stock},
    images: [${p.images.map((i) => `'${i}'`).join(', ')}],${
      p.imageSize ? `\n    imageSize: { w: ${p.imageSize.w}, h: ${p.imageSize.h} },` : ''
    }
    description: '${esc(p.description)}',
    featured: ${p.featured},
    tags: ['${PLATFORM_LABEL[p.platform]}'],${p.note ? `\n    note: '${esc(p.note)}',` : ''}
  },`
  )
  .join('\n')

const cabecera = `// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO GOOD GAME — fuente de verdad de los productos
//
// Generado desde el inventario real del negocio (_source/inventario.xlsx) con
// \`npm run catalogo\`. A partir de aquí puedes EDITAR ESTE ARCHIVO directamente.
//
// CÓMO ADMINISTRAR:
//   • Cambiar precio    → price: 189000        (entero, sin puntos ni comas)
//   • Precio tachado    → oldPrice: 240000     (el descuento se calcula solo)
//   • Sin precio        → price: null          (muestra "Consultar precio")
//   • Marcar agotado    → stock: 0
//   • Cambiar unidades  → stock: 3
//   • Estado            → condition: 'nuevo' | 'usado' | 'consultar'
//   • Región del disco  → region: 'america' | 'europa' | 'japon' | 'asia' | null
//   • Destacar en home  → featured: true
//   • Poner fotografía  → images: ['/games/mi-juego-ps5.webp']
//
// Los productos sin fotografía muestran una portada de marca con su título.
// Nunca se usa la carátula de otro juego.
// ─────────────────────────────────────────────────────────────────────────────
import type { Product } from '@/types'

export const products: Product[] = [
${cuerpo}
]
`

fs.writeFileSync(OUT_DATA, cabecera)

// 5. Sitemap
const SITE_URL = 'https://goodgame.com.co'
const rutas = ['/', '/catalogo', '/usados', '/favoritos']
const urls = [
  ...rutas.map((r) => ({ loc: r, priority: r === '/' ? '1.0' : '0.8', freq: 'weekly' })),
  ...productos.map((p) => ({ loc: `/producto/${p.slug}`, priority: '0.6', freq: 'monthly' })),
]
fs.writeFileSync(
  path.resolve('../public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
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
)

// ── Resumen ─────────────────────────────────────────────────────────────────
const cuenta = (k) =>
  Object.entries(productos.reduce((m, x) => ((m[x[k] ?? '—'] = (m[x[k] ?? '—'] || 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([a, b]) => `${a}:${b}`)
    .join('  ')

console.log(`✔ ${productos.length} productos → src/data/products.ts`)
console.log(`✔ ${archivoDeCrop.size} imágenes WebP → public/games/`)
console.log(`✔ sitemap con ${urls.length} URLs`)
console.log('  plataforma →', cuenta('platform'))
console.log('  estado     →', cuenta('condition'))
console.log('  región     →', cuenta('region'))
console.log('  categoría  →', cuenta('category'))
console.log('  con foto   →', productos.filter((p) => p.images.length).length)
console.log('  destacados →', productos.filter((p) => p.featured).length)
console.log('  unidades   →', productos.reduce((n, p) => n + p.stock, 0))
console.log(
  '  precios    → ' +
    Math.min(...productos.map((p) => p.price)).toLocaleString('es-CO') +
    ' a ' +
    Math.max(...productos.map((p) => p.price)).toLocaleString('es-CO')
)
if (sinClasificar.length) console.log('  sin género →', sinClasificar.join(' | '))
if (erratasAplicadas.length)
  console.log('  erratas corregidas →', [...new Set(erratasAplicadas)].length)
