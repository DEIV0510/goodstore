// ─────────────────────────────────────────────────────────────────────────────
// Comprueba que la barra de envíos no tapa el contenido, en varios anchos.
//
//   node tools/prueba-barra-envios.mjs [baseUrl]
//
// Necesita la tienda corriendo (npm run dev + npm run api).
//
// La barra va dentro de la cabecera fija y publica su alto en --gg-barra. Si en
// un móvil el texto baja a dos líneas y el contenido no se aparta lo mismo, una
// franja de la página queda debajo de la cabecera sin ningún error en consola.
// Eso solo se ve midiendo, y medirlo a mano en un navegador de escritorio no
// sirve: las pestañas en segundo plano no recalculan estilos y dan números
// falsos. Aquí se mide en un Chrome sin ventana, que siempre está «al frente».
//
// Este archivo vive en tools/ y no se publica nunca.
// ─────────────────────────────────────────────────────────────────────────────
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:5254'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SALIDA = 'tools/qa-shots'
fs.mkdirSync(SALIDA, { recursive: true })

const ANCHOS = [320, 360, 375, 414, 640, 768, 1024, 1440]
const RUTAS = ['/', '/catalogo']

const navegador = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
})

let fallos = 0
try {
  const pagina = await navegador.newPage()

  for (const ruta of RUTAS) {
    for (const ancho of ANCHOS) {
      await pagina.setViewport({ width: ancho, height: 800 })
      await pagina.goto(BASE + ruta, { waitUntil: 'networkidle2', timeout: 60000 })
      await pagina.waitForFunction(
        () => [...document.querySelectorAll('header p')].some((p) => p.textContent.includes('$')),
        { timeout: 20000 }
      )
      // Dos fotogramas: el ResizeObserver publica el alto y el estilo se
      // recalcula en el siguiente pintado, no en el mismo instante.
      await pagina.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      )
      await new Promise((r) => setTimeout(r, 400))

      const m = await pagina.evaluate(() => {
        const header = document.querySelector('header')
        const main = document.getElementById('contenido')
        const barra = [...header.querySelectorAll('p')].find((p) => p.textContent.includes('$'))
        const primero = main.firstElementChild
        const caja = (el) => el.getBoundingClientRect()
        return {
          texto: barra.innerText.replace(/\s+/g, ' ').trim(),
          altoBarra: Math.round(caja(barra.parentElement).height),
          finCabecera: Math.round(caja(header).bottom),
          inicio: Math.round(caja(primero).top),
          scrollHorizontal: document.documentElement.scrollWidth > window.innerWidth,
        }
      })

      // 1 px es el borde inferior de la cabecera, que ya se montaba sobre el
      // contenido antes de la barra.
      const tapa = m.finCabecera - m.inicio
      const bien = tapa <= 1 && !m.scrollHorizontal
      if (!bien) fallos++
      console.log(
        `${bien ? 'OK   ' : 'FALLA'}  ${ruta.padEnd(9)} ${String(ancho).padStart(4)} px  ` +
          `barra ${String(m.altoBarra).padStart(2)} px · tapa ${tapa} px` +
          `${m.scrollHorizontal ? ' · SCROLL HORIZONTAL' : ''}  «${m.texto}»`
      )

      if (ruta === '/' && [320, 375, 1440].includes(ancho)) {
        await pagina.screenshot({
          path: `${SALIDA}/barra-envios-${ancho}.png`,
          clip: { x: 0, y: 0, width: ancho, height: 170 },
        })
      }
    }
  }
} finally {
  await navegador.close()
}

console.log(
  fallos === 0
    ? '\nLa barra de envíos no tapa el contenido en ningún ancho.'
    : `\n${fallos} caso(s) con contenido tapado o scroll horizontal. NO publiques así.`
)
process.exit(fallos === 0 ? 0 : 1)
