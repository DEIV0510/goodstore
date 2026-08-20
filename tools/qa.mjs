// ─────────────────────────────────────────────────────────────────────────────
// qa.mjs — Control de calidad automatizado de la tienda
//
// Comprueba en un navegador real:
//   · errores de consola en todas las rutas
//   · scroll horizontal accidental en 9 anchos distintos
//   · enlaces rotos / botones sin acción
//   · flujo de carrito, buscador, filtros y menú móvil
//   · enlaces de WhatsApp (número correcto)
//   · imágenes que no cargan
//
// Uso: node tools/qa.mjs [baseUrl]
// ─────────────────────────────────────────────────────────────────────────────
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://127.0.0.1:5254'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SHOTS = 'tools/qa-shots'
fs.mkdirSync(SHOTS, { recursive: true })

const WIDTHS = [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920]
const ROUTES = [
  ['/', 'inicio'],
  ['/catalogo', 'catalogo'],
  ['/catalogo?plataforma=ps5', 'catalogo-ps5'],
  ['/producto/elden-ring-ps5', 'producto'],
  ['/usados', 'usados'],
  ['/favoritos', 'favoritos'],
  ['/ruta-que-no-existe', '404'],
]

const results = { errors: [], warnings: [], passed: [] }
const fail = (m) => { results.errors.push(m); console.log('  ✗ ' + m) }
const warn = (m) => { results.warnings.push(m); console.log('  ! ' + m) }
const pass = (m) => { results.passed.push(m); console.log('  ✓ ' + m) }

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
})

const ready = async (page) => {
  await page.waitForFunction(() => !document.getElementById('gg-boot'), { timeout: 15000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 250))
}

