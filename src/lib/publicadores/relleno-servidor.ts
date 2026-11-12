// ─────────────────────────────────────────────────────────────────────────────
// El relleno de publicadores contra la base y la fuente (12-nov-2026). Las reglas y el fusible, en relleno.ts.
//   · La bajada va por DECODO (`DECODO_RELLENO_URL`), nunca por `PROXY_URL`, que es la IP de las lecturas de las personas.
//   · Su tope y su bitácora son suyos (`lecturas_relleno`): el tope de 30 por hora de las personas no lo ve.
//   · El estado del fusible vive en `config` (`relleno_publicadores_fusible`).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProxyAgent } from "undici";
import { claveEdificio } from "@/lib/guia/ficha-anio";
import { almacenPublicacion } from "@/lib/guia/ficha-servidor";
import { leerFicha, TIMEOUT_FICHA_MS, type AlmacenPublicacion, type RespuestaFicha } from "@/lib/guia/publicacion";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { RITMO_RELLENO_POR_HORA, type CandidatoRelleno, type DepsRelleno, type MotivoFusible } from "./relleno";

const RUTA = "lib/publicadores/relleno";
export const CLAVE_FUSIBLE = "relleno_publicadores_fusible";

/** El proxy del relleno: Decodo, con su propia credencial. null si no está configurado (el relleno no lee nada). */
let agente: ProxyAgent | null | undefined;
export function proxyRelleno(): ProxyAgent | null {
  if (agente === undefined) agente = process.env.DECODO_RELLENO_URL ? new ProxyAgent(process.env.DECODO_RELLENO_URL) : null;
  return agente;
}

/** UN pedido a la ficha por Decodo, sin seguir redirecciones y con tiempo máximo. */
export async function bajarFichaRelleno(url: string): Promise<RespuestaFicha> {
  const dispatcher = proxyRelleno();
  // Sin Decodo no se sale: nunca por la IP de las personas ni directo.
  if (!dispatcher) return { falla: "red" };
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "es-CL,es;q=0.9",
      },
      redirect: "manual",
      dispatcher,
      signal: AbortSignal.timeout(TIMEOUT_FICHA_MS),
    } as RequestInit & { dispatcher?: unknown });
    return { status: r.status, location: r.headers.get("location"), html: r.status === 200 ? await r.text() : null };
  } catch (e) {
    const n = (e as { name?: string })?.name;
    if (n === "TimeoutError" || n === "AbortError") return { falla: "tiempo" };
    return { falla: "red" };
  }
}

/** El almacén del relleno: el de la guía para lo que se sabe del aviso, con SU bitácora y SU tope. */
export function almacenRelleno(admin: SupabaseClient): AlmacenPublicacion {
  const base = almacenPublicacion(admin);
  return {
    ...base,
    async lecturasUltimaHora() {
      // Fichas por hora: cuenta el resultado de cada chequeo, no el salto de la ficha vieja a la nueva.
      const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await admin.from("lecturas_relleno").select("id", { count: "exact", head: true }).gte("leido_at", desde).neq("motivo", "redirige");
      reportarFalloQuery(error, { ruta: RUTA, operacion: "contar-hora" });
      return error || count == null ? Number.POSITIVE_INFINITY : count;
    },
    async anotar(l) {
      const { error } = await admin.from("lecturas_relleno").insert({ aviso_id: l.avisoId, codigo: l.codigo, motivo: l.motivo, destino: l.destino });
      reportarFalloQuery(error, { ruta: RUTA, operacion: "anotar-lectura" });
    },
    // El bloqueo del relleno lo maneja su fusible: no entra a la vigilancia de las lecturas de las personas.
    async alertarBloqueo(l) {
      console.warn(`[relleno] la fuente bloquea: aviso ${l.avisoId} · ${l.codigo ?? "-"} ${l.destino ?? ""}`.trim());
    },
  };
}

export async function leerFusible(admin: SupabaseClient, ahora: Date = new Date()): Promise<{ hasta: Date; motivo: string; detalle: string; at: string } | null> {
  const { data, error } = await admin.from("config").select("value").eq("key", CLAVE_FUSIBLE).maybeSingle();
  reportarFalloQuery(error, { ruta: RUTA, operacion: "leer-fusible" });
  const v = (data as { value?: string } | null)?.value;
  if (!v) return null;
  try {
    const o = JSON.parse(v) as { hasta?: string; motivo?: string; detalle?: string; at?: string };
    const hasta = new Date(String(o.hasta));
    if (!(hasta.getTime() > ahora.getTime())) return null;
    return { hasta, motivo: String(o.motivo ?? ""), detalle: String(o.detalle ?? ""), at: String(o.at ?? "") };
  } catch {
    return null;
  }
}

export function depsRelleno(admin: SupabaseClient): DepsRelleno {
  const almacen = almacenRelleno(admin);
  return {
    async fusible() {
      return leerFusible(admin);
    },
    async saltarFusible(motivo: MotivoFusible, detalle: string, hasta: Date) {
      const at = new Date().toISOString();
      const { error } = await admin.from("config").upsert({ key: CLAVE_FUSIBLE, value: JSON.stringify({ hasta: hasta.toISOString(), motivo, detalle, at }), updated_at: at }, { onConflict: "key" });
      reportarFalloQuery(error, { ruta: RUTA, operacion: "saltar-fusible" });
      console.warn(`[relleno] saltó el fusible (${motivo}): ${detalle}. Detenido hasta ${hasta.toISOString()}.`);
    },
    async candidatos(limite: number): Promise<CandidatoRelleno[]> {
      const { data, error } = await admin.rpc("relleno_publicadores_candidatos", { p_limite: limite });
      reportarFalloQuery(error, { ruta: RUTA, operacion: "candidatos" });
      if (error) throw new Error(`candidatos: ${error.message}`);
      const vistos = new Set<string>();
      const out: CandidatoRelleno[] = [];
      for (const f of (data ?? []) as Array<{ aviso_id: string; url: string; comuna: string | null; lat: number | null; lng: number | null; prioridad: number }>) {
        if (vistos.has(f.aviso_id) || !f.url) continue;
        vistos.add(f.aviso_id);
        const edificio = f.lat != null && f.lng != null ? claveEdificio({ comuna: f.comuna ?? "", lat: Number(f.lat), lng: Number(f.lng) }) : `aviso|${f.aviso_id}`;
        out.push({ avisoId: f.aviso_id, url: f.url, edificio, prioridad: Number(f.prioridad) });
      }
      return out;
    },
    leer(c) {
      return leerFicha({ id: c.avisoId, url: c.url, edificio: c.edificio }, "relleno", almacen, bajarFichaRelleno, new Date(), { tope: RITMO_RELLENO_POR_HORA });
    },
    esperar(ms) {
      return new Promise((r) => setTimeout(r, ms));
    },
    ahora() {
      return new Date();
    },
  };
}

/** Lo que el panel muestra del relleno: cuántos leídos, cuántos faltan y el fusible. */
export async function estadoRelleno(admin: SupabaseClient): Promise<{ configurado: boolean; leidas24h: number | null; publicadores: number | null; fusible: Awaited<ReturnType<typeof leerFusible>> }> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [l, p, fusible] = await Promise.all([
    admin.from("lecturas_relleno").select("id", { count: "exact", head: true }).gte("leido_at", desde).neq("motivo", "redirige"),
    admin.from("publicadores").select("id", { count: "exact", head: true }),
    leerFusible(admin),
  ]);
  return { configurado: !!process.env.DECODO_RELLENO_URL, leidas24h: l.error ? null : l.count ?? 0, publicadores: p.error ? null : p.count ?? 0, fusible };
}
