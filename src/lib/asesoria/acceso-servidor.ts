// ─────────────────────────────────────────────────────────────────────────────
// EL INTERRUPTOR DE LA ASESORÍA, EN EL SERVIDOR (27-nov-2026). Se llama POR PEDIDO, nunca dentro de `unstable_cache`: el booleano
// es de un dispositivo. El modo y la lista se recuerdan 60 s por proceso (el admin los olvida al cambiarlos). Sin poder leer: apagada.
// ─────────────────────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/service";
import { accesoAsesoria, CLAVE_MODO_ASESORIA, leerModoAsesoria, SIN_ASESORIA, TABLA_ACCESO_ASESORIA, type AccesoAsesoria, type ModoAsesoria } from "./acceso";

const VIDA_MS = 60_000;
let recordado: { modo: ModoAsesoria; lista: Set<string>; at: number } | null = null;

export function olvidarAccesoAsesoria(): void {
  recordado = null;
}

export async function estadoAsesoria(): Promise<{ modo: ModoAsesoria; lista: Set<string> }> {
  if (recordado && Date.now() - recordado.at < VIDA_MS) return recordado;
  try {
    const admin = createServiceClient();
    const [c, l] = await Promise.all([
      admin.from("config").select("value").eq("key", CLAVE_MODO_ASESORIA).maybeSingle(),
      admin.from(TABLA_ACCESO_ASESORIA).select("dispositivo_hash").order("dispositivo_hash").range(0, 999),
    ]);
    if (c.error || l.error) return { modo: "apagada", lista: new Set() };
    recordado = { modo: leerModoAsesoria(c.data?.value), lista: new Set((l.data ?? []).map((f) => String(f.dispositivo_hash))), at: Date.now() };
    return recordado;
  } catch {
    return { modo: "apagada", lista: new Set() };
  }
}

/** ¿Este dispositivo (en hash) o esta cuenta ven la asesoría, y son prueba? */
export async function accesoAsesoriaDe(p: { dispositivoHash: string | null; userId: string | null }): Promise<AccesoAsesoria> {
  // SOLO EN DESARROLLO LOCAL (`next dev`): ASESORIA_LOCAL=todos la muestra como prueba sin tocar la base, para recorrerla en local.
  // En un build (preview o producción) NODE_ENV es «production» y esta línea no existe para nadie.
  if (process.env.NODE_ENV === "development" && process.env.ASESORIA_LOCAL === "todos") return { habilitada: true, prueba: true };
  const { modo, lista } = await estadoAsesoria();
  if (modo === "apagada") return SIN_ASESORIA;
  let cuentaDePrueba = false;
  if (p.userId) {
    try {
      const { data } = await createServiceClient().from("test_accounts").select("user_id").eq("user_id", p.userId).maybeSingle();
      cuentaDePrueba = !!data;
    } catch {
      cuentaDePrueba = false;
    }
  }
  return accesoAsesoria({ modo, dispositivoEnLista: !!p.dispositivoHash && lista.has(p.dispositivoHash), cuentaDePrueba });
}
