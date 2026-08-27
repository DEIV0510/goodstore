import { api, consultarEstado, olvidarEstado } from '@/lib/api'
import type { AdminProfile, AdminRole } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Autenticación del panel.
//
// La contraseña sale del navegador una vez, viaja por HTTPS y el servidor la
// compara contra un hash bcrypt. Nunca se guarda: ni aquí, ni en el
// almacenamiento del navegador, ni en el proyecto.
//
// La sesión es una cookie HttpOnly: JavaScript no la puede leer, así que un
// script inyectado en la página no puede robarla.
//
// No existe ninguna contraseña escrita en el código. La primera cuenta la crea
// el propio administrador al abrir /admin por primera vez.
// ─────────────────────────────────────────────────────────────────────────────

export async function iniciarSesion(
  email: string,
  password: string
): Promise<AdminProfile> {
  const r = await api<{ sesion: AdminProfile }>('sesion/entrar', {
    metodo: 'POST',
    cuerpo: { email: email.trim(), clave: password },
  })
  olvidarEstado()
  return r.sesion
}

export async function cerrarSesion(): Promise<void> {
  await api('sesion/salir', { metodo: 'POST' })
  olvidarEstado()
}

export async function obtenerMiPerfil(): Promise<AdminProfile | null> {
  const estado = await consultarEstado(true)
  return estado.sesion
}

/**
 * Crea la cuenta principal.
 *
 * Solo funciona mientras NO exista ningún administrador. Devuelve un código de
 * recuperación que se muestra UNA vez: el servidor solo guarda su hash.
 */
export async function instalar(
  email: string,
  nombre: string,
  clave: string
): Promise<{ perfil: AdminProfile; codigo: string }> {
  const r = await api<{ sesion: AdminProfile; codigo: string }>('sesion/instalar', {
    metodo: 'POST',
    cuerpo: { email: email.trim(), nombre, clave },
  })
  olvidarEstado()
  return { perfil: r.sesion, codigo: r.codigo }
}

/**
 * Restablece la contraseña con el código de recuperación.
 *
 * Sustituye al correo de recuperación: el envío de correo en hosting
 * compartido es poco fiable y dependería de otro servicio. El código se
 * consume al usarlo y se entrega uno nuevo.
 */
export async function recuperar(
  email: string,
  codigo: string,
  clave: string
): Promise<{ perfil: AdminProfile; codigo: string }> {
  const r = await api<{ sesion: AdminProfile; codigo: string }>('sesion/recuperar', {
    metodo: 'POST',
    cuerpo: { email: email.trim(), codigo, clave },
  })
  olvidarEstado()
  return { perfil: r.sesion, codigo: r.codigo }
}

export async function cambiarContrasena(actual: string, nueva: string): Promise<void> {
  await api('sesion/clave', { metodo: 'POST', cuerpo: { actual, nueva } })
}

/** Genera un código de recuperación nuevo. Pide la contraseña para confirmar. */
export async function nuevoCodigo(clave: string): Promise<string> {
  const r = await api<{ codigo: string }>('sesion/codigo', {
    metodo: 'POST',
    cuerpo: { clave },
  })
  return r.codigo
}

export async function actualizarMiNombre(nombre: string): Promise<AdminProfile> {
  const r = await api<{ sesion: AdminProfile }>('sesion/perfil', {
    metodo: 'PATCH',
    cuerpo: { nombre },
  })
  olvidarEstado()
  return r.sesion
}

// ── Qué puede hacer cada rol ─────────────────────────────────────────────────
// Es el MISMO criterio que aplica el servidor. Aquí solo sirve para no mostrar
// botones que van a fallar; la decisión real la toma siempre el backend, y por
// eso lanzar la petición a mano tampoco sirve de nada.

export const puedeEditar = (rol: AdminRole | null | undefined) =>
  rol === 'super_admin' || rol === 'admin' || rol === 'editor'

export const puedeBorrar = (rol: AdminRole | null | undefined) =>
  rol === 'super_admin' || rol === 'admin'

export const puedeVerNegocio = (rol: AdminRole | null | undefined) =>
  rol === 'super_admin' || rol === 'admin'

export const puedeConfigurar = (rol: AdminRole | null | undefined) =>
  rol === 'super_admin'

export const ETIQUETA_ROL: Record<AdminRole, string> = {
  super_admin: 'Super administrador',
  admin: 'Administrador',
  editor: 'Editor',
}

export const DESCRIPCION_ROL: Record<AdminRole, string> = {
  super_admin: 'Acceso total, incluidos ajustes y administradores.',
  admin: 'Gestiona catálogo, inventario, pedidos y clientes. Puede eliminar.',
  editor: 'Crea y edita catálogo y contenido. No elimina ni ve pedidos.',
}
