// ─────────────────────────────────────────────────────────────────────────────
// El informe de un aviso de la guía (30-sep-2026): el MISMO body que armaría el wizard —sugerencias
// del aviso, buildLtrPayload— con los datos del aviso y los números de la persona (su pie, su plazo, su
// tasa; o la combinación ajustada que mostró la guía). La antigüedad: la del edificio si se conoce, si
// no la ficha leída a demanda (ficha-anio.ts); sin ella, 25 años supuestos, y el informe lo dice
// (`origenAviso.antiguedad = "supuesta"`).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLtrPayload } from "@/components/formulario-v4/wizardV4Payload";
import { arriendoParaEvaluar, contextoDeSugerencias, respuestasDeAviso, sugerenciasDeAviso } from "@/lib/avisos/evaluar-aviso";
import type { AnalisisInput } from "@/lib/types";
import { anioDeAviso, aniosDesde } from "./ficha-anio";
import { almacenFichas, bajarFicha } from "./ficha-anio-servidor";
import { avisoDeCandidato, type CandidatoGuia, type OrigenGuia } from "./guia-servidor";
import { distanciaM, type Combinacion } from "./seleccion";

export type OrigenAntiguedad = "ficha" | "supuesta" | "nuevo";

/** El aviso, con su evaluación guardada. null si no está activo o no fue evaluado. */
export async function leerAvisoGuia(admin: SupabaseClient, avisoId: string, o: OrigenGuia): Promise<CandidatoGuia | null> {
  const [{ data: sp }, { data: ae }] = await Promise.all([
    admin.from("scraped_properties")
      .select("id, comuna, lat, lng, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, url, type, is_active")
      .eq("id", avisoId).order("id").limit(1),
    admin.from("avisos_evaluados").select("precio_uf, antiguedad_anios, antiguedad_origen, arriendo, venta, gastos_comunes").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  const f = sp?.[0];
  if (!f || !ae || f.type !== "venta" || !f.is_active || f.lat == null || f.lng == null) return null;
  const lat = Number(f.lat), lng = Number(f.lng);
  return {
    avisoId: f.id as string,
    distanciaM: distanciaM(o, { lat, lng }),
    comuna: f.comuna as string,
    lat, lng,
    m2: Number(f.superficie_m2),
    dormitorios: Number(f.dormitorios),
    banos: Number(f.banos) || 1,
    condicion: f.condicion === "nuevo" ? "nuevo" : "usado",
    direccion: (f.direccion as string | null) ?? null,
    fechaEntrega: (f.fecha_entrega as string | null) ?? null,
    url: (f.url as string | null) ?? null,
    precioUF: Number(ae.precio_uf),
    antiguedadAnios: ae.antiguedad_origen === "ficha" ? (ae.antiguedad_anios as number) : null,
    antiguedadOrigen: (ae.antiguedad_origen as string | null) ?? null,
    arriendo: ae.arriendo,
    venta: ae.venta,
    gastosComunes: (ae.gastos_comunes as number | null) ?? null,
  };
}

/** Los años del edificio: conocidos, o de la ficha (una lectura como mucho), o null (25 supuestos). */
export async function antiguedadDelAviso(admin: SupabaseClient, c: CandidatoGuia): Promise<{ anios: number | null; origen: OrigenAntiguedad }> {
  if (c.condicion === "nuevo") return { anios: 0, origen: "nuevo" };
  if (c.antiguedadAnios != null) return { anios: c.antiguedadAnios, origen: "ficha" };
  const r = await anioDeAviso({ id: c.avisoId, url: c.url, comuna: c.comuna, lat: c.lat, lng: c.lng }, almacenFichas(admin), bajarFicha);
  return r.anio != null ? { anios: aniosDesde(r.anio), origen: "ficha" } : { anios: null, origen: "supuesta" };
}

/** El body del informe, como el del wizard, más `origenAviso`. null si el aviso no tiene arriendo. */
export async function cuerpoDelAviso(
  c: CandidatoGuia,
  o: OrigenGuia,
  combo: Combinacion,
  antiguedad: { anios: number | null; origen: OrigenAntiguedad },
  cfg: { uf: number; tasa: number },
): Promise<AnalisisInput | null> {
  const a = avisoDeCandidato(c, antiguedad.anios);
  const { arr, vta } = await sugerenciasDeAviso(a);
  const arriendo = arriendoParaEvaluar(a, arr, vta, cfg.uf, false);
  if (!arriendo) return null;
  const body = buildLtrPayload(
    respuestasDeAviso(a, combo.piePct, o.tasa, arriendo.monto, { plazo: combo.plazoAnios, tasaMercado: cfg.tasa }),
    contextoDeSugerencias(arriendo, arr, vta, cfg),
  ) as unknown as AnalisisInput;
  body.origenAviso = { avisoId: c.avisoId, antiguedad: antiguedad.origen, origenAnalysisId: o.analysisId };
  return body;
}
