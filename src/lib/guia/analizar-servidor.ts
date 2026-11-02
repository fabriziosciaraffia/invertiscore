// ─────────────────────────────────────────────────────────────────────────────
// El informe de un aviso de la guía (30-sep-2026): el MISMO body que armaría el wizard —sugerencias
// del aviso, buildLtrPayload— con los datos del aviso y los números de la persona (su pie, su plazo, su
// tasa; o la combinación ajustada que mostró la guía). La antigüedad: la que dio la ficha en la lectura
// que chequeó la publicación (publicacion.ts), o la del edificio si se conoce; sin ella, 25 años
// supuestos, y el informe lo dice (`origenAviso.antiguedad = "supuesta"`).
// LA EDAD REAL (03-nov-2026, goal «la edad del edificio»): con año, el motor recibe la edad tal cual (no la banda) y
// `origenAviso.edad` guarda el año y la fuente —la ficha de este aviso u otro aviso del edificio— para que el informe lo
// diga; sin año, `origenAviso.supuestaPor` dice si la ficha se leyó y no lo trae o si no se pudo leer (edad-edificio.ts).
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { arriendoParaEvaluar, contextoDeSugerencias, payloadDeAviso, respuestasDeAviso, sugerenciasDeAviso } from "@/lib/avisos/evaluar-aviso";
import type { AnalisisInput } from "@/lib/types";
import { aniosDesde, claveEdificio } from "./ficha-anio";
import { avisoDeCandidato, type CandidatoGuia, type OrigenGuia } from "./guia-servidor";
import { distanciaM, type Combinacion } from "./seleccion";
import type { EdadEdificio, SupuestaPor } from "./edad-edificio";

export type OrigenAntiguedad = "ficha" | "supuesta" | "nuevo";
/** La edad con que se analiza: los años (null = 25 supuestos), de dónde salió, el año y su fuente, o por qué se supuso. */
export interface AntiguedadAviso {
  anios: number | null;
  origen: OrigenAntiguedad;
  edad?: EdadEdificio | null;
  supuestaPor?: SupuestaPor | null;
}
/** La lectura de la ficha al tocar: `leida` = la ficha nueva respondió 200 (se pudo mirar si dice el año); `anio`, el que dijo. */
export interface LecturaAnio {
  leida: boolean;
  anio: number | null;
}
/** La lectura que dejó `chequearPublicacion`, como la necesita la edad (sin lectura = no se pudo leer). */
export function lecturaAnioDe(l: { leida: true; motivo: string; anio: number | null } | { leida: false } | null | undefined): LecturaAnio {
  return l?.leida ? { leida: l.motivo === "publicado", anio: l.anio } : { leida: false, anio: null };
}

/** El aviso, con su evaluación guardada. null si no está activo o no fue evaluado. */
export async function leerAvisoGuia(admin: SupabaseClient, avisoId: string, o: OrigenGuia): Promise<CandidatoGuia | null> {
  const [{ data: sp }, { data: ae }] = await Promise.all([
    admin.from("scraped_properties")
      .select("id, comuna, lat, lng, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, url, type, is_active")
      .eq("id", avisoId).order("id").limit(1),
    admin.from("avisos_evaluados").select("precio_uf, antiguedad_anios, antiguedad_origen, arriendo, venta, gastos_comunes, mediana_comuna").eq("aviso_id", avisoId).maybeSingle(),
  ]);
  const f = sp?.[0];
  if (!f || !ae || f.type !== "venta" || !f.is_active || f.lat == null || f.lng == null) return null;
  const lat = Number(f.lat), lng = Number(f.lng);
  return {
    avisoId: f.id as string,
    // Sin informe de origen (origen sintético) no hay de qué estar lejos.
    distanciaM: o.sintetico ? 0 : distanciaM(o, { lat, lng }),
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
    medianaComuna: ae.mediana_comuna ?? null,
  };
}

