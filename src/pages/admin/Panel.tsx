import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  Layers,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GraficoAnillo,
  GraficoBarras,
  GraficoBarrasH,
  Panel as PanelGrafico,
  SinDatos,
} from '@/components/admin/Graficos'
import { Cargando, Cifra, Encabezado, ErrorEstado, Etiqueta } from '@/components/admin/UI'
import { platformShort } from '@/data/taxonomy'
import { useAuth } from '@/hooks/useAuth'
import { cop, pluralize } from '@/lib/format'
import { puedeVerNegocio } from '@/services/autenticacion'
import {
  cargarPanel,
  leerUmbralStockBajo,
  serieCatalogoPorPlataforma,
  serieCategorias,
  serieMasVendidos,
  serieMasVistos,
  serieVentas,
  type DatosPanel,
  type Granularidad,
} from '@/services/metricas'

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla principal del panel.
//
// Es lo primero que se ve al entrar, así que responde de un vistazo a las tres
// preguntas del día: qué hay que reponer, cómo va el catálogo y cómo van las
// ventas.
//
// Ni una cifra de aquí es inventada: todas salen de cargarPanel(), que las
// calcula sobre los datos reales. Cuando todavía no hay pedidos, el gráfico
// correspondiente lo dice en vez de dibujar una curva de ejemplo.
// ─────────────────────────────────────────────────────────────────────────────

/** Miles con punto, como se escriben en Colombia. El dinero va con cop(). */
const numero = new Intl.NumberFormat('es-CO')

/** Las ventanas de tiempo son las que aplica serieVentas() en cada agrupación. */
const GRANULARIDADES: { id: Granularidad; etiqueta: string; tramo: string }[] = [
  { id: 'dia', etiqueta: 'Día', tramo: 'Últimos 14 días' },
  { id: 'semana', etiqueta: 'Semana', tramo: 'Últimas 8 semanas' },
  { id: 'mes', etiqueta: 'Mes', tramo: 'Últimos 6 meses' },
]

