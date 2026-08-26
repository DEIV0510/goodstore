import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock, Mail } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { pedirRecuperacion } from '@/services/autenticacion'
import { mensajeDeError } from '@/lib/supabase'
import SinBackend from './SinBackend'

// ─────────────────────────────────────────────────────────────────────────────
// Acceso al panel.
//
// La contraseña no se compara aquí ni existe en ninguna parte del proyecto: se
// envía cifrada a Supabase Auth, que es quien la verifica contra su hash. Este
// componente solo pinta el formulario y muestra el resultado.
// ─────────────────────────────────────────────────────────────────────────────

export default function Login() {
  const { perfil, cargando, configurado, iniciarSesion } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const destino = (ubicacion.state as { destino?: string } | null)?.destino ?? '/admin'

  const [modo, setModo] = useState<'entrar' | 'recuperar'>('entrar')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const campoEmail = useRef<HTMLInputElement>(null)

  // El panel usa superficies claras; el login es azul de marca a pantalla
  // completa, así que se retira esa marca mientras esté visible.
  useEffect(() => {
    document.documentElement.classList.remove('gg-admin')
    document.title = 'Acceso · Panel GOOD GAME'
  }, [])

  useEffect(() => {
    campoEmail.current?.focus()
  }, [modo])

  if (!configurado) return <SinBackend />

  // Con sesión abierta no tiene sentido mostrar el formulario.
  if (!cargando && perfil) return <Navigate to={destino} replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (modo === 'recuperar') {
      if (!email.trim()) {
        setError('Escribe el correo de tu cuenta.')
        campoEmail.current?.focus()
        return
      }
      setEnviando(true)
      try {
        await pedirRecuperacion(email)
        setEnviado(true)
      } catch (err) {
        setError(mensajeDeError(err))
      } finally {
        setEnviando(false)
      }
      return
    }

    if (!email.trim() || !clave) {
      setError('Escribe tu correo y tu contraseña.')
      return
    }

    setEnviando(true)
    try {
      await iniciarSesion(email, clave)
      navegar(destino, { replace: true })
    } catch (err) {
      setError(mensajeDeError(err))
      setClave('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink-900 px-4 py-10">
      {/* Fondo de marca */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(168deg,#141BA4_0%,#0C1287_38%,#070C42_100%)]" />
        <div className="absolute inset-0 bg-tech opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_35%,#000_10%,transparent_80%)]" />
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-400/25 blur-[120px]" />
        <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-gold-500/10 blur-[110px]" />
      </div>

      <div className="relative w-full max-w-[400px] animate-fade-up">
        {/* Marca */}
        <div className="mb-6 text-center">
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

        <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl sm:p-7">
          <h1 className="font-display text-[19px] font-bold text-slate-900">
            {modo === 'entrar' ? 'Panel de administración' : 'Recuperar contraseña'}
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
            {modo === 'entrar'
              ? 'Gestiona tu tienda desde un solo lugar.'
              : 'Te enviamos un enlace para crear una contraseña nueva.'}
          </p>

          {enviado ? (
            <div className="mt-5">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[13px] leading-relaxed text-emerald-800">
                  Si <strong>{email}</strong> corresponde a una cuenta de este panel,
                  recibirás un correo con el enlace para cambiar la contraseña. Revisa
                  también la carpeta de correo no deseado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEnviado(false)
                  setModo('entrar')
                }}
                className="adm-btn-suave mt-4 w-full"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Volver al acceso
              </button>
            </div>
          ) : (
            <form onSubmit={enviar} className="mt-5 space-y-4" noValidate>
              <div>
                <label htmlFor="admin-email" className="adm-label">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    ref={campoEmail}
                    id="admin-email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    className="adm-input pl-9"
                    aria-invalid={error ? true : undefined}
                  />
                </div>
              </div>

              {modo === 'entrar' && (
                <div>
                  <label htmlFor="admin-clave" className="adm-label">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="admin-clave"
                      type={verClave ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      placeholder="••••••••"
                      className="adm-input pl-9 pr-11"
                      aria-invalid={error ? true : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setVerClave((v) => !v)}
                      aria-label={verClave ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                      className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      {verClave ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="adm-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={enviando} className="adm-btn-primary w-full">
                {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {enviando
                  ? modo === 'entrar'
                    ? 'Entrando…'
                    : 'Enviando…'
                  : modo === 'entrar'
                    ? 'INICIAR SESIÓN'
                    : 'ENVIAR ENLACE'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setModo(modo === 'entrar' ? 'recuperar' : 'entrar')
                    setError(null)
                  }}
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[13px] font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                >
                  {modo === 'entrar' ? (
                    <>
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      ¿Olvidaste tu contraseña?
                    </>
                  ) : (
                    <>
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      Volver al acceso
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-[12.5px] text-white/45">
          <Link to="/" className="rounded px-2 py-1 hover:text-white hover:underline">
            ← Ir a la tienda
          </Link>
        </p>
      </div>
    </div>
  )
}
