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
  pedirRecuperacion,
} from '@/services/autenticacion'

// ─────────────────────────────────────────────────────────────────────────────
// Mi perfil.
//
// Lo único que se edita aquí es el nombre. Ni el rol ni el estado: quien los
// cambia es un super administrador desde /admin/administradores, porque una
// cuenta que puede ascenderse sola no tiene ningún límite real.
//
// La contraseña tampoco se escribe en esta pantalla. Cambiarla es pedir el
// correo con el enlace: así la clave nueva solo la conoce quien tiene acceso a
// ese buzón, y esta aplicación no la ve pasar en ningún momento.
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
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)

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

  async function cambiarContrasena() {
    if (!perfil) return
    setEnviandoCorreo(true)
    try {
      await pedirRecuperacion(perfil.email)
      avisos.exito(`Te enviamos un correo a ${perfil.email} con el enlace para cambiarla.`)
    } catch (err) {
      avisos.error(err)
    } finally {
      setEnviandoCorreo(false)
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
              No se escribe aquí. Te llega un correo con un enlace y la nueva contraseña
              la eliges tú desde ahí, sin que pase por esta pantalla.
            </p>

            <button
              type="button"
              onClick={() => void cambiarContrasena()}
              disabled={enviandoCorreo}
              className="adm-btn-suave mt-4"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {enviandoCorreo ? 'Enviando el correo…' : 'Cambiar contraseña'}
            </button>

            <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">
              El enlace llega a <strong className="text-slate-700">{perfil.email}</strong>,
              solo sirve una vez y caduca al poco tiempo. Si no lo ves, revisa la carpeta
              de spam.
            </p>
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
