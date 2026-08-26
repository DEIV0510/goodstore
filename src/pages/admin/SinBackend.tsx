import { Database, ExternalLink } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla que se muestra cuando el panel todavía no tiene base de datos.
//
// Deliberadamente NO hay un formulario de acceso: un login que no comprueba
// nada da una falsa sensación de seguridad. Mientras no haya un servicio de
// autenticación real detrás, aquí no se entra.
//
// La tienda pública, mientras tanto, sigue funcionando con normalidad.
// ─────────────────────────────────────────────────────────────────────────────

const PASOS = [
  {
    titulo: 'Crea el proyecto en Supabase',
    detalle:
      'Entra a supabase.com con tu cuenta y crea un proyecto nuevo. Elige la región más cercana a Colombia (East US suele ser la mejor).',
  },
  {
    titulo: 'Ejecuta las migraciones',
    detalle:
      'En el editor SQL del proyecto, pega y ejecuta en orden los cuatro archivos de supabase/migrations/. Crean las tablas, los permisos, la auditoría y el depósito de imágenes.',
  },
  {
    titulo: 'Copia las credenciales',
    detalle:
      'En Project Settings → API copia la URL y la clave anónima (anon public). La clave de servicio NO se usa aquí y no debe salir nunca del servidor.',
  },
  {
    titulo: 'Crea el archivo .env',
    detalle:
      'Duplica .env.example como .env, pega ahí las dos credenciales y reinicia el servidor de desarrollo.',
  },
  {
    titulo: 'Crea tu cuenta de administrador',
    detalle:
      'En Authentication → Users del panel de Supabase, añade tu usuario con correo y contraseña. El primero que se registra queda como super administrador automáticamente.',
  },
  {
    titulo: 'Carga el catálogo',
    detalle:
      'Ejecuta npm run sembrar para subir a la base de datos los 318 productos, las categorías, las preguntas frecuentes y la configuración que hoy tiene la tienda.',
  },
]

export default function SinBackend() {
  useEffect(() => {
    document.documentElement.classList.remove('gg-admin')
    document.title = 'Configurar el panel · GOOD GAME'
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
              <Database className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[19px] font-bold text-slate-900">
                Falta conectar la base de datos
              </h1>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
                El panel está construido y listo, pero todavía no tiene detrás un
                servicio de autenticación real. No se muestra un formulario de acceso
                porque un inicio de sesión que no verifica nada no protegería nada.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[13px] leading-relaxed text-slate-600">
              <strong className="text-slate-900">La tienda no está afectada.</strong>{' '}
              Sigue publicada y funcionando con su catálogo actual. Conectar la base de
              datos es lo que permite editarla desde aquí en vez de tocar el código.
            </p>
          </div>

          <ol className="mt-6 space-y-4">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="flex gap-3.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-900 text-[11.5px] font-bold text-gold-500">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-slate-900">{p.titulo}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">
                    {p.detalle}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="adm-btn-primary"
            >
              Abrir Supabase
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link to="/" className="adm-btn-suave">
              Ir a la tienda
            </Link>
          </div>

          <p className="mt-5 text-[12.5px] leading-relaxed text-slate-400">
            Los pasos completos, con el detalle de cada variable, están en el archivo{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11.5px] text-slate-700">
              ADMIN.md
            </code>{' '}
            del proyecto.
          </p>
        </div>
      </div>
    </div>
  )
}
