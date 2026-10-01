// El almacén de las lecturas de ficha (service role) y la bajada de UNA ficha por el proxy: sin seguir
// redirecciones, sin reintentos, con tiempo máximo. Los resguardos y la clasificación viven en
// publicacion.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { proxyDispatcher } from "@/lib/services/scraper/toctoc";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { alertarUnaVezAlDia } from "@/lib/cron-resultado";
import { TIMEOUT_FICHA_MS, type AlmacenPublicacion, type RespuestaFicha } from "./publicacion";

const RUTA = "lib/guia/ficha";

export function almacenPublicacion(admin: SupabaseClient): AlmacenPublicacion {
  return {
    async publicacion(avisoId) {
      const { data, error } = await admin.from("publicacion_avisos").select("estado, chequeado_at").eq("aviso_id", avisoId).maybeSingle();
      reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-publicacion" });
      if (!data) return null;
      return { estado: data.estado === "despublicado" ? "despublicado" : "publicado", chequeadoAt: new Date(data.chequeado_at as string) };
    },
    async lecturasUltimaHora() {
      const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await admin.from("lecturas_ficha").select("id", { count: "exact", head: true }).gte("leido_at", desde);
      reportarFalloQuery(error, { ruta: RUTA, operacion: "contar-hora" });
      // Sin conteo no hay cómo respetar el tope: se da por lleno.
      return error || count == null ? Number.POSITIVE_INFINITY : count;
    },
    async anotar(l) {
      const { error } = await admin.from("lecturas_ficha").insert({ aviso_id: l.avisoId, tipo: l.tipo, codigo: l.codigo, motivo: l.motivo, destino: l.destino });
      reportarFalloQuery(error, { ruta: RUTA, operacion: "anotar-lectura" });
    },
    async cerrar(l) {
      const estado = l.anio != null ? "anio" : l.motivo === "publicado" ? "sin_anio" : "error";
      const { error: e2 } = await admin.from("fichas_leidas").upsert(
        { aviso_id: l.avisoId, edificio: l.edificio, estado, anio: l.anio, codigo: l.codigo, motivo: l.motivo, leido_at: new Date().toISOString() },
        { onConflict: "aviso_id" },
      );
      reportarFalloQuery(e2, { ruta: RUTA, operacion: "anotar-ficha" });
      if (l.anio != null) {
        const { error: e3 } = await admin.from("anios_edificio").upsert({ edificio: l.edificio, anio: l.anio, aviso_id: l.avisoId }, { onConflict: "edificio", ignoreDuplicates: true });
        reportarFalloQuery(e3, { ruta: RUTA, operacion: "guardar-anio-edificio" });
      }
    },
    async guardarPublicacion(avisoId, estado, codigo, destino) {
      const { error } = await admin.from("publicacion_avisos").upsert(
        { aviso_id: avisoId, estado, codigo, destino, chequeado_at: new Date().toISOString() },
        { onConflict: "aviso_id" },
      );
      reportarFalloQuery(error, { ruta: RUTA, operacion: "guardar-publicacion" });
    },
    async despublicar(avisoId) {
      const { error } = await admin.from("avisos_evaluados").delete().eq("aviso_id", avisoId);
      reportarFalloQuery(error, { ruta: RUTA, operacion: "despublicar" });
    },
    async alertarBloqueo(l) {
      try {
        await alertarUnaVezAlDia(
          admin, "ficha", new Date().toISOString().slice(0, 10),
          `La fuente respondió ${l.codigo ?? "un desafío"} al leer una ficha: está bloqueando las lecturas. La guía muestra solo lo ya chequeado hasta que se libere.`,
          { error: [`${l.tipo} · aviso ${l.avisoId} · ${l.codigo ?? "-"} ${l.destino ?? ""}`.trim()] },
          "bloqueo",
        );
      } catch (e) {
        console.error("[ficha] no se pudo alertar el bloqueo:", e);
      }
    },
  };
}

/** UN pedido a la ficha, por el proxy, sin seguir redirecciones y con tiempo máximo. */
export async function bajarFicha(url: string): Promise<RespuestaFicha> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "es-CL,es;q=0.9",
      },
      redirect: "manual",
      dispatcher: proxyDispatcher,
      signal: AbortSignal.timeout(TIMEOUT_FICHA_MS),
    } as RequestInit & { dispatcher?: unknown });
    return { status: r.status, location: r.headers.get("location"), html: r.status === 200 ? await r.text() : null };
  } catch (e) {
    const n = (e as { name?: string })?.name;
    return { falla: n === "TimeoutError" || n === "AbortError" ? "tiempo" : "red" };
  }
}
