import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import fs from 'node:fs'
import { norm } from './inventory.mjs'

// Busca, entre TODAS las portadas leídas, candidatas para los productos que
// quedaron sin fotografía. Muestra también las fotos ya asignadas a otro
// producto, por si el emparejamiento fue el equivocado.

const leidas = JSON.parse(fs.readFileSync('_portadas-leidas.json', 'utf8'))
const extra = [
  { archivo: 'requiem.webp', titulo: 'Resident Evil Requiem', plataforma: 'ps5' },
  { archivo: 'microsd256gb.webp', titulo: 'MicroSD Kingston 256GB', plataforma: 'switch' },
]
const todas = [...leidas, ...extra]

const PALABRAS = process.argv.slice(2)
if (!PALABRAS.length) {
  console.log('uso: node tools/buscar-faltantes.mjs <palabra> [palabra...]')
  process.exit(0)
}

for (const p of PALABRAS) {
  const q = norm(p)
  const hits = todas.filter(
    (f) => norm(f.titulo).includes(q) || norm(f.archivo).includes(q)
  )
  console.log(`\n── "${p}" → ${hits.length} coincidencia(s)`)
  for (const h of hits) {
    console.log(
      `   ${h.archivo.padEnd(30)} "${h.titulo}" [${h.plataforma}]${h.edicion ? ' · ' + h.edicion : ''}`
    )
  }
}
