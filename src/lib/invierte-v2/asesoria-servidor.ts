// ─────────────────────────────────────────────────────────────────────────────
// EL PERFIL DE LA ASESORÍA MANDA EN INVIERTE (decisión de Fabrizio, 27-nov-2026). Quien llega desde «Seguir con estos deptos» ya tiene
// su perfil declarado (inv_perfiles, origen «asesoria»): al firmar la orden, Invierte NO le vuelve a preguntar su perfil; lo usa tal
// cual —con el tope de la regla única (tope/regla.ts)— y suma solos los otros deptos que eligió en la asesoría (`elegidos`).
//   · Se hace una vez: queda marcado en tope_supuestos.adoptadoInvierte. Si después edita su perfil en Invierte, vale lo editado.
//   · Lo mismo que hace confirmarPerfil al confirmar: las comunas y el tope al perfil del semanal, la búsqueda de alternativas y la
//     bitácora. Lo único que NO hace es recalcular el tope: el de la asesoría ya sale de la misma regla.
// Lo llama la página del perfil de Invierte (a donde cae la firma). Tier ASESORIA.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { leerPerfilInv } from "./perfil-servidor";
import { sumarDepto } from "./base-servidor";
import { anotar, ultimaOrdenDe } from "./servidor";
import type { PerfilInv } from "./perfil-servidor";
import { contactoDeAsesoria, idsDeLaAsesoria, type DeptoAsesoria } from "./asesoria";
import type { PieInvierte, UrgenciaInvierte } from "@/lib/invierte/invierte";

export type ResultadoAdopcion = { adoptado: false } | { adoptado: true; sumados: string[] };

export async function adoptarPerfilAsesoria(admin: SupabaseClient, user: { id: string; email: string | null }): Promise<ResultadoAdopcion> {
  const [orden, perfil] = await Promise.all([ultimaOrdenDe(admin, user.id), leerPerfilInv(admin, user.id)]);
  if (!orden || !perfil || perfil.origen !== "asesoria" || perfil.topeSupuestos?.adoptadoInvierte) return { adoptado: false };
  const ahora = new Date().toISOString();
  // UN SOLO PERFIL: las comunas y el tope también al de la selección semanal (como confirmarPerfil).
  const pb: Record<string, unknown> = { user_id: user.id, comunas: perfil.comunas, actualizado_at: ahora };
  if (perfil.topeUF != null && perfil.topeUF > 0) pb.precio_max_uf = Math.round(perfil.topeUF);
  const r = await admin.from("perfil_busqueda").upsert(pb, { onConflict: "user_id" });
  if (r.error) console.error("[inv2] perfil_busqueda (asesoría):", r.error.message);
  const { error } = await admin.from("inv_perfiles")
    .update({ tope_supuestos: { ...(perfil.topeSupuestos ?? {}), buscarAlternativas: true, adoptadoInvierte: ahora }, updated_at: ahora })
    .eq("user_id", user.id);
  if (error) return { adoptado: false };
  // Los deptos que eligió en la asesoría, sumados a sus opciones (el de la firma ya está: sumarDepto lo devuelve como «ya»).
  const sumados: string[] = [];
  for (const avisoId of perfil.elegidos) {
    const s = await sumarDepto(admin, user, avisoId, null, "mapa", null).catch(() => ({ ok: false as const }));
    if (s.ok) sumados.push(avisoId);
  }
  await anotar(admin, { userId: user.id, email: user.email, ordenId: orden.id, actor: "persona", accion: "perfil_confirmado", detalle: { origen: "asesoria", tope_uf: perfil.topeUF, comunas: perfil.comunas, sumados }, esPrueba: perfil.esPrueba });
  return { adoptado: true, sumados };
}

// ── EL CONTACTO DESDE LA ASESORÍA (tercera vuelta, 27-nov-2026) ──────────────────────────────────────────────────────────────────
/** El flujo de cada plazo en avisos_evaluados (el mismo que mostró el perfil de la asesoría). */
const COLUMNA_FLUJO: Record<number, string> = { 30: "flujo_20", 25: "flujo_20_25", 20: "flujo_20_20", 15: "flujo_20_15" };

export interface ContactoAsesoria { deptos: DeptoAsesoria[]; urgencia: UrgenciaInvierte; pie: PieInvierte }

/** Los deptos que trae «Seguir con estos deptos» (solo de sus elegidos), con su calle o comuna, precio y lo que dejan a SU plazo, y
 *  lo que ya se sabe para no preguntarlo (asesoria.ts). null si no viene de la asesoría. */
export async function contactoDesdeAsesoria(admin: SupabaseClient, perfil: PerfilInv, depto: { avisoId: string; precioUF: number | null }, mas: string | string[] | undefined): Promise<ContactoAsesoria | null> {
  const ids = idsDeLaAsesoria(depto.avisoId, mas, perfil.elegidos);
  if (!ids) return null;
  const col = COLUMNA_FLUJO[perfil.plazoAnios ?? 30] ?? "flujo_20";
  const [sp, ae] = await Promise.all([
    admin.from("scraped_properties").select("id, direccion, comuna").in("id", ids),
    admin.from("avisos_evaluados").select(`aviso_id, precio_uf, ${col}`).in("aviso_id", ids),
  ]);
  if (sp.error || ae.error) return null;
  const lugarDe = new Map((sp.data ?? []).map((x) => [String(x.id), lugarCorto(x.direccion as string | null, x.comuna as string | null)]));
  const evDe = new Map(((ae.data ?? []) as unknown as Array<Record<string, unknown>>).map((x) => [String(x.aviso_id), x]));
  const deptos = ids.flatMap((id) => {
    const e = evDe.get(id);
    if (!e || e.precio_uf == null) return [];
    return [{ avisoId: id, lugar: lugarDe.get(id) ?? "", precioUF: Number(e.precio_uf), flujoCLP: e[col] == null ? null : Math.round(Number(e[col])) }];
  });
  if (!deptos.length) return null;
  return { deptos, ...contactoDeAsesoria({ preaprobado: perfil.preaprobado, topePieUF: perfil.topePieUF, pieTiene: perfil.pieTiene }, depto.precioUF) };
}

/** La calle sin el número (lo que sigue a la primera coma, fuera), o la comuna si no hay dirección. */
function lugarCorto(direccion: string | null, comuna: string | null): string {
  const d = (direccion ?? "").split(",")[0].replace(/\s+\d[\d\s-]*$/, "").trim();
  return d.length >= 3 ? d : comuna ?? "";
}
