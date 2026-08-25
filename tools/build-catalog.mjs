import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import sharp from './sharp.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { buildInventory, norm } from './inventory.mjs'
import { FOTOS, ACCESORIOS } from './fotos.mjs'
import { asignar, ALIAS } from './asignar-fotos.mjs'
import { recortar } from './crop-fotos.mjs'

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
  'spiderman goty': "Marvel's Spider-Man Game of the Year Edition",
  'dead cells goty': 'Dead Cells Game of the Year Edition',
  'red dead redemption 2': 'Red Dead Redemption II',
  'resident evil 4 version clasica': 'Resident Evil 4 (versión clásica)',
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
  'nier automata': 'NieR: Automata',

  // ── Títulos tomados de la propia carátula ─────────────────────────────────
  // Al leer las fotografías se vio el nombre impreso en cada caja. Donde el
  // Excel abrevia, se usa el de la caja: es lo que el cliente busca en Google
  // y en el buscador de la tienda. La edición se conserva cuando la hay.
  '1971 collector s edition': "1971 Project Helios Collector's Edition",
  'alan wake 2 deluxe edition': 'Alan Wake II Deluxe Edition',
  'armored core': 'Armored Core VI: Fires of Rubicon',
  'baldur s gate 3': "Baldur's Gate III",
  'bioshock collection': 'BioShock: The Collection',
  'blasphemous 2': 'Blasphemous II',
  'bloodstained ritual of the night 2': 'Bloodstained: Curse of the Moon 2',
  'callisto protocol': 'The Callisto Protocol',
  'crash bandicoot 4': "Crash Bandicoot 4: It's About Time",
  'crash ctr': 'Crash Team Racing Nitro-Fueled',
  'crash team racing': 'Crash Team Racing Nitro-Fueled',
  'crash trilogy': 'Crash Bandicoot N. Sane Trilogy',
  'dark souls 2': 'Dark Souls II: Scholar of the First Sin',
  'dead cells return to castlevania': 'Dead Cells: Return to Castlevania',
  'dead rising remastered': 'Dead Rising Deluxe Remaster',
  'death stranding 2': 'Death Stranding 2: On the Beach',
  'detective pikachu jp': 'Detective Pikachu Returns (edición japonesa)',
  'deus ex': 'Deus Ex: Mankind Divided',
  'devil may cry collection': 'Devil May Cry HD Collection',
  'diablo 3': 'Diablo III: Eternal Collection',
  'disco elisium': 'Disco Elysium: The Final Cut',
  'donkey kong tropical freeze': 'Donkey Kong Country: Tropical Freeze',
  'doom classic collection': 'DOOM: The Classics Collection',
  'dragon quest vii': 'Dragon Quest VII Reimagined',
  'dragon quest xi s americano': 'Dragon Quest XI S: Echoes of an Elusive Age',
  'ender lilies': 'Ender Lilies: Quietus of the Knights',
  'ender magnolia bloom in the mist americano': 'Ender Magnolia: Bloom in the Mist',
  'expedition 33': 'Clair Obscur: Expedition 33',
  'expedition 33 edicion especial': 'Clair Obscur: Expedition 33 — Edición Especial',
  'fate extella': 'Fate/EXTELLA: The Umbral Star',
  'fc 25': 'EA Sports FC 25',
  'final fantasy rebirth': 'Final Fantasy VII Rebirth',
  'gears of war': 'Gears of War: Reloaded',
  'god fall': 'Godfall',
  'god of war 3': 'God of War III Remastered',
  'gta trilogy': 'Grand Theft Auto: The Trilogy — The Definitive Edition',
  'gta v': 'Grand Theft Auto V',
  'highland song': 'A Highland Song',
  'jujutsu kaisen': 'Jujutsu Kaisen: Cursed Clash',
  kena: 'Kena: Bridge of Spirits',
  'lego batman': 'LEGO Batman: Legacy of the Dark Knight',
  'lego batman 3': 'LEGO Batman 3: Beyond Gotham',
  'mario tennis': 'Mario Tennis Fever',
  'metal gear solid collection': 'Metal Gear Solid: Master Collection Vol. 1',
  'metal gear solid collection vol 1': 'Metal Gear Solid: Master Collection Vol. 1',
  'metroid prime 4': 'Metroid Prime 4: Beyond',
  'midnight suns': "Marvel's Midnight Suns",
  'monster hunter': 'Monster Hunter: World',
  'ori collection': 'Ori: The Collection',
  'overcooked and overcooked 2': 'Overcooked! Special Edition + Overcooked! 2',
  'pokémon legends z a': 'Leyendas Pokémon: Z-A',
  'pokémon snap': 'New Pokémon Snap',
  rayman: 'Rayman Legends',
  'resident evil 7 biohazard gold edition': 'Resident Evil VII: Biohazard Gold Edition',
  'resident evil 9': 'Resident Evil Requiem',
  sekiro: 'Sekiro: Shadows Die Twice',
  'sifu switch': 'Sifu',
  'space marine 2': 'Warhammer 40,000: Space Marine II',
  spyro: 'Spyro Reignited Trilogy',
  'the adventure of elliot': 'The Adventures of Elliot: The Millennium Tales',
  'the last of us 2': 'The Last of Us Part II',
  'the last of us part 2': 'The Last of Us Part II Remastered',
  'the last of us remastered': 'The Last of Us Remasterizado',
  'the witcher 3 complete edition usa': 'The Witcher 3: Wild Hunt Complete Edition',
  'uncharted collection': 'Uncharted: Legacy of Thieves Collection',
  wuchang: 'Wuchang: Fallen Feathers',
  'ys ix': 'Ys IX: Monstrum Nox',
  'zelda tears of the kingdom': 'The Legend of Zelda: Tears of the Kingdom',
  'zelda: tears of the kingdom': 'The Legend of Zelda: Tears of the Kingdom',
  'microsd kingston canvas select plus 256gb':
    'Memoria MicroSD Kingston Canvas Select Plus 256 GB',
  'control xbox negro': 'Control Xbox inalámbrico negro',
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

