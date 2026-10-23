// ─────────────────────────────────────────────────────────────────────────────
// EXPLORAR del lado del servidor (23-oct-2026): los pines salen de la RPC `explorar_pines` —el mismo universo que
// deptos_conteo y el semanal, solo los Comprar con ese pie y ese plazo—, paginados con `range` (PostgREST corta en
// 1.000 sin avisar y una comuna puede pasar de mil); los ya analizados, de los informes de la cuenta hechos desde un
// aviso; el saldo, el ticket y la tasa y la UF para el aviso antes de gastar. NADA ACÁ ESCRIBE: explorar no gasta y no
// toca el perfil. Las reglas puras viven en explorar.ts.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";
import { MEMORIA_SEMANAL_MS, VENTANA_SEMANAL_DIAS } from "@/lib/guia/semanal";
import { comunaDeAviso } from "@/lib/guia/semanal-candidatos";
import { leerAvisoGuia } from "@/lib/guia/analizar-servidor";
import { leerConfigGuia, origenSintetico, type CandidatoGuia } from "@/lib/guia/guia-servidor";
import { estadoSaldo, leerSaldo, type EstadoSaldo } from "@/lib/casa-saldo";
import { ticketDeCuentaDisponible } from "@/lib/lo-que-sigue/ticket-cuenta-servidor";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import type { EventoServidor } from "@/lib/posthog-servidor";
import { dormsDe, FILTROS_POR_DEFECTO, filtrosDePerfil, porPuntaje, soloComprar, type FiltrosExplorar, type PinExplorar } from "./explorar";

const RUTA = "lib/explorar";
/** Lo que trae cada página de la RPC: el tope de PostgREST, pedido a propósito. */
export const PAGINA_PINES = 1000;
/** Un tope de cordura: ocho comunas con todo no llegan ni a la mitad. */
const TOPE_PINES = 20000;

const desdeVentana = (ahora: Date) => new Date(ahora.getTime() - VENTANA_SEMANAL_DIAS * 864e5).toISOString().replace("Z", "");

type FilaPin = {
  id: string; comuna: string; lat: number; lng: number; superficie_m2: number; dormitorios: number; banos: number | null;
  precio_uf: number; veredicto: string | null; score: number | null; flujo: number | null; arriendo: number | null;
  pub_estado: string | null; pub_at: string | null;
};

function parametros(f: FiltrosExplorar, ahora: Date) {
  return { comunas: f.comunas.map(comunaDeAviso), dorms: dormsDe(f.tipologias), uf_min: f.ufMin, uf_max: f.ufMax, desde: desdeVentana(ahora), pie: f.pie, plazo: f.plazo };
}

/** Todos los pines de una búsqueda, por puntaje: los Comprar con ese pie y ese plazo, página a página. */
export async function pinesExplorar(admin: SupabaseClient, f: FiltrosExplorar, ahora: Date = new Date()): Promise<PinExplorar[]> {
  const params = parametros(f, ahora);
  const filas: FilaPin[] = [];
  for (let desde = 0; desde < TOPE_PINES; desde += PAGINA_PINES) {
    const { data, error } = await admin.rpc("explorar_pines", params).range(desde, desde + PAGINA_PINES - 1);
    if (error) throw new Error(`explorar_pines: ${error.message}`);
    const pagina = (data ?? []) as FilaPin[];
    filas.push(...pagina);
    if (pagina.length < PAGINA_PINES) break;
  }
  const fresco = (f: FilaPin) => f.pub_estado === "publicado" && !!f.pub_at && ahora.getTime() - Date.parse(f.pub_at) < MEMORIA_SEMANAL_MS;
  const pines: PinExplorar[] = filas.map((f) => ({
    avisoId: f.id, comuna: f.comuna, lat: Number(f.lat), lng: Number(f.lng), m2: Math.round(Number(f.superficie_m2)),
    dormitorios: Number(f.dormitorios), tipologia: tipologiaDe(f.dormitorios, f.banos), precioUF: Math.round(Number(f.precio_uf)),
    veredicto: f.veredicto ?? "", score: f.score, flujo: f.flujo, arriendo: f.arriendo != null && f.arriendo > 0 ? f.arriendo : null,
    vistoAt: fresco(f) ? f.pub_at : null,
  }));
  return porPuntaje(soloComprar(pines));
}

