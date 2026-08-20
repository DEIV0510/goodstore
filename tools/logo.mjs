import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
// Permite ejecutar el script desde cualquier carpeta (p. ej. )
process.chdir(dirname(fileURLToPath(import.meta.url)))
import sharp from './sharp.mjs'
import fs from 'node:fs'

// Monograma GG: dos "G" geométricas trazadas con arcos.
const G = (cx, cy, r, color, w) => {
  const sx = (cx + r * Math.cos(-0.62)).toFixed(2)
  const sy = (cy + r * Math.sin(-0.62)).toFixed(2)
  return `<path d="M ${sx} ${sy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} L ${(cx + r * 0.05).toFixed(2)} ${cy}"
    fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
}

const mark = (size = 96) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#161EB4"/><stop offset="0.5" stop-color="#070A78"/><stop offset="1" stop-color="#050745"/>
    </linearGradient>
  </defs>
  <rect x="1.75" y="1.75" width="92.5" height="92.5" rx="25" fill="url(#bg)" stroke="#FFF000" stroke-width="3.5"/>
  <g transform="translate(0,-2)">
    ${G(31, 45, 13.5, '#FFFFFF', 7)}
    ${G(63, 45, 13.5, '#050745', 12)}
    ${G(63, 45, 13.5, '#FFF000', 7)}
  </g>
  <rect x="34" y="74" width="28" height="4.5" rx="2.25" fill="#FF1717"/>
</svg>`

fs.writeFileSync('../public/favicon.svg', mark().trim() + '\n')
await sharp(Buffer.from(mark(180))).png().toFile('../public/apple-touch-icon.png')
await sharp(Buffer.from(mark(512))).png().toFile('logo-preview.png')
console.log('logo ok')
