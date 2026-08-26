import { listarProductos } from './catalogo'
import { listarPedidos, listarClientes } from './pedidos'
import type {
  DashboardStats,
  Order,
  Product,
  SeriesPoint,
} from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Métricas del panel.
//
// TODO se calcula a partir de los datos reales. Cuando no hay suficientes, las
// funciones devuelven una lista vacía y la pantalla dice que aún no hay datos.
// Nunca se rellena un gráfico con cifras de ejemplo: un número inventado en un
// panel de negocio es peor que un espacio en blanco.
// ─────────────────────────────────────────────────────────────────────────────

/** Umbral por omisión de "stock bajo". El panel lo puede cambiar. */
export const STOCK_BAJO_POR_OMISION = 3

export const CLAVE_STOCK_BAJO = 'gg.admin.stockBajo'

export function leerUmbralStockBajo(): number {
  try {
    const guardado = localStorage.getItem(CLAVE_STOCK_BAJO)
    const n = guardado ? Number(guardado) : NaN
    return Number.isFinite(n) && n >= 0 ? n : STOCK_BAJO_POR_OMISION
  } catch {
    return STOCK_BAJO_POR_OMISION
  }
}

export function guardarUmbralStockBajo(valor: number): void {
  try {
    localStorage.setItem(CLAVE_STOCK_BAJO, String(valor))
  } catch {
    /* almacenamiento no disponible */
  }
}

/** stock null = disponibilidad por confirmar; se cuenta como disponible. */
export const estaAgotado = (p: Product) => p.stock === 0

export const tieneStockBajo = (p: Product, umbral: number) =>
  p.stock !== null && p.stock > 0 && p.stock <= umbral

export interface DatosPanel {
  productos: Product[]
  pedidos: Order[]
  stats: DashboardStats
  bajoStock: Product[]
}

export async function cargarPanel(umbral: number): Promise<DatosPanel> {
  const [productos, pedidos, clientes] = await Promise.all([
    listarProductos({ incluirNoPublicados: true }),
    listarPedidos(),
    listarClientes(),
  ])

  const publicados = productos.filter((p) => p.status === 'publicado')
  const bajoStock = publicados.filter((p) => tieneStockBajo(p, umbral))
  const vendidos = pedidos.filter((p) => p.status !== 'cancelado')

  const stats: DashboardStats = {
    products: productos.length,
    draft: productos.filter((p) => p.status !== 'publicado').length,
    available: publicados.filter((p) => !estaAgotado(p)).length,
    soldOut: publicados.filter(estaAgotado).length,
    lowStock: bajoStock.length,
    units: publicados.reduce((n, p) => n + (p.stock ?? 0), 0),
    inventoryValue: publicados.reduce((n, p) => n + (p.price ?? 0) * (p.stock ?? 0), 0),
    orders: pedidos.length,
    sales: vendidos.reduce((n, p) => n + p.total, 0),
    customers: clientes.length,
    views: productos.reduce((n, p) => n + p.views, 0),
  }

  return { productos, pedidos, stats, bajoStock }
}

// ── Series para los gráficos ─────────────────────────────────────────────────

export type Granularidad = 'dia' | 'semana' | 'mes'

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

/** Clave de agrupación y etiqueta legible para una fecha. */
function agrupar(fecha: Date, granularidad: Granularidad): [string, string] {
  const dd = String(fecha.getDate()).padStart(2, '0')
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')

  if (granularidad === 'dia') {
    return [`${fecha.getFullYear()}-${mm}-${dd}`, `${dd}/${mm}`]
  }
  if (granularidad === 'mes') {
    return [`${fecha.getFullYear()}-${mm}`, `${MESES[fecha.getMonth()]}`]
  }
  // Semana: se ancla al lunes para que la etiqueta sea estable.
  const lunes = new Date(fecha)
  const dia = (lunes.getDay() + 6) % 7
  lunes.setDate(lunes.getDate() - dia)
  const l = String(lunes.getDate()).padStart(2, '0')
  const lm = String(lunes.getMonth() + 1).padStart(2, '0')
  return [`${lunes.getFullYear()}-${lm}-${l}`, `${l}/${lm}`]
}

