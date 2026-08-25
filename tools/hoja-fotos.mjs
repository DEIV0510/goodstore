import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import sharp from './sharp.mjs'
import fs from 'node:fs'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// hoja-fotos.mjs — Hojas de contacto para revisar que cada portada publicada
// corresponde al producto al que se asignó. Se mira una por una: una carátula
// equivocada en una tienda es peor que no tener carátula.
//
// Uso: node tools/hoja-fotos.mjs
// ─────────────────────────────────────────────────────────────────────────────

const IMG = '../public/games'
const productos = fs.readFileSync('../src/data/products.ts', 'utf8')

// Primera aparición de cada imagen, con el nombre del producto que la usa
const entradas = []
const vistos = new Set()
const re = /name: '((?:[^'\\]|\\.)*)',[\s\S]*?platform: '([^']+)',[\s\S]*?images: \[([^\]]*)\]/g
let m
while ((m = re.exec(productos))) {
  const img = m[3].replace(/'/g, '').trim()
  if (!img || vistos.has(img)) continue
  vistos.add(img)
  entradas.push({ nombre: m[1].replace(/\\'/g, "'"), plataforma: m[2], img: img.replace('/games/', '') })
}

console.log('imágenes publicadas:', entradas.length)

const CW = 168
const CH = 214
const COLS = 8
const POR_HOJA = 48

for (let h = 0; h * POR_HOJA < entradas.length; h++) {
  const lote = entradas.slice(h * POR_HOJA, (h + 1) * POR_HOJA)
  const filas = Math.ceil(lote.length / COLS)
  const W = COLS * (CW + 6) + 6
  const H = filas * (CH + 34) + 6
  const comps = []
  for (let i = 0; i < lote.length; i++) {
    const buf = await sharp(path.join(IMG, lote[i].img))
      .resize({ width: CW, height: CH, fit: 'contain', background: { r: 18, g: 20, b: 32 } })
      .png()
      .toBuffer()
    comps.push({ input: buf, left: 6 + (i % COLS) * (CW + 6), top: 6 + Math.floor(i / COLS) * (CH + 34) })
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lab =
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    lote
      .map((e, i) => {
        const x = 6 + (i % COLS) * (CW + 6)
        const y = 6 + Math.floor(i / COLS) * (CH + 34) + CH
        const t = esc(e.nombre).slice(0, 30)
        return `<text x="${x}" y="${y + 13}" font-size="11" font-family="monospace" fill="#FFF000">${t}</text><text x="${x}" y="${y + 26}" font-size="10" font-family="monospace" fill="#8B95FF">${e.plataforma}</text>`
      })
      .join('') +
    '</svg>'
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 10, g: 12, b: 20 } } })
    .composite([...comps, { input: Buffer.from(lab), top: 0, left: 0 }])
    .png()
    .toFile(`_hoja-${h + 1}.png`)
  console.log(`✔ tools/_hoja-${h + 1}.png (${lote.length})`)
}
