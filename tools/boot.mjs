import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import fs from 'node:fs'

// ─────────────────────────────────────────────────────────────────────────────
// boot.mjs — Inyecta la pantalla de carga en index.html.
//
// El logotipo va incrustado en base64 (≈13 KB) para que aparezca en el primer
// fotograma, sin esperar ninguna petición de red. Se regenera con:
//   node tools/boot.mjs
// ─────────────────────────────────────────────────────────────────────────────

const logo = 'data:image/png;base64,' + fs.readFileSync('../public/brand/logo-color.png').toString('base64')

const STYLE = `    <style>
      /* ── Pantalla de carga ──────────────────────────────────────────────
         Vive fuera de React para pintarse en el primer fotograma.
         El logotipo va incrustado en base64: cero peticiones de red.       */
      html { background: #070C42; }

      #gg-boot {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 34px;
        background: radial-gradient(125% 95% at 50% 32%, #161EB4 0%, #0A0F8C 34%, #070A78 58%, #080E4C 82%, #070C42 100%);
        font-family: Archivo, 'Segoe UI', system-ui, sans-serif;
        transition: opacity .55s ease, visibility .55s ease;
      }
      #gg-boot[data-hide='true'] { opacity: 0; visibility: hidden; pointer-events: none; }

      /* Malla técnica */
      #gg-boot::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
        background-size: 44px 44px;
        mask-image: radial-gradient(72% 58% at 50% 45%, #000 18%, transparent 80%);
        -webkit-mask-image: radial-gradient(72% 58% at 50% 45%, #000 18%, transparent 80%);
      }

      /* Barrido tipo CRT */
      #gg-boot::after {
        content: '';
        position: absolute;
        left: 0; right: 0;
        height: 150px;
        background: linear-gradient(180deg, transparent, rgba(255,240,0,.075), transparent);
        animation: gg-scan 2.6s linear infinite;
      }
      @keyframes gg-scan { 0% { top: -18%; } 100% { top: 108%; } }

      /* Logotipo oficial */
      .gg-boot__logo {
        position: relative;
        width: min(340px, 74vw);
        height: auto;
        animation: gg-pop .7s cubic-bezier(.16,1,.3,1) both;
        filter: drop-shadow(0 14px 34px rgba(0,0,0,.5));
      }
      @keyframes gg-pop {
        from { opacity: 0; transform: translateY(16px) scale(.93); }
        to   { opacity: 1; transform: none; }
      }

      /* Barra de carga por bloques, como en las consolas retro */
      .gg-boot__bar {
        position: relative;
        width: min(264px, 66vw);
        height: 14px;
        overflow: hidden;
        background: repeating-linear-gradient(90deg,
          rgba(255,255,255,.13) 0 18px, transparent 18px 22px);
        animation: gg-fade .5s .15s both;
      }
      .gg-boot__bar i {
        position: absolute;
        inset: 0 auto 0 0;
        display: block;
        width: 0;
        background: repeating-linear-gradient(90deg,
          #FFF000 0 18px, transparent 18px 22px);
        animation: gg-fill 1.15s steps(12) forwards;
      }
      @keyframes gg-fill { to { width: 100%; } }
      @keyframes gg-fade { from { opacity: 0 } to { opacity: 1 } }

      .gg-boot__hint {
        position: relative;
        margin-top: -18px;
        font-size: .66rem;
        font-weight: 700;
        letter-spacing: .46em;
        text-indent: .46em;
        color: rgba(255,255,255,.5);
        animation: gg-blink 1.1s steps(2, start) infinite;
      }
      @keyframes gg-blink { 50% { opacity: .3 } }

      @media (prefers-reduced-motion: reduce) {
        #gg-boot::after, .gg-boot__logo, .gg-boot__hint { animation: none; }
        .gg-boot__bar i { animation: none; width: 100%; }
      }
    </style>`

const BODY = `    <!-- Pantalla de carga -->
    <div id="gg-boot" role="status" aria-live="polite" aria-label="Cargando GOOD GAME">
      <img class="gg-boot__logo" src="${logo}" alt="GOOD GAME — Game Store" width="720" height="239" />
      <div class="gg-boot__bar"><i></i></div>
      <p class="gg-boot__hint">CARGANDO</p>
    </div>`

// Se normalizan los saltos de línea: git puede haber convertido el archivo a CRLF.
let html = fs.readFileSync('../index.html', 'utf8').split('\r\n').join('\n')

html = html.replace(/ {4}<style>[\s\S]*?<\/style>/, STYLE)

const start = html.indexOf('    <!-- Pantalla de carga -->')
const end = html.indexOf('    <noscript>')
if (start < 0 || end < 0) {
  throw new Error('No se encontró el bloque de la pantalla de carga en index.html')
}
html = html.slice(0, start) + BODY + '\n\n' + html.slice(end)

fs.writeFileSync('../index.html', html)

const kb = Math.round(Buffer.byteLength(html) / 1024)
console.log(`✔ pantalla de carga inyectada en index.html (${kb} KB con el logo incrustado)`)
