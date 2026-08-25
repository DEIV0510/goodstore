import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import sharp from './sharp.mjs'
import fs from 'node:fs'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// crop-fotos.mjs — Recorta la caja del juego en cada fotografía individual.
//
// Las fotos del negocio muestran el estuche sobre una estantería: alrededor se
// ven otros lomos, la mesa o la pared, casi siempre DESENFOCADOS. La caja, en
// cambio, está enfocada. Ese contraste de nitidez es lo que se usa para
// encontrarla, en vez de fiarse del color (que cambia con cada plataforma).
//
// Uso:  node tools/crop-fotos.mjs [--muestra archivo1,archivo2]
// ─────────────────────────────────────────────────────────────────────────────

const SRC = '../_source/fotos'
const OUT = 'crops-fotos'

/** Proporción real del estuche por plataforma (ancho / alto). */
export const RATIO = { ps5: 0.788, ps4: 0.794, switch: 0.617, switch2: 0.617, xbox: 0.79 }

/**
 * Devuelve la caja del estuche dentro de la fotografía.
 * Trabaja sobre una miniatura para ir rápido y escala el resultado.
 */
export async function detectarCaja(file) {
  const A = 220 // ancho de trabajo
  const { data, info } = await sharp(file)
    .resize({ width: A })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height

  // Medida de enfoque: laplaciano absoluto, suavizado en una rejilla
  const foco = new Float32Array(W * H)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      const lap =
        4 * data[i] - data[i - 1] - data[i + 1] - data[i - W] - data[i + W]
      foco[i] = Math.abs(lap)
    }
  }

  // Media por celda de 8×8 para quitar ruido
  const C = 8
  const gw = Math.ceil(W / C)
  const gh = Math.ceil(H / C)
  const celda = new Float32Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let s = 0
      let n = 0
      for (let y = gy * C; y < Math.min(H, gy * C + C); y++) {
        for (let x = gx * C; x < Math.min(W, gx * C + C); x++) {
          s += foco[y * W + x]
          n++
        }
      }
      celda[gy * gw + gx] = s / Math.max(1, n)
    }
  }

  const orden = [...celda].sort((a, b) => a - b)
  const umbral = orden[Math.floor(orden.length * 0.62)]

  // Perfiles: en qué columnas y filas hay nitidez
  const colOK = new Array(gw).fill(0)
  const rowOK = new Array(gh).fill(0)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (celda[gy * gw + gx] > umbral) {
        colOK[gx]++
        rowOK[gy]++
      }
    }
  }

  // El estuche es el tramo central continuo con más nitidez
  const tramo = (perf, total) => {
    const min = total * 0.28
    let mejor = [0, perf.length - 1]
    let ini = -1
    for (let i = 0; i < perf.length; i++) {
      if (perf[i] >= min) {
        if (ini < 0) ini = i
      } else if (ini >= 0) {
        if (i - 1 - ini > mejor[1] - mejor[0]) mejor = [ini, i - 1]
        ini = -1
      }
    }
    if (ini >= 0 && perf.length - 1 - ini > mejor[1] - mejor[0]) mejor = [ini, perf.length - 1]
    return mejor
  }

  const [gx0, gx1] = tramo(colOK, gh)
  const [gy0, gy1] = tramo(rowOK, gw)

  const meta = await sharp(file).metadata()
  const escala = meta.width / W
  return {
    left: Math.max(0, Math.round(gx0 * C * escala)),
    top: Math.max(0, Math.round(gy0 * C * escala)),
    right: Math.min(meta.width, Math.round((gx1 + 1) * C * escala)),
    bottom: Math.min(meta.height, Math.round((gy1 + 1) * C * escala)),
    full: { w: meta.width, h: meta.height },
  }
}

/**
 * Ajusta la caja detectada a la proporción real del estuche, sin salirse de la
 * fotografía. Así todas las portadas quedan con la misma forma.
 */
export function encuadrar(caja, ratio) {
  const { full } = caja
  let w = caja.right - caja.left
  let h = caja.bottom - caja.top
  const cx = caja.left + w / 2
  const cy = caja.top + h / 2

  // Se parte del alto y se calcula el ancho que corresponde
  let nw = h * ratio
  let nh = h
  if (nw > w * 1.35) {
    // La detección se quedó corta de ancho: se manda el ancho
    nw = w
    nh = w / ratio
  }
  nw = Math.min(nw, full.w)
  nh = Math.min(nh, full.h)

  let left = Math.round(cx - nw / 2)
  let top = Math.round(cy - nh / 2)
  left = Math.max(0, Math.min(left, full.w - Math.round(nw)))
  top = Math.max(0, Math.min(top, full.h - Math.round(nh)))
  return { left, top, width: Math.round(nw), height: Math.round(nh) }
}

/** Recorta y exporta una fotografía. */
export async function recortar(archivo, plataforma, destino) {
  const src = path.join(SRC, archivo)
  const caja = await detectarCaja(src)
  const region = encuadrar(caja, RATIO[plataforma] ?? 0.75)
  await sharp(src)
    .extract(region)
    .resize({ width: 420, kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6, m1: 0.4, m2: 1.2 })
    .webp({ quality: 80, effort: 6 })
    .toFile(destino)
  return region
}

// ── Modo muestra: genera una hoja de contacto para revisar el recorte ────────
if (process.argv[1] && process.argv[1].endsWith('crop-fotos.mjs')) {
  fs.mkdirSync(OUT, { recursive: true })
  const arg = process.argv.indexOf('--muestra')
  const archivos =
    arg > -1
      ? process.argv[arg + 1].split(',')
      : fs.readdirSync(SRC).filter((f) => f.endsWith('.webp')).slice(0, 12)

  const CW = 220
  const CH = 290
  const COLS = 6
  const comps = []
  for (let i = 0; i < archivos.length; i++) {
    const f = archivos[i]
    const plat = /2$/.test(f.replace('.webp', '')) ? 'switch2' : /switch|swtich|stich/i.test(f) ? 'switch' : 'ps5'
    const caja = await detectarCaja(path.join(SRC, f))
    const region = encuadrar(caja, RATIO[plat])
    const buf = await sharp(path.join(SRC, f))
      .extract(region)
      .resize({ width: CW, height: CH, fit: 'contain', background: { r: 20, g: 22, b: 34 } })
      .png()
      .toBuffer()
    comps.push({ input: buf, left: 8 + (i % COLS) * (CW + 8), top: 8 + Math.floor(i / COLS) * (CH + 30) })
  }
  const filas = Math.ceil(archivos.length / COLS)
  const Wt = COLS * (CW + 8) + 8
  const Ht = filas * (CH + 30) + 8
  const lab =
    `<svg width="${Wt}" height="${Ht}" xmlns="http://www.w3.org/2000/svg">` +
    archivos
      .map(
        (f, i) =>
          `<text x="${8 + (i % COLS) * (CW + 8)}" y="${8 + Math.floor(i / COLS) * (CH + 30) + CH + 18}" font-size="13" font-family="monospace" fill="#FFF000">${f.replace('.webp', '').slice(0, 26)}</text>`
      )
      .join('') +
    '</svg>'
  await sharp({ create: { width: Wt, height: Ht, channels: 3, background: { r: 12, g: 14, b: 24 } } })
    .composite([...comps, { input: Buffer.from(lab), top: 0, left: 0 }])
    .png()
    .toFile('_muestra-recorte.webp')
  console.log('✔ tools/_muestra-recorte.png con', archivos.length, 'recortes')
}
