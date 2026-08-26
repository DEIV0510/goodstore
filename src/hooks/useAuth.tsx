import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cliente, backendConfigurado } from '@/lib/supabase'
import type { AuthChangeEvent } from '@supabase/supabase-js'
import {
  cerrarSesion as salir,
  iniciarSesion as entrar,
  obtenerMiPerfil,
} from '@/services/autenticacion'
import type { AdminProfile } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Sesión del panel.
//
// El estado de la sesión lo manda Supabase, no este componente: se escucha
// `onAuthStateChange`, así que si el token caduca o se cierra la sesión desde
// otra pestaña, el panel se entera y devuelve al login sin quedarse colgado.
// ─────────────────────────────────────────────────────────────────────────────

interface ValorAuth {
  perfil: AdminProfile | null
  /** true mientras se resuelve si hay sesión: evita parpadear el login. */
  cargando: boolean
  configurado: boolean
  iniciarSesion: (email: string, password: string) => Promise<void>
  cerrarSesion: () => Promise<void>
  refrescarPerfil: () => Promise<void>
}

const AuthContext = createContext<ValorAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<AdminProfile | null>(null)
  const [cargando, setCargando] = useState(backendConfigurado)

  const refrescarPerfil = useCallback(async () => {
    try {
      setPerfil(await obtenerMiPerfil())
    } catch {
      setPerfil(null)
    }
  }, [])

  useEffect(() => {
    let vivo = true
    let desuscribir: (() => void) | undefined

    // El cliente se descarga bajo demanda, así que este arranque es asíncrono.
    void (async () => {
      const db = await cliente()
      if (!vivo) return
      if (!db) {
        setCargando(false)
        return
      }

      // Sesión que pudiera venir de una visita anterior.
      try {
        const p = await obtenerMiPerfil()
        if (vivo) setPerfil(p)
      } catch {
        if (vivo) setPerfil(null)
      } finally {
        if (vivo) setCargando(false)
      }

      if (!vivo) return

      const { data: sub } = db.auth.onAuthStateChange((evento: AuthChangeEvent) => {
        if (!vivo) return
        if (evento === 'SIGNED_OUT') {
          setPerfil(null)
          return
        }
        if (
          evento === 'SIGNED_IN' ||
          evento === 'TOKEN_REFRESHED' ||
          evento === 'USER_UPDATED'
        ) {
          void refrescarPerfil()
        }
      })
      desuscribir = () => sub.subscription.unsubscribe()
    })()

    return () => {
      vivo = false
      desuscribir?.()
    }
  }, [refrescarPerfil])

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const p = await entrar(email, password)
    setPerfil(p)
  }, [])

  const cerrarSesion = useCallback(async () => {
    await salir()
    setPerfil(null)
  }, [])

  const valor = useMemo<ValorAuth>(
    () => ({
      perfil,
      cargando,
      configurado: backendConfigurado,
      iniciarSesion,
      cerrarSesion,
      refrescarPerfil,
    }),
    [perfil, cargando, iniciarSesion, cerrarSesion, refrescarPerfil]
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
