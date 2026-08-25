import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import fs from 'node:fs'
import { buildInventory, norm } from './inventory.mjs'
import { asignar } from './asignar-fotos.mjs'

// Compara el nombre del Excel con el título IMPRESO EN LA CAJA (leído de la
// fotografía). Donde la caja da el título completo y el Excel una abreviatura,
// conviene usar el de la caja: es lo que el cliente busca en Google.

const inventario = buildInventory()
const porClave = new Map(
  inventario.map((p) => [p.name.toLowerCase() + '|' + p.platform, p])
)

const { resultado } = asignar()
const leidas = new Map(
  JSON.parse(fs.readFileSync('_portadas-leidas.json', 'utf8')).map((f) => [f.archivo, f])
)

const filas = []
for (const a of resultado) {
  if (!a.clave) continue
  const p = porClave.get(a.clave)
  const l = leidas.get(a.archivo)
  if (!p || !l || !l.titulo) continue
  const excel = norm(p.name)
  const caja = norm(l.titulo)
  if (excel === caja) continue
  // Solo interesa cuando la caja aporta información que el Excel no tiene
  const palabrasExcel = new Set(excel.split(' '))
  const nuevas = caja.split(' ').filter((w) => !palabrasExcel.has(w))
  if (!nuevas.length) continue
  filas.push({ excel: p.name, plataforma: p.platform, caja: l.titulo, nuevas: nuevas.join(' ') })
}

filas.sort((a, b) => a.excel.localeCompare(b.excel, 'es'))
console.log(`${filas.length} nombres donde la caja dice más que el Excel:\n`)
for (const f of filas) {
  console.log(`  '${norm(f.excel)}': '${f.caja}',`)
  console.log(`      // Excel: "${f.excel}" [${f.plataforma}]`)
}
