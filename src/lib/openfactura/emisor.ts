/**
 * Datos fijos del emisor (Yape Digital SpA) para el encabezado del DTE.
 * Obtenidos de GET /v2/dte/organization de OpenFactura (ver scripts/of-organization.mjs).
 * Nombres de campo = esquema SII/OpenFactura del bloque Emisor de un DTE.
 */
export const EMISOR = {
  RUTEmisor: "78410649-7",
  RznSoc: "YAPE DIGITAL SPA",
  GiroEmis: "Desarrollo e implementación de soluciones de IA y software.",
  Acteco: 620900,
  DirOrigen: "SANTA MAGDALENA 75 OF 304    304",
  CmnaOrigen: "Providencia",
  CdgSIISucur: "92982491",
} as const;

export type Emisor = typeof EMISOR;
