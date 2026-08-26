import { Loader2, ShieldAlert } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { AdminRole } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Portero del panel.
//
// Es la primera barrera, no la única ni la principal: aunque alguien se saltara
// esta comprobación desde la consola del navegador, la base de datos seguiría
// rechazando cada petición que su rol no permite (0002_permisos.sql).
// Esconder una pantalla no es seguridad; aquí solo evita callejones sin salida.
// ─────────────────────────────────────────────────────────────────────────────

export default function RutaProtegida({
  children,
  /** Roles admitidos. Sin lista, basta con tener sesión activa. */
  roles,
}: {
  children: React.ReactNode
  roles?: AdminRole[]
}) {
  const { perfil, cargando, configurado } = useAuth()
  const ubicacion = useLocation()

  if (!configurado) return <Navigate to="/admin/login" replace />

  // Mientras se resuelve si hay sesión no se decide nada: enviar al login aquí
  // expulsaría a quien sí tiene sesión cada vez que recarga la página.
  if (cargando) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-100" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <p className="text-[13px] font-medium">Comprobando la sesión…</p>
        </div>
      </div>
    )
  }

  if (!perfil) {
    // Se recuerda a dónde quería entrar, para llevarlo allí tras identificarse.
    return <Navigate to="/admin/login" replace state={{ destino: ubicacion.pathname }} />
  }

  if (roles && !roles.includes(perfil.role)) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="font-display text-xl font-bold text-slate-900">
          No tienes acceso a esta sección
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-slate-500">
          Tu rol es <strong>{perfil.role}</strong> y esta pantalla está reservada a otros
          perfiles. Si necesitas entrar, pídeselo a un super administrador.
        </p>
        <Link to="/admin" className="adm-btn-suave adm-btn-sm mt-5">
          Volver al panel
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
