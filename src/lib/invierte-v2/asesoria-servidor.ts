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
