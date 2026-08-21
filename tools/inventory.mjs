import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import fs from 'node:fs'

// ─────────────────────────────────────────────────────────────────────────────
// inventory.mjs — Lee el inventario del negocio (Excel) y lo normaliza.
//
// Origen: _source/inventario.xlsx  (columnas: Articulo · Plataforma ·
//         Pv estimado · Estado · Region · Cantidad)
//
// Reglas aplicadas:
//   · Cada fila es una unidad listada. Las filas idénticas (mismo título,
//     plataforma, estado, región y precio) se agrupan en UN producto.
//   · La cantidad del grupo es max(suma de cantidades escritas, nº de filas).
//     El negocio a veces escribe "3" en la primera fila y deja en blanco las
//     dos repeticiones; otras veces escribe "1" en cada una. La regla cubre
//     ambos casos sin inflar el stock.
//   · Un mismo título puede quedar como dos productos si hay copia nueva y
//     copia usada a distinto precio: son ofertas distintas.
// ─────────────────────────────────────────────────────────────────────────────

// Las filas se extraen del .xlsx con tools/xlsx-read.mjs y se guardan como
// instantánea en tools/inventario-filas.json para que el build sea reproducible.

/** Filas ya extraídas del Excel y guardadas como instantánea reproducible. */
export function readRows() {
  return JSON.parse(fs.readFileSync('inventario-filas.json', 'utf8'))
}

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const PLATFORM = {
  ps5: 'ps5',
  ps4: 'ps4',
  'switch 1': 'switch',
  'switch 2': 'switch2',
  xbox: 'xbox',
}

const CONDITION = { nuevo: 'nuevo', usado: 'usado' }

const REGION = {
  america: 'america',
  europa: 'europa',
  japon: 'japon',
  asia: 'asia',
}

/** Convierte las filas crudas en la lista de productos del catálogo. */
export function buildInventory() {
  const rows = readRows()
  const items = Object.entries(rows)
    .filter(([n]) => +n >= 2)
    .map(([n, c]) => {
      const platRaw = String(c.B || '').toLowerCase().trim()
      const plat = PLATFORM[platRaw]
      if (!plat) throw new Error(`Plataforma desconocida en la fila ${n}: "${c.B}"`)
      const cond = CONDITION[String(c.D || '').toLowerCase().trim()]
      if (!cond) throw new Error(`Estado desconocido en la fila ${n}: "${c.D}"`)
      const regionRaw = String(c.E || '').toLowerCase().trim()
      const region = regionRaw ? REGION[regionRaw] : null
      if (regionRaw && !region) throw new Error(`Región desconocida en la fila ${n}: "${c.E}"`)
      const price = Number(c.C)
      if (!Number.isFinite(price) || price <= 0) throw new Error(`Precio inválido en la fila ${n}`)
      return {
        row: +n,
        name: String(c.A).trim(),
        platform: plat,
        price,
        condition: cond,
        region,
        qty: c.F === undefined ? null : Number(c.F),
      }
    })

  // Agrupar filas idénticas
  const groups = new Map()
  for (const it of items) {
    const k = [norm(it.name), it.platform, it.condition, it.region, it.price].join('|')
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(it)
  }

  const products = []
  for (const [, g] of groups) {
    const sum = g.reduce((n, x) => n + (x.qty || 0), 0)
    const stock = Math.max(sum, g.length)
    // Se conserva el nombre mejor escrito del grupo (el que tiene más mayúsculas
    // internas suele ser el que el negocio escribió con cuidado).
    const name = g.map((x) => x.name).sort((a, b) => b.length - a.length)[0]
    products.push({
      name,
      platform: g[0].platform,
      price: g[0].price,
      condition: g[0].condition,
      region: g[0].region,
      stock,
      rows: g.map((x) => x.row),
    })
  }

  products.sort(
    (a, b) => a.platform.localeCompare(b.platform) || a.name.localeCompare(b.name, 'es')
  )
  return products
}

if (process.argv[1] && process.argv[1].endsWith('inventory.mjs')) {
  const p = buildInventory()
  console.log(`✔ ${p.length} productos a partir del inventario`)
  const by = (k) =>
    Object.entries(
      p.reduce((m, x) => ((m[x[k] ?? 'sin dato'] = (m[x[k] ?? 'sin dato'] || 0) + 1), m), {})
    )
      .sort((a, b) => b[1] - a[1])
      .map(([a, b]) => `${a}:${b}`)
      .join('  ')
  console.log('  plataforma →', by('platform'))
  console.log('  estado     →', by('condition'))
  console.log('  región     →', by('region'))
  console.log('  unidades   →', p.reduce((n, x) => n + x.stock, 0))
  console.log(
    '  precios    → min',
    Math.min(...p.map((x) => x.price)),
    '· max',
    Math.max(...p.map((x) => x.price))
  )
  fs.writeFileSync('inventario-productos.json', JSON.stringify(p, null, 1))
  console.log('  → tools/inventario-productos.json')
}
