// ─────────────────────────────────────────────────────────────────────────────
// Gating dueño-only de la vista DOCUMENTO (D-1) y de los endpoints PDF.
//
// El audit F2-0 encontró que `/analisis/[id]/documento` y su gemela STR servían
// el informe COMPLETO a cualquiera con el UUID, sin mirar sesión ni is_premium.
// Riesgo pre-existente que creció con el cap anónimo: se acumulan informes
// premium de anónimos con lectura pública por URL.
//
// Decisión de producto: acceso dueño-only. Compartir un análisis se hace por
// `/analisis/[id]` (vista guest capada, diseñada para eso); `/documento` deja de
// ser superficie compartible.
//
// ── Quién pasa ───────────────────────────────────────────────────────────────
//   · dueño logueado (user.id === analisis.user_id)
//   · anónimo-dueño (cookie httpOnly `franco_anon` cuyo hash calza con la fila)
//   · admin
//   · el RENDERER de PDFs, solo para la VISTA (ver abajo)
// Cualquier otro → redirect a la vista pública correcta, NO un 404 seco: quien
// llegó con un link compartido de buena fe aterriza donde sí puede leer.
//
// ── Por qué un secreto en header para el renderer ────────────────────────────
// El pipeline (src/lib/pdf/render-pdf.ts) levanta Chromium headless y navega al
// MISMO origin sin cookies ni identidad: el request llega como visitante
// anónimo puro. No hay sesión que reutilizar, así que el paso se hace con un
// header `x-render-secret` que solo el server conoce. Renderer y página corren
// en lambdas distintas — por eso el secreto tiene que venir del env y no puede
// generarse en runtime.
//
// El secreto vale SOLO para la vista. Los endpoints PDF exigen dueño de verdad:
// si no, gatear la vista sería decorativo — cualquiera pediría el PDF y el
// pipeline, con su secreto, le renderizaría el documento completo y se lo
// entregaría.
//
// ── Kill-switch fail-open ────────────────────────────────────────────────────
// Sin `RENDER_PDF_SECRET` en el env, el gating queda APAGADO y todo se comporta
// como hoy. Es deliberado: un deploy sin la variable no puede dejar los PDFs
// muertos ni sacar a los dueños de su documento. Encenderlo es setear la
// variable y redesplegar — cero cambios de código.
// ─────────────────────────────────────────────────────────────────────────────

import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/admin";
import { sha256Hex, tokenAnonDelRequest } from "@/lib/api-helpers/anon-cap";

/** Header con el que el renderer se identifica ante la vista documento. */
export const RENDER_SECRET_HEADER = "x-render-secret";

/** ¿El gating está encendido? (kill-switch fail-open por env). */
export function gatingDocumentoActivo(): boolean {
  return !!process.env.RENDER_PDF_SECRET;
}

/** Secreto para que el renderer lo mande. null = kill-switch apagado. */
export function secretoRenderer(): string | null {
  return process.env.RENDER_PDF_SECRET || null;
}

/** ¿Este request viene del pipeline de PDFs? */
function esRenderer(): boolean {
  const esperado = process.env.RENDER_PDF_SECRET;
  if (!esperado) return false;
  try {
    return headers().get(RENDER_SECRET_HEADER) === esperado;
  } catch {
    // Fuera de un contexto de request (no debería pasar en estas rutas).
    return false;
  }
}

export type MotivoDenegacion = "sin_sesion" | "sesion_ajena" | "cookie_no_calza";

export type AccesoDocumento =
  | { ok: true; via: "dueno" | "anon_dueno" | "admin" | "renderer" | "gating_apagado" }
  | { ok: false; motivo: MotivoDenegacion };

/** Fila mínima que necesita el predicado. */
export interface FilaParaAcceso {
  user_id: string | null;
  anon_claim_token_hash?: string | null;
}

/**
 * Decide si este request puede ver el documento (o pedir su PDF).
 *
 * `permitirRenderer`: true en la VISTA (el pipeline la navega), false en los
 * endpoints PDF (ahí el solicitante tiene que ser dueño de verdad).
 */
export function evaluarAccesoDocumento(opts: {
  fila: FilaParaAcceso;
  user: User | null;
  permitirRenderer: boolean;
}): AccesoDocumento {
  const { fila, user, permitirRenderer } = opts;

  if (!gatingDocumentoActivo()) return { ok: true, via: "gating_apagado" };
  if (permitirRenderer && esRenderer()) return { ok: true, via: "renderer" };

  if (user) {
    if (isAdminUser(user.email)) return { ok: true, via: "admin" };
    if (fila.user_id !== null && fila.user_id === user.id) return { ok: true, via: "dueno" };
    return { ok: false, motivo: "sesion_ajena" };
  }

  // Sin sesión: única vía es ser el anónimo que lo creó (cap F2). Mismo
  // predicado que la vista anónimo-dueño de /analisis/[id].
  if (fila.user_id === null && fila.anon_claim_token_hash) {
    const token = tokenAnonDelRequest();
    if (token && sha256Hex(token) === fila.anon_claim_token_hash) {
      return { ok: true, via: "anon_dueno" };
    }
    return { ok: false, motivo: "cookie_no_calza" };
  }
  return { ok: false, motivo: "sin_sesion" };
}

/**
 * Deja rastro del rechazo. Instrumentación mínima acordada: log estructurado
 * server-side (grepeable en Vercel) + el `?desde=documento` del redirect, que
 * se mide con el `$pageview` de la vista pública. No se emite evento PostHog
 * desde el server: no hay cliente server-side en el proyecto y montarlo por
 * esto sería desproporcionado.
 */
export function logDenegacion(opts: {
  ruta: string;
  analisisId: string;
  motivo: MotivoDenegacion;
  logueado: boolean;
}): void {
  console.warn(
    `[documento-gating] denegado ruta=${opts.ruta} id=${opts.analisisId} motivo=${opts.motivo} logueado=${opts.logueado}`,
  );
}

/**
 * Comprobación de dueño para los endpoints PDF. Devuelve el mismo veredicto que
 * la vista pero SIN la pata del renderer, y ya resuelve la sesión.
 */
export async function accesoPdf(
  supabase: SupabaseClient,
  fila: FilaParaAcceso,
): Promise<AccesoDocumento> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return evaluarAccesoDocumento({ fila, user: user ?? null, permitirRenderer: false });
}