/** Cuántos convienen con una búsqueda (el botón del dashboard). 0 si falla. */
export async function conteoExplorar(admin: SupabaseClient, f: FiltrosExplorar, ahora: Date = new Date()): Promise<number> {
  const { data, error } = await admin.rpc("explorar_conteo", parametros(f, ahora));
  reportarFalloQuery(error, { ruta: RUTA, operacion: "conteo" });
  return error ? 0 : Number(data) || 0;
}

/** Los informes de renta larga de la cuenta hechos desde un aviso: aviso → informe (el más reciente). Los pines azules. */
export async function informesDeExplorar(admin: SupabaseClient, userId: string): Promise<Record<string, string>> {
  const { data, error } = await admin.from("analisis").select("id, aviso:input_data->origenAviso->>avisoId")
    .eq("user_id", userId).eq("tipo_analisis", "long-term").not("input_data->origenAviso->>avisoId", "is", null)
    .order("created_at", { ascending: true }).limit(1000);
  reportarFalloQuery(error, { ruta: RUTA, operacion: "informes", userId });
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ id: string; aviso: string | null }>) if (r.aviso) out[r.aviso] = r.id;
  return out;
}

/** Con qué filtros abre el mapa: el perfil de la cuenta, o la búsqueda por defecto si el perfil no alcanza. */
export async function filtrosDeLaCuenta(admin: SupabaseClient, userId: string): Promise<{ filtros: FiltrosExplorar; desdePerfil: boolean }> {
  const pp = await leerPerfilBusqueda(admin, userId);
  const f = filtrosDePerfil(pp.perfilLtr ?? pp.perfil);
  return f ? { filtros: f, desdePerfil: true } : { filtros: FILTROS_POR_DEFECTO, desdePerfil: false };
}

export interface DatosExplorar {
  filtros: FiltrosExplorar;
  pines: PinExplorar[];
  /** aviso → informe de los que ya analizó esta cuenta. */
  analizados: Record<string, string>;
  n: number;
  saldo: EstadoSaldo;
  ticket: boolean;
  cuentaCreadaAt: string | null;
  finanzas: { uf: number | null; tasa: number | null };
}

export async function cargarExplorar(admin: SupabaseClient, user: { id: string; created_at?: string | null }, f: FiltrosExplorar, ahora: Date = new Date()): Promise<DatosExplorar> {
  const [pines, analizados, datosSaldo, ticket, cfg] = await Promise.all([
    pinesExplorar(admin, f, ahora),
    informesDeExplorar(admin, user.id),
    leerSaldo(admin, user.id),
    ticketDeCuentaDisponible(admin, user),
    leerConfigGuia(admin),
  ]);
  return {
    filtros: f, pines, analizados, n: pines.length, saldo: estadoSaldo(datosSaldo), ticket,
    cuentaCreadaAt: ticket ? (user.created_at ?? null) : null, finanzas: { uf: cfg.uf, tasa: cfg.tasa },
  };
}

/** Un aviso del mapa con su evaluación guardada, para recalcularlo con otro pie y otro plazo. null si no está. */
export function candidatoExplorar(admin: SupabaseClient, avisoId: string): Promise<CandidatoGuia | null> {
  return leerAvisoGuia(admin, avisoId, origenSintetico("", { piePct: null, plazoAnios: null, comunas: [], dormitorios: [] }, { tasa: 0 }));
}

// ── LA MEDICIÓN ──────────────────────────────────────────────────────────────
/** «explorar_vista»: una vista del mapa, con los filtros y cuántos pines. */
export function eventoExplorarVista(p: { userId: string; filtros: FiltrosExplorar; n: number; analizados: number; fuente: "pagina" | "cambio" }): EventoServidor {
  return {
    event: "explorar_vista",
    distinctId: p.userId,
    properties: {
      comunas: p.filtros.comunas, tipologias: p.filtros.tipologias, uf_min: p.filtros.ufMin, uf_max: p.filtros.ufMax, pie: p.filtros.pie, plazo: p.filtros.plazo,
      n: p.n, analizados: p.analizados, fuente: p.fuente,
    },
  };
}

/** «explorar_analiza»: un análisis pedido desde el mapa, con el depto. */
export function eventoExplorarAnaliza(p: { userId: string; analysisId: string; avisoId: string; comuna: string; precioUF: number; m2: number; piePct: number; plazoAnios: number }): EventoServidor {
  return {
    event: "explorar_analiza",
    distinctId: p.userId,
    uuid: undefined,
    properties: { analysis_id: p.analysisId, aviso_id: p.avisoId, comuna: p.comuna, precio_uf: p.precioUF, m2: p.m2, pie_pct: p.piePct, plazo_anios: p.plazoAnios },
  };
}
