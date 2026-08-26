import { cliente, exigirBackend } from '@/lib/supabase'
import type { AdminProfile, AdminRole } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Autenticación del panel.
//
// La contraseña la gestiona Supabase Auth de principio a fin: viaja cifrada,
// se guarda con hash en el servidor y nunca pasa por este código ni por el
// almacenamiento del navegador. Lo que sí se guarda es el token de sesión, que
// caduca y se renueva solo.
//
// No existe ninguna contraseña escrita en el proyecto. La primera cuenta se
// crea desde el panel de Supabase o con el registro inicial, y queda como
// super_admin automáticamente (disparador de 0001_esquema.sql).
// ─────────────────────────────────────────────────────────────────────────────

interface FilaPerfil {
  id: string
  email: string
  name: string
  role: AdminRole
  status: 'activo' | 'suspendido'
  last_login_at: string | null
  created_at: string
}

export const perfilDesdeFila = (f: FilaPerfil): AdminProfile => ({
  id: f.id,
  email: f.email,
  name: f.name,
  role: f.role,
  status: f.status,
  lastLoginAt: f.last_login_at,
  createdAt: f.created_at,
})

export async function iniciarSesion(
  email: string,
  password: string
): Promise<AdminProfile> {
  const db = await exigirBackend()

  const { data, error } = await db.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw error
  if (!data.user) throw new Error('No se pudo iniciar la sesión.')

  const perfil = await obtenerMiPerfil()
  if (!perfil) {
    await db.auth.signOut()
    throw new Error(
      'Tu cuenta existe pero no tiene un perfil de administrador asignado. ' +
        'Pide a un super administrador que te dé acceso.'
    )
  }
  if (perfil.status !== 'activo') {
    await db.auth.signOut()
    throw new Error('Tu cuenta está suspendida. Contacta a un super administrador.')
  }

  // Deja la marca de último acceso y la línea en el historial.
  try {
    await db.rpc('gg_registrar_acceso')
  } catch {
    /* que falle el registro no debe impedir entrar */
  }

  return perfil
}

export async function cerrarSesion(): Promise<void> {
  const db = await cliente()
  if (!db) return
  const { error } = await db.auth.signOut()
  if (error) throw error
}

export async function obtenerMiPerfil(): Promise<AdminProfile | null> {
  const db = await cliente()
  if (!db) return null

  const { data: sesion } = await db.auth.getUser()
  if (!sesion.user) return null

  const { data, error } = await db
    .from('profiles')
    .select('id, email, name, role, status, last_login_at, created_at')
    .eq('id', sesion.user.id)
    .maybeSingle()
  if (error) throw error
  return data ? perfilDesdeFila(data as unknown as FilaPerfil) : null
}

/**
 * Envía el correo de recuperación. `redirectTo` es la pantalla del panel donde
 * el administrador escribirá la nueva contraseña; ese dominio debe estar en la
 * lista de URLs permitidas del proyecto Supabase.
 */
export async function pedirRecuperacion(email: string): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/admin/nueva-clave`,
  })
  if (error) throw error
}

/** Se usa al volver desde el enlace del correo, con la sesión de recuperación activa. */
export async function cambiarContrasena(nueva: string): Promise<void> {
  const db = await exigirBackend()
  const { error } = await db.auth.updateUser({ password: nueva })
  if (error) throw error
}

export async function actualizarMiNombre(nombre: string): Promise<void> {
  const db = await exigirBackend()
  const { data: sesion } = await db.auth.getUser()
  if (!sesion.user) throw new Error('No hay sesión activa.')

  const { error } = await db
    .from('profiles')
    .update({ name: nombre })
    .eq('id', sesion.user.id)
  if (error) throw error
}

// ── Qué puede hacer cada rol ─────────────────────────────────────────────────
// Es el MISMO criterio que aplican las políticas de la base de datos. Aquí solo
// sirve para no mostrar botones que van a fallar; la decisión real la toma
// siempre el servidor.

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
