import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import sharp from './sharp.mjs'
import fs from 'node:fs'

// ─────────────────────────────────────────────────────────────────────────────
// brand.mjs — Prepara los archivos del logo OFICIAL de GOOD GAME.
//
// Origen: _source/logos/  (entregado por el cliente, PNG con transparencia)
//   marcas de agua-01.png → versión a color (badge rojo, GOOD blanco, GAME amarillo)
//   marcas de agua-02.png → versión blanca (para fondos oscuros)
//   marcas de agua-03.png → versión negra (para fondos claros)
//
// Salidas en public/brand/ : logo recortado a su caja real, en los tamaños que
// usa la web, más el mando aislado para favicon e íconos de app.
// ─────────────────────────────────────────────────────────────────────────────

const SRC = '../_source/logos'
const OUT = '../public/brand'
fs.mkdirSync(OUT, { recursive: true })

const VARIANTS = [
  { file: 'marcas de agua-01.png', name: 'logo-color' },
  { file: 'marcas de agua-02.png', name: 'logo-blanco' },
  { file: 'marcas de agua-03.png', name: 'logo-negro' },
]

const info = {}

for (const v of VARIANTS) {
  const src = `${SRC}/${v.file}`
  // trim() recorta el margen transparente y deja la caja real del logo
  const trimmed = await sharp(src).trim({ threshold: 1 }).png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  info[v.name] = { w: meta.width, h: meta.height, ratio: +(meta.width / meta.height).toFixed(3) }

  // Ancho máximo de uso en la web ≈ 230 px → se exporta a 3x para pantallas retina
  await sharp(trimmed).resize({ width: 720 }).png({ compressionLevel: 9 }).toFile(`${OUT}/${v.name}.png`)
  await sharp(trimmed).resize({ width: 720 }).webp({ quality: 92 }).toFile(`${OUT}/${v.name}.webp`)

  console.log(`✔ ${v.name}  ${meta.width}×${meta.height} (ratio ${info[v.name].ratio})`)
}

// ── Mando aislado: la parte cuadrada del logo, sirve de ícono ──────────────
// Medido sobre el logo recortado (720×239): el mando ocupa
// x ∈ [5.5 %, 39.5 %] e y ∈ [16 %, 80 %]; el resto es borde y tipografía.
const iconFrom = async (file, out, pad) => {
  const trimmed = await sharp(`${SRC}/${file}`).trim({ threshold: 1 }).png().toBuffer()
  const m = await sharp(trimmed).metadata()
  const icon = await sharp(trimmed)
    .extract({
      left: Math.round(m.width * 0.055),
      top: Math.round(m.height * 0.16),
      width: Math.round(m.width * 0.34),
      height: Math.round(m.height * 0.64),
    })
    .trim({ threshold: 1 })
    .png()
    .toBuffer()
  const im = await sharp(icon).metadata()
  const side = Math.max(im.width, im.height)
  const box = Math.round(side * (1 + pad))
  return sharp({
    create: { width: box, height: box, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: icon, left: Math.round((box - im.width) / 2), top: Math.round((box - im.height) / 2) },
    ])
    .png()
    .toFile(out)
}

await iconFrom('marcas de agua-02.png', `${OUT}/mando-blanco.png`, 0.14)
await iconFrom('marcas de agua-01.png', `${OUT}/mando-color.png`, 0.14)
console.log('✔ mando aislado (ícono)')

// ── Favicon e íconos de aplicación ──────────────────────────────────────────
// Fondo azul de marca + mando blanco centrado.
const appIcon = async (size, out, radius) => {
  const pad = Math.round(size * 0.17)
  const mando = await sharp(`${OUT}/mando-blanco.png`)
    .resize({ width: size - pad * 2, height: size - pad * 2, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#161EB4"/><stop offset="0.55" stop-color="#0A0F8C"/><stop offset="1" stop-color="#070A78"/>
       </linearGradient></defs>
       <rect width="${size}" height="${size}" rx="${radius}" fill="url(#b)"/>
       <rect x="${size * 0.035}" y="${size * 0.035}" width="${size * 0.93}" height="${size * 0.93}" rx="${radius * 0.85}"
             fill="none" stroke="#FF1717" stroke-width="${Math.max(2, size * 0.045)}"/>
     </svg>`
  )
  await sharp(bg).composite([{ input: mando, gravity: 'center' }]).png().toFile(out)
}

await appIcon(512, `${OUT}/icono-512.png`, 108)
await appIcon(180, '../public/apple-touch-icon.png', 38)
await appIcon(64, `${OUT}/icono-64.png`, 14)
console.log('✔ íconos de aplicación')

// ── favicon.svg: SVG con el PNG del mando incrustado (nítido y ligero) ──────
const mandoB64 = fs.readFileSync(`${OUT}/mando-blanco.png`).toString('base64')
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#161EB4"/><stop offset="0.55" stop-color="#0A0F8C"/><stop offset="1" stop-color="#070A78"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="url(#b)"/>
  <rect x="2.2" y="2.2" width="59.6" height="59.6" rx="12" fill="none" stroke="#FF1717" stroke-width="3"/>
  <image href="data:image/png;base64,${mandoB64}" x="11" y="11" width="42" height="42" preserveAspectRatio="xMidYMid meet"/>
</svg>
`
fs.writeFileSync('../public/favicon.svg', favicon)
console.log('✔ favicon.svg')

fs.writeFileSync(`${OUT}/_medidas.json`, JSON.stringify(info, null, 2))
console.log('\nProporciones del logo:', JSON.stringify(info, null, 2))
