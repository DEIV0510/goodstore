import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import fs from 'node:fs'
import { buildInventory, norm } from './inventory.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// match-fotos.mjs — Propone qué producto le corresponde a cada fotografía nueva.
//
// Los archivos vienen con nombres abreviados e informales ("howardslegacy",
// "grimsondeset", "thekingoftgthers"), así que esta propuesta SIEMPRE se revisa
// mirando las imágenes antes de aceptarla.
// ─────────────────────────────────────────────────────────────────────────────

const DIR = '../_source/fotos'

/** Pistas de plataforma dentro del nombre del archivo (con sus erratas). */
const PISTA_PLATAFORMA = [
  [/(switch|swtich|swithc|stich|swticjh|seitch|swirch|stwitch|swtitch|swithc)2/i, 'switch2'],
  [/switch|swtich|swithc|stich|swticjh|seitch|swirch|stwitch|swtitch/i, 'switch'],
  [/ps5/i, 'ps5'],
  [/ps4/i, 'ps4'],
]

export function plataformaDeArchivo(f) {
  for (const [re, plat] of PISTA_PLATAFORMA) if (re.test(f)) return plat
  return null
}

/** Quita la pista de plataforma y la extensión para quedarse con el título. */
export function tituloDeArchivo(f) {
  return f
    .replace(/.webp$/i, '')
    .replace(/(switch|swtich|swithc|stich|swticjh|seitch|swirch|stwitch|swtitch)2?/gi, ' ')
    .replace(/ps[45]/gi, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
}

/** Similitud por trigramas: tolera abreviaturas y erratas. */
function trigramas(s) {
  const t = ' ' + norm(s).replace(/\s+/g, ' ') + ' '
  const out = new Set()
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3))
  return out
}

export function similitud(a, b) {
  const A = trigramas(a)
  const B = trigramas(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  return (2 * inter) / (A.size + B.size)
}

export function proponer() {
  const inventario = buildInventory()
  // Un título puede tener varias filas (nuevo/usado): la foto sirve a todas.
  const titulos = [...new Map(inventario.map((p) => [norm(p.name) + '|' + p.platform, p])).values()]

  const archivos = fs.readdirSync(DIR).filter((f) => /.webp$/i.test(f))
  const propuestas = archivos.map((f) => {
    const plat = plataformaDeArchivo(f)
    const titulo = tituloDeArchivo(f)
    const candidatos = titulos
      .filter((t) => !plat || t.platform === plat)
      .map((t) => ({ t, s: similitud(titulo, t.name) }))
      .sort((a, b) => b.s - a.s)
    // Si la pista de plataforma no da nada bueno, se prueba sin filtrar
    const libres = titulos
      .map((t) => ({ t, s: similitud(titulo, t.name) * (plat && t.platform !== plat ? 0.8 : 1) }))
      .sort((a, b) => b.s - a.s)
    const mejor = candidatos[0] && candidatos[0].s >= libres[0].s * 0.9 ? candidatos[0] : libres[0]
    return {
      archivo: f,
      pista: plat,
      titulo,
      propuesta: mejor?.t ?? null,
      score: +(mejor?.s ?? 0).toFixed(2),
      alternativas: libres.slice(0, 4).map((x) => `${x.t.name} [${x.t.platform}] ${x.s.toFixed(2)}`),
    }
  })
  return { propuestas, titulos }
}

if (process.argv[1] && process.argv[1].endsWith('match-fotos.mjs')) {
  const { propuestas, titulos } = proponer()
  const fuerte = propuestas.filter((p) => p.score >= 0.62)
  const debil = propuestas.filter((p) => p.score < 0.62)
  console.log(`fotografías: ${propuestas.length} · títulos en inventario: ${titulos.length}`)
  console.log(`propuestas firmes (≥0.62): ${fuerte.length} · dudosas: ${debil.length}`)
  console.log('\n── DUDOSAS ──')
  for (const p of debil) {
    console.log(`  ${p.archivo.padEnd(30)} "${p.titulo}" → ${p.propuesta?.name ?? '—'} (${p.score})`)
    console.log(`      alt: ${p.alternativas.join(' · ')}`)
  }
  fs.writeFileSync('_propuesta-fotos.json', JSON.stringify(propuestas, null, 1))
}
