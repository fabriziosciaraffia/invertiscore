// El almacén de las fichas leídas (tablas `fichas_leidas` y `anios_edificio`, service role) y la
// bajada de UNA ficha por el proxy, sin reintentos. Los resguardos viven en ficha-anio.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { proxyDispatcher } from "@/lib/services/scraper/toctoc";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { TIMEOUT_FICHA_MS, type AlmacenFichas } from "./ficha-anio";

const RUTA = "lib/guia/ficha-anio";

export function almacenFichas(admin: SupabaseClient): AlmacenFichas {
  return {
    async anioEdificio(clave) {
      const { data, error } = await admin.from("anios_edificio").select("anio").eq("edificio", clave).maybeSingle();
      reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-anio-edificio" });
      return typeof data?.anio === "number" ? data.anio : null;
    },
    async fichaLeida(avisoId) {
      const { data, error } = await admin.from("fichas_leidas").select("anio").eq("aviso_id", avisoId).maybeSingle();
      reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-ficha-leida" });
      // Si la lectura falla no sabemos si se leyó: se trata como leída (no se sale a la fuente).
      if (error) return { anio: null };
      return data ? { anio: typeof data.anio === "number" ? data.anio : null } : null;
    },
    async lecturasUltimaHora() {
      const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await admin.from("fichas_leidas").select("aviso_id", { count: "exact", head: true }).gte("leido_at", desde);
      reportarFalloQuery(error, { ruta: RUTA, operacion: "contar-hora" });
      // Sin conteo no hay cómo respetar el tope: se da por lleno.
      return error || count == null ? Number.POSITIVE_INFINITY : count;
    },
    async reservar(avisoId, clave) {
      const { error } = await admin.from("fichas_leidas").insert({ aviso_id: avisoId, edificio: clave, estado: "reservada" });
      if (error && error.code !== "23505") reportarFalloQuery(error, { ruta: RUTA, operacion: "reservar" });
      return !error;
    },
    async cerrar(avisoId, estado, anio) {
      const { error } = await admin.from("fichas_leidas").update({ estado, anio }).eq("aviso_id", avisoId);
      reportarFalloQuery(error, { ruta: RUTA, operacion: "cerrar" });
    },
    async guardarAnioEdificio(clave, anio, avisoId) {
      const { error } = await admin.from("anios_edificio").upsert({ edificio: clave, anio, aviso_id: avisoId }, { onConflict: "edificio", ignoreDuplicates: true });
      reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-anio-edificio" });
    },
  };
}

/** UN pedido a la ficha, por el proxy, con tiempo máximo. null si no vuelve un 200 con cuerpo. */
export async function bajarFicha(url: string): Promise<string | null> {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      Accept: "text/html",
      "Accept-Language": "es-CL,es;q=0.9",
    },
    dispatcher: proxyDispatcher,
    signal: AbortSignal.timeout(TIMEOUT_FICHA_MS),
  } as RequestInit & { dispatcher?: unknown });
  if (r.status !== 200) return null;
  const t = await r.text();
  return t.trim() ? t : null;
}
