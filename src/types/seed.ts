import type { Product } from './index'

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo incluido en el paquete (`src/data/products.ts`).
//
// Es la SEMILLA: el inventario real del negocio tal como se cargó desde su
// hoja de cálculo. Cumple dos funciones:
//
//   1. Poblar la base de datos la primera vez (`npm run sembrar`).
//   2. Mantener la tienda en pie mientras la base de datos no esté conectada,
//      exactamente con el catálogo que hoy está publicado.
//
// No trae los campos que solo se administran desde el panel (estado de
// publicación, etiquetas de marketing, vistas): `catalogo.ts` los completa con
// valores neutros al leerla.
// ─────────────────────────────────────────────────────────────────────────────
export type ProductSeed = Omit<
  Product,
  'status' | 'onSale' | 'newRelease' | 'bestSeller' | 'views' | 'sku'
>
