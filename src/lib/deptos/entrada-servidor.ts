// ─────────────────────────────────────────────────────────────────────────────
// La entrada de /deptos, en el servidor (22-oct-2026; reglas en entrada.ts): el registro de cada entrada verificada
// (deptos_entradas), el hash del código, la marca del alta y el aviso de las altas perdidas a PostHog.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { capturarServidor, distinctIdDeCorreo, uuidDeterminista } from "@/lib/posthog-servidor";
import { normalizarCorreo } from "./servidor";
import { ESPERA_ALTA_PERDIDA_MS, esAltaPerdida, type EntradaRegistrada } from "./entrada";

const RUTA = "lib/deptos/entrada-servidor";
const DOMINIO = "deptos-entrada";

/** El código no se guarda: su HMAC con el secreto del servidor, para reconocer el mismo código en un reintento. */
export function hashCodigo(correo: string, codigo: string, secreto: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY): string {
  return createHmac("sha256", secreto && secreto.length >= 16 ? secreto : "sin-secreto").update(`${DOMINIO}:${normalizarCorreo(correo)}:${codigo}`).digest("base64url");
}

/** La puerta con que eligió (deptos_pendientes.puerta): B o C. */
async function puertaDe(admin: SupabaseClient, correo: string): Promise<string | null> {
  const { data } = await admin.from("deptos_pendientes").select("puerta").eq("correo", normalizarCorreo(correo)).maybeSingle();
  return (data?.puerta as string | null | undefined) ?? null;
}

/** `puerta`: si quien llama ya la sabe (la ruta del código lee lo elegido junto con verificar), una escritura sola. */
export async function registrarEntrada(admin: SupabaseClient, p: { correo: string; userId: string; metodo: "codigo" | "enlace" | "google"; codigoHash?: string | null; puerta?: Promise<string | null> }): Promise<void> {
  const correo = normalizarCorreo(p.correo);
  const { error } = await admin.from("deptos_entradas").insert({
    correo, user_id: p.userId, puerta: p.puerta ? await p.puerta : await puertaDe(admin, correo), metodo: p.metodo, codigo_hash: p.codigoHash ?? null,
  });
  reportarFalloQuery(error, { ruta: RUTA, operacion: "registrar", userId: p.userId });
}

export async function ultimaEntrada(admin: SupabaseClient, correo: string): Promise<EntradaRegistrada | null> {
  const { data, error } = await admin.from("deptos_entradas").select("id, user_id, codigo_hash, verificado_at, alta, recuperada_at")
    .eq("correo", normalizarCorreo(correo)).order("verificado_at", { ascending: false }).limit(1).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "ultima" });
  return data ? {
    id: data.id as string, userId: (data.user_id as string | null) ?? null, codigoHash: (data.codigo_hash as string | null) ?? null,
    verificadoAt: data.verificado_at as string, alta: (data.alta as Record<string, unknown> | null) ?? null, recuperadaAt: (data.recuperada_at as string | null) ?? null,
  } : null;
}

export async function marcarRepuesta(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.from("deptos_entradas").update({ recuperada_at: new Date().toISOString() }).eq("id", id);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "repuesta" });
}

/** El alta respondió: la última entrada sin alta de ese correo (o de esa cuenta) queda con su alta. */
export async function marcarAlta(admin: SupabaseClient, p: { correo: string; userId: string; alta: Record<string, unknown> }): Promise<void> {
  const { data } = await admin.from("deptos_entradas").select("id").eq("correo", normalizarCorreo(p.correo)).is("alta_at", null)
    .order("verificado_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return;
  const { error } = await admin.from("deptos_entradas").update({ alta: p.alta, alta_at: new Date().toISOString(), user_id: p.userId }).eq("id", data.id);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "marcar-alta", userId: p.userId });
}

/**
 * LAS ALTAS PERDIDAS (22-oct-2026, pedido de Fabrizio: saber cuántas veces pasa de verdad): toda entrada verificada que
 * no terminó en alta dentro del minuto sale a PostHog como `alta_perdida`, una vez, con la puerta y el camino (código,
 * enlace o Google), a la hora en que se cumplió el minuto. Las cuentas de prueba salen marcadas como todo evento del
 * servidor. Lo corre el cron de /deptos (correo-del-dia), cada 10 minutos.
 */
export async function avisarAltasPerdidas(admin: SupabaseClient, ahora: Date = new Date(), capturar: typeof capturarServidor = capturarServidor): Promise<number> {
  const hasta = new Date(ahora.getTime() - ESPERA_ALTA_PERDIDA_MS).toISOString();
  const { data, error } = await admin.from("deptos_entradas").select("id, correo, user_id, puerta, metodo, verificado_at, alta_at, perdida_avisada_at")
    .is("alta_at", null).is("perdida_avisada_at", null).lte("verificado_at", hasta).order("verificado_at", { ascending: true }).limit(100);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-perdidas" });
  let avisadas = 0;
  for (const f of (data ?? []) as Array<{ id: string; correo: string; user_id: string | null; puerta: string | null; metodo: string; verificado_at: string; alta_at: string | null; perdida_avisada_at: string | null }>) {
    if (!esAltaPerdida({ verificadoAt: f.verificado_at, altaAt: f.alta_at, perdidaAvisadaAt: f.perdida_avisada_at }, ahora)) continue;
    try {
      await capturar({
        event: "alta_perdida",
        distinctId: f.user_id ?? distinctIdDeCorreo(f.correo),
        correo: f.correo,
        uuid: uuidDeterminista(`alta_perdida:${f.id}`),
        timestamp: new Date(Date.parse(f.verificado_at) + ESPERA_ALTA_PERDIDA_MS).toISOString(),
        properties: { puerta: f.puerta ?? null, metodo: f.metodo, verificado_at: f.verificado_at },
      });
    } catch (e) {
      console.error("[deptos] alta_perdida:", e);
      continue;
    }
    const { error: eU } = await admin.from("deptos_entradas").update({ perdida_avisada_at: ahora.toISOString() }).eq("id", f.id).is("perdida_avisada_at", null);
    reportarFalloQuery(eU, { ruta: RUTA, operacion: "marcar-perdida" });
    if (!eU) avisadas++;
  }
  return avisadas;
}
