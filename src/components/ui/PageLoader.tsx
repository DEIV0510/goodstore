/** Placeholder de carga entre rutas: reserva altura para evitar saltos. */
export default function PageLoader() {
  return (
    <div className="gg-container py-16" role="status" aria-live="polite">
      <span className="sr-only">Cargando contenido…</span>
      <div className="skeleton h-8 w-52 rounded-lg" />
      <div className="skeleton mt-4 h-4 w-full max-w-xl rounded" />
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="surface overflow-hidden">
            <div className="skeleton aspect-[3/4] w-full" />
            <div className="space-y-2 p-3">
              <div className="skeleton h-3 w-14 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="surface overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[3/4] w-full" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-3 w-12 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton mt-3 h-9 w-full rounded-lg" />
      </div>
    </div>
  )
}
