// ─────────────────────────────────────────────────────────────────────────────
// Comparar (30-sep-2026): dos o más informes propios lado a lado —veredicto, precio, flujo y
// resultado a 10 años—, leídos COMO LOS LEE EL INFORME: cada uno se recalcula con el motor vivo, la
// UF congelada de su fila y su mediana/snapshot (LTR `recomputeResultsForLegacy`, STR
// `recomputeShortTermForLegacy`). El resultado a 10 años es el mismo del capítulo V: tu parte al
// vender (`exitScenario.equityCLP`), en pesos de hoy. Solo lectura.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { normalizarResultsStrPersistidos } from "@/lib/analysis/normalizar-results-str";
import { conOcupacionRealizadaDelCache } from "@/lib/airbnb/ocupacion-realizada-cache";
import { prefetchCapRefComuna, prefetchMedianaComunaVenta, prefetchMercadoStr } from "@/lib/api-helpers/analisis-pipeline";
import { getUFValue, resolveUfForAnalysis } from "@/lib/uf";
import { readVeredicto } from "@/lib/results-helpers";
import type { Veredicto } from "@/lib/types";

import { COMPARAR_MAX, COMPARAR_MIN, type ColumnaComparar, type OpcionComparar } from "./comparar-tipos";
export { COMPARAR_MAX, COMPARAR_MIN, type ColumnaComparar, type OpcionComparar };

/** Los ids que pide la URL, sin repetidos, en su orden, dentro del rango. */
export function idsComparar(raw: string | null | undefined): string[] {
  const ids = (raw ?? "").split(",").map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s));
  return Array.from(new Set(ids)).slice(0, COMPARAR_MAX);
}

export async function opcionesComparar(sb: SupabaseClient, userId: string): Promise<OpcionComparar[]> {
  const { data } = await sb
    .from("analisis")
    .select("id, nombre, comuna, tipo_analisis, created_at")
    .eq("user_id", userId)
    .not("results", "is", null)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    nombre: (r.nombre as string) || "Análisis",
    comuna: (r.comuna as string) ?? null,
    modalidad: r.tipo_analisis === "short-term" ? "str" : "ltr",
    createdAt: r.created_at as string,
  }));
}

/** Lo que la tabla lee del resultado recalculado (LTR o STR). */
type ResultadoLeido = {
  metrics?: { flujoNetoMensual?: number; flujoMensual?: number };
  escenarios?: { base?: { flujoCajaMensual?: number } };
  exitScenario?: { equityCLP?: number };
  francoScore?: { veredicto?: Veredicto };
} | null | undefined;
type FilaComparar = {
  id: string; nombre: string | null; comuna: string | null; tipo_analisis: string | null; created_at: string;
  input_data: Record<string, unknown> | null; results: unknown;
  mediana_comuna_snapshot: { mediana: number; n?: number; p25?: number; p75?: number; estimada?: boolean } | null;
  capref_comuna_snapshot: unknown; strref_zona_snapshot: unknown;
};
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function columnasComparar(sb: SupabaseClient, userId: string, ids: string[]): Promise<ColumnaComparar[]> {
  if (ids.length === 0) return [];
  const { data } = await sb
    .from("analisis")
    .select("id, nombre, comuna, tipo_analisis, created_at, input_data, results, mediana_comuna_snapshot, capref_comuna_snapshot, strref_zona_snapshot")
    .in("id", ids)
    .eq("user_id", userId);
  const ufLive = await getUFValue();
  const porId = new Map((data ?? []).map((r) => [r.id as string, r as unknown as FilaComparar]));
  const out: ColumnaComparar[] = [];
  for (const id of ids) {
    const f = porId.get(id);
    if (!f) continue;
    const inp = f.input_data;
    const esStr = f.tipo_analisis === "short-term";
    const asOf = new Date(f.created_at);
    try {
      if (!esStr) {
        const uf = resolveUfForAnalysis(f.results as never, inp as never, ufLive, f.id);
        const snap = f.mediana_comuna_snapshot;
        const med = inp
          ? snap != null
            ? { mediana: snap.mediana, n: snap.n ?? 0, p25: snap.p25, p75: snap.p75, ...(snap.estimada ? { estimada: true } : {}), capRefComuna: f.capref_comuna_snapshot ?? (await prefetchCapRefComuna(sb, inp as never, uf)) }
            : await prefetchMedianaComunaVenta(sb, inp as never, uf)
          : undefined;
        const r = (inp ? recomputeResultsForLegacy(inp as never, uf, med as never, asOf) : f.results) as ResultadoLeido;
        out.push({
          id, nombre: f.nombre || "Análisis", comuna: f.comuna ?? null, modalidad: "ltr",
          veredicto: readVeredicto(r as never) ?? null,
          precioUF: Number(inp?.precio) || null,
          flujoMensualCLP: num(r?.metrics?.flujoNetoMensual),
          resultado10CLP: num(r?.exitScenario?.equityCLP),
          uf,
        });
      } else {
        const precioUF = Number(inp?.precioCompraUF) || 0;
        const uf = precioUF > 0 ? Number(inp?.precioCompra) / precioUF : ufLive;
        const med = inp
          ? await prefetchMercadoStr(sb, {
              comuna: typeof inp.comuna === "string" ? inp.comuna : "", superficie: Number(inp.superficieUtil) || 0, dormitorios: Number(inp.dormitorios) || 0,
              esNuevo: inp.tipoPropiedad === "nuevo", antiguedad: typeof inp.antiguedad === "number" ? inp.antiguedad : undefined,
            }, uf, (f.strref_zona_snapshot ?? null) as never)
          : { mediana: null, n: 0 };
        // Como el informe: la ocupación realizada del caché entra antes del recálculo.
        const persist = await conOcupacionRealizadaDelCache(inp, normalizarResultsStrPersistidos(f.results as never));
        const r = ((inp && recomputeShortTermForLegacy(inp as never, persist, uf, asOf, med)) ?? persist) as ResultadoLeido;
        out.push({
          id, nombre: f.nombre || "Análisis", comuna: f.comuna ?? null, modalidad: "str",
          veredicto: r?.francoScore?.veredicto ?? readVeredicto(r as never) ?? null,
          precioUF: precioUF || null,
          // La misma fuente que el capítulo del flujo en renta corta (CapitulosInversionStr).
          flujoMensualCLP: num(r?.metrics?.flujoMensual) ?? num(r?.escenarios?.base?.flujoCajaMensual),
          resultado10CLP: num(r?.exitScenario?.equityCLP),
          uf,
        });
      }
    } catch {
      out.push({ id, nombre: f.nombre || "Análisis", comuna: f.comuna ?? null, modalidad: esStr ? "str" : "ltr", veredicto: null, precioUF: null, flujoMensualCLP: null, resultado10CLP: null, uf: ufLive });
    }
  }
  return out;
}
