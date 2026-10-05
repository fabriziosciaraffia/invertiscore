// El perfil de búsqueda desde la base (02-oct-2026): las filas de `perfiles_inversion` de la persona
// (una por informe; el plazo sale del `input_data` de cada informe) y lo editado a mano en
// `perfil_busqueda`. La regla de cómo se juntan vive en perfil-busqueda.ts (puro).
// Los informes de renta larga SIN fila en `perfiles_inversion` (anteriores al 28-sep-2026, cuando nació
// la tabla) entran también, armados desde su `input_data` (`filaDesdeInforme`, 05-oct-2026): el perfil se
// alimenta de TODOS sus informes, y el correo semanal le llega a quien tenga uno.
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { MANUAL_VACIO, perfilDeBusqueda, type FilaPerfilInforme, type Horizonte, type Modalidad, type PerfilBusqueda, type PerfilManual } from "./perfil-busqueda";

const RUTA = "lib/perfil-busqueda";
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const horiz = (v: unknown): Horizonte | null => (v === "ya" || v === "meses" || v === "mirando" ? v : null);
const modal = (v: unknown): Modalidad | null => (v === "ltr" || v === "str" ? v : null);

export interface PerfilDeLaPersona {
  perfil: PerfilBusqueda;
  manual: PerfilManual;
  semanalBajaAt: string | null;
  regaloOtorgadoAt: string | null;
}

/** Un informe de renta larga como fila de perfil, desde lo que la persona puso en el wizard. */
export function filaDesdeInforme(a: { created_at: string; comuna: string | null; input_data: unknown }): FilaPerfilInforme {
  const i = (a.input_data ?? {}) as Record<string, unknown>;
  return {
    creadoAt: a.created_at,
    tipologia: tipologiaDe(i.dormitorios, i.banos),
    comuna: (typeof i.comuna === "string" && i.comuna.trim() ? i.comuna : a.comuna) ?? null,
    modalidad: "ltr",
    presupuestoUf: num(i.precio),
    piePct: num(i.piePct),
    plazoAnios: num(i.plazoCredito),
    prefTipologia: null,
    prefComuna: null,
    prefModalidad: null,
    horizonte: null,
  };
}

export async function leerPerfilBusqueda(admin: SupabaseClient, userId: string): Promise<PerfilDeLaPersona> {
  const [{ data: filas, error: e1 }, { data: man, error: e2 }, { data: ltr, error: e3 }] = await Promise.all([
    admin.from("perfiles_inversion")
      .select("analysis_id, created_at, tipologia, comuna, modalidad, presupuesto_uf, pie_pct, pref_tipologia, pref_comuna, pref_modalidad, horizonte_compra")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    admin.from("perfil_busqueda").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("analisis").select("id, created_at, comuna, input_data").eq("user_id", userId).eq("tipo_analisis", "long-term")
      .order("created_at", { ascending: false }).limit(200),
  ]);
  reportarFalloQuery(e3, { ruta: RUTA, operacion: "leer-informes", userId });
  reportarFalloQuery(e1, { ruta: RUTA, operacion: "leer-perfiles", userId });
  reportarFalloQuery(e2, { ruta: RUTA, operacion: "leer-manual", userId });
  const ids = (filas ?? []).map((f) => f.analysis_id as string);
  const plazos = new Map<string, number | null>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await admin.from("analisis").select("id, input_data").in("id", ids.slice(i, i + 100));
    for (const a of data ?? []) plazos.set(a.id as string, num((a.input_data as Record<string, unknown> | null)?.plazoCredito));
  }
  const informes: FilaPerfilInforme[] = (filas ?? []).map((f) => ({
    creadoAt: f.created_at as string,
    tipologia: (f.tipologia as string | null) ?? null,
    comuna: (f.comuna as string | null) ?? null,
    modalidad: modal(f.modalidad) ?? "ltr",
    presupuestoUf: num(f.presupuesto_uf),
    piePct: num(f.pie_pct),
    plazoAnios: plazos.get(f.analysis_id as string) ?? null,
    prefTipologia: (f.pref_tipologia as string | null) ?? null,
    prefComuna: (f.pref_comuna as string | null) ?? null,
    prefModalidad: modal(f.pref_modalidad),
    horizonte: horiz(f.horizonte_compra),
  }));
  const conFila = new Set(ids);
  for (const a of ltr ?? []) {
    if (conFila.has(a.id as string)) continue;
    informes.push(filaDesdeInforme({ created_at: a.created_at as string, comuna: (a.comuna as string | null) ?? null, input_data: a.input_data }));
  }
  const m = man as Record<string, unknown> | null;
  const manual: PerfilManual = m
    ? {
        dormitorios: Array.isArray(m.dormitorios) ? (m.dormitorios as number[]) : null,
        comunas: Array.isArray(m.comunas) ? (m.comunas as string[]) : null,
        precioMaxUf: num(m.precio_max_uf),
        modalidad: modal(m.modalidad),
        piePct: num(m.pie_pct),
        plazoAnios: num(m.plazo_anios),
        horizonte: horiz(m.horizonte_compra),
      }
    : MANUAL_VACIO;
  return {
    perfil: perfilDeBusqueda(informes, manual),
    manual,
    semanalBajaAt: (m?.semanal_baja_at as string | null) ?? null,
    regaloOtorgadoAt: (m?.regalo_otorgado_at as string | null) ?? null,
  };
}