/**
 * Nombre final del producto.
 *
 * IMPORTANTE: primero se separa el paréntesis y DESPUÉS se corrige el nombre.
 * Al revés, "Spiderman GOTY (Codigos vigentes)" nunca coincidía con la errata
 * 'spiderman goty' y se quedaba con el nombre abreviado del Excel.
 */
function nombreFinal(raw) {
  const { limpio, nota } = separarNota(raw)
  return { limpio: tituloBonito(limpio), nota }
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

// ── 1. Resolver qué fotografía le toca a cada producto ──────────────────────
//
// Orden de preferencia:
//   1. Fotografía individual nueva del negocio (la de mejor calidad)
//   2. La de otro producto que es el MISMO juego escrito distinto en el Excel
//   3. El recorte antiguo de las fotos en cuadrícula
//   4. Ninguna → la web dibuja una portada de marca con el título
//
const { resultado: asignaciones } = asignar()
const fotoNueva = new Map() // clave de inventario → archivo original
for (const a of asignaciones) if (a.clave) fotoNueva.set(a.clave, a.archivo)
for (const [destino, origen] of Object.entries(ALIAS)) {
  if (!fotoNueva.has(destino) && fotoNueva.has(origen)) fotoNueva.set(destino, fotoNueva.get(origen))
}

const fuenteDeProducto = new Map() // producto → { tipo, ref }
for (const p of inventario) {
  const clave = p.name.toLowerCase() + '|' + p.platform
  if (fotoNueva.has(clave)) {
    fuenteDeProducto.set(p, { tipo: 'foto', ref: fotoNueva.get(clave) })
  } else if (FOTOS[clave]) {
    fuenteDeProducto.set(p, { tipo: 'recorte', ref: FOTOS[clave] })
  } else if (ALIAS[clave] && FOTOS[ALIAS[clave]]) {
    fuenteDeProducto.set(p, { tipo: 'recorte', ref: FOTOS[ALIAS[clave]] })
  }
}

// Una misma imagen puede servir a varios productos (copia nueva y usada): el
// archivo se nombra con el primer producto para no duplicarla en disco.
const archivoDeFuente = new Map()
const plataformaDeFuente = new Map()
for (const [p, f] of fuenteDeProducto) {
  const k = f.tipo + ':' + f.ref
  const base = slugify(nombreFinal(p.name).limpio) + '-' + p.platform
  if (!archivoDeFuente.has(k) || base < archivoDeFuente.get(k)) archivoDeFuente.set(k, base)
  if (!plataformaDeFuente.has(k)) plataformaDeFuente.set(k, p.platform)
}

// ── 2. Generar las imágenes ─────────────────────────────────────────────────
fs.rmSync(OUT_IMG, { recursive: true, force: true })
fs.mkdirSync(OUT_IMG, { recursive: true })
const tamañoDeFuente = new Map()
let nNuevas = 0
let nRecortes = 0

for (const [k, base] of archivoDeFuente) {
  const [tipo, ref] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)]
  const destino = path.join(OUT_IMG, `${base}.webp`)

  if (tipo === 'foto') {
    // Fotografía individual: se recorta el estuche y se exporta
    const region = await recortar(ref, plataformaDeFuente.get(k), destino)
    tamañoDeFuente.set(k, { w: 420, h: Math.round((420 * region.height) / region.width) })
    nNuevas++
  } else {
    const src = path.resolve('crops', `${ref}.png`)
    if (!fs.existsSync(src)) throw new Error(`Falta el recorte ${src}`)
    await sharp(src).webp({ quality: 82, effort: 6 }).toFile(destino)
    const meta = await sharp(src).metadata()
    tamañoDeFuente.set(k, { w: meta.width, h: meta.height })
    nRecortes++
  }
}

// 3. Construir los productos
const usados = new Set()
const productos = []
const sinClasificar = []

for (const p of inventario) {
  const claveInv = p.name.toLowerCase() + '|' + p.platform
  const { limpio, nota } = nombreFinal(p.name)

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

  const fuente = fuenteDeProducto.get(p)
  const claveFuente = fuente ? fuente.tipo + ':' + fuente.ref : null
  const archivo = claveFuente ? archivoDeFuente.get(claveFuente) : null

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
    imageSize: claveFuente ? tamañoDeFuente.get(claveFuente) : null,
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
console.log(`✔ ${archivoDeFuente.size} imágenes WebP → public/games/ (${nNuevas} fotos nuevas · ${nRecortes} recortes)`)
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
