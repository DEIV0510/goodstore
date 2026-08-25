import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import fs from 'node:fs'
import { buildInventory } from './inventory.mjs'
import { asignar, ALIAS, DESCARTADAS } from './asignar-fotos.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// revisar-cobertura.mjs — Qué productos siguen sin fotografía y qué
// fotografías siguen sin usarse. Sirve para no dejar nada por emparejar.
// ─────────────────────────────────────────────────────────────────────────────

const inventario = buildInventory()
const titulos = [
  ...new Map(inventario.map((p) => [p.name.toLowerCase() + '|' + p.platform, p])).values(),
]

const { resultado } = asignar()
const usadas = new Map() // clave de inventario → archivo
for (const a of resultado) if (a.clave) usadas.set(a.clave, a.archivo)
for (const [destino, origen] of Object.entries(ALIAS)) {
  if (!usadas.has(destino) && usadas.has(origen)) usadas.set(destino, usadas.get(origen))
}

const sinFoto = titulos.filter((t) => !usadas.has(t.name.toLowerCase() + '|' + t.platform))

const archivos = fs.readdirSync('../_source/fotos').filter((f) => f.endsWith('.webp'))
const asignadas = new Set(resultado.filter((a) => a.clave).map((a) => a.archivo))
const sinUsar = archivos.filter((f) => !asignadas.has(f))

const leidas = new Map(
  JSON.parse(fs.readFileSync('_portadas-leidas.json', 'utf8')).map((f) => [f.archivo, f])
)

console.log('═══ PRODUCTOS SIN FOTOGRAFÍA (' + sinFoto.length + ') ═══')
for (const t of sinFoto) console.log('  · ' + t.name + '  [' + t.platform + ']')

console.log('\n═══ FOTOGRAFÍAS SIN USAR (' + sinUsar.length + ') ═══')
for (const f of sinUsar) {
  const l = leidas.get(f)
  const motivo = DESCARTADAS[f] ? ' → descartada: ' + DESCARTADAS[f] : ' → SIN MOTIVO REGISTRADO'
  console.log('  · ' + f.padEnd(28) + '"' + (l?.titulo ?? '?') + '" [' + (l?.plataforma ?? '?') + ']' + motivo)
}

console.log(
  '\nresumen: ' +
    (titulos.length - sinFoto.length) +
    '/' +
    titulos.length +
    ' títulos con foto · ' +
    (archivos.length - sinUsar.length) +
    '/' +
    archivos.length +
    ' fotos usadas'
)
