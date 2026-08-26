import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cliente, backendConfigurado, mensajeDeError } from '@/lib/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { cambiarContrasena } from '@/services/autenticacion'
import SinBackend from './SinBackend'

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla a la que lleva el enlace del correo de recuperación.
//
// Supabase abre una sesión temporal al abrir ese enlace; con ella se puede
// definir la contraseña nueva. Si se entra aquí sin venir del correo, no hay
// sesión y se dice claramente, en vez de mostrar un formulario que fallará.
// ─────────────────────────────────────────────────────────────────────────────

const MINIMO = 8

export default function NuevaClave() {
  const navegar = useNavigate()
  const [comprobando, setComprobando] = useState(true)
  const [haySesion, setHaySesion] = useState(false)
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [ver, setVer] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('gg-admin')
    document.title = 'Nueva contraseña · Panel GOOD GAME'
  }, [])

  useEffect(() => {
    let vivo = true
    let desuscribir: (() => void) | undefined

    void (async () => {
      const db = await cliente()
      if (!vivo) return
      if (!db) {
        setComprobando(false)
        return
      }

      // El enlace del correo trae el token en el fragmento de la URL; el
      // cliente lo procesa y emite PASSWORD_RECOVERY. Puede llegar antes o
      // después de este efecto, así que se contemplan las dos vías.
      const { data: sub } = db.auth.onAuthStateChange(
        (evento: AuthChangeEvent, sesion: Session | null) => {
          if (!vivo) return
          if (evento === 'PASSWORD_RECOVERY' || sesion) {
            setHaySesion(true)
            setComprobando(false)
          }
        }
      )
      desuscribir = () => sub.subscription.unsubscribe()

      const { data } = await db.auth.getSession()
      if (!vivo) return
      setHaySesion(Boolean(data.session))
      setComprobando(false)
    })()

    return () => {
      vivo = false
      desuscribir?.()
    }
  }, [])

  if (!backendConfigurado) return <SinBackend />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (clave.length < MINIMO) {
      setError(`La contraseña debe tener al menos ${MINIMO} caracteres.`)
      return
    }
    if (clave !== repetida) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setEnviando(true)
    try {
      await cambiarContrasena(clave)
      setListo(true)
      window.setTimeout(() => navegar('/admin', { replace: true }), 2200)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-ink-900 px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gold-500 font-display text-xl font-black text-ink-900 shadow-gold">
            GG
          </span>
          <p className="font-display text-2xl font-black leading-none tracking-tight text-white">
            GOOD GAME
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl sm:p-7">
          {comprobando ? (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-400" role="status">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <p className="text-[13px]">Comprobando el enlace…</p>
            </div>
          ) : listo ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
              <h1 className="mt-3 font-display text-[18px] font-bold text-slate-900">
                Contraseña actualizada
              </h1>
              <p className="mt-1.5 text-[13px] text-slate-500">
                Ya puedes usar el panel. Te llevamos allí…
              </p>
            </div>
          ) : !haySesion ? (
            <div className="text-center">
              <h1 className="font-display text-[18px] font-bold text-slate-900">
                Este enlace ya no sirve
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                Los enlaces de recuperación caducan al poco tiempo y solo se pueden usar
                una vez. Pide uno nuevo desde la pantalla de acceso.
              </p>
              <Link to="/admin/login" className="adm-btn-suave mt-5 w-full">
                Volver al acceso
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-[19px] font-bold text-slate-900">
                Crea tu contraseña
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                Elige una que no uses en otro sitio. Mínimo {MINIMO} caracteres.
              </p>

              <form onSubmit={enviar} className="mt-5 space-y-4" noValidate>
                <div>
                  <label htmlFor="clave-nueva" className="adm-label">
                    Contraseña nueva
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="clave-nueva"
                      type={ver ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      className="adm-input pl-9 pr-11"
                      aria-invalid={error ? true : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setVer((v) => !v)}
                      aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                      className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      {ver ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="clave-repetida" className="adm-label">
                    Repite la contraseña
                  </label>
                  <input
                    id="clave-repetida"
                    type={ver ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={repetida}
                    onChange={(e) => setRepetida(e.target.value)}
                    className="adm-input"
                    aria-invalid={error ? true : undefined}
                  />
                </div>

                {error && (
                  <p className="adm-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={enviando} className="adm-btn-primary w-full">
                  {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {enviando ? 'Guardando…' : 'GUARDAR CONTRASEÑA'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
