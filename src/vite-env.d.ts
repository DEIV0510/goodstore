/// <reference types="vite/client" />

// ─────────────────────────────────────────────────────────────────────────────
// Variables de entorno del proyecto.
//
// Declararlas aquí hace que TypeScript avise si se escribe mal el nombre de una
// variable, en vez de dejar pasar un `undefined` silencioso hasta producción.
//
// Todo lo que empieza por VITE_ acaba dentro del paquete que descarga el
// navegador: aquí NUNCA va una clave secreta.
// ─────────────────────────────────────────────────────────────────────────────

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
