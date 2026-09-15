// ─────────────────────────────────────────────────────────────────────────────
// Comprueba que las fichas de juego abren entrando DIRECTAMENTE por su dirección.
//
//   node tools/prueba-enlace-directo.mjs [baseUrl]
//
// Existe por un fallo real que estuvo en producción: la ficha mandaba a 404 si
// el catálogo aún no había llegado, y en una visita directa —un enlace de
// WhatsApp, un resultado de Google, cualquiera de las 318 fichas del sitemap—
// el catálogo todavía no ha llegado nunca. Navegando desde el catálogo iba
// bien, así que probando a mano no se veía: solo fallaba al entrar desde fuera.
//
// Abre cada ficha en una página nueva (sin nada cargado antes) y exige que
// aparezca el botón de compra. Y comprueba lo contrario: que un juego que no
// existe siga acabando en 404.
//
// Solo lectura: corta cualquier petición que no sea GET, para no sumar visitas
// al contador de productos más vistos.
//
// Este archivo vive en tools/ y no se publica nunca.
// ─────────────────────────────────────────────────────────────────────────────
import puppeteer from 'puppeteer-core'

const BASE = (process.argv[2] || 'http://localhost:5254').replace(/\/$/, '')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ESPERA = 25000

const publico = await (await fetch(BASE + '/api/publico')).json()
const conPrecio = publico.productos.filter((p) => p.price !== null)
const muestra = [conPrecio[0], conPrecio[Math.floor(conPrecio.length / 2)], conPrecio.at(-1)]
  .filter(Boolean)
  .map((p) => p.slug)

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })

let fallos = 0
const comprobar = (bien, texto) => {
  console.log(`${bien ? 'OK   ' : 'FALLA'}  ${texto}`)
  if (!bien) fallos++
}

/** Abre una dirección en limpio y espera a que la ficha o el 404 se decidan. */
async function abrir(ruta) {
  const pagina = await navegador.newPage()
  await pagina.setViewport({ width: 1280, height: 900 })
  await pagina.setRequestInterception(true)
  pagina.on('request', (r) => (r.method() === 'GET' ? r.continue() : r.abort()))
  try {
    await pagina.goto(BASE + ruta, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await pagina
      .waitForFunction(
        () =>
          location.pathname === '/404' ||
          [...document.querySelectorAll('button')].some((b) => /Agregar al carrito|Agotado/.test(b.textContent)),
        { timeout: ESPERA }
      )
      .catch(() => {})
    // Un segundo más: si la ficha fuera a saltar a 404 después de pintarse,
    // aquí se vería.
    await new Promise((r) => setTimeout(r, 1500))
    return await pagina.evaluate(() => ({
      ruta: location.pathname,
      titulo: document.title,
      compra: [...document.querySelectorAll('button')].some((b) => /Agregar al carrito/.test(b.textContent)),
    }))
  } finally {
    await pagina.close()
  }
}

try {
  for (const slug of muestra) {
    const r = await abrir(`/producto/${slug}`)
    comprobar(
      r.ruta === `/producto/${slug}` && r.compra,
      `entrando directo a /producto/${slug} se ve la ficha (${r.ruta} · «${r.titulo}»)`
    )
  }

  const r404 = await abrir('/producto/este-juego-no-existe-en-la-tienda')
  comprobar(r404.ruta === '/404', `un juego que no existe sigue acabando en 404 (${r404.ruta})`)
} finally {
  await navegador.close()
}

console.log(
  fallos === 0
    ? '\nLas fichas abren desde fuera de la tienda.'
    : `\n${fallos} fallo(s). Un enlace compartido o un resultado de Google llevaría a «Game Over».`
)
process.exit(fallos === 0 ? 0 : 1)
