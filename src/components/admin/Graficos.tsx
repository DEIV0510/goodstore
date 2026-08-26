import { BarChart3 } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import type { SeriesPoint } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Gráficos del panel.
//
// Dibujados a mano en SVG, sin librería: pesan poco, se adaptan solos y usan
// exactamente los colores de la marca.
//
// Reglas que se respetan en todos:
//   · Sin datos suficientes NO se dibuja nada: se explica que aún no los hay.
//     Un gráfico relleno con cifras de ejemplo engaña a quien mira el negocio.
//   · Cada serie lleva su valor visible o accesible; el color nunca es la única
//     fuente de información.
//   · Los colores de datos superan 3:1 sobre blanco. El amarillo de marca no se
//     usa para datos porque sobre blanco no llega a ese contraste; queda para
//     acentos de interacción.
// ─────────────────────────────────────────────────────────────────────────────

/** Paleta categórica: azules de marca al frente, apoyos con buen contraste. */
export const COLORES = [
  '#141BA4', // azul 700 de marca
  '#3641DC', // azul 500
  '#0E7490', // cian 700
  '#B45309', // ámbar 700
  '#047857', // esmeralda 700
  '#BE123C', // rosa 700
]

const formatoCorto = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const formatoLargo = new Intl.NumberFormat('es-CO')

export function SinDatos({ mensaje }: { mensaje?: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 px-4 text-center">
      <BarChart3 className="h-6 w-6 text-slate-300" aria-hidden="true" />
      <p className="max-w-xs text-[13px] leading-relaxed text-slate-400">
        {mensaje ?? 'Aún no hay suficientes datos para generar este gráfico.'}
      </p>
    </div>
  )
}

