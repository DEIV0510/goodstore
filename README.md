# GOOD GAME — Game Store

Tienda web de videojuegos, consolas y accesorios para **GOOD GAME** (Itagüí, Antioquia).
Catálogo de **118 videojuegos físicos** para PlayStation 5, PlayStation 4 y Nintendo Switch,
con carrito, filtros, buscador y cierre de compra por WhatsApp.

---

## 1. Cómo ejecutar el proyecto

```bash
npm install
npm run dev
```

Abre <http://localhost:5254>.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (puerto 5254) |
| `npm run build` | Compila a `dist/` listo para publicar |
| `npm run preview` | Sirve `dist/` para revisar el build |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run images` | Regenera `public/games/*.webp`, `src/data/products.ts` y `sitemap.xml` |
| `npm run qa` | Control de calidad automatizado en navegador real (ver §9) |
| `npm run brand` | Regenera logotipos e íconos desde `_source/logos/` |
| `npm run boot` | Reinyecta la pantalla de carga en `index.html` |

---

## 2. Tecnologías

- **React 18** + **TypeScript** (tipado estricto)
- **Vite 5** (build y dev server)
- **Tailwind CSS 3** con tokens de marca propios
- **React Router 6** (URLs amigables y enlaces profundos)
- **Lucide Icons** (SVG, sin emojis como iconos)
- **sharp** (procesamiento de imágenes, solo en desarrollo)
- **puppeteer-core** (QA automatizado, solo en desarrollo)

Sin dependencias de UI pesadas: todo el diseño es propio.

---

## 3. Estructura de carpetas

```
good-game/
├── public/
│   ├── games/             118 portadas WebP (recortadas de las fotos reales)
│   ├── favicon.svg        Monograma GG
│   ├── apple-touch-icon.png
│   ├── og-image.png       Imagen para compartir (1200×630)
│   ├── robots.txt
│   └── sitemap.xml        Generado con `npm run images`
│
├── src/
│   ├── components/
│   │   ├── brand/         Logo y monograma
│   │   ├── layout/        Header, Footer, menú móvil, buscador, botones flotantes
│   │   ├── home/          Secciones de la portada
│   │   ├── catalog/       Tarjeta de producto y panel de filtros
│   │   ├── cart/          Panel del carrito
│   │   └── ui/            Piezas reutilizables (imagen, badges, drawer, toasts…)
│   ├── data/
│   │   ├── products.ts    ★ CATÁLOGO — fuente de verdad, se edita a mano
│   │   ├── site.ts        ★ Datos del negocio (WhatsApp, ubicación, redes)
│   │   ├── categories.ts  Tarjetas de "Explora por categoría"
│   │   ├── faq.ts         Preguntas frecuentes
│   │   └── taxonomy.ts    Plataformas, géneros, estados, rangos de precio
│   ├── lib/
│   │   ├── filters.ts     Motor de filtros, orden y búsqueda
│   │   ├── whatsapp.ts    Armado de los mensajes de WhatsApp
│   │   ├── format.ts      Precios en pesos, normalización de texto
│   │   └── seo.ts         Title, description, canonical, Open Graph y JSON-LD
│   ├── pages/             Home, Catalog, ProductPage, Usados, Favoritos, NotFound
│   ├── store/             Carrito y favoritos (Context + localStorage)
│   ├── styles/index.css   Base, componentes y utilidades
│   └── types.ts           ★ Modelo de datos
│
├── tools/                 Utilidades de desarrollo (no se publican)
│   ├── _source/…          Fotografías originales del negocio
│   ├── catalog.mjs        Mapeo recorte → producto
│   ├── descriptions.mjs   Descripción de cada título
│   ├── build-assets.mjs   Genera imágenes + products.ts + sitemap
│   ├── crop4.mjs          Recorta cada portada de las fotos en cuadrícula
│   ├── og.mjs / logo.mjs  Imagen para compartir y favicon
│   └── qa.mjs             Control de calidad automatizado
│
└── _source/               Copia de las fotos y el brief del cliente
```

---

## 4. De dónde salen las imágenes

El negocio entregó **6 fotografías** con los juegos organizados en cuadrícula
(una de ellas duplicada), el logotipo oficial y un PDF con el brief. No había
fotos individuales de cada juego.

El proceso fue:

1. Se detectó la cuadrícula de cada foto midiendo los bordes de las cajas
   (ajuste de paso uniforme sobre el perfil de bordes verticales/horizontales).
2. Se recortó **cada caja por separado**, respetando la proporción real del
   estuche (Switch 105×170 mm, PS4/PS5 135×170 mm) y recortando la tela de fondo.
3. Se escaló ×2.8 con Lanczos + enfoque suave y se exportó a WebP (≈14 KB por
   portada, 1.6 MB en total).

No se retocó ninguna portada, no se cambió ningún logo de marca y no se usó
ninguna imagen de banco: **todas las portadas son fotos reales del inventario.**

Para volver a generarlas: `node tools/crop4.mjs && npm run images`.

---

## 5. Qué está listo y funcionando

| Elemento | Estado |
| --- | --- |
| Pantalla de carga con el logotipo oficial, barra de bloques y barrido CRT | ✅ ~1,1 s y desaparece |
| Header fijo con navegación de 7 secciones | ✅ |
| Menú móvil (hamburguesa, cierra con Escape) | ✅ |
| Buscador global (nombre, plataforma, género, sin tildes) | ✅ atajo `/` |
| Hero con portadas reales en abanico | ✅ |
| Beneficios, categorías, confianza, FAQ | ✅ |
| Catálogo con 118 productos | ✅ |
| Filtros por plataforma, estado, disponibilidad, género y precio | ✅ con contadores reales |
| Orden: destacados, recientes, precio ↑↓, nombre | ✅ |
| Filtros reflejados en la URL (compartibles) | ✅ |
| Página individual por producto (`/producto/slug`) | ✅ con datos estructurados |
| Productos relacionados | ✅ |
| Carrito: agregar, cantidad, eliminar, vaciar, persistencia | ✅ |
| Finalizar compra → WhatsApp con el pedido armado | ✅ |
| Favoritos con página propia | ✅ |
| Sección y formulario de videojuegos usados | ✅ envía por WhatsApp |
| Botón flotante de WhatsApp + volver arriba | ✅ |
| Toasts, skeletons, lazy loading, estados de error | ✅ |
| Página 404 "GAME OVER" | ✅ |
| SEO: title, description, canonical, Open Graph, JSON-LD, sitemap, robots | ✅ |
| Responsive de 320 px a 1920 px sin scroll horizontal | ✅ verificado |
| Accesibilidad: foco visible, teclado, alt, ARIA, contraste | ✅ |

---

## 6. Qué quedó preparado para completar

El negocio **no entregó** estos datos, así que la tienda funciona sin ellos y los
muestra de forma honesta en lugar de inventarlos:

| Dato | Cómo se muestra hoy | Dónde se completa |
| --- | --- | --- |
| **Precios** | "Consultar precio" + botón de WhatsApp | `price` en `products.ts` |
| **Nuevo / usado por título** | "Estado a confirmar" | `condition` en `products.ts` |
| **Stock** | Todo disponible (nada marcado agotado) | `stock` en `products.ts` |
| **Consolas** | Bloque "Próximamente nuevos equipos" con CTA a WhatsApp | añadir productos con `category: 'consolas'` |
| **Accesorios** | Igual que consolas | `category: 'accesorios'` |
| **Redes sociales** | Nota de "próximamente"; no hay enlaces falsos | `site.socials` en `site.ts` |
| **Dirección exacta** | Solo "Itagüí, Antioquia" (petición del cliente) | `site.ts` |
| **Dominio** | `goodgame.com.co` como marcador | `site.url` + `SITE_URL` en `build-assets.mjs` |

Los filtros de **precio** y **estado** ya funcionan: hoy muestran `0` porque no hay
datos, y se activan solos en cuanto se llenen los campos.

### Títulos retirados

Seis juegos aparecen marcados con una **X roja** en las fotografías. No se publican.
Están listados en `retirados`, al final de `src/data/products.ts`:
Resident Evil 3, God of War (2018), Horizon Zero Dawn, Kena: Bridge of Spirits,
Mega Man X Legacy Collection 1+2 y Need for Speed Payback.

> Para reactivar uno hay que **reemplazar su fotografía**: la original tiene la X encima.

---

## 7. Administrar el catálogo

Todo se hace en **`src/data/products.ts`**. Cada producto es un objeto:

```ts
{
  id: 'juegos6-12',
  name: 'Elden Ring',
  slug: 'elden-ring-ps5',          // define la URL: /producto/elden-ring-ps5
  platform: 'ps5',                 // 'ps5' | 'ps4' | 'switch'
  category: 'videojuegos',         // 'videojuegos' | 'consolas' | 'accesorios'
  genre: 'rpg',
  condition: 'consultar',          // 'nuevo' | 'usado' | 'consultar'
  price: null,                     // null → "Consultar precio"
  oldPrice: null,
  stock: null,                     // null → disponible · 0 → agotado
  images: ['/games/elden-ring-ps5.webp'],
  description: '…',
  featured: true,                  // aparece en "Videojuegos destacados"
  tags: ['PS5'],
}
```

### Cambiar precios

```ts
price: 189000,      // se muestra "$189.000"
oldPrice: 240000,   // se muestra tachado y calcula "-21%" automáticamente
```

Los precios son **números enteros sin puntos ni comas**. El formato en pesos
colombianos lo aplica la web sola.

### Modificar stock

```ts
stock: null   // disponible (por defecto)
stock: 3      // disponible
stock: 0      // AGOTADO: tarjeta atenuada, "Agregar" deshabilitado,
              // el botón de WhatsApp cambia a "Preguntar cuándo vuelve"
```

### Cambiar el estado (nuevo / usado)

```ts
condition: 'nuevo'      // badge dorado "Nuevo"
condition: 'usado'      // badge "Usado"
condition: 'consultar'  // "Estado a confirmar"
```

En cuanto haya títulos con `'nuevo'` o `'usado'`, el filtro **Estado** empieza a
mostrar resultados sin tocar nada más.

### Agregar un videojuego nuevo

1. Guarda la foto de la portada en `public/games/` como `mi-juego-ps5.webp`
   (proporción ~3:4, ancho recomendado 260–400 px).
2. Copia un bloque en `products.ts` y cambia `id`, `name`, `slug`, `platform`,
   `genre`, `images` y `description`.
3. El `slug` debe ser **único**: usa `nombre-del-juego-plataforma`.
4. Guarda. El producto aparece en el catálogo, el buscador, los filtros y el sitemap.

Si prefieres regenerarlo todo desde las fotos originales, añade la fila en
`tools/catalog.mjs` + la descripción en `tools/descriptions.mjs` y ejecuta
`npm run images`.

### Agregar consolas o accesorios

Mismo procedimiento, cambiando `category: 'consolas'` o `'accesorios'`.
Las secciones de la portada dejan de mostrar "Próximamente" automáticamente y
pasan a mostrar los productos.

---

## 8. Conectar más adelante

### Base de datos (Firebase, Supabase, WooCommerce, API propia)

La interfaz **nunca lee la base de datos directamente**: solo importa
`products` desde `src/data/products.ts`. Para migrar basta con que la fuente
devuelva objetos con la forma de `Product` (`src/types.ts`).

```ts
// src/data/products.ts  →  reemplazar por, por ejemplo:
import { supabase } from '@/lib/supabase'

export async function getProducts(): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*')
  return data ?? []
}
```

Y en las páginas, cambiar el import estático por un `useEffect`/`loader` que
guarde el resultado en estado. El resto (filtros, carrito, buscador, SEO)
funciona igual porque todo opera sobre el tipo `Product`.

Campos que conviene crear en la tabla: `id, name, slug, platform, category,
genre, condition, price, old_price, stock, images, description, featured, tags`.

### Pasarela de pagos (Wompi, Mercado Pago, PayU, Bold…)

Hoy el carrito termina en WhatsApp. El único punto que hay que tocar es el pie
del panel del carrito, en `src/components/cart/CartDrawer.tsx`:

```tsx
<a href={cartMessage(cart)} …>Finalizar compra</a>
```

Se reemplaza por un botón que llame a la pasarela con `cart`, `cartTotal` y los
datos del cliente. Recomendado:

1. Añadir un paso de datos de envío antes del pago.
2. Crear la referencia de pago en un backend (no en el navegador).
3. Dejar el botón de WhatsApp como alternativa: en Colombia convierte mucho.

`cartTotal` ya viene calculado y `cartHasPending` avisa si hay productos sin
precio publicado (no se debería cobrar en línea un carrito con precios pendientes).

---

## 9. Control de calidad

```bash
npm run dev      # en una terminal
npm run qa       # en otra
```

`tools/qa.mjs` abre Chrome real y verifica:

- errores de consola en las 7 rutas
- ausencia de scroll horizontal en 320 / 375 / 390 / 414 / 768 / 1024 / 1280 / 1440 / 1920 px
- que todas las imágenes carguen
- que no haya enlaces muertos y que **todos** los de WhatsApp apunten al 3508271637
- flujo completo del carrito (agregar, contar, panel, mensaje, persistencia)
- buscador con resultados y estado vacío
- filtros (URL, aplicación real, combinación) y ordenamiento
- menú móvil y drawer de filtros
- tamaño de los objetivos táctiles

Guarda capturas en `tools/qa-shots/`. Devuelve código de salida ≠ 0 si algo falla,
así que sirve tal cual en un pipeline de CI.

---

## 10. Publicar

El build es estático (`dist/`). Sirve cualquier hosting; con Vercel:

```bash
npx vercel deploy --prod --yes
```

`vercel.json` ya incluye el *rewrite* de SPA (para que `/producto/...` funcione al
recargar) y cabeceras de caché de un año para `/games/*`.

Al tener el dominio definitivo, actualizar:

- `site.url` en `src/data/site.ts`
- `SITE_URL` en `tools/build-assets.mjs` (y volver a correr `npm run images`)
- `<link rel="canonical">` y `og:url` en `index.html`

---

## 11. Identidad visual

| Token | Color | Uso |
| --- | --- | --- |
| `blue-900` | `#070A78` | Azul principal del logo |
| `ink-900` | `#070C42` | Fondo de la página |
| `ink-700` | `#0C1566` | Tarjetas y superficies |
| `gold-500` | `#FFF000` | Botones, precios, badges, hover, CTA |
| `alert-500` | `#FF1717` | Agotado, descuentos, favoritos (uso moderado) |

Tipografías: **Archivo** (títulos, ancho extendido) e **Inter** (texto).

**Logotipo oficial del negocio.** Los originales están en `_source/logos/` (AI, PDF
y PNG con transparencia en versión color, blanca y negra). `npm run brand`
genera desde ahí todo lo que usa la web, en `public/brand/`:

| Archivo | Uso |
| --- | --- |
| `logo-blanco.png` | Header, footer y menú móvil (fondo oscuro) |
| `logo-color.png` | Pantalla de carga e imagen para compartir |
| `logo-negro.png` | Reserva para fondos claros (facturas, impresos) |
| `mando-blanco.png` | El mando aislado, para estados vacíos y la 404 |
| `icono-512.png`, `apple-touch-icon.png`, `favicon.svg` | Íconos de app y pestaña |

Si el negocio actualiza el logotipo, basta con reemplazar los PNG de
`_source/logos/` y ejecutar `npm run brand && npm run boot`.

---

## 12. Notas de honestidad del contenido

Siguiendo el brief, **no se inventó nada**:

- Ningún precio, stock, edición ni característica que no estuviera confirmada.
- Ninguna dirección exacta (el negocio pidió no publicarla).
- Ninguna red social (están pendientes).
- Ningún testimonio, certificación, años de experiencia ni número de clientes.
- Dos títulos llevan una nota visible porque la foto no permitía confirmar la
  edición exacta: *Dragon Quest HD-2D Remake* y *The Walking Dead*.
