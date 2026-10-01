// «Quiero verlo» en el panel (01-oct-2026): la lista de los intereses y sus totales por comuna, por
// veredicto y por semana. SOLO LECTURA. Las filas salen de `interes_avisos` con el informe que las
// originó (`analisis`: comuna, precio, tipología); la persona, de Auth.
import type { SupabaseClient } from "@supabase/supabase-js";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { PAGINA_POSTGREST } from "@/lib/comuna-stats";

export interface FilaQuieroVerlo {
  analysisId: string;
  userId: string;
  creadoAt: string;
  persona: string;
  perfil: { piePct: number | null; plazo: number | null; tasa: number | null };
  comuna: string;
  tipologia: string | null;
  precioUF: number | null;
  veredicto: string | null;
  score: number | null;
  correo: "enviado" | "despublicado" | "pendiente";
}

/** El lunes (America/Santiago) de la semana de una fecha, como AAAA-MM-DD. */
export function semanaDe(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Totales por comuna, por veredicto y por semana; cada lista de mayor a menor (la semana, la más nueva primero). */
export function resumirQuieroVerlo(filas: Array<Pick<FilaQuieroVerlo, "comuna" | "veredicto" | "creadoAt">>) {
  const contar = (clave: (f: (typeof filas)[number]) => string) => {
    const m = new Map<string, number>();
    for (const f of filas) m.set(clave(f), (m.get(clave(f)) ?? 0) + 1);
    return Array.from(m, ([k, n]) => ({ k, n }));
  };
  return {
    total: filas.length,
    porComuna: contar((f) => f.comuna || "—").sort((a, b) => b.n - a.n || a.k.localeCompare(b.k)),
    porVeredicto: contar((f) => f.veredicto ?? "—").sort((a, b) => b.n - a.n || a.k.localeCompare(b.k)),
    porSemana: contar((f) => semanaDe(f.creadoAt)).sort((a, b) => b.k.localeCompare(a.k)),
  };
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Las filas, la más nueva primero. `noTest`: el filtro de cuentas de prueba (filtroNoTest) o null. */
export async function leerQuieroVerlo(sb: SupabaseClient, noTest: string | null): Promise<FilaQuieroVerlo[]> {
  const intereses: Array<Record<string, unknown>> = [];
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    let q = sb.from("interes_avisos").select("analysis_id, user_id, veredicto, score, perfil, created_at, correo_enviado_at, aviso_despublicado_at");
    if (noTest) q = q.or(noTest);
    const { data, error } = await q.order("created_at", { ascending: false }).order("analysis_id").range(off, off + PAGINA_POSTGREST - 1);
    if (error) throw new Error(`interes_avisos: ${error.message}`);
    intereses.push(...(data ?? []));
    if (!data || data.length < PAGINA_POSTGREST) break;
  }
  const ids = intereses.map((i) => i.analysis_id as string);
  const informes = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from("analisis").select("id, comuna, input_data").in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`analisis: ${error.message}`);
    for (const a of data ?? []) informes.set(a.id as string, a);
  }
  const personas = new Map<string, string>();
  for (const uid of Array.from(new Set(intereses.map((i) => i.user_id as string)))) {
    const { data } = await sb.auth.admin.getUserById(uid);
    const u = data?.user;
    const nombre = (u?.user_metadata?.full_name ?? u?.user_metadata?.name ?? u?.user_metadata?.nombre ?? "") as string;
    personas.set(uid, [nombre.trim(), u?.email ?? ""].filter(Boolean).join(" · ") || uid);
  }
  return intereses.map((i) => {
    const a = informes.get(i.analysis_id as string);
    const input = (a?.input_data ?? {}) as Record<string, unknown>;
    const perfil = (i.perfil ?? {}) as Record<string, unknown>;
    return {
      analysisId: i.analysis_id as string,
      userId: i.user_id as string,
      creadoAt: i.created_at as string,
      persona: personas.get(i.user_id as string) ?? (i.user_id as string),
      perfil: { piePct: num(perfil.piePct), plazo: num(perfil.plazo), tasa: num(perfil.tasa) },
      comuna: String(a?.comuna ?? input.comuna ?? ""),
      tipologia: tipologiaDe(input.dormitorios, input.banos),
      precioUF: num(input.precio),
      veredicto: (i.veredicto as string | null) ?? null,
      score: num(i.score),
      correo: i.correo_enviado_at ? "enviado" : i.aviso_despublicado_at ? "despublicado" : "pendiente",
    };
  });
}
