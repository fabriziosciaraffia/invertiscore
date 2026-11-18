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
/** GET: el PDF guardado, para verlo en el visor del navegador («Abrir PDF», en una pestaña nueva; el servidor verifica que la
 *  orden sea de quien la pide); POST: anota que la persona abrió la ventana de la orden. */
export const URL_VER_ORDEN = "/api/invierte-v2/orden";

// ── /invierte, LA DIRECCIÓN ÚNICA DEL FLUJO (18-nov-2026, decisión de Fabrizio) ─────────────────────────────────────────
// Todo correo o mensaje del flujo que no pida una acción puntual enlaza a /invierte, nunca a una pantalla específica: la ruta
// decide según el estado de la persona. Sin sesión, pide entrar y vuelve; sin acceso, 404 como las demás rutas nuevas; con
// orden firmada y sin perfil, Partimos; con perfil y sin elegir, el resultado; ya eligió, la base (etapa 2, 18-nov-2026); con
// el contacto a medias, la firma de su depto; si no, el mapa.
export const URL_INVIERTE = "/invierte";
export const URL_OPCIONES = "/invierte/opciones";
export const URL_BASE = "/invierte/base";
export const URL_ENTRAR_INVIERTE = `/login?next=${encodeURIComponent(URL_INVIERTE)}`;

export type RutaInvierte = { tipo: "entrar"; url: string } | { tipo: "no-existe" } | { tipo: "ir"; url: string };

export function destinoInvierte(p: { sesion: boolean; acceso: boolean; firmo: boolean; contacto: { avisoId: string; origen: OrigenInvierte } | null; perfil?: boolean; eligio?: boolean }): RutaInvierte {
  if (!p.sesion) return { tipo: "entrar", url: URL_ENTRAR_INVIERTE };
  if (!p.acceso) return { tipo: "no-existe" };
  if (p.firmo) return { tipo: "ir", url: p.eligio ? URL_BASE : p.perfil ? URL_OPCIONES : URL_PARTIMOS };
  if (p.contacto) return { tipo: "ir", url: urlFirma(p.contacto.avisoId, p.contacto.origen) };
  return { tipo: "ir", url: "/explorar" };
}

export const esAvisoId = (x: unknown): x is string => typeof x === "string" && AVISO_ID.test(x);
