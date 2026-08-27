import {
  Check,
  Copy,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
} from 'lucide-react'
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
  Selector,
} from '@/components/admin/UI'
import { useAuth } from '@/hooks/useAuth'
import { DESCRIPCION_ROL, ETIQUETA_ROL } from '@/services/autenticacion'
import {
  cambiarEstadoAdmin,
  cambiarRol,
  crearAdministrador,
  eliminarAdministrador,
  listarAdministradores,
  regenerarCodigo,
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
//   · Aquí no se escriben contraseñas. Dar de alta crea la cuenta y devuelve un
//     código de un solo uso que esa persona canjea por SU contraseña. Ninguna
//     clave ajena pasa nunca por las manos de otro.
//   · El código se enseña UNA vez. El servidor guarda solo su huella, así que
//     no hay forma de volver a leerlo: si se pierde se genera otro, y el
//     anterior deja de servir en ese mismo momento.
//
// Lo que se ve o se esconde en esta tabla no es la seguridad real: la API vuelve
// a comprobar el rol en cada petición, por su cuenta.
// ─────────────────────────────────────────────────────────────────────────────

/** Orden de mayor a menor permiso: sirve para la lista, el <select> y el orden. */
const ROLES: AdminRole[] = ['super_admin', 'admin', 'editor']

const ID_FORM_ALTA = 'form-alta-admin'

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

/**
 * El código de recuperación, tal como se enseña la única vez que se puede ver.
 *
 * Se repite en dos sitios (alta y código nuevo), así que vive aparte. El botón
 * de copiar confirma en sí mismo durante dos segundos: un aviso flotante más
 * encima del modal taparía justo el código que hay que apuntar.
 */
function CodigoDeUnSoloUso({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <div>
      <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4 text-center">
        <p className="select-all font-mono text-[17px] font-bold tracking-wider text-blue-900">
          {codigo}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(codigo).then(() => {
            setCopiado(true)
            window.setTimeout(() => setCopiado(false), 2000)
          })
        }}
        className="adm-btn-suave adm-btn-sm mt-3 w-full"
      >
        {copiado ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
        {copiado ? 'Copiado' : 'Copiar el código'}
      </button>

      <p className="mt-3 text-[12.5px] leading-relaxed text-alert-600">
        Apúntalo o cópialo ahora: al cerrar esta ventana no se puede volver a ver.
        Solo queda su huella guardada.
      </p>
    </div>
  )
}

/** Genera un código nuevo para quien perdió el suyo. Sobre uno mismo, no. */
function BotonCodigo({
  admin,
  esYo,
  bloqueado,
  onGenerar,
  ancho,
}: {
  admin: AdminProfile
  esYo: boolean
  bloqueado: boolean
  onGenerar: () => void
  ancho?: boolean
}) {
  return (
    <button
      type="button"
      disabled={esYo || bloqueado}
      onClick={onGenerar}
      aria-label={`Generar un código de recuperación nuevo para ${comoSeLlama(admin)}`}
      title={
        esYo
          ? 'Para tu propio código entra en Mi perfil: allí se te pide la contraseña'
          : undefined
      }
      className={`adm-btn-suave adm-btn-sm ${ancho ? 'w-full' : ''}`}
    >
      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
      Código
    </button>
  )
}

/** Borra la cuenta. El historial que firmó esa persona no se toca. */
function BotonBorrar({
  admin,
  esYo,
  bloqueado,
  onBorrar,
  ancho,
}: {
  admin: AdminProfile
  esYo: boolean
  bloqueado: boolean
  onBorrar: () => void
  ancho?: boolean
}) {
  return (
    <button
      type="button"
      disabled={esYo || bloqueado}
      onClick={onBorrar}
      aria-label={`Borrar la cuenta de ${comoSeLlama(admin)}`}
      title={esYo ? 'No puedes borrar tu propia cuenta' : undefined}
      className={`adm-btn-suave adm-btn-sm text-alert-600 ${ancho ? 'w-full' : ''}`}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      Borrar
    </button>
  )
}