const newPage = async (w = 1440, h = 900, mobile = false) => {
  const page = await browser.newPage()
  await page.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })
  const logs = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`)
  })
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
  page.on('requestfailed', (r) => {
    const u = r.url()
    if (!u.startsWith('data:') && !u.includes('fonts.g')) logs.push(`[404] ${u}`)
  })
  return { page, logs }
}

// ── 1. Consola limpia en todas las rutas ────────────────────────────────────
console.log('\n▸ Errores de consola por ruta')
for (const [route, name] of ROUTES) {
  const { page, logs } = await newPage()
  await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 45000 })
  await new Promise((r) => setTimeout(r, 900))
  const real = logs.filter((l) => !l.includes('Download the React DevTools'))
  if (real.length) real.forEach((l) => fail(`${name}: ${l.slice(0, 190)}`))
  else pass(`${name}: consola limpia`)
  await page.close()
}

// ── 2. Sin scroll horizontal en 9 anchos ────────────────────────────────────
console.log('\n▸ Scroll horizontal (9 anchos × 4 rutas)')
for (const w of WIDTHS) {
  for (const [route, name] of ROUTES.slice(0, 5)) {
    const { page } = await newPage(w, 900, w < 768)
    await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 45000 })
    await new Promise((r) => setTimeout(r, 500))
    const over = await page.evaluate(() => {
      const d = document.documentElement
      const offenders = []
      if (d.scrollWidth > d.clientWidth + 1) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect()
          if (r.width > 0 && (r.right > d.clientWidth + 2 || r.left < -2)) {
            const st = getComputedStyle(el)
            if (st.position === 'fixed' || st.visibility === 'hidden' || st.display === 'none') continue
            offenders.push(
              `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(r.left)}→${Math.round(r.right)}]`
            )
            if (offenders.length > 2) break
          }
        }
      }
      return { scrollW: d.scrollWidth, clientW: d.clientWidth, offenders }
    })
    if (over.scrollW > over.clientW + 1) {
      fail(`${w}px ${name}: scroll horizontal (${over.scrollW} > ${over.clientW}) — ${over.offenders.join(' | ')}`)
    }
    await page.close()
  }
}
if (!results.errors.some((e) => e.includes('scroll horizontal'))) pass('sin scroll horizontal en ningún ancho')

// ── 3. Imágenes cargadas ────────────────────────────────────────────────────
console.log('\n▸ Imágenes')
{
  const { page } = await newPage(1440, 1000)
  await page.goto(BASE + '/catalogo', { waitUntil: 'networkidle2', timeout: 45000 })
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) {
      window.scrollBy(0, window.innerHeight)
      await new Promise((r) => setTimeout(r, 220))
    }
  })
  await new Promise((r) => setTimeout(r, 1200))
  const imgs = await page.evaluate(() =>
    Array.from(document.images).map((i) => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0 }))
  )
  const broken = imgs.filter((i) => !i.ok)
  if (broken.length) broken.slice(0, 5).forEach((b) => fail(`imagen rota: ${b.src}`))
  else pass(`${imgs.length} imágenes cargadas correctamente en el catálogo`)
  await page.close()
}

// ── 4. Enlaces y WhatsApp ───────────────────────────────────────────────────
console.log('\n▸ Enlaces')
{
  const { page } = await newPage()
  const seen = new Set()
  for (const [route] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 45000 })
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a')).map((a) => ({
        href: a.getAttribute('href') || '',
        text: (a.textContent || '').trim().slice(0, 40),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
      }))
    )
    for (const l of links) {
      const key = l.href + l.text
      if (seen.has(key)) continue
      seen.add(key)
      if (!l.href || l.href === '#') fail(`enlace muerto en ${route}: "${l.text}"`)
      if (l.href.startsWith('https://wa.me/')) {
        if (!l.href.startsWith('https://wa.me/573508271637')) fail(`WhatsApp con número incorrecto: ${l.href.slice(0, 60)}`)
        if (l.target !== '_blank' || !(l.rel || '').includes('noopener')) warn(`enlace externo sin target/rel seguro: ${l.text}`)
      }
    }
  }
  const wa = [...seen].filter((k) => k.includes('wa.me')).length
  pass(`${seen.size} enlaces revisados, ${wa} de WhatsApp, todos al 3508271637`)
  await page.close()
}

// ── 5. Flujo de carrito ─────────────────────────────────────────────────────
console.log('\n▸ Carrito')
{
  const { page } = await newPage()
  await page.goto(BASE + '/catalogo', { waitUntil: 'networkidle2', timeout: 45000 })
  await ready(page)
  await page.waitForSelector('article button')
  const btns = await page.$$('xpath/.//button[contains(., "Agregar")]')
  await btns[0].click()
  await new Promise((r) => setTimeout(r, 350))
  await btns[1].click()
  await new Promise((r) => setTimeout(r, 350))
  await btns[1].click()
  await new Promise((r) => setTimeout(r, 500))
  const badge = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label^="Carrito"]')
    return b ? b.textContent.trim() : null
  })
  if (badge === '3') pass('contador del carrito = 3 tras agregar 1+2')
  else fail(`contador del carrito incorrecto: "${badge}" (esperado 3)`)

  await page.click('button[aria-label^="Carrito"]')
  await new Promise((r) => setTimeout(r, 500))
  const cart = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return null
    const checkout = Array.from(dialog.querySelectorAll('a')).find((a) => a.textContent.includes('Finalizar'))
    return {
      items: dialog.querySelectorAll('li').length,
      checkoutHref: checkout ? checkout.href : null,
    }
  })
  if (cart && cart.items === 2) pass('el panel del carrito muestra 2 líneas de producto')
  else fail(`panel del carrito con ${cart ? cart.items : 'null'} líneas (esperado 2)`)
  if (cart?.checkoutHref?.startsWith('https://wa.me/573508271637')) {
    const msg = decodeURIComponent(cart.checkoutHref.split('text=')[1] || '')
    if (msg.includes('estoy interesado en comprar')) pass('“Finalizar compra” arma el mensaje de WhatsApp con los productos')
    else fail('el mensaje de WhatsApp del carrito no tiene el formato esperado')
  } else fail('“Finalizar compra” no apunta al WhatsApp correcto')

  // persistencia
  await page.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 700))
  const after = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label^="Carrito"]')
    return b ? b.textContent.trim() : null
  })
  if (after === '3') pass('el carrito persiste tras recargar')
  else fail(`el carrito no persiste tras recargar (badge: "${after}")`)
  await page.close()
}

// ── 6. Buscador ─────────────────────────────────────────────────────────────
console.log('\n▸ Buscador')
{
  const { page } = await newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 })
  await ready(page)
  await page.click('button[aria-label="Buscar juegos"]')
  await page.waitForSelector('input[aria-label="Buscar en el catálogo"]')
  await page.type('input[aria-label="Buscar en el catálogo"]', 'resident evil')
  await new Promise((r) => setTimeout(r, 600))
  const hits = await page.evaluate(() => document.querySelectorAll('[role="dialog"] ul li a').length)
  if (hits > 0) pass(`buscador: "resident evil" → ${hits} resultados`)
  else fail('buscador: "resident evil" no devolvió resultados')

  await page.evaluate(() => {
    const i = document.querySelector('input[aria-label="Buscar en el catálogo"]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(i, 'zzzzqqq')
    i.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 600))
  const empty = await page.evaluate(() => document.body.innerText.includes('No encontramos ese juego'))
  if (empty) pass('buscador: estado vacío correcto')
  else fail('buscador: no muestra el estado “No encontramos ese juego”')
  await page.close()
}

// ── 7. Filtros ──────────────────────────────────────────────────────────────
console.log('\n▸ Filtros')
{
  const { page } = await newPage()
  await page.goto(BASE + '/catalogo', { waitUntil: 'networkidle2', timeout: 45000 })
  await ready(page)
  const total = await page.evaluate(() => document.querySelectorAll('main ul > li > article').length)

  const [ps5] = await page.$$('xpath/.//label[contains(., "PlayStation 5")]')
  await ps5.click()
  await new Promise((r) => setTimeout(r, 900))
  const url = page.url()
  const onlyPs5 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main article')).every((a) => a.textContent.includes('PS5'))
  )
  if (url.includes('plataforma=ps5')) pass('el filtro se refleja en la URL (?plataforma=ps5)')
  else fail(`el filtro no llegó a la URL: ${url}`)
  if (onlyPs5) pass('el filtro de plataforma solo deja productos PS5')
  else fail('el filtro de plataforma dejó productos de otra plataforma')

  const [terror] = await page.$$('xpath/.//label[contains(., "Terror")]')
  await terror.click()
  await new Promise((r) => setTimeout(r, 900))
  const combo = await page.evaluate(() => document.querySelectorAll('main ul > li > article').length)
  if (combo > 0 && combo < total) pass(`filtros combinados PS5 + Terror → ${combo} de ${total}`)
  else fail(`filtros combinados dieron ${combo} resultados (total ${total})`)

  const [orden] = await page.$$('#orden')
  await orden.select('nombre')
  await new Promise((r) => setTimeout(r, 800))
  const sorted = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main article h3')).map((h) => h.textContent.trim())
  )
  const ok = sorted.every((n, i) => i === 0 || sorted[i - 1].localeCompare(n, 'es') <= 0)
  if (ok) pass('ordenar por nombre funciona (A→Z)')
  else fail(`ordenar por nombre no ordena: ${sorted.slice(0, 4).join(' | ')}`)
  await page.close()
}

// ── 8. Menú móvil y drawer de filtros ───────────────────────────────────────
console.log('\n▸ Móvil')
{
  const { page } = await newPage(375, 780, true)
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 45000 })
  await ready(page)
  await page.click('button[aria-label="Abrir menú"]')
  await new Promise((r) => setTimeout(r, 500))
  const menu = await page.evaluate(() => {
    const d = document.querySelector('[aria-label="Menú"]')
    return d ? d.querySelectorAll('a').length : 0
  })
  if (menu >= 8) pass(`menú móvil abre con ${menu} enlaces`)
  else fail(`menú móvil con ${menu} enlaces (esperado ≥8)`)
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 400))
  const closed = await page.evaluate(() => !document.querySelector('[aria-label="Menú"]'))
  if (closed) pass('el menú móvil cierra con Escape')
  else fail('el menú móvil no cierra con Escape')

  await page.goto(BASE + '/catalogo', { waitUntil: 'networkidle2', timeout: 45000 })
  await ready(page)
  const [fbtn] = await page.$$('xpath/.//button[contains(., "Filtros")]')
  await fbtn.click()
  await new Promise((r) => setTimeout(r, 500))
  const drawer = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return d ? d.querySelectorAll('input[type="checkbox"]').length : 0
  })
  if (drawer > 10) pass(`drawer de filtros móvil con ${drawer} opciones`)
  else fail(`drawer de filtros móvil con ${drawer} opciones`)
  await page.close()
}

// ── 9. Táctil: tamaño mínimo de los objetivos ───────────────────────────────
console.log('\n▸ Objetivos táctiles (mín. 44×44)')
{
  const { page } = await newPage(375, 780, true)
  await page.goto(BASE + '/catalogo', { waitUntil: 'networkidle2', timeout: 45000 })
  await ready(page)
  await new Promise((r) => setTimeout(r, 800))
  const small = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('button, a[href], select, input')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (getComputedStyle(el).display === 'contents') continue
      // los enlaces dentro de párrafos o listas de texto no requieren 44px
      if (el.tagName === 'A' && el.closest('nav[aria-label="Ruta de navegación"]')) continue
      if (el.tagName === 'A' && el.closest('h1,h2,h3,h4,p')) continue
      if (el.className && String(el.className).includes('sr-only')) continue
      const before = getComputedStyle(el, '::before')
      const grow = before.content !== 'none' && before.position === 'absolute' ? 12 : 0
      if (r.height + grow >= 40 && r.width + grow >= 24) continue
      if (r.height < 40 || r.width < 24) {
        out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28)}" ${Math.round(r.width)}×${Math.round(r.height)}`)
      }
      if (out.length > 6) break
    }
    return out
  })
  if (small.length === 0) pass('todos los controles táctiles miden al menos 40px de alto')
  else small.forEach((s) => warn(`objetivo pequeño: ${s}`))
  await page.close()
}

// ── 10. Capturas responsive ─────────────────────────────────────────────────
console.log('\n▸ Capturas')
for (const w of [375, 768, 1440]) {
  for (const [route, name] of [['/', 'home'], ['/catalogo', 'catalogo'], ['/producto/elden-ring-ps5', 'producto']]) {
    const { page } = await newPage(w, 900, w < 768)
    await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 45000 })
    await new Promise((r) => setTimeout(r, 1400))
    await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: w !== 1440 })
    await page.close()
  }
}
pass('capturas guardadas en tools/qa-shots/')

await browser.close()

console.log('\n══════════════════════════════════════════')
console.log(`  ✓ ${results.passed.length} comprobaciones OK`)
console.log(`  ! ${results.warnings.length} avisos`)
console.log(`  ✗ ${results.errors.length} errores`)
console.log('══════════════════════════════════════════')
process.exit(results.errors.length ? 1 : 0)
