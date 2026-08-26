import { Mail, ShieldCheck, UserCheck, UserMinus, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { useAvisos } from '@/components/admin/Avisos'
import { Modal, useConfirmar } from '@/components/admin/Modal'
import { Tabla, type Columna } from '@/components/admin/Tabla'
import {
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
} from '@/components/admin/UI'
import { useAuth } from '@/hooks/useAuth'
import { backendConfigurado } from '@/lib/supabase'
import { DESCRIPCION_ROL, ETIQUETA_ROL } from '@/services/autenticacion'
import {
  cambiarEstadoAdmin,
  cambiarRol,
  invitarAdministrador,
  listarAdministradores,
} from '@/services/equipo'
import type { AdminProfile, AdminRole } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Administradores.
//
// Dos reglas gobiernan esta pantalla:
//
//   · Nadie se edita a sí mismo. Ni el rol ni el estado: un super administrador
//     que se degrada o se suspende por descuido deja el panel sin dueño y ya no
//     hay forma de arreglarlo desde aquí. Por eso su propia fila va bloqueada.
//   · Aquí no se escriben contraseñas. Invitar es mandar un correo para que la
//     persona cree la suya; esta aplicación nunca ve ni guarda esa clave.
//   · Invitar NO da de alta a nadie. El correo sale por el flujo de recuperación
//     de contraseña (`invitarAdministrador` en services/equipo.ts), y ese flujo
//     solo escribe a direcciones que ya existen en Supabase Auth: crear el
//     usuario sin su clave de servicio exigiría tener esa clave en el navegador,
//     que es justo lo que no se hace. Por eso la pantalla no promete un correo
//     que quizá no salga; el alta se hace en Supabase (Authentication → Users),
//     como explica ADMIN.md.
//
// Lo que se ve o se esconde en esta tabla no es la seguridad real: las políticas
// de la base de datos vuelven a comprobar cada cambio por su cuenta.
// ─────────────────────────────────────────────────────────────────────────────

/** Orden de mayor a menor permiso: sirve para la lista, el <select> y el orden. */
const ROLES: AdminRole[] = ['super_admin', 'admin', 'editor']

const ID_FORM_INVITAR = 'form-invitar-admin'

/** Fecha corta en español. Nunca devuelve «Invalid Date». */
function fecha(iso: string | null | undefined, vacio: string): string {
  if (!iso) return vacio
  const f = new Date(iso)
  if (Number.isNaN(f.getTime())) return vacio
  return f.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Con qué llamar a alguien cuando todavía no ha puesto su nombre. */
const comoSeLlama = (a: AdminProfile) => a.name || a.email

// Los dos controles de fila viven FUERA del componente de pantalla a propósito:
// declarados dentro, React los trataría como un tipo nuevo en cada render y el
// <select> perdería el foco justo al cambiar un rol.

function SelectorRol({
  admin,
  esYo,
  bloqueado,
  vista,
  onCambiar,
}: {
  admin: AdminProfile
  esYo: boolean
  bloqueado: boolean
  /** La tabla y las tarjetas de móvil están las dos en el DOM a la vez, así que
      el id lleva la vista dentro: repetirlo rompería la relación etiqueta-campo. */
  vista: 'tabla' | 'movil'
  onCambiar: (rol: AdminRole) => void
}) {
  const id = `rol-${vista}-${admin.id}`
  const idAyuda = `${id}-ayuda`
  return (
    <div className="min-w-[180px]">
      {/* El encabezado «Rol» de la columna no llega a móvil: la etiqueta oculta
          es lo que le dice al lector de pantalla de quién es este control. */}
      <label htmlFor={id} className="sr-only">
        Rol de {comoSeLlama(admin)}
      </label>
      <select
        id={id}
        value={admin.role}
        disabled={esYo || bloqueado}
        aria-describedby={esYo ? idAyuda : undefined}
        onChange={(e) => onCambiar(e.target.value as AdminRole)}
        className="adm-select text-[13px]"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ETIQUETA_ROL[r]}
          </option>
        ))}
      </select>
      {esYo && (
        <p id={idAyuda} className="adm-ayuda">
          No puedes cambiar tu propio rol.
        </p>
      )}
    </div>
  )
}

function BotonEstado({
  admin,
  esYo,
  bloqueado,
  onAlternar,
  ancho,
}: {
  admin: AdminProfile
  esYo: boolean
  bloqueado: boolean
  onAlternar: () => void
  /** En móvil el botón ocupa todo el ancho de la tarjeta. */
  ancho?: boolean
}) {
  const suspender = admin.status === 'activo'
  const Icono = suspender ? UserMinus : UserCheck
  return (
    <button
      type="button"
      disabled={esYo || bloqueado}
      onClick={onAlternar}
      aria-label={`${suspender ? 'Suspender' : 'Reactivar'} a ${comoSeLlama(admin)}`}
      title={esYo ? 'No puedes suspender tu propia cuenta' : undefined}
      className={`adm-btn-suave adm-btn-sm ${ancho ? 'w-full' : ''} ${
        suspender ? 'text-alert-600' : ''
      }`}
    >
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {suspender ? 'Suspender' : 'Reactivar'}
    </button>
  )
}