export default function Administradores() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()
  const { perfil, apiViva } = useAuth()

  const [administradores, setAdministradores] = useState<AdminProfile[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fila que está esperando respuesta del servidor. Se guarda el id y no un
  // booleano suelto para bloquear solo esa fila, no la tabla entera.
  const [ocupado, setOcupado] = useState<string | null>(null)

  // Formulario de alta.
  const [altaAbierta, setAltaAbierta] = useState(false)
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rolNuevo, setRolNuevo] = useState<AdminRole>('editor')
  const [errorEmail, setErrorEmail] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Código recién generado. Vive en su propia ventana porque es lo único de
  // esta pantalla que no se puede volver a consultar: si se pierde de vista, se
  // pierde del todo.
  const [codigoRecien, setCodigoRecien] = useState<{ para: string; codigo: string } | null>(
    null
  )

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

  function abrirAlta() {
    setEmail('')
    setNombre('')
    setRolNuevo('editor')
    setErrorEmail(null)
    setAltaAbierta(true)
  }

  async function darDeAlta(e: FormEvent) {
    e.preventDefault()
    const valor = email.trim()

    if (!valor) {
      setErrorEmail('Escribe el correo de la persona que va a entrar.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
      setErrorEmail('Ese correo no parece válido.')
      return
    }
    // El servidor también lo rechaza —el índice de la tabla es lo que de verdad
    // lo impide—; esto solo sirve para decirlo antes y con mejores palabras.
    if (administradores.some((a) => a.email.toLowerCase() === valor.toLowerCase())) {
      setErrorEmail('Ese correo ya tiene acceso al panel.')
      return
    }

    setEnviando(true)
    try {
      const r = await crearAdministrador(valor, nombre.trim(), rolNuevo)
      // El formulario se cierra y el código toma su sitio: son dos pasos, y
      // dejar los dos abiertos a la vez invita a cerrar el que no toca.
      setAltaAbierta(false)
      setCodigoRecien({ para: r.administrador.email, codigo: r.codigo })
      await cargar(true)
    } catch (err) {
      avisos.error(err)
    } finally {
      setEnviando(false)
    }
  }

  async function nuevoCodigoDe(admin: AdminProfile) {
    const quien = comoSeLlama(admin)

    const confirmado = await confirmar({
      titulo: `¿Generar un código nuevo para ${quien}?`,
      mensaje:
        'El código anterior deja de servir en ese mismo momento. Si lo tenía apuntado, ya ' +
        'no le abrirá nada y tendrás que entregarle el nuevo.',
      confirmar: 'Generar el código',
    })
    if (!confirmado) return

    setOcupado(admin.id)
    try {
      setCodigoRecien({ para: admin.email, codigo: await regenerarCodigo(admin.id) })
    } catch (e) {
      avisos.error(e)
    } finally {
      setOcupado(null)
    }
  }

  async function borrar(admin: AdminProfile) {
    const quien = comoSeLlama(admin)

    const confirmado = await confirmar({
      titulo: `¿Borrar la cuenta de ${quien}?`,
      mensaje:
        'Dejará de existir y no se puede deshacer. Lo que esa persona hizo sigue en el ' +
        'historial, con su nombre. Si solo quieres cerrarle el paso un tiempo, suspéndela.',
      confirmar: 'Borrar la cuenta',
      peligroso: true,
    })
    if (!confirmado) return

    setOcupado(admin.id)
    try {
      await eliminarAdministrador(admin.id)
      avisos.exito(`La cuenta de ${quien} quedó borrada.`)
      await cargar(true)
    } catch (e) {
      avisos.error(e)
    } finally {
      setOcupado(null)
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
          <div className="flex flex-wrap justify-end gap-1">
            <BotonEstado
              admin={a}
              esYo={a.id === perfil?.id}
              bloqueado={ocupado === a.id}
              onAlternar={() => void alternarEstado(a)}
            />
            <BotonCodigo
              admin={a}
              esYo={a.id === perfil?.id}
              bloqueado={ocupado === a.id}
              onGenerar={() => void nuevoCodigoDe(a)}
            />
            <BotonBorrar
              admin={a}
              esYo={a.id === perfil?.id}
              bloqueado={ocupado === a.id}
              onBorrar={() => void borrar(a)}
            />
          </div>
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
        <button type="button" onClick={abrirAlta} className="adm-btn-primary">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Dar de alta
        </button>
      </Encabezado>

      {/* ── Qué significa cada rol ──────────────────────────────────────────── */}
      <section className="adm-card-pad">
        <h2 className="adm-titulo">Qué puede hacer cada rol</h2>
        <p className="adm-sub mt-1">
          El rol decide qué pantallas ve cada persona. Esconder un botón no es lo que
          da o quita permisos: el servidor vuelve a comprobar el rol por su cuenta en
          cada petición, aunque venga escrita a mano.
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
              apiViva ? 'Todavía no hay administradores' : 'No hay conexión con el servidor'
            }
            descripcion={
              apiViva
                ? 'Da de alta aquí a quien deba entrar al panel. Se crea la cuenta al momento y te devuelve un código de un solo uso para que esa persona elija su contraseña.'
                : 'Las cuentas del panel viven en el servidor, así que mientras no responda no hay nada que listar. Revisa que la carpeta «api» esté publicada y vuelve a entrar.'
            }
          >
            {apiViva && (
              <button type="button" onClick={abrirAlta} className="adm-btn-primary">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Dar de alta
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

                <div className="grid grid-cols-2 gap-2">
                  <BotonEstado
                    admin={a}
                    esYo={a.id === perfil?.id}
                    bloqueado={ocupado === a.id}
                    onAlternar={() => void alternarEstado(a)}
                    ancho
                  />
                  <BotonCodigo
                    admin={a}
                    esYo={a.id === perfil?.id}
                    bloqueado={ocupado === a.id}
                    onGenerar={() => void nuevoCodigoDe(a)}
                    ancho
                  />
                </div>
                <BotonBorrar
                  admin={a}
                  esYo={a.id === perfil?.id}
                  bloqueado={ocupado === a.id}
                  onBorrar={() => void borrar(a)}
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

      {/* ── Alta de una cuenta ──────────────────────────────────────────────── */}
      <Modal
        abierto={altaAbierta}
        onCerrar={() => setAltaAbierta(false)}
        titulo="Dar de alta a alguien"
        descripcion="La contraseña la elige esa persona, no tú."
        ancho="md"
        pie={
          <>
            <button
              type="button"
              onClick={() => setAltaAbierta(false)}
              className="adm-btn-suave adm-btn-sm"
            >
              Cancelar
            </button>
            {/* El pie vive fuera del <form>, así que el botón se enlaza por id. */}
            <BotonGuardar form={ID_FORM_ALTA} guardando={enviando} className="adm-btn-sm">
              Crear la cuenta
            </BotonGuardar>
          </>
        }
      >
        <form id={ID_FORM_ALTA} onSubmit={darDeAlta} className="space-y-4" noValidate>
          <Entrada
            id="alta-email"
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
            ayuda="Con este correo entrará al panel."
          />

          <Entrada
            id="alta-nombre"
            label="Nombre"
            autoComplete="off"
            placeholder="Cómo quieres verla en la lista"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            ayuda="Si lo dejas vacío se usa la parte del correo antes de la arroba."
          />

          <Selector
            id="alta-rol"
            label="Rol"
            value={rolNuevo}
            onChange={(e) => setRolNuevo(e.target.value as AdminRole)}
            opciones={ROLES.map((r) => ({ valor: r, etiqueta: ETIQUETA_ROL[r] }))}
            ayuda={DESCRIPCION_ROL[rolNuevo]}
          />

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="flex items-center gap-2 text-[13px] font-bold text-blue-900">
              <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              Qué pasa al crearla
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-blue-900">
              <li>
                La cuenta queda creada al momento y aparece en la lista, todavía sin
                contraseña.
              </li>
              <li>
                Verás <strong>una sola vez</strong> un código de un solo uso. Entrégaselo
                en mano o por WhatsApp.
              </li>
              <li>
                Esa persona entra en <strong>/admin</strong>, pulsa «¿Olvidaste tu
                contraseña?», escribe su correo y el código, y elige su clave.
              </li>
              <li>Tú nunca escribes ni ves la contraseña de nadie.</li>
            </ul>
          </div>

          <p className="text-[12.5px] leading-relaxed text-slate-500">
            No se envía ningún correo: el envío desde un hosting compartido no es fiable y
            dependería de otro servicio. Por eso el código se entrega a mano.
          </p>
        </form>
      </Modal>

      {/* ── El código, la única vez que se puede ver ─────────────────────────── */}
      <Modal
        abierto={codigoRecien !== null}
        onCerrar={() => setCodigoRecien(null)}
        titulo="Código de un solo uso"
        descripcion={
          codigoRecien ? `Para ${codigoRecien.para}. Solo se muestra ahora.` : undefined
        }
        ancho="sm"
        pie={
          <button
            type="button"
            onClick={() => setCodigoRecien(null)}
            className="adm-btn-primary adm-btn-sm"
          >
            Ya lo guardé
          </button>
        }
      >
        {codigoRecien && (
          <>
            <CodigoDeUnSoloUso codigo={codigoRecien.codigo} />
            <p className="mt-4 text-[12.5px] leading-relaxed text-slate-500">
              Con él entrará por «¿Olvidaste tu contraseña?» y elegirá su propia clave. Si
              se pierde, genera otro desde esta misma pantalla: el anterior deja de servir
              en ese momento.
            </p>
          </>
        )}
      </Modal>
    </>
  )
}
