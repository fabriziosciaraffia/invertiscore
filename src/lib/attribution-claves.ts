// ─────────────────────────────────────────────────────────────────────────────
// Las claves y el tipo de la atribución, SIN imports de servidor (19-oct-2026, LCP de la landing).
//
// `useAttributionSync` (cliente, en el provider global: todas las páginas) importaba estas constantes desde
// `lib/attribution.ts`, que importa `posthog-servidor.ts`, que importa `crypto` de Node: webpack metía en el navegador
// los polyfills de criptografía (bn.js, asn1, Buffer: 98 kB gz) antes del titular, sin que nadie los usara. Lo que
// necesita el navegador vive acá; `attribution.ts` lo reexporta para el servidor. Lo fija el tier LANDING-RENDIMIENTO.
// ─────────────────────────────────────────────────────────────────────────────
import type { Puerta } from "@/lib/atribucion-puerta";

/** Clave de localStorage que ya usa useUTMCapture. NO cambiar sin migrar. */
export const UTM_STORAGE_KEY = "franco_utm";

/** Marca de "ya sincronicé la atribución de este usuario" (evita POST por visita). */
export const ATTRIBUTION_SYNCED_KEY = "franco_attr_sync";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export interface AtribucionInput {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  referrer?: string | null;
  landing_path?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  /** Por dónde entró la cuenta (15-oct-2026, atribucion-puerta.ts): A informe, B selección, C referido, D orgánico. */
  puerta?: Puerta | null;
  puerta_detalle?: string | null;
}