export function Panel({
  titulo,
  descripcion,
  acciones,
  children,
}: {
  titulo: string
  descripcion?: string
  acciones?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="adm-card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-slate-900">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-[12.5px] text-slate-500">{descripcion}</p>}
        </div>
        {acciones}
      </header>
      {children}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Barras verticales — evolución en el tiempo
// ─────────────────────────────────────────────────────────────────────────────

export function GraficoBarras({
  datos,
  formato = (v) => formatoLargo.format(v),
  etiquetaSerie,
}: {
  datos: SeriesPoint[]
  formato?: (v: number) => string
  /** Se usa en el resumen que lee el lector de pantalla. */
  etiquetaSerie: string
}) {
  const [activo, setActivo] = useState<number | null>(null)
  const idResumen = useId()

  const maximo = useMemo(() => Math.max(...datos.map((d) => d.value), 1), [datos])

  // Todo a cero significa que el periodo existe pero no hubo movimiento: eso sí
  // es información, y se dibuja la línea base con el aviso correspondiente.
  const todoCero = datos.every((d) => d.value === 0)
  if (datos.length === 0) return <SinDatos />

  const ANCHO = 720
  const ALTO = 220
  const MARGEN = { arriba: 18, derecha: 8, abajo: 30, izquierda: 46 }
  const areaAncho = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const areaAlto = ALTO - MARGEN.arriba - MARGEN.abajo
  const paso = areaAncho / datos.length
  const anchoBarra = Math.min(paso * 0.62, 46)

  // Cuatro marcas en el eje: suficientes para leer, sin saturar.
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maximo * f))

  const total = datos.reduce((n, d) => n + d.value, 0)
  const mayor = datos.reduce((a, b) => (b.value > a.value ? b : a), datos[0])

  return (
    <figure className="m-0">
      <p id={idResumen} className="sr-only">
        {`${etiquetaSerie}: ${datos.length} tramos, total ${formato(total)}. ` +
          (todoCero
            ? 'Sin movimiento en el periodo.'
            : `El valor más alto es ${formato(mayor.value)} en ${mayor.label}.`)}
      </p>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="h-[220px] w-full"
        role="img"
        aria-describedby={idResumen}
        aria-label={etiquetaSerie}
      >
        {/* Rejilla: discreta, no debe competir con los datos */}
        {marcas.map((m, i) => {
          const y = MARGEN.arriba + areaAlto - (m / maximo) * areaAlto
          return (
            <g key={i}>
              <line
                x1={MARGEN.izquierda}
                x2={ANCHO - MARGEN.derecha}
                y1={y}
                y2={y}
                stroke={i === 0 ? '#cbd5e1' : '#f1f5f9'}
                strokeWidth={1}
              />
              <text
                x={MARGEN.izquierda - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 11 }}
              >
                {formatoCorto.format(m)}
              </text>
            </g>
          )
        })}

        {datos.map((d, i) => {
          const alto = todoCero ? 0 : (d.value / maximo) * areaAlto
          const x = MARGEN.izquierda + i * paso + (paso - anchoBarra) / 2
          const y = MARGEN.arriba + areaAlto - alto
          const resaltada = activo === i
          return (
            <g key={`${d.label}-${i}`}>
              {/* Zona sensible ancha: en móvil el dedo no acierta una barra fina */}
              <rect
                x={MARGEN.izquierda + i * paso}
                y={MARGEN.arriba}
                width={paso}
                height={areaAlto}
                fill="transparent"
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${d.label}: ${formato(d.value)}`}
              >
                <title>{`${d.label}: ${formato(d.value)}`}</title>
              </rect>

              <rect
                x={x}
                y={y}
                width={anchoBarra}
                height={Math.max(alto, d.value > 0 ? 2 : 0)}
                rx={4}
                fill={resaltada ? '#3641DC' : '#141BA4'}
                className="pointer-events-none transition-[fill] duration-150"
              />

              {resaltada && d.value > 0 && (
                <text
                  x={x + anchoBarra / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="pointer-events-none fill-slate-900"
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  {formato(d.value)}
                </text>
              )}

              <text
                x={MARGEN.izquierda + i * paso + paso / 2}
                y={ALTO - 10}
                textAnchor="middle"
                className="pointer-events-none fill-slate-400"
                style={{ fontSize: 11 }}
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>

      {todoCero && (
        <figcaption className="mt-1 text-center text-[12.5px] text-slate-400">
          No hubo movimiento en este periodo.
        </figcaption>
      )}
    </figure>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Barras horizontales — comparación con nombres largos
//
// Los títulos de videojuegos son largos: en vertical habría que rotarlos y se
// vuelven ilegibles, sobre todo en móvil.
// ─────────────────────────────────────────────────────────────────────────────

export function GraficoBarrasH({
  datos,
  unidad,
  formato = (v) => formatoLargo.format(v),
}: {
  datos: SeriesPoint[]
  unidad: string
  formato?: (v: number) => string
}) {
  const maximo = useMemo(() => Math.max(...datos.map((d) => d.value), 1), [datos])
  if (datos.length === 0) return <SinDatos />

  return (
    <ul className="space-y-2.5">
      {datos.map((d, i) => (
        <li key={`${d.label}-${i}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] font-medium text-slate-700" title={d.label}>
              {d.label}
            </span>
            <span className="adm-num shrink-0 text-[12.5px] font-bold text-slate-900">
              {formato(d.value)}
              <span className="ml-1 font-medium text-slate-400">{unidad}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max((d.value / maximo) * 100, 2)}%`,
                background: COLORES[i % COLORES.length],
              }}
              role="img"
              aria-label={`${d.label}: ${formato(d.value)} ${unidad}`}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Anillo — reparto de un total
//
// Solo para pocos grupos: con más de seis, las porciones dejan de distinguirse
// y una lista de barras se lee mucho mejor.
// ─────────────────────────────────────────────────────────────────────────────

export function GraficoAnillo({
  datos,
  unidad,
}: {
  datos: SeriesPoint[]
  unidad: string
}) {
  const total = useMemo(() => datos.reduce((n, d) => n + d.value, 0), [datos])
  if (datos.length === 0 || total === 0) return <SinDatos />

  if (datos.length > 6) {
    return <GraficoBarrasH datos={datos} unidad={unidad} />
  }

  const RADIO = 62
  const GROSOR = 22
  const circunferencia = 2 * Math.PI * RADIO
  let acumulado = 0

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <svg viewBox="0 0 160 160" className="h-[150px] w-[150px] shrink-0" role="img"
        aria-label={`Reparto por ${unidad}: ${datos
          .map((d) => `${d.label} ${Math.round((d.value / total) * 100)} por ciento`)
          .join(', ')}`}
      >
        <g transform="translate(80,80) rotate(-90)">
          <circle r={RADIO} fill="none" stroke="#f1f5f9" strokeWidth={GROSOR} />
          {datos.map((d, i) => {
            const fraccion = d.value / total
            const largo = fraccion * circunferencia
            const desfase = acumulado
            acumulado += largo
            return (
              <circle
                key={`${d.label}-${i}`}
                r={RADIO}
                fill="none"
                stroke={COLORES[i % COLORES.length]}
                strokeWidth={GROSOR}
                strokeDasharray={`${Math.max(largo - 2, 0)} ${circunferencia}`}
                strokeDashoffset={-desfase}
                strokeLinecap="butt"
              >
                <title>{`${d.label}: ${formatoLargo.format(d.value)} (${Math.round(
                  fraccion * 100
                )} %)`}</title>
              </circle>
            )
          })}
        </g>
        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="fill-slate-900"
          style={{ fontSize: 22, fontWeight: 800 }}
        >
          {formatoCorto.format(total)}
        </text>
        <text
          x="80"
          y="94"
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontSize: 11 }}
        >
          {unidad}
        </text>
      </svg>

      {/* Leyenda con el valor escrito: el color no es la única pista */}
      <ul className="w-full min-w-0 space-y-1.5">
        {datos.map((d, i) => (
          <li key={`${d.label}-${i}`} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: COLORES[i % COLORES.length] }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600">
              {d.label}
            </span>
            <span className="adm-num shrink-0 text-[12.5px] font-bold text-slate-900">
              {formatoLargo.format(d.value)}
            </span>
            <span className="adm-num w-10 shrink-0 text-right text-[12px] text-slate-400">
              {Math.round((d.value / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
