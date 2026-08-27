import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { consultarEstado, mensajeDeError, type Diagnostico } from '@/lib/api'
import {
  cerrarSesion as salir,
  iniciarSesion as entrar,
  instalar as crearPrimeraCuenta,
} from '@/services/autenticacion'
import type { AdminProfile } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Sesión del panel.
//
// El estado lo manda el servidor, no este componente: se consulta /api/estado
// y ahí viene todo (si hay cuenta creada, si hay sesión, si el hosting cumple).
// Así, si la sesión caduca o se cierra desde otro dispositivo, el panel se
// entera en la siguiente carga en vez de quedarse colgado.
// ─────────────────────────────────────────────────────────────────────────────

interface ValorAuth {
  perfil: AdminProfile | null
  /** true mientras se resuelve el estado: evita parpadear el acceso. */
  cargando: boolean
  /** La API respondió. Si es false, el hosting no está ejecutando PHP. */
  apiViva: boolean
  /** Ya existe una cuenta de administrador. */
  instalado: boolean
  /** Se pidió un rescate dejando RESCATE.txt en la carpeta de datos. */
  rescate: boolean
  diagnostico: Diagnostico | null
  avisos: string[]
  /** Mensaje si la API no respondió. */
  errorApi: string | null
  iniciarSesion: (email: string, password: string) => Promise<void>
  cerrarSesion: () => Promise<void>
  instalar: (email: string, nombre: string, clave: string) => Promise<string>
  refrescarPerfil: () => Promise<void>
}

const AuthContext = createContext<ValorAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<AdminProfile | null>(null)
  const [instalado, setInstalado] = useState(false)
  const [rescate, setRescate] = useState(false)
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [apiViva, setApiViva] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const refrescarPerfil = useCallback(async () => {
    try {
      const e = await consultarEstado(true)
      setPerfil(e.sesion)
      setInstalado(e.instalado)
      setRescate(e.rescate)
      setDiagnostico(e.diagnostico)
      setAvisos(e.avisos ?? [])
      setApiViva(true)
      setErrorApi(null)
    } catch (e) {
      setPerfil(null)
      setApiViva(false)
      setErrorApi(mensajeDeError(e))
    }
  }, [])

  useEffect(() => {
    let vivo = true
    void (async () => {
      await refrescarPerfil()
      if (vivo) setCargando(false)
    })()
    return () => {
      vivo = false
    }
  }, [refrescarPerfil])

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const p = await entrar(email, password)
    setPerfil(p)
    setInstalado(true)
    setApiViva(true)
    setErrorApi(null)
  }, [])

  const cerrarSesion = useCallback(async () => {
    try {
      await salir()
    } finally {
      // Aunque la petición falle, aquí se deja de considerar que hay sesión:
      // dejar al usuario dentro tras pulsar "cerrar sesión" sería peor.
      setPerfil(null)
    }
  }, [])

  const instalar = useCallback(
    async (email: string, nombre: string, clave: string) => {
      const { perfil: p, codigo } = await crearPrimeraCuenta(email, nombre, clave)
      setPerfil(p)
      setInstalado(true)
      setRescate(false)
      return codigo
    },
    []
  )

  const valor = useMemo<ValorAuth>(
    () => ({
      perfil,
      cargando,
      apiViva,
      instalado,
      rescate,
      diagnostico,
      avisos,
      errorApi,
      iniciarSesion,
      cerrarSesion,
      instalar,
      refrescarPerfil,
    }),
    [
      perfil,
      cargando,
      apiViva,
      instalado,
      rescate,
      diagnostico,
      avisos,
      errorApi,
      iniciarSesion,
      cerrarSesion,
      instalar,
      refrescarPerfil,
    ]
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
