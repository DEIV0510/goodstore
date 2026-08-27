/// <reference types="vite/client" />

// ─────────────────────────────────────────────────────────────────────────────
// Variables de entorno del proyecto.
//
// No hay ninguna, y es a propósito: el backend viaja dentro del mismo sitio, así
// que el navegador pide /api al dominio en el que ya está. Nada que configurar y
// nada que se pueda quedar sin poner el día que se publique.
//
// Si algún día hiciera falta alguna, va declarada aquí para que TypeScript avise
// cuando se escriba mal el nombre, en vez de dejar pasar un `undefined`
// silencioso hasta producción. Y recuerda: todo lo que empieza por VITE_ acaba
// dentro del paquete que descarga el navegador. Ahí NUNCA va una clave secreta.
// ─────────────────────────────────────────────────────────────────────────────

interface ImportMetaEnv {
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