export default function Administradores() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()
  const { perfil } = useAuth()

  const [administradores, setAdministradores] = useState<AdminProfile[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fila que está esperando respuesta del servidor. Se guarda el id y no un
  // booleano suelto para bloquear solo esa fila, no la tabla entera.
  const [ocupado, setOcupado] = useState<string | null>(null)

  const [invitacionAbierta, setInvitacionAbierta] = useState(false)
  const [email, setEmail] = useState('')
  const [errorEmail, setErrorEmail] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  /**
   * `silencioso` recarga sin sustituir la pantalla por el cargador: tras cambiar
   * un rol, parpadear la tabla entera hace perder de vista la fila que se acaba
   * de tocar.
   */
  const cargar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true)
      setError(null)
      try {
        setAdministradores(await listarAdministradores())
      } catch (e) {
        // La recarga silenciosa ocurre DESPUÉS de que el cambio ya se guardó: si
        // se cae la red justo ahí, cambiar toda la pantalla por el error borraría
        // la tabla que se estaba mirando. Ese caso se cuenta en un aviso y la
        // lista se queda como está.
        if (silencioso) {
          avisos.error(e)
        } else {
          setError(
            e instanceof Error ? e.message : 'No se pudo cargar la lista de administradores'
          )
        }
      } finally {
        setCargando(false)
      }
    },
    [avisos]
  )

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function cambiarRolDe(admin: AdminProfile, rol: AdminRole) {
    if (rol === admin.role) return
    const nombre = comoSeLlama(admin)

    // Se confirma antes de tocar nada: un desplegable cambia de valor con un
    // gesto, y con el teclado basta una flecha para pasar de Editor a super
    // administrador sin querer. Ascender entrega el panel entero —incluida esta
    // pantalla, desde la que podría degradar a los demás—; degradar deja a
    // alguien fuera de secciones que quizá estaba usando.
    const confirmado = await confirmar({
      titulo: `¿Cambiar el rol de ${nombre}?`,
      mensaje:
        rol === 'super_admin'
          ? `${nombre} pasará a ser super administrador: acceso total, incluidos los ajustes y esta misma pantalla, donde podrá cambiar el rol de cualquiera.`
          : `${nombre} pasará a ${ETIQUETA_ROL[rol].toLowerCase()}. ${DESCRIPCION_ROL[rol]}`,
      confirmar: 'Cambiar el rol',
      // Solo se pinta en rojo lo que amplía el poder de otra persona.
      peligroso: rol === 'super_admin',
    })
    // Al no cambiar ningún estado, React devuelve solo el <select> al rol que
    // sigue teniendo el dato, así que cancelar no deja la pantalla mintiendo.
    if (!confirmado) return

    setOcupado(admin.id)
    try {
      await cambiarRol(admin.id, rol)
      avisos.exito(`${nombre} ahora es ${ETIQUETA_ROL[rol].toLowerCase()}.`)
      await cargar(true)
    } catch (e) {
      // El <select> lo manda el dato, no un estado propio: si el cambio falla la
      // lista sigue igual y el control vuelve solo al rol anterior.
      avisos.error(e)
    } finally {
      setOcupado(null)
    }
  }

  async function alternarEstado(admin: AdminProfile) {
    const suspender = admin.status === 'activo'
    const nombre = comoSeLlama(admin)

    const confirmado = await confirmar({
      titulo: suspender ? `¿Suspender a ${nombre}?` : `¿Reactivar a ${nombre}?`,
      mensaje: suspender
        ? 'Dejará de poder entrar al panel hasta que lo reactives. No se borra nada: su cuenta y todo lo que haya hecho siguen en el historial.'
        : 'Volverá a entrar al panel con el rol que tiene asignado ahora.',
      confirmar: suspender ? 'Suspender' : 'Reactivar',
      // Reactivar no destruye nada: se muestra como acción normal, no en rojo.
      peligroso: suspender,
    })
    if (!confirmado) return

    setOcupado(admin.id)
    try {
      await cambiarEstadoAdmin(admin.id, suspender ? 'suspendido' : 'activo')
      avisos.exito(suspender ? `${nombre} quedó suspendido.` : `${nombre} vuelve a tener acceso.`)
      await cargar(true)
    } catch (e) {
      avisos.error(e)
    } finally {
      setOcupado(null)
    }
  }

  function abrirInvitacion() {
    setEmail('')
    setErrorEmail(null)
    setInvitacionAbierta(true)
  }

  async function invitar(e: FormEvent) {
    e.preventDefault()
    const valor = email.trim()

    if (!valor) {
      setErrorEmail('Escribe el correo de la persona que quieres invitar.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
      setErrorEmail('Ese correo no parece válido.')
      return
    }
    // Invitar reutiliza el correo de recuperación: mandárselo a alguien que ya
    // está en la lista no lo invitaría, le restablecería la contraseña.
    if (administradores.some((a) => a.email.toLowerCase() === valor.toLowerCase())) {
      setErrorEmail('Ese correo ya tiene acceso al panel.')
      return
    }

    setEnviando(true)
    try {
      await invitarAdministrador(valor)
      // Supabase responde igual exista o no la cuenta (así nadie puede averiguar
      // desde fuera quién tiene usuario), de modo que aquí no se sabe si el
      // correo salió de verdad. Decir «enviado» sería inventárselo.
      avisos.exito(
        `Pedido el enlace para ${valor}. Le llegará si ya tiene usuario creado en Supabase.`
      )
      setInvitacionAbierta(false)
      setEmail('')
    } catch (err) {
      // Sin base de datos conectada esto lanza a propósito; el aviso lo explica.
      avisos.error(err)
    } finally {
      setEnviando(false)
    }
  }

  const columnas: Columna<AdminProfile>[] = [
    {
      clave: 'persona',
      titulo: 'Persona',
      orden: (a) => comoSeLlama(a).toLowerCase(),
      celda: (a) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            {a.name || <span className="text-slate-400">Sin nombre</span>}
            {a.id === perfil?.id && (
              <span className="ml-2 align-middle text-[11px] font-bold uppercase tracking-wide text-blue-700">
                Tú
              </span>
            )}
          </p>
          <p className="truncate text-[12px] text-slate-500">{a.email}</p>
        </div>
      ),
    },
    {
      clave: 'rol',
      titulo: 'Rol',
      orden: (a) => ROLES.indexOf(a.role),
      celda: (a) => (
        <SelectorRol
          admin={a}
          esYo={a.id === perfil?.id}
          bloqueado={ocupado === a.id}
          vista="tabla"
          onCambiar={(rol) => void cambiarRolDe(a, rol)}
        />
      ),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      orden: (a) => a.status,
      celda: (a) => (
        <Etiqueta tono={a.status === 'activo' ? 'verde' : 'rojo'}>
          {a.status === 'activo' ? 'Activo' : 'Suspendido'}
        </Etiqueta>
      ),
    },
    {
      clave: 'acceso',
      titulo: 'Último acceso',
      // Sin fecha, cadena vacía: los que nunca entraron quedan juntos al ordenar.
      orden: (a) => a.lastLoginAt ?? '',
      celda: (a) => (
        <span
          className={`adm-num whitespace-nowrap ${a.lastLoginAt ? '' : 'text-slate-400'}`}
        >
          {fecha(a.lastLoginAt, 'Nunca')}
        </span>
      ),
    },
    {
      clave: 'creado',
      titulo: 'Creado',
      orden: (a) => a.createdAt ?? '',
      celda: (a) => (
        <span className="adm-num whitespace-nowrap">{fecha(a.createdAt, '—')}</span>
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      className: 'text-right',
      soloTabla: true,
      celda: (a) => (
        <div className="flex flex-col items-end gap-1">
          <BotonEstado
            admin={a}
            esYo={a.id === perfil?.id}
            bloqueado={ocupado === a.id}
            onAlternar={() => void alternarEstado(a)}
          />
          {a.id === perfil?.id && (
            <span className="text-[11px] text-slate-400">Es tu cuenta</span>
          )}
        </div>
      ),
    },
  ]

  if (cargando) return <Cargando texto="Cargando administradores…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  return (
    <>
      <Encabezado
        titulo="Administradores"
        descripcion="Quién puede entrar al panel y qué puede hacer."
      >
        <button type="button" onClick={abrirInvitacion} className="adm-btn-primary">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Invitar administrador
        </button>
      </Encabezado>

      {/* ── Qué significa cada rol ──────────────────────────────────────────── */}
      <section className="adm-card-pad">
        <h2 className="adm-titulo">Qué puede hacer cada rol</h2>
        <p className="adm-sub mt-1">
          El rol decide qué pantallas ve cada persona. Esconder un botón no es lo que
          da o quita permisos: la base de datos vuelve a comprobarlo por su cuenta en
          cada petición.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[13.5px] font-bold text-slate-900">{ETIQUETA_ROL[r]}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                {DESCRIPCION_ROL[r]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Lista ───────────────────────────────────────────────────────────── */}
      {administradores.length === 0 ? (
        <div className="adm-card mt-4">
          <EstadoVacio
            icono={ShieldCheck}
            titulo={
              backendConfigurado
                ? 'Todavía no hay administradores'
                : 'Falta conectar la base de datos'
            }
            descripcion={
              backendConfigurado
                ? 'Da de alta en Supabase (Authentication → Users) a quien deba entrar al panel y envíale la invitación desde aquí: aparecerá en esta lista en cuanto cree su contraseña.'
                : 'Las cuentas del panel viven en la base de datos, así que mientras no esté conectada no hay nada que listar ni invitaciones que enviar. Pon las credenciales en el archivo .env y vuelve a entrar.'
            }
          >
            {backendConfigurado && (
              <button type="button" onClick={abrirInvitacion} className="adm-btn-primary">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Invitar administrador
              </button>
            )}
          </EstadoVacio>
        </div>
      ) : (
        <div className="adm-card mt-4 overflow-hidden">
          <Tabla
            datos={administradores}
            columnas={columnas}
            claveFila={(a) => a.id}
            ordenInicial={{ clave: 'rol', dir: 'asc' }}
            tarjetaMovil={(a) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {a.name || 'Sin nombre'}
                      {a.id === perfil?.id && (
                        <span className="ml-2 align-middle text-[11px] font-bold uppercase tracking-wide text-blue-700">
                          Tú
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[12px] text-slate-500">{a.email}</p>
                  </div>
                  <Etiqueta tono={a.status === 'activo' ? 'verde' : 'rojo'}>
                    {a.status === 'activo' ? 'Activo' : 'Suspendido'}
                  </Etiqueta>
                </div>

                <SelectorRol
                  admin={a}
                  esYo={a.id === perfil?.id}
                  bloqueado={ocupado === a.id}
                  vista="movil"
                  onCambiar={(rol) => void cambiarRolDe(a, rol)}
                />

                <dl className="grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Último acceso
                    </dt>
                    <dd className="adm-num mt-0.5 text-slate-600">
                      {fecha(a.lastLoginAt, 'Nunca')}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-slate-400">
                      Creado
                    </dt>
                    <dd className="adm-num mt-0.5 text-slate-600">
                      {fecha(a.createdAt, '—')}
                    </dd>
                  </div>
                </dl>

                <BotonEstado
                  admin={a}
                  esYo={a.id === perfil?.id}
                  bloqueado={ocupado === a.id}
                  onAlternar={() => void alternarEstado(a)}
                  ancho
                />
                {a.id === perfil?.id && (
                  <p className="text-[11.5px] text-slate-400">
                    Es tu cuenta: nadie puede suspenderse a sí mismo.
                  </p>
                )}
              </div>
            )}
          />
        </div>
      )}

      {/* ── Invitación ──────────────────────────────────────────────────────── */}
      <Modal
        abierto={invitacionAbierta}
        onCerrar={() => setInvitacionAbierta(false)}
        titulo="Invitar administrador"
        descripcion="La contraseña la elige ella, no tú."
        ancho="md"
        pie={
          <>
            <button
              type="button"
              onClick={() => setInvitacionAbierta(false)}
              className="adm-btn-suave adm-btn-sm"
            >
              Cancelar
            </button>
            {/* El pie vive fuera del <form>, así que el botón se enlaza por id. */}
            <BotonGuardar form={ID_FORM_INVITAR} guardando={enviando} className="adm-btn-sm">
              Enviar invitación
            </BotonGuardar>
          </>
        }
      >
        <form id={ID_FORM_INVITAR} onSubmit={invitar} className="space-y-4" noValidate>
          <Entrada
            id="invitar-email"
            label="Correo electrónico"
            requerido
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="persona@ejemplo.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setErrorEmail(null)
            }}
            error={errorEmail ?? undefined}
            ayuda="Tiene que ser un correo al que esa persona entre: ahí le llega el enlace."
          />

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="flex items-center gap-2 text-[13px] font-bold text-blue-900">
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              Cómo funciona
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-blue-900">
              <li>
                <strong>Antes hay que darla de alta en Supabase</strong> (Authentication →
                Users). Desde aquí no se crean cuentas: si esa dirección todavía no
                existe, no le llega nada y tampoco verás un error.
              </li>
              <li>El correo lleva un enlace para que cree su propia contraseña.</li>
              <li>Entrará con rol Editor; desde aquí puedes ascenderlo después.</li>
              <li>Nunca escribes tú la contraseña de otra persona.</li>
            </ul>
          </div>

          <p className="text-[12.5px] leading-relaxed text-slate-500">
            Aparecerá en esta lista cuando haya creado su contraseña y entrado por
            primera vez. Si no le llega el correo, comprueba que su usuario existe en
            Supabase y que revisó la carpeta de spam antes de volver a invitarlo.
          </p>
        </form>
      </Modal>
    </>
  )
}
