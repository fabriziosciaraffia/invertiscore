// EL ACUERDO Y LOS OTROS DEPTOS (25-nov-2026; decisión de Fabrizio). Con un acuerdo en un depto (una oferta a firme aceptada, o ya en
// promesa, escritura o inscrito), las ofertas en espera y los demás deptos quedan en pausa: no se presentan y no se firma una oferta nueva.
// Es la regla de la promesa adelantada al acuerdo, porque una oferta a firme aceptada ya compromete. Si ese negocio no sigue (el depto
// sale de esas etapas), Franco le pregunta a la persona antes de presentar la que estaba en espera: nada pasa solo.
// Y el paso a «acuerdo» deja la fecha de la etapa y su línea en la bitácora, igual que cuando el admin cambia la etapa a mano.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ETAPAS_CON_ACUERDO } from "./b4";
import { anotar } from "./servidor";

/** El depto (id) de la persona con un acuerdo vigente, fuera de `exceptoDeptoId`; null si no hay. */
export async function deptoConAcuerdo(admin: SupabaseClient, userId: string, exceptoDeptoId: string | null): Promise<string | null> {
  let q = admin.from("inv_deptos").select("id").eq("user_id", userId).eq("estado", "elegido").in("etapa", ETAPAS_CON_ACUERDO as unknown as string[]).limit(1);
  if (exceptoDeptoId) q = q.neq("id", exceptoDeptoId);
  const { data } = await q;
  return ((data ?? [])[0]?.id as string | undefined) ?? null;
}

/** El depto pasa a la etapa del acuerdo (en_firme) con su fecha y una línea «depto_etapa» en la bitácora, como el cambio a mano. */
export async function pasarAAcuerdo(admin: SupabaseClient, deptoId: string, actor: { tipo: "admin" | "persona" | "sistema"; email: string | null }, iso: string): Promise<void> {
  const { data: d } = await admin.from("inv_deptos").select("user_id, aviso_id, etapa, es_prueba").eq("id", deptoId).maybeSingle();
  if (!d || d.etapa === "en_firme") return;
  const { error } = await admin.from("inv_deptos").update({ etapa: "en_firme", etapa_at: iso, updated_at: iso }).eq("id", deptoId);
  if (error) { console.error("[inv2] pasar a acuerdo:", error.message); return; }
  await anotar(admin, { userId: d.user_id as string, email: null, actor: actor.tipo, actorEmail: actor.email, accion: "depto_etapa", detalle: { aviso_id: d.aviso_id, de: d.etapa, a: "en_firme", motivo: "oferta_aceptada" }, esPrueba: d.es_prueba === true });
}
