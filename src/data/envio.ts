// ─────────────────────────────────────────────────────────────────────────────
// Tarifas de envío por omisión.
//
// Las dio el negocio el 2026-09-15, por nota de voz: domicilio en el Valle de
// Aburrá (Medellín, Itagüí, Envigado, Bello y el resto del área metropolitana)
// a $15.000, y envío al resto del país a $18.500. En casos puntuales el valor
// puede variar.
//
// No van sumadas al precio de cada juego a propósito: quien lleva dos o tres
// pagaría el envío dos o tres veces. Y el negocio decidió que la tienda solo
// las PUBLIQUE: no se suman al cobro en línea, el envío se cuadra aparte.
//
// Viven en un archivo sin importaciones porque las leen dos sitios —los datos
// de la tienda (data/site.ts) y los ajustes del panel (services/ajustes.ts)— y
// dos copias del mismo valor se separan sin que nadie se entere.
// ─────────────────────────────────────────────────────────────────────────────

export const TARIFAS_ENVIO_POR_OMISION = {
  /** Domicilio en el Valle de Aburrá. */
  area: 15000,
  /** Envío al resto del país. */
  nacional: 18500,
} as const
