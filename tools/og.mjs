// Genera public/og-image.png (1200×630) para compartir en redes y WhatsApp.
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
// Permite ejecutar el script desde cualquier carpeta (p. ej. )
process.chdir(dirname(fileURLToPath(import.meta.url)))
import sharp from './sharp.mjs'

const W = 1200
const H = 630

const COVERS = [
  { file: '../public/games/the-legend-of-zelda-breath-of-the-wild-switch.webp', x: 690, y: 246, rot: -12 },
  { file: '../public/games/god-of-war-ragnarok-ps5.webp', x: 1062, y: 240, rot: 10 },
  { file: '../public/games/ghost-of-tsushima-ps4.webp', x: 814, y: 218, rot: -5 },
  { file: '../public/games/elden-ring-ps5.webp', x: 938, y: 212, rot: 3 },
]

const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#151DAE"/><stop offset="0.42" stop-color="#0C1287"/>
      <stop offset="0.75" stop-color="#080C60"/><stop offset="1" stop-color="#070C42"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.42" r="0.55">
      <stop offset="0" stop-color="#FFF000" stop-opacity="0.13"/><stop offset="1" stop-color="#FFF000" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="46" height="46" patternUnits="userSpaceOnUse">
      <path d="M46 0H0V46" fill="none" stroke="#FFFFFF" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
    <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#161EB4"/><stop offset="0.5" stop-color="#070A78"/><stop offset="1" stop-color="#050745"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</svg>`

const fg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <text x="78" y="286" font-family="Archivo, Segoe UI, sans-serif" font-size="66" font-weight="900" letter-spacing="-2.4" fill="#FFFFFF">Tu próximo juego</text>
  <text x="78" y="360" font-family="Archivo, Segoe UI, sans-serif" font-size="66" font-weight="900" letter-spacing="-2.4" fill="#FFF000">empieza aquí.</text>

  <text x="78" y="428" font-family="Inter, Segoe UI, sans-serif" font-size="25" font-weight="500" fill="#FFFFFF" opacity="0.76">Videojuegos · Consolas · Accesorios</text>

  <g transform="translate(78,478)">
    <rect x="0" y="0" width="336" height="46" rx="23" fill="#FFF000"/>
    <text x="168" y="30" text-anchor="middle" font-family="Archivo, Segoe UI, sans-serif" font-size="19" font-weight="800" fill="#070C42">PS5 · PS4 · NINTENDO SWITCH</text>
  </g>

  <text x="78" y="574" font-family="Inter, Segoe UI, sans-serif" font-size="21" font-weight="600" fill="#FFFFFF" opacity="0.62">WhatsApp 350 827 1637  ·  Envíos a Medellín y toda Colombia</text>
</svg>`

const base = await sharp(Buffer.from(bg)).png().toBuffer()

const LOGO_H = 92
const logo = await sharp('../public/brand/logo-color.png')
  .resize({ height: LOGO_H })
  .png()
  .toBuffer()

const layers = [{ input: logo, left: 78, top: 62 }]
for (const c of COVERS) {
  const img = await sharp(c.file)
    .resize({ width: 178 })
    .rotate(c.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const meta = await sharp(img).metadata()
  layers.push({
    input: img,
    left: Math.round(c.x - meta.width / 2),
    top: Math.round(c.y - meta.height / 2 + 90),
  })
}

await sharp(base)
  .composite([...layers, { input: Buffer.from(fg), top: 0, left: 0 }])
  .png()
  .toFile('../public/og-image.png')

console.log('✔ public/og-image.png (1200×630)')
