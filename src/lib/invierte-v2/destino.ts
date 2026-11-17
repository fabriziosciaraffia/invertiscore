// ─────────────────────────────────────────────────────────────────────────────
// ¿ADÓNDE LLEVA EL BOTÓN «Invierte con Franco»? (etapa 1, 18-nov-2026). Puro: lo usan las tres superficies (el mapa, la
// selección y la portada del informe) y el tier INVIERTE-V2.
//   · Al flujo nuevo SOLO con acceso (acceso.ts) y un depto USADO. Un nuevo de inmobiliaria sigue yendo a Pronto aunque la
//     cuenta esté en la lista (decisión de Fabrizio).
//   · Sin acceso, siempre Pronto: el camino de hoy, sin un cambio.
// ─────────────────────────────────────────────────────────────────────────────
import type { OrigenInvierte } from "@/lib/invierte/invierte";

export type DestinoInvierte = "pronto" | "v2";

export function destinoBoton(p: { acceso: boolean; condicion: unknown }): DestinoInvierte {
  return p.acceso === true && p.condicion === "usado" ? "v2" : "pronto";
}

const AVISO_ID = /^[A-Za-z0-9_-]{1,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La primera pantalla del flujo nuevo para un depto: el contacto (paso 1 de 2). */
export function urlContacto(avisoId: string, origen: OrigenInvierte, analysisId?: string | null): string {
  const q = new URLSearchParams({ desde: origen });
  if (analysisId && UUID.test(analysisId)) q.set("a", analysisId);
  return `/invierte/${encodeURIComponent(avisoId)}?${q.toString()}`;
}

export function urlFirma(avisoId: string, origen: OrigenInvierte, analysisId?: string | null): string {
  const q = new URLSearchParams({ desde: origen });
  if (analysisId && UUID.test(analysisId)) q.set("a", analysisId);
  return `/invierte/${encodeURIComponent(avisoId)}/firma?${q.toString()}`;
}

export const URL_PARTIMOS = "/invierte/partimos";
export const URL_PERFIL = "/invierte/perfil";
export const URL_VER_ORDEN = "/api/invierte-v2/orden";

export const esAvisoId = (x: unknown): x is string => typeof x === "string" && AVISO_ID.test(x);