/** Cuántos tramos hacia atrás se muestran en cada granularidad. */
const TRAMOS: Record<Granularidad, number> = { dia: 14, semana: 8, mes: 6 }

/**
 * Ventas por tramo. Incluye los tramos sin ventas (en cero) para que el
 * gráfico no mienta juntando fechas lejanas como si fueran consecutivas.
 */
export function serieVentas(
  pedidos: Order[],
  granularidad: Granularidad
): SeriesPoint[] {
  const validos = pedidos.filter((p) => p.status !== 'cancelado')
  if (validos.length === 0) return []

  const totales = new Map<string, number>()
  for (const p of validos) {
    const [clave] = agrupar(new Date(p.createdAt), granularidad)
    totales.set(clave, (totales.get(clave) ?? 0) + p.total)
  }

  const puntos: SeriesPoint[] = []
  const hoy = new Date()
  for (let i = TRAMOS[granularidad] - 1; i >= 0; i--) {
    const f = new Date(hoy)
    if (granularidad === 'dia') f.setDate(f.getDate() - i)
    else if (granularidad === 'semana') f.setDate(f.getDate() - i * 7)
    else f.setMonth(f.getMonth() - i)

    const [clave, etiqueta] = agrupar(f, granularidad)
    puntos.push({ label: etiqueta, value: totales.get(clave) ?? 0 })
  }
  return puntos
}

/** Productos con más vistas. Vacío mientras nadie haya abierto una ficha. */
export function serieMasVistos(productos: Product[], tope = 6): SeriesPoint[] {
  return productos
    .filter((p) => p.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, tope)
    .map((p) => ({ label: p.name, value: p.views }))
}

/** Productos más vendidos, contando unidades de pedidos no cancelados. */
export function serieMasVendidos(pedidos: Order[], tope = 6): SeriesPoint[] {
  const unidades = new Map<string, number>()
  for (const pedido of pedidos) {
    if (pedido.status === 'cancelado') continue
    for (const linea of pedido.items) {
      unidades.set(linea.name, (unidades.get(linea.name) ?? 0) + linea.qty)
    }
  }
  return [...unidades.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, tope)
    .map(([label, value]) => ({ label, value }))
}

/** Reparto del catálogo por plataforma. Siempre hay datos si hay productos. */
export function serieCatalogoPorPlataforma(productos: Product[]): SeriesPoint[] {
  const nombres: Record<string, string> = {
    ps5: 'PS5',
    ps4: 'PS4',
    switch: 'Switch',
    switch2: 'Switch 2',
    xbox: 'Xbox',
  }
  const cuenta = new Map<string, number>()
  for (const p of productos) {
    if (p.status !== 'publicado') continue
    cuenta.set(p.platform, (cuenta.get(p.platform) ?? 0) + 1)
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ label: nombres[id] ?? id, value }))
}

/** Categorías más populares: por vistas si las hay, si no por tamaño de catálogo. */
export function serieCategorias(productos: Product[]): {
  puntos: SeriesPoint[]
  medida: 'vistas' | 'productos'
} {
  const publicados = productos.filter((p) => p.status === 'publicado')
  const hayVistas = publicados.some((p) => p.views > 0)

  const nombres: Record<string, string> = {
    videojuegos: 'Videojuegos',
    consolas: 'Consolas',
    accesorios: 'Accesorios',
  }
  const cuenta = new Map<string, number>()
  for (const p of publicados) {
    const suma = hayVistas ? p.views : 1
    cuenta.set(p.category, (cuenta.get(p.category) ?? 0) + suma)
  }

  return {
    puntos: [...cuenta.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, value]) => ({ label: nombres[id] ?? id, value })),
    medida: hayVistas ? 'vistas' : 'productos',
  }
}
