import { CalendarDays, Clock, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { useAvisos } from '@/components/admin/Avisos'
import { useConfirmar } from '@/components/admin/Modal'
import {
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  Etiqueta,
} from '@/components/admin/UI'
import { useAuth } from '@/hooks/useAuth'
import {
  DESCRIPCION_ROL,
  ETIQUETA_ROL,
  actualizarMiNombre,
  cambiarContrasena,
  nuevoCodigo,
} from '@/services/autenticacion'

// ─────────────────────────────────────────────────────────────────────────────
// Mi perfil.
//
// Lo único que se edita aquí es el nombre. Ni el rol ni el estado: quien los
// cambia es un super administrador desde /admin/administradores, porque una
// cuenta que puede ascenderse sola no tiene ningún límite real.
//
// La contraseña sí se cambia aquí, pero pidiendo siempre la actual: una sesión
// abierta no basta para quedarse con la cuenta de otro.
// ─────────────────────────────────────────────────────────────────────────────

/** Fecha larga en español. Devuelve `vacio` cuando no hay dato. */
function fecha(iso: string | null | undefined, vacio: string): string {
  if (!iso) return vacio
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return vacio
  return f.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Fecha con hora: para el último acceso importa el «cuándo» exacto. */
function fechaHora(iso: string | null | undefined, vacio: string): string {
  if (!iso) return vacio
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return vacio
  return f.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function Perfil() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()
  const { perfil, cargando, cerrarSesion, refrescarPerfil } = useAuth()

  const [nombre, setNombre] = useState('')
  const [errorNombre, setErrorNombre] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [claveActual, setClaveActual] = useState('')
  const [claveNueva, setClaveNueva] = useState('')
  const [errorClave, setErrorClave] = useState<string | null>(null)
  const [cambiandoClave, setCambiandoClave] = useState(false)
  const [claveCodigo, setClaveCodigo] = useState('')
  const [codigo, setCodigo] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)

  // El campo se resincroniza con el perfil: `refrescarPerfil()` puede traer un
  // nombre distinto al que hay escrito (por ejemplo, si se cambió desde otra
  // pestaña) y el formulario no debe quedarse mostrando el viejo.
  useEffect(() => {
    setNombre(perfil?.name ?? '')
  }, [perfil?.name])

  async function guardarNombre(e: FormEvent) {
    e.preventDefault()
    const valor = nombre.trim()

    if (!valor) {
      setErrorNombre('Escribe tu nombre: es el que aparece en el historial de cambios.')
      return
    }

    setGuardando(true)
    try {
      await actualizarMiNombre(valor)
      // Sin esto, la barra lateral seguiría mostrando el nombre anterior hasta
      // la siguiente recarga completa de la página.
      await refrescarPerfil()
      avisos.exito('Nombre actualizado.')
    } catch (err) {
      // Sin base de datos conectada esto lanza a propósito; el aviso lo explica.
      avisos.error(err)
    } finally {
      setGuardando(false)
    }
  }

  async function guardarClave(e: FormEvent) {
    e.preventDefault()
    setErrorClave(null)

    if (claveNueva.length < 8) {
      setErrorClave('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (claveNueva === claveActual) {
      setErrorClave('La contraseña nueva tiene que ser distinta de la actual.')
      return
    }

    setCambiandoClave(true)
    try {
      await cambiarContrasena(claveActual, claveNueva)
      setClaveActual('')
      setClaveNueva('')
      avisos.exito('Contraseña actualizada.')
    } catch (err) {
      avisos.error(err)
    } finally {
      setCambiandoClave(false)
    }
  }

  async function generarCodigo(e: FormEvent) {
    e.preventDefault()
    setGenerando(true)
    try {
      // El código se muestra una sola vez: el servidor solo guarda su hash.
      setCodigo(await nuevoCodigo(claveCodigo))
      setClaveCodigo('')
    } catch (err) {
      avisos.error(err)
    } finally {
      setGenerando(false)
    }
  }

  async function salir() {
    const confirmado = await confirmar({
      titulo: '¿Cerrar sesión?',
      mensaje:
        'Volverás al inicio de sesión y tendrás que escribir tu correo y tu contraseña para entrar de nuevo. La tienda no se ve afectada.',
      confirmar: 'Cerrar sesión',
    })
    if (!confirmado) return

    try {
      await cerrarSesion()
    } catch (err) {
      avisos.error(err)
    }
  }

  if (cargando) return <Cargando texto="Cargando tu perfil…" />
  if (!perfil) {
    return (
      <ErrorEstado mensaje="No hay ninguna sesión activa. Vuelve a entrar al panel." />
    )
  }

  const sinCambios = nombre.trim() === perfil.name

  return (
    <>
      <Encabezado
        titulo="Mi perfil"
        descripcion="Tus datos y tu forma de entrar al panel."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* ── Datos de la cuenta ────────────────────────────────────────── */}
          <section className="adm-card-pad">
            <h2 className="adm-titulo">Datos de la cuenta</h2>
            <p className="adm-sub mt-1">
              Tu nombre es el que queda firmando cada cambio en el historial.
            </p>

            <form onSubmit={guardarNombre} className="mt-4 space-y-4" noValidate>
              <Entrada
                id="perfil-nombre"
                label="Nombre"
                requerido
                autoComplete="name"
                placeholder="Nombre y apellido"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value)
                  setErrorNombre(null)
                }}
                error={errorNombre ?? undefined}
              />

              <Entrada
                id="perfil-email"
                label="Correo electrónico"
                type="email"
                value={perfil.email}
                // Solo lectura, no deshabilitado: así se puede seleccionar y
                // copiar, y sigue leyéndose con el lector de pantalla.
                readOnly
                className="bg-slate-50 text-slate-500"
                ayuda="El correo no se puede cambiar desde aquí."
              />

              <div className="flex flex-wrap gap-2">
                <BotonGuardar guardando={guardando} disabled={sinCambios}>
                  Guardar cambios
                </BotonGuardar>
                {sinCambios && (
                  <p className="self-center text-[12.5px] text-slate-400">
                    No hay nada nuevo que guardar.
                  </p>
                )}
              </div>
            </form>
          </section>

          {/* ── Contraseña ────────────────────────────────────────────────── */}
          <section className="adm-card-pad">
            <h2 className="adm-titulo">Contraseña</h2>
            <p className="adm-sub mt-1">
              Se pide la actual aunque ya tengas la sesión abierta: si alguien se
              sentara ante tu equipo desatendido, no debería poder quedarse con la
              cuenta.
            </p>

            <form onSubmit={guardarClave} className="mt-4 space-y-3" noValidate>
              <Entrada
                label="Contraseña actual"
                type="password"
                autoComplete="current-password"
                value={claveActual}
                onChange={(e) => setClaveActual(e.target.value)}
              />
              <Entrada
                label="Contraseña nueva"
                type="password"
                autoComplete="new-password"
                value={claveNueva}
                onChange={(e) => setClaveNueva(e.target.value)}
                ayuda="Mínimo 8 caracteres. Que no la uses en otro sitio."
                error={errorClave ?? undefined}
              />
              <BotonGuardar guardando={cambiandoClave}>Cambiar contraseña</BotonGuardar>
            </form>
          </section>

          {/* ── Código de recuperación ────────────────────────────────────── */}
          <section className="adm-card-pad">
            <h2 className="adm-titulo">Código de recuperación</h2>
            <p className="adm-sub mt-1">
              Es lo que te deja volver a entrar si olvidas la contraseña. Genera uno
              nuevo si perdiste el anterior: el viejo deja de servir en ese momento.
            </p>

            {codigo ? (
              <div className="mt-4">
                <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4 text-center">
                  <p className="select-all font-mono text-[16px] font-bold tracking-wider text-blue-900">
                    {codigo}
                  </p>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-alert-600">
                  Guárdalo ahora: al salir de esta pantalla no se puede volver a ver.
                </p>
              </div>
            ) : (
              <form onSubmit={generarCodigo} className="mt-4 space-y-3" noValidate>
                <Entrada
                  label="Confirma tu contraseña"
                  type="password"
                  autoComplete="current-password"
                  value={claveCodigo}
                  onChange={(e) => setClaveCodigo(e.target.value)}
                  ayuda="Se pide para que nadie genere un código desde tu sesión abierta."
                />
                <button type="submit" disabled={generando} className="adm-btn-suave">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  {generando ? 'Generando…' : 'Generar un código nuevo'}
                </button>
              </form>
            )}
          </section>

          {/* ── Sesión ────────────────────────────────────────────────────── */}
          <section className="adm-card-pad">
            <h2 className="adm-titulo">Sesión</h2>
            <p className="adm-sub mt-1">
              La sesión queda guardada en este navegador y se renueva sola, así que sigue
              abierta la próxima vez que entres. Ciérrala tú si el equipo no es tuyo.
            </p>

            <button
              type="button"
              onClick={() => void salir()}
              className="adm-btn-peligro mt-4"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Cerrar sesión
            </button>
          </section>
        </div>

        {/* ── Rol y actividad ─────────────────────────────────────────────── */}
        <aside className="adm-card-pad h-fit">
          <h2 className="adm-titulo">Tu acceso</h2>

          <div className="mt-4 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-slate-900">
                {ETIQUETA_ROL[perfil.role]}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">
                {DESCRIPCION_ROL[perfil.role]}
              </p>
            </div>
          </div>

          <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
            El rol solo lo cambia un super administrador desde la pantalla de
            administradores.
          </p>

          <dl className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[12.5px] font-semibold text-slate-500">Estado</dt>
              <dd>
                <Etiqueta tono={perfil.status === 'activo' ? 'verde' : 'rojo'}>
                  {perfil.status === 'activo' ? 'Activo' : 'Suspendido'}
                </Etiqueta>
              </dd>
            </div>

            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                En el panel desde
              </dt>
              <dd className="adm-num text-right text-[12.5px] text-slate-700">
                {fecha(perfil.createdAt, '—')}
              </dd>
            </div>

            <div className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Último acceso
              </dt>
              <dd className="adm-num text-right text-[12.5px] text-slate-700">
                {fechaHora(perfil.lastLoginAt, 'Este es el primero')}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  )
}
