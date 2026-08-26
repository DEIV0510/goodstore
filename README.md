# GOOD GAME — Game Store

Tienda web de videojuegos, consolas y accesorios para **GOOD GAME** (Itagüí, Antioquia).
Catálogo de **318 productos físicos** (445 unidades) para PlayStation 5, PlayStation 4,
Nintendo Switch, Switch 2 y accesorios, con precios y existencias reales, carrito,
filtros, buscador y cierre de compra por WhatsApp.

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
| `npm run catalogo` | Regenera el catálogo desde el inventario: `products.ts`, imágenes y `sitemap.xml` |
| `npm run qa` | Control de calidad automatizado en navegador real (ver §9) |
| `npm run brand` | Regenera logotipos e íconos desde `_source/logos/` |
| `node tools/hoja-fotos.mjs` | Hojas de contacto para revisar que cada portada es la correcta |
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
│   ├── games/             261 portadas WebP de las fotos del negocio
│   ├── brand/             Logotipo oficial en sus tres versiones + íconos
│   ├── apple-touch-icon.png
│   ├── og-image.png       Imagen para compartir (1200×630)
│   ├── robots.txt
│   └── sitemap.xml        Generado con `npm run catalogo`
│
├── src/
│   ├── components/
│   │   ├── brand/         Logo y monograma
│   │   ├── layout/        Header, Footer, menú móvil, buscador, botones flotantes
│   │   ├── home/          Secciones de la portada
│   │   ├── catalog/       Tarjeta de producto y panel de filtros
│   │   ├── cart/          Panel del carrito
│   │   ├── ui/            Piezas reutilizables (imagen, badges, drawer, toasts…)
│   │   └── admin/         Kit del panel: tabla, modal, avisos, gráficos, imágenes
│   ├── layouts/
│   │   ├── PublicLayout   Envoltorio de la tienda
│   │   └── AdminLayout    Barra lateral y estructura del panel
│   ├── pages/
│   │   ├── public/        Home, Catalog, ProductPage, Usados, Favoritos, NotFound
│   │   └── admin/         Las 16 pantallas del panel
│   ├── services/          ★ Única puerta a los datos; la usan tienda y panel
│   │   ├── catalogo.ts    Productos y categorías
│   │   ├── pedidos.ts     Pedidos y clientes
│   │   ├── contenido.ts   Portada, banners y preguntas
│   │   ├── ajustes.ts     Configuración general y WhatsApp
│   │   ├── autenticacion.ts  Sesión y permisos
│   │   ├── equipo.ts      Administradores e historial
│   │   ├── metricas.ts    Cifras y series de los gráficos
│   │   └── almacenamiento.ts  Subida de imágenes
│   ├── hooks/
│   │   ├── useCatalogo    Datos de la tienda (base de datos o catálogo incluido)
│   │   └── useAuth        Sesión del panel
│   ├── data/
│   │   ├── products.ts    ★ CATÁLOGO incluido — semilla y respaldo
│   │   ├── site.ts        ★ Datos del negocio (WhatsApp, ubicación, redes)
│   │   ├── categories.ts  Tarjetas de "Explora por categoría"
│   │   ├── faq.ts         Preguntas frecuentes
│   │   └── taxonomy.ts    Plataformas, géneros, estados, rangos de precio
│   ├── lib/
│   │   ├── supabase.ts    Cliente de la base de datos (null si no está conectada)
│   │   ├── filters.ts     Motor de filtros, orden y búsqueda
│   │   ├── whatsapp.ts    Armado de los mensajes de WhatsApp
│   │   ├── format.ts      Precios en pesos, normalización de texto
│   │   └── seo.ts         Title, description, canonical, Open Graph y JSON-LD
│   ├── store/             Carrito y favoritos (Context + localStorage)
│   ├── styles/
│   │   ├── index.css      Base, componentes y utilidades de la tienda
│   │   └── admin.css      Tema claro del panel (todo bajo html.gg-admin)
│   └── types/             ★ Modelo de datos
│
├── supabase/migrations/   Esquema, permisos, auditoría y almacenamiento
│
├── tools/                 Utilidades de desarrollo (no se publican)
│   ├── _source/…          Fotografías originales del negocio
│   ├── inventory.mjs      Lee y normaliza el inventario del Excel
│   ├── asignar-fotos.mjs  Qué fotografía va con cada producto (revisado a mano)
│   ├── crop-fotos.mjs     Aísla el estuche en cada fotografía
│   ├── build-catalog.mjs  Genera products.ts + imágenes + sitemap
│   ├── sembrar.mjs        Carga el catálogo en la base de datos
│   ├── hoja-fotos.mjs     Hojas de contacto para revisar las portadas
│   ├── brand.mjs / og.mjs Logotipos, íconos e imagen para compartir
│   └── qa.mjs             Control de calidad automatizado
│
└── _source/               Copia de las fotos y el brief del cliente
```

**La tienda y el panel comparten `src/services/`.** Esa es la razón por la que
un cambio hecho en `/admin` se ve en la tienda: no hay dos copias de los datos.

---

## 4. Qué entregó el negocio

| Entrega | Qué contenía | Dónde está |
| --- | --- | --- |
| Brief | PDF con la información del negocio | `_source/brief.pdf` |
| Logotipo | AI, PDF y PNG con transparencia en color, blanco y negro | `_source/logos/` |
| Inventario | Excel con 324 filas: artículo, plataforma, precio, estado, región y cantidad | `_source/inventario.xlsx` |
| Fotografías | 269 fotos individuales de las carátulas | `_source/fotos/` |
| Fotos iniciales | 6 fotos con los juegos en cuadrícula (una repetida) | `_source/juegos*.png` |

Las primeras seis fotos, en cuadrícula, se usaron mientras no había fotos
individuales: se detectó la rejilla y se recortó cada caja por separado. Hoy solo
quedan dos de esos recortes en uso, para dos productos que las fotos nuevas no
cubren. El detalle está en §6.

No se retocó ninguna portada, no se cambió ningún logo de marca y no se usó
ninguna imagen de banco: **todas las portadas son fotos reales del inventario.**

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
| Catálogo con 318 productos, 445 unidades y 303 fotos reales | ✅ |
| Filtros por plataforma, estado, disponibilidad, género, región y precio | ✅ con contadores reales |
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

## 6. De dónde salen los datos del catálogo

El negocio entregó su inventario en Excel (`_source/inventario.xlsx`) con las
columnas **Articulo · Plataforma · Pv estimado · Estado · Region · Cantidad**.
De ahí sale todo: 324 filas → **318 productos** y **445 unidades**.

Reglas aplicadas al leerlo (en `tools/inventory.mjs`):

- Las filas idénticas (mismo título, plataforma, estado, región y precio) se
  agrupan en un solo producto. La cantidad es `max(suma escrita, nº de filas)`,
  porque el negocio a veces escribe "3" en la primera fila y deja las
  repeticiones en blanco, y otras veces escribe "1" en cada una.
- Un mismo título puede quedar como **dos productos** si hay copia nueva y copia
  usada a distinto precio: son dos ofertas distintas, cada una con su stock.
- Los paréntesis del Excel ("Sin mapa", "Códigos vigentes", "No incluye
  llavero") se convierten en un aviso visible en la ficha del producto.
- Los nombres se normalizan a formato título y se corrigen las erratas
  ("Assasin's" → "Assassin's", "Elden ring nightrein" → "Elden Ring Nightreign").
- Donde el Excel abrevia, se usa el **título impreso en la carátula**, que se
  obtuvo al leer las fotografías: "Sekiro" → *Sekiro: Shadows Die Twice*,
  "Rayman" → *Rayman Legends*, "Monster hunter" → *Monster Hunter: World*. Es lo
  que el cliente escribe en Google y en el buscador de la tienda.

Son 93 correcciones de nombre en total, listadas en `ERRATAS` dentro de
`tools/build-catalog.mjs`, cada una respaldada por su propia fotografía. Un caso
vale la pena mencionarlo: el Excel dice *Bloodstained Ritual of the Night 2*, un
juego que no existe; la caja es **Bloodstained: Curse of the Moon 2**.

### Fotografías

De los 318 productos, **303 tienen fotografía real** del negocio. Los 15 restantes
muestran una **portada de marca generada** con su título y el color de su
plataforma: nunca se usa la carátula de otro juego ni una imagen de banco.

Las fotos individuales están en `_source/fotos/` (269 archivos). El proceso:

1. **Identificación.** Los nombres de archivo vienen abreviados y con erratas
   (`howardslegacy`, `grimsondeset`, `thekingoftgthers`), así que no se usan para
   emparejar. Se leyó el **título impreso en cada carátula** y la franja de
   plataforma de la caja.
2. **Recorte.** `tools/crop-fotos.mjs` aísla el estuche midiendo el **enfoque**:
   la caja está nítida y el fondo (otros lomos, la estantería) desenfocado. Luego
   ajusta el recorte a la proporción real del estuche, así todas las portadas
   quedan con la misma forma.
3. **Exportación.** 420 px de ancho, WebP al 80 % → ~35 KB por portada, 12 MB en
   total, con carga diferida.

El mapa fotografía → producto está en `tools/asignar-fotos.mjs` y se **verificó
mirando las 259 portadas publicadas** en hojas de contacto
(`node tools/hoja-fotos.mjs`). Esa revisión encontró cinco errores que ningún
emparejamiento automático habría detectado:

| Archivo | Lo que parecía | Lo que era |
| --- | --- | --- |
| `thelastofus2.png` | The Last of Us Part II | **Part I** (estaban intercambiadas) |
| `thelastofus2remaster.png` | The Last of Us Part I | **Part II Remastered** |
| `fantasyvii.png` | Final Fantasy VII Remake | **Final Fantasy VII Rebirth** |
| `pokemonswitch.png` | Pokémon Legends Arceus | **Detective Pikachu (japonés)** |
| `minecraftsotyymode.png` | Minecraft Dungeons | **Minecraft: Story Mode** (no se publica) |
| `spacemarine.png` | Space Marine | **Space Marine II** — la caja lleva el II |
| `pokemonswitch.png` | Pokémon Legends Arceus | **Detective Pikachu Returns**, que sí está en el inventario |

Nueve fotografías más quedaron sin publicar porque el juego no está en el
inventario (Donkey Kong Bananza, FIFA 21, MADiSON, Metal Slug Tactics) o porque
la caja es de una plataforma que el negocio no tiene listada. El motivo de cada
una está escrito en `DESCARTADAS`, dentro de `tools/asignar-fotos.mjs`.

> **Para añadir fotos nuevas:** se copian a `_source/fotos/`, se añade una línea
> en `FORZADAS` (o se deja que el emparejamiento automático las resuelva) y se
> ejecuta `npm run catalogo`.

### Géneros y descripciones

Los 289 títulos únicos se clasificaron por género y recibieron una descripción
corta y factual. Los dos accesorios (control de Xbox y memoria microSD) no llevan
género, que es lo correcto. La clasificación vive en `tools/_clasificacion.json`.

### Lo que sigue sin definirse

| Dato | Cómo se muestra hoy | Dónde se completa |
| --- | --- | --- |
| **Consolas** | La categoría existe, pero el inventario no trae consolas | añadir productos con `category: 'consolas'` |
| **Redes sociales** | Nota de "próximamente"; no hay enlaces falsos | `site.socials` en `site.ts` |
| **Dirección exacta** | Solo "Itagüí, Antioquia" (petición del cliente) | `site.ts` |
| **Dominio** | `goodgamecol.shop` (dominio real, Hostinger) | `site.url` + `SITE_URL` en `build-catalog.mjs` |

---

## 7. Administrar el catálogo

Hay dos formas, y la primera es la recomendada.

### Desde el panel de administración (recomendado)

El proyecto incluye un panel completo en **`/admin`**: productos, inventario,
categorías, pedidos, clientes, contenido de la portada, banners, preguntas
frecuentes, WhatsApp, configuración, administradores e historial de cambios.

Requiere conectar una base de datos (Supabase) una sola vez. **Los pasos están
en [`ADMIN.md`](ADMIN.md)**; toma unos diez minutos.

Con el panel conectado no hace falta tocar código ni volver a publicar la web
para cambiar un precio, un stock o un texto.

### Editando el archivo del catálogo

Mientras no haya base de datos, la tienda usa el catálogo incluido en el
paquete y se administra en **`src/data/products.ts`**. Cada producto es un
objeto:

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
