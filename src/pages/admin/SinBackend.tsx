import { RefreshCw, ServerCrash } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────────
// La API no responde.
//
// No es un estado normal: los archivos de la API se publican junto con la
// tienda, así que si el sitio está en línea, la API debería estarlo. Cuando
// falla, casi siempre es una de tres cosas, y se dicen las tres.
//
// La tienda pública, mientras tanto, sigue funcionando: tiene su catálogo de
// respaldo y no depende de que la API conteste.
// ─────────────────────────────────────────────────────────────────────────────

const CAUSAS = [
  {
    titulo: 'Falta subir la carpeta «api»',
    detalle:
      'Al publicar el sitio hay que subir TODO el contenido de dist/, incluida la ' +
      'carpeta api y el archivo .htaccess. Los administradores de archivos suelen ' +
      'ocultar los archivos que empiezan por punto: activa «mostrar archivos ocultos».',
  },
  {
    titulo: 'El hosting no está ejecutando PHP',
    detalle:
      'En hPanel → Avanzado → Configuración PHP, comprueba que la versión sea 8.0 ' +
      'o superior y que la extensión pdo_sqlite esté activada.',
  },
  {
    titulo: 'El servidor no permite reescribir direcciones',
    detalle:
      'La API necesita mod_rewrite, que Hostinger trae activado. Si el sitio está ' +
      'en otro servidor, comprueba que el .htaccess se esté aplicando.',
  },
]

export default function SinBackend({ mensaje }: { mensaje?: string | null }) {
  useEffect(() => {
    document.documentElement.classList.remove('gg-admin')
    document.title = 'Panel no disponible · GOOD GAME'
  }, [])

  return (
    <div className="min-h-dvh bg-ink-900 px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gold-500 font-display text-xl font-black text-ink-900 shadow-gold">
            GG
          </span>
          <p className="font-display text-2xl font-black leading-none tracking-tight text-white">
            GOOD GAME
          </p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[.32em] text-gold-500">
            Admin panel
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <ServerCrash className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[19px] font-bold text-slate-900">
                El panel no puede conectar con el servidor
              </h1>
              {mensaje && (
                <p className="mt-1.5 rounded-md bg-slate-100 px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-600">
                  {mensaje}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[13px] leading-relaxed text-slate-600">
              <strong className="text-slate-900">La tienda no está afectada.</strong> Sigue
              publicada y funcionando con su catálogo. Esto solo impide administrarla
              desde aquí.
            </p>
          </div>

          <p className="mt-6 text-[13px] font-bold text-slate-900">
            Las tres causas habituales:
          </p>
          <ol className="mt-3 space-y-4">
            {CAUSAS.map((c, i) => (
              <li key={c.titulo} className="flex gap-3.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-900 text-[11.5px] font-bold text-gold-500">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-slate-900">{c.titulo}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">
                    {c.detalle}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="adm-btn-primary"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Volver a intentar
            </button>
            <Link to="/" className="adm-btn-suave">
              Ir a la tienda
            </Link>
          </div>

          <p className="mt-5 text-[12.5px] leading-relaxed text-slate-400">
            El detalle completo está en{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11.5px] text-slate-700">
              ADMIN.md
            </code>
            , en la carpeta del proyecto.
          </p>
        </div>
      </div>
    </div>
  )
}