export default function Panel() {
  const { perfil } = useAuth()

  // Un editor no puede leer pedidos ni clientes: las políticas de la base de
  // datos (0002_permisos.sql) le devuelven cero filas, no un error. Mostrarle
  // "0 ventas" sería mentirle, así que esas casillas se marcan con un guion.
  const verNegocio = puedeVerNegocio(perfil?.role)

  // El umbral de stock bajo lo fija la pantalla de inventario y vive en el
  // navegador. Se relee en cada carga, no solo al montar: si cambia a mitad de
  // sesión, el botón de actualizar trae los datos con el valor vigente y el
  // aviso de arriba habla de ese mismo número.
  const [umbral, setUmbral] = useState(leerUmbralStockBajo)
  const [granularidad, setGranularidad] = useState<Granularidad>('dia')

  const [datos, setDatos] = useState<DatosPanel | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const vigente = leerUmbralStockBajo()
      setUmbral(vigente)
      setDatos(await cargarPanel(vigente))
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudieron cargar los datos del panel'
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Las series se calculan antes de cualquier salida temprana: los hooks no
  // pueden quedar detrás de un `return`.
  const ventas = useMemo(
    () => (datos && verNegocio ? serieVentas(datos.pedidos, granularidad) : []),
    [datos, granularidad, verNegocio]
  )
  const masVistos = useMemo(
    () => (datos ? serieMasVistos(datos.productos) : []),
    [datos]
  )
  const masVendidos = useMemo(
    () => (datos && verNegocio ? serieMasVendidos(datos.pedidos) : []),
    [datos, verNegocio]
  )
  const plataformas = useMemo(
    () => (datos ? serieCatalogoPorPlataforma(datos.productos) : []),
    [datos]
  )
  const categorias = useMemo(
    () =>
      datos
        ? serieCategorias(datos.productos)
        : { puntos: [], medida: 'productos' as const },
    [datos]
  )

  if (cargando) return <Cargando texto="Cargando el resumen…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />
  if (!datos) return null // solo para que TypeScript sepa que ya hay datos

  const { stats, bajoStock } = datos
  const tramo = GRANULARIDADES.find((g) => g.id === granularidad) ?? GRANULARIDADES[0]

  const sinAcceso = 'Sin acceso con tu rol.'
  const cifraNegocio = (valor: string) => (verNegocio ? valor : '—')

  const pestanasVentas = (
    <div
      role="group"
      aria-label="Agrupar las ventas por"
      className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
    >
      {GRANULARIDADES.map((g) => {
        const activa = g.id === granularidad
        return (
          <button
            key={g.id}
            type="button"
            aria-pressed={activa}
            onClick={() => setGranularidad(g.id)}
            // El estado activo no se distingue solo por color: cambia el fondo,
            // el borde y el grosor de la letra.
            className={`min-h-[44px] rounded-md px-3 text-[12.5px] transition-colors sm:min-h-[34px] ${
              activa
                ? 'bg-white font-bold text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'font-medium text-slate-500 hover:text-slate-900'
            }`}
          >
            {g.etiqueta}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <Encabezado titulo="Panel" descripcion="Resumen de GOOD GAME al día de hoy.">
        <button type="button" onClick={() => void cargar()} className="adm-btn-suave">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Actualizar
        </button>
        <Link to="/admin/productos/nuevo" className="adm-btn-primary">
          Agregar producto
        </Link>
      </Encabezado>

      {/* ── Lo urgente, arriba del todo ─────────────────────────────────────
          Solo aparece cuando de verdad hay algo por reponer: un aviso que sale
          siempre deja de leerse a la semana.                                */}
      {stats.lowStock > 0 && (
        <div
          role="status"
          className="adm-card mb-5 flex flex-col gap-3 border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-display text-[14px] font-bold text-amber-900">
                {pluralize(stats.lowStock, 'producto tiene', 'productos tienen')} stock
                bajo
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-800">
                Les quedan {pluralize(umbral, 'unidad', 'unidades')} o menos. Repón
                antes de que la tienda los muestre agotados.
              </p>
            </div>
          </div>
          <Link
            to="/admin/inventario"
            className="adm-btn-suave adm-btn-sm shrink-0 border-amber-300 bg-white hover:border-amber-400"
          >
            Ver inventario
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* ── Cifras ──────────────────────────────────────────────────────────
          Las dos casillas en pesos ocupan doble columna hasta el escritorio:
          un importe de siete dígitos no cabe en una columna estrecha y se
          saldría de la tarjeta a 320 px.                                    */}
      <section aria-label="Resumen en cifras" className="mb-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Cifra
            icono={Package}
            etiqueta="Productos"
            valor={numero.format(stats.products)}
            // `draft` cuenta todo lo que no está publicado: borradores y archivados.
            nota={stats.draft > 0 ? `${numero.format(stats.draft)} sin publicar` : undefined}
          />
          <Cifra
            icono={CheckCircle2}
            etiqueta="Disponibles"
            valor={numero.format(stats.available)}
            // `available` es "publicado y no agotado": el stock sin confirmar
            // (null) también entra, así que no se puede prometer "existencias".
            nota="Publicados que no están agotados"
            tono="verde"
          />
          <Cifra
            icono={XCircle}
            etiqueta="Agotados"
            valor={numero.format(stats.soldOut)}
            nota="Publicados con stock en cero"
            tono="rojo"
          />
          <Cifra
            icono={Layers}
            etiqueta="Unidades en stock"
            valor={numero.format(stats.units)}
            nota="Suma del catálogo publicado"
            tono="gris"
          />

          <div className="col-span-2 lg:col-span-1 [&>div]:h-full">
            <Cifra
              icono={Wallet}
              etiqueta="Valor del inventario"
              valor={cop(stats.inventoryValue)}
              nota="Precio × unidades en stock"
            />
          </div>

          <Cifra
            icono={ClipboardList}
            etiqueta="Pedidos"
            valor={cifraNegocio(numero.format(stats.orders))}
            nota={verNegocio ? 'Registrados en el panel' : sinAcceso}
            tono={verNegocio ? 'azul' : 'gris'}
          />

          <div className="col-span-2 lg:col-span-1 [&>div]:h-full">
            <Cifra
              icono={TrendingUp}
              etiqueta="Ventas"
              valor={cifraNegocio(cop(stats.sales))}
              nota={verNegocio ? 'Sin contar los cancelados' : sinAcceso}
              tono={verNegocio ? 'verde' : 'gris'}
            />
          </div>

          <Cifra
            icono={Users}
            etiqueta="Clientes"
            valor={cifraNegocio(numero.format(stats.customers))}
            nota={verNegocio ? 'Con ficha guardada' : sinAcceso}
            tono={verNegocio ? 'azul' : 'gris'}
          />
          <Cifra
            icono={Eye}
            etiqueta="Vistas de fichas"
            valor={numero.format(stats.views)}
            nota="Aperturas desde la tienda"
            tono="gris"
          />
        </div>
      </section>

      <div className="space-y-5">
        {/* ── Ventas ──────────────────────────────────────────────────────── */}
        <PanelGrafico
          titulo="Ventas"
          // Sin acceso a pedidos no se dibuja ningún tramo: anunciar una
          // ventana de tiempo que no se va a ver solo confunde.
          descripcion={
            verNegocio
              ? `${tramo.tramo}. No se cuentan los pedidos cancelados.`
              : undefined
          }
          acciones={verNegocio ? pestanasVentas : undefined}
        >
          {!verNegocio ? (
            <SinDatos mensaje="Tu rol no tiene acceso a los pedidos, así que este gráfico no se puede mostrar." />
          ) : ventas.length === 0 ? (
            // serieVentas() devuelve una lista vacía solo cuando no queda
            // ningún pedido sin cancelar. Decir "aún no hay pedidos" cuando sí
            // los hay, pero todos cancelados, sería falso.
            <SinDatos
              mensaje={
                stats.orders > 0
                  ? 'Todos los pedidos registrados están cancelados, y esos no cuentan como venta.'
                  : 'Aún no hay pedidos registrados. Cuando registres el primero, aquí verás la evolución de las ventas.'
              }
            />
          ) : (
            <GraficoBarras datos={ventas} etiquetaSerie="Ventas" formato={cop} />
          )}
        </PanelGrafico>

        {/* ── Qué mira y qué compra la gente ──────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-2">
          <PanelGrafico
            titulo="Productos más vistos"
            descripcion="Fichas abiertas en la tienda."
          >
            {masVistos.length === 0 ? (
              <SinDatos mensaje="Aún nadie ha abierto una ficha de producto." />
            ) : (
              <GraficoBarrasH datos={masVistos} unidad="vistas" />
            )}
          </PanelGrafico>

          <PanelGrafico
            titulo="Más vendidos"
            descripcion="Unidades de los pedidos no cancelados."
          >
            {!verNegocio ? (
              <SinDatos mensaje="Tu rol no tiene acceso a los pedidos, así que este gráfico no se puede mostrar." />
            ) : masVendidos.length === 0 ? (
              <SinDatos mensaje="Aún no hay ventas registradas." />
            ) : (
              <GraficoBarrasH datos={masVendidos} unidad="unidades" />
            )}
          </PanelGrafico>
        </div>

        {/* ── Cómo está repartido el catálogo ─────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-2">
          <PanelGrafico
            titulo="Catálogo por plataforma"
            descripcion="Productos publicados en cada consola."
          >
            <GraficoAnillo datos={plataformas} unidad="productos" />
          </PanelGrafico>

          <PanelGrafico
            titulo="Categorías más populares"
            // Sin vistas todavía, serieCategorias() ordena por tamaño de
            // catálogo. Decirlo evita leer "productos" como si fuera interés.
            descripcion={
              categorias.medida === 'vistas'
                ? 'Ordenadas por vistas de ficha.'
                : 'Todavía no hay vistas: se ordenan por número de productos publicados.'
            }
          >
            <GraficoBarrasH datos={categorias.puntos} unidad={categorias.medida} />
          </PanelGrafico>
        </div>

        {/* ── Qué hay que reponer ─────────────────────────────────────────── */}
        {bajoStock.length > 0 && (
          <PanelGrafico
            titulo="Stock bajo"
            descripcion={`Publicados con ${pluralize(umbral, 'unidad', 'unidades')} o menos.`}
            acciones={
              <Link to="/admin/inventario" className="adm-btn-suave adm-btn-sm">
                Ver inventario
              </Link>
            }
          >
            <ul className="divide-y divide-slate-100">
              {bajoStock.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/admin/productos/${p.id}`}
                    className="-mx-2 flex min-h-[44px] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-slate-800">
                      {p.name}
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-slate-500">
                      {platformShort(p.platform)}
                    </span>
                    {/* tieneStockBajo() ya descartó el stock nulo; el ?? 0 es
                        solo para el compilador. */}
                    <span className="adm-num shrink-0">
                      <Etiqueta tono="ambar">
                        {pluralize(p.stock ?? 0, 'unidad', 'unidades')}
                      </Etiqueta>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {bajoStock.length > 6 && (
              <p className="mt-3 text-[12.5px] text-slate-500">
                Y {numero.format(bajoStock.length - 6)} más en la pantalla de inventario.
              </p>
            )}
          </PanelGrafico>
        )}
      </div>
    </>
  )
}