/** El aviso para chequear su ficha, aunque ya no tenga evaluación (un despublicado la pierde). */
export async function fichaDelAviso(admin: SupabaseClient, avisoId: string): Promise<{ id: string; url: string | null; edificio: string } | null> {
  const { data } = await admin.from("scraped_properties").select("id, url, comuna, lat, lng").eq("id", avisoId).order("id").limit(1);
  const f = data?.[0];
  if (!f || f.lat == null || f.lng == null) return null;
  return { id: f.id as string, url: (f.url as string | null) ?? null, edificio: claveEdificio({ comuna: f.comuna as string, lat: Number(f.lat), lng: Number(f.lng) }) };
}

/** Los años del edificio: los de la ficha recién leída, o los del edificio si se conocen, o null (25 supuestos).
 *  No sale a la fuente: la única lectura es la que chequeó la publicación. Con año, el año y su fuente: «edificio» solo si lo
 *  dio OTRO aviso (`anios_edificio` guarda el aviso cuya ficha lo dijo). Sin año, por qué: la ficha leída no lo dice, o no se
 *  pudo leer. */
export async function antiguedadDelAviso(admin: SupabaseClient, c: CandidatoGuia, lectura: LecturaAnio, ahora: Date = new Date()): Promise<AntiguedadAviso> {
  if (c.condicion === "nuevo") return { anios: 0, origen: "nuevo" };
  if (c.antiguedadAnios != null) return { anios: c.antiguedadAnios, origen: "ficha", edad: { anio: ahora.getFullYear() - c.antiguedadAnios, fuente: "ficha" } };
  if (lectura.anio != null) return { anios: aniosDesde(lectura.anio, ahora), origen: "ficha", edad: { anio: lectura.anio, fuente: "ficha" } };
  const { data } = await admin.from("anios_edificio").select("anio, aviso_id").eq("edificio", claveEdificio(c)).maybeSingle();
  if (typeof data?.anio === "number") {
    return { anios: aniosDesde(data.anio, ahora), origen: "ficha", edad: { anio: data.anio, fuente: data.aviso_id === c.avisoId ? "ficha" : "edificio" } };
  }
  return { anios: null, origen: "supuesta", supuestaPor: lectura.leida ? "no-dice" : "no-leida" };
}

/** El body del informe, como el del wizard, más `origenAviso`. null si el aviso no tiene arriendo. */
export async function cuerpoDelAviso(
  c: CandidatoGuia,
  o: OrigenGuia,
  combo: Combinacion,
  antiguedad: AntiguedadAviso,
  cfg: { uf: number; tasa: number },
): Promise<AnalisisInput | null> {
  const a = avisoDeCandidato(c, antiguedad.anios);
  const { arr, vta } = await sugerenciasDeAviso(a);
  const arriendo = arriendoParaEvaluar(a, arr, vta, cfg.uf, false);
  if (!arriendo) return null;
  const body = payloadDeAviso(
    respuestasDeAviso(a, combo.piePct, o.tasa, arriendo.monto, { plazo: combo.plazoAnios, tasaMercado: cfg.tasa }),
    contextoDeSugerencias(arriendo, arr, vta, cfg),
  ) as unknown as AnalisisInput;
  body.origenAviso = { avisoId: c.avisoId, antiguedad: antiguedad.origen, origenAnalysisId: o.analysisId ?? undefined, ...camposDeEdad(antiguedad) };
  return body;
}

/** Lo que `origenAviso` guarda de la edad: el año y su fuente, o por qué se supuso. Nada de esto lo lee el motor. */
export function camposDeEdad(a: AntiguedadAviso): { edad?: EdadEdificio; supuestaPor?: SupuestaPor } {
  return { ...(a.edad ? { edad: a.edad } : {}), ...(a.origen === "supuesta" && a.supuestaPor ? { supuestaPor: a.supuestaPor } : {}) };
}
