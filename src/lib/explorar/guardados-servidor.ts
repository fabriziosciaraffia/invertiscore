// Los guardados de la cuenta para el dashboard (28-oct-2026; las reglas en guardados.ts): los últimos 60 que guardó con el
// corazón en Explorar, con su línea y la evaluación de la noche con el financiamiento por defecto (pie 20 % y 30 años: el
// de la vista global, deptos/estandar.ts), y su
// informe si ya lo analizó. Solo lectura.
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { condicionDe } from "@/lib/guia/linea-depto";
import { informesDeExplorar } from "./servidor";
import type { DeptoGuardado } from "./guardados";
import { PLAZO_POR_DEFECTO } from "@/lib/deptos/estandar";

/** Las columnas de la noche con el plazo por defecto: a 30 años, la evaluación de siempre; a 25, las columnas `*_25`. */
const COLS = PLAZO_POR_DEFECTO === 30 ? { v: "veredicto_20", s: "score_20", f: "flujo_20" } : { v: "veredicto_20_25", s: "score_20_25", f: "flujo_20_25" };

const RUTA = "lib/explorar/guardados";
/** Cuántos se muestran (los más recientes): la lectura por id va en la URL y no puede ser larga. */
export const MAX_GUARDADOS_CASA = 60;

export async function guardadosParaCasa(admin: SupabaseClient, userId: string): Promise<DeptoGuardado[]> {
  const { data: g, error } = await admin.from("explorar_guardados").select("aviso_id, creado_at").eq("user_id", userId).order("creado_at", { ascending: false }).limit(MAX_GUARDADOS_CASA);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "guardados", userId });
  const ids = ((g ?? []) as Array<{ aviso_id: string }>).map((r) => r.aviso_id);
  if (ids.length === 0) return [];
  const [{ data: sp, error: e1 }, { data: ae, error: e2 }, informes] = await Promise.all([
    admin.from("scraped_properties").select("id, comuna, superficie_m2, dormitorios, banos, condicion, is_active").in("id", ids).order("id").limit(60),
    admin.from("avisos_evaluados").select(`aviso_id, precio_uf, ${COLS.v}, ${COLS.s}, ${COLS.f}, arriendo`).in("aviso_id", ids),
    informesDeExplorar(admin, userId),
  ]);
  reportarFalloQuery(e1, { ruta: RUTA, operacion: "avisos", userId });
  reportarFalloQuery(e2, { ruta: RUTA, operacion: "evaluados", userId });
  const avisos = new Map(((sp ?? []) as Array<Record<string, unknown>>).map((r) => [String(r.id), r]));
  const evals = new Map(((ae ?? []) as unknown as Array<Record<string, unknown>>).map((r) => [String(r.aviso_id), r]));
  const num = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return ids.flatMap((id) => {
    const a = avisos.get(id);
    if (!a) return [];
    const e = evals.get(id);
    const cond = condicionDe(a.condicion);
    const arriendo = num((e?.arriendo as { monto?: unknown } | null | undefined)?.monto);
    return [{
      avisoId: id, comuna: String(a.comuna ?? ""), m2: Math.round(Number(a.superficie_m2) || 0), tipologia: tipologiaDe(a.dormitorios, a.banos),
      ...(cond ? { condicion: cond } : {}),
      precioUF: num(e?.precio_uf) != null ? Math.round(Number(e!.precio_uf)) : null,
      veredicto: (e?.[COLS.v] as string | null) ?? null, score: num(e?.[COLS.s]), flujo: num(e?.[COLS.f]),
      arriendo: arriendo != null && arriendo > 0 ? arriendo : null,
      activo: a.is_active === true, informeId: informes[id] ?? null,
    }];
  });
}
