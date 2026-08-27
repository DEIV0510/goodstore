import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { recuperar } from '@/services/autenticacion'
import { mensajeDeError } from '@/lib/api'
import SinBackend from './SinBackend'

// ─────────────────────────────────────────────────────────────────────────────
// Puerta del panel.
//
// Tres situaciones, una sola pantalla:
//
//   instalar    no hay ninguna cuenta todavía → se crea la principal
//   entrar      hay cuenta → correo y contraseña
//   recuperar   se perdió la contraseña → código de recuperación
//
// La contraseña no se compara aquí ni existe en ninguna parte del proyecto:
// viaja al servidor, que la coteja contra un hash bcrypt y la descarta.
// ─────────────────────────────────────────────────────────────────────────────

type Modo = 'instalar' | 'entrar' | 'recuperar'

export default function Login() {
  const { perfil, cargando, apiViva, instalado, rescate, errorApi, iniciarSesion, instalar } =
    useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const destino = (ubicacion.state as { destino?: string } | null)?.destino ?? '/admin'

  const [modo, setModo] = useState<Modo | null>(null)
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [clave, setClave] = useState('')
  const [codigo, setCodigo] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codigoNuevo, setCodigoNuevo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const campoEmail = useRef<HTMLInputElement>(null)

  // El panel usa superficies claras; esta pantalla es azul de marca a pantalla
  // completa, así que se retira esa marca mientras esté visible.
  useEffect(() => {
    document.documentElement.classList.remove('gg-admin')
    document.title = 'Acceso · Panel GOOD GAME'
  }, [])

  // El modo lo decide el servidor: si no hay cuenta creada, lo primero es
  // crearla. Se calcula una vez, cuando llega el estado.
  useEffect(() => {
    if (cargando || modo !== null) return
    setModo(!instalado || rescate ? 'instalar' : 'entrar')
  }, [cargando, instalado, rescate, modo])

  useEffect(() => {
    campoEmail.current?.focus()
  }, [modo])

  if (cargando) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-900" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" aria-hidden="true" />
      </div>
    )
  }

  // La API no responde: casi siempre significa que el hosting no está
  // ejecutando PHP o que faltan archivos por subir.
  if (!apiViva) return <SinBackend mensaje={errorApi} />

  // Con sesión abierta no tiene sentido mostrar el formulario.
  if (perfil && !codigoNuevo) return <Navigate to={destino} replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)

    try {
      if (modo === 'instalar') {
        if (!email.trim()) throw new Error('Escribe tu correo electrónico.')
        if (clave.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
        setCodigoNuevo(await instalar(email, nombre, clave))
        return
      }

      if (modo === 'recuperar') {
        if (!email.trim() || !codigo.trim()) {
          throw new Error('Escribe tu correo y el código de recuperación.')
        }
        if (clave.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
        const r = await recuperar(email, codigo, clave)
        setCodigoNuevo(r.codigo)
        return
      }

      if (!email.trim() || !clave) throw new Error('Escribe tu correo y tu contraseña.')
      await iniciarSesion(email, clave)
      navegar(destino, { replace: true })
    } catch (err) {
      setError(mensajeDeError(err))
      setClave('')
    } finally {
      setEnviando(false)
    }
  }

  // ── Código de recuperación recién generado ────────────────────────────────
  // Se enseña UNA vez: el servidor solo guarda su hash y no hay forma de
  // volver a verlo. Por eso la pantalla insiste tanto en guardarlo.
  if (codigoNuevo) {
    return (
      <Marco>
        <div className="text-center">
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="font-display text-[19px] font-bold text-slate-900">
            Guarda este código
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
            Es lo único que te permitirá volver a entrar si olvidas la contraseña.
            <strong className="text-slate-900"> No se puede volver a ver.</strong>
          </p>
        </div>

        <div className="mt-5 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4 text-center">
          <p className="adm-num select-all font-mono text-[17px] font-bold tracking-wider text-blue-900">
            {codigoNuevo}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(codigoNuevo).then(() => {
              setCopiado(true)
              window.setTimeout(() => setCopiado(false), 2200)
            })
          }}
          className="adm-btn-suave mt-3 w-full"
        >
          {copiado ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copiar el código
            </>
          )}
        </button>

        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">
          Guárdalo donde guardas tus contraseñas, o escríbelo en papel. Si lo pierdes
          y olvidas la contraseña, la única salida es crear un archivo llamado
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[11.5px]">
            RESCATE.txt
          </code>
          en la carpeta de datos desde el administrador de archivos del hosting.
        </p>

        <button
          type="button"
          onClick={() => navegar('/admin', { replace: true })}
          className="adm-btn-primary mt-5 w-full"
        >
          Ya lo guardé, entrar al panel
        </button>
      </Marco>
    )
  }

  const titulos: Record<Modo, { titulo: string; sub: string }> = {
    instalar: {
      titulo: rescate ? 'Restablecer el acceso' : 'Crea tu cuenta',
      sub: rescate
        ? 'Se detectó una petición de rescate. Define de nuevo la cuenta principal.'
        : 'Eres la primera persona que entra: esta será la cuenta principal.',
    },
    entrar: {
      titulo: 'Panel de administración',
      sub: 'Gestiona tu tienda desde un solo lugar.',
    },
    recuperar: {
      titulo: 'Recuperar el acceso',
      sub: 'Escribe el código que guardaste al crear la cuenta.',
    },
  }
  const t = titulos[modo ?? 'entrar']

  return (
    <Marco>
      <h1 className="font-display text-[19px] font-bold text-slate-900">{t.titulo}</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t.sub}</p>

      <form onSubmit={enviar} className="mt-5 space-y-4" noValidate>
        {modo === 'instalar' && (
          <div>
            <label htmlFor="admin-nombre" className="adm-label">
              Tu nombre
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="admin-nombre"
                type="text"
                autoComplete="name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Cómo quieres que te llame el panel"
                className="adm-input pl-9"
              />
            </div>
          </div>
        )}

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

        {modo === 'recuperar' && (
          <div>
            <label htmlFor="admin-codigo" className="adm-label">
              Código de recuperación
            </label>
            <input
              id="admin-codigo"
              type="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="ABCDE-FGHJK-LMNPQ-RSTUV"
              className="adm-input font-mono tracking-wider"
            />
          </div>
        )}

        <div>
          <label htmlFor="admin-clave" className="adm-label">
            {modo === 'entrar' ? 'Contraseña' : 'Contraseña nueva'}
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="admin-clave"
              type={verClave ? 'text' : 'password'}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
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
          {modo !== 'entrar' && (
            <p className="adm-ayuda">Mínimo 8 caracteres. Que no la uses en otro sitio.</p>
          )}
        </div>

        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={enviando} className="adm-btn-primary w-full">
          {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {enviando
            ? 'Un momento…'
            : modo === 'instalar'
              ? 'CREAR LA CUENTA'
              : modo === 'recuperar'
                ? 'RESTABLECER'
                : 'INICIAR SESIÓN'}
        </button>

        {modo !== 'instalar' && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setModo(modo === 'entrar' ? 'recuperar' : 'entrar')
                setError(null)
                setClave('')
                setCodigo('')
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
        )}
      </form>
    </Marco>
  )
}

/** Fondo de marca compartido por todas las pantallas de acceso. */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink-900 px-4 py-10">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(168deg,#141BA4_0%,#0C1287_38%,#070C42_100%)]" />
        <div className="absolute inset-0 bg-tech opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_35%,#000_10%,transparent_80%)]" />
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-400/25 blur-[120px]" />
        <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-gold-500/10 blur-[110px]" />
      </div>

      <div className="relative w-full max-w-[420px] animate-fade-up">
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
          {children}
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
