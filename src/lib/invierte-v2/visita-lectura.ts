// La visita del depto, leída de la base (24-nov-2026). Módulo aparte para que B4 y la página del depto la lean sin importarse entre sí.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VisitaResumen } from "./visita";

const n = (x: unknown) => (x == null ? null : Number.isFinite(Number(x)) ? Number(x) : null);

/** La visita del depto con su reporte (la última que no se canceló), para rondaDesde y la corrección del admin. */
export async function visitaParaRonda(admin: SupabaseClient, deptoId: string): Promise<VisitaResumen | null> {
  const { data: v } = await admin.from("inv_visitas").select("id, estado, pedida_desde, visitada_at, reporte, reporte_estado, reporte_arreglos, reporte_linea, sugerida_antes_uf, sugerida_despues_uf").eq("depto_id", deptoId).neq("estado", "cancelada").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!v) return null;
  const r = (v.reporte ?? {}) as { puntos?: VisitaResumen["puntos"]; fotos?: { path?: string; mini?: string }[]; delta?: number; rango?: { pisoUF?: number; altoUF?: number } };
  return {
    id: v.id as string, estado: v.estado as string, pedidaDesde: (v.pedida_desde as string | null) ?? null, visitadaAt: (v.visitada_at as string | null) ?? null,
    reporteEstado: (v.reporte_estado as VisitaResumen["reporteEstado"]) ?? null, reporteLinea: (v.reporte_linea as string | null) ?? null,
    arreglos: Array.isArray(v.reporte_arreglos) ? (v.reporte_arreglos as string[]) : [], puntos: Array.isArray(r.puntos) ? r.puntos : [], fotos: Array.isArray(r.fotos) ? r.fotos.filter((f): f is { path: string; mini: string } => !!f && typeof f.path === "string" && typeof f.mini === "string").map((f) => ({ path: f.path, mini: f.mini })) : [],
    delta: Number(r.delta ?? 0), pisoUF: n(r.rango?.pisoUF), altoUF: n(r.rango?.altoUF), sugeridaAntesUF: n(v.sugerida_antes_uf), sugeridaDespuesUF: n(v.sugerida_despues_uf),
  };
}

