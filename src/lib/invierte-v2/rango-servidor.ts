// ─────────────────────────────────────────────────────────────────────────────
// EL RANGO DE OFERTA Y LA OFERTA, EN EL SERVIDOR (etapa 3, B3, 22-nov-2026; regla v1 en rango.ts).
//   · Las señales del depto (solo lectura): la última bajada (precios_uf) de toda la cadena de republicaciones (avisos_gemelos,
//     23-nov-2026: un republicado hereda las rebajas del aviso anterior, y volver más barato cuenta como bajada), sus vecinos del edificio (desde la ubicación confirmada o el
//     pin; ninguna ficha), si el pin es sospechoso, y el estado y los arreglos de la lectura vigente.
//   · El rango se guarda en la oferta BORRADOR del depto (inv_ofertas, una abierta por depto): se calcula cuando el depto está listo y
//     se recalcula si cambia el precio publicado, mientras la oferta no esté firmada; al firmar se congela. El admin puede corregir
//     postura, rango y razones (queda quién), y no es obligatorio.
//   · Firmar: el mismo mecanismo de la orden (nombre y RUT de la orden firmada, casilla, texto exacto y su hash, IP y agente). Con otra
//     oferta viva, queda en cola. Presentarla es de una persona de Franco (B4): firmar deja la tarea.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONFIG_RANGO_V1, REGLA_VERSION, avisoOferta, calcularRango, topeOferta, type ConfigRango, type Rango, type SenalesRango } from "./rango";
import { leerUbicaciones, metros, numerosDe } from "./depto-servidor";
import { vigenteSobre, type DatosDepto } from "./base-servidor";
import type { Vigente } from "./cambios";
import { leerLecturas } from "./lectura-franco-servidor";
import { etapaDe } from "./depto-flujo";
import { anotar, sha256, ultimaOrdenDe, type ContextoPedido } from "./servidor";
import { leerPreaprobacion } from "./preaprobacion-servidor";
import { puedeOfertar } from "./preaprobacion";
import { VERSION_TEXTO_OFERTA, textoPlanoOferta } from "./oferta-documento";
import { FIRMA_COPY } from "./rango";
import { lineaDepto } from "./base";
import { publicadoDesde, ultimaBajadaCadena } from "./gemelos";
import { leerPaginaDepto } from "./depto-pagina-servidor";
import { OFERTAS_VIVAS } from "./b4";
import type { VisitaResumen } from "./visita";

const T_OF = "inv_ofertas";
// En firme también: la página del depto la lee para el camino (si quedó en firme sin visitar). Firmar exige borrador (asegurarRango).
const ABIERTAS = ["borrador", "firmada", "en_cola", "presentada", "contraoferta", "aceptada_sujeta", "en_firme"];
// Una a la vez (B4, decisión de Fabrizio del 23-nov-2026): firmada, en cola, presentada, contraoferta y aceptada cuentan como vivas.
const VIVAS: readonly string[] = OFERTAS_VIVAS;
/** Las que cerraron sin acuerdo: el depto vuelve al paso 2 con su tarjeta de cierre hasta que la persona hace otra oferta. */
export const CERRADAS = ["sin_acuerdo", "retirada"] as const;

/** Los valores de la regla, de `config` (invierte_rango_*), con los de la versión 1 por defecto. */
export async function leerConfigRango(admin: SupabaseClient): Promise<ConfigRango> {
  const { data } = await admin.from("config").select("key, value").like("key", "invierte_%");
  const m = new Map(((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, Number(r.value)]));
  const v = (k: string, d: number) => { const x = m.get(k); return x != null && Number.isFinite(x) ? x : d; };
  const c = CONFIG_RANGO_V1;
  return {
    base: v("invierte_rango_base", c.base), min: v("invierte_rango_min", c.min), max: v("invierte_rango_max", c.max), banda: v("invierte_rango_banda", c.banda),
    bandaAjusta: v("invierte_rango_banda_ajusta", c.bandaAjusta),
    yaBajo: v("invierte_rango_ya_bajo", c.yaBajo), vecinosSobre: v("invierte_rango_vecinos_sobre", c.vecinosSobre), vecinosBajo: v("invierte_rango_vecinos_bajo", c.vecinosBajo),
    arreglos: v("invierte_rango_arreglos", c.arreglos), remodelacion: v("invierte_rango_remodelacion", c.remodelacion),
    sobreVecinosPct: v("invierte_rango_sobre_vecinos_pct", c.sobreVecinosPct), bajoVecinosPct: v("invierte_rango_bajo_vecinos_pct", c.bajoVecinosPct),
    corteVecinosPct: v("invierte_rango_corte_vecinos_pct", c.corteVecinosPct), minVecinos: v("invierte_rango_min_vecinos", c.minVecinos),
    posturaAsegura: v("invierte_rango_postura_asegura", c.posturaAsegura), posturaNegocia: v("invierte_rango_postura_negocia", c.posturaNegocia),
    avisoFuertePct: v("invierte_aviso_fuerte_pct", c.avisoFuertePct),
  };
}

/** «15 de enero» desde «2027-01-15» (la misma forma que muestra la pantalla de firma). */
export const fechaLarga = (iso: string | null) => (iso ? new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`)) : null);
const num = (x: unknown) => (x == null ? null : Number.isFinite(Number(x)) ? Number(x) : null);

/** LAS SEÑALES del depto. Solo lectura. `punto`: la ubicación confirmada si existe (entonces el pin no es sospechoso). */
/** La cadena de republicaciones del aviso (él mismo y sus gemelos anteriores). Sin la migración aplicada, solo él. */
export async function cadenaDe(admin: SupabaseClient, avisoId: string): Promise<{ avisoId: string; vistoDesde: string }[]> {
  const { data, error } = await admin.rpc("cadena_gemelos", { p_aviso: avisoId });
  if (error || !Array.isArray(data) || !data.length) return [{ avisoId, vistoDesde: "" }];
  return (data as { aviso_id: string; visto_desde: string }[]).map((x) => ({ avisoId: x.aviso_id, vistoDesde: String(x.visto_desde ?? "") }));
}

export async function senalesDe(admin: SupabaseClient, avisoId: string, publicadoUF: number, confirmada: { lat: number; lng: number } | null): Promise<SenalesRango> {
  const cadena = await cadenaDe(admin, avisoId);
  const ids = cadena.map((c) => c.avisoId);
  const [{ data: sp }, { data: bajas }, { data: saltos }, lecturas, { data: cfg }] = await Promise.all([
    admin.from("scraped_properties").select("id, comuna, lat, lng, superficie_m2, dormitorios, banos").eq("id", avisoId).order("id").limit(1).maybeSingle(),
    admin.from("precios_uf").select("fecha, precio_uf, precio_uf_antes, delta_pct").in("property_id", ids).lt("delta_pct", -0.5).order("fecha", { ascending: false }).limit(20),
    ids.length > 1 ? admin.from("avisos_gemelos").select("nuevo_visto_desde, precio_viejo_uf, precio_nuevo_uf").in("nuevo_id", ids) : Promise.resolve({ data: [] }),
    leerLecturas(admin, [avisoId]),
    admin.from("config").select("value").eq("key", "uf_value").maybeSingle(),
  ]);
  const l = lecturas[avisoId] ?? null;
  const bajada = ultimaBajadaCadena(
    ((bajas ?? []) as { fecha: string; precio_uf: number; precio_uf_antes: number | null }[]).filter((b) => num(b.precio_uf_antes) != null).map((b) => ({ fecha: String(b.fecha), precioAntes: Number(b.precio_uf_antes), precio: Number(b.precio_uf) })),
    ((saltos ?? []) as { nuevo_visto_desde: string; precio_viejo_uf: number; precio_nuevo_uf: number }[]).map((x) => ({ fecha: String(x.nuevo_visto_desde).slice(0, 10), precioViejoUF: Number(x.precio_viejo_uf), precioNuevoUF: Number(x.precio_nuevo_uf) })),
  );
  const base: SenalesRango = { bajada, vecinos: null, pinSospechoso: false, estadoArriendo: l?.estadoArriendo ?? null, arreglos: l?.arreglos ?? [], publicadoDesde: publicadoDesde(cadena.filter((c) => c.vistoDesde)), eslabones: cadena.length - 1 };
  const pin = sp?.lat != null && sp?.lng != null ? { lat: Number(sp.lat), lng: Number(sp.lng) } : null;
  const punto = confirmada ?? pin;
  const m2 = num(sp?.superficie_m2), d = num(sp?.dormitorios), uf = Number(cfg?.value);
  if (!sp || !punto || !m2 || d == null || !(uf > 0)) return base;
  // ¿Pin sospechoso? Solo sin ubicación confirmada: un punto genérico conocido, o un punto que comparten avisos de comunas distintas.
  if (!confirmada) {
    const { data: gen } = await admin.from("pines_genericos").select("lat, lng").limit(100);
    if (((gen ?? []) as { lat: number; lng: number }[]).some((g) => metros({ lat: Number(g.lat), lng: Number(g.lng) }, punto) <= 5)) base.pinSospechoso = true;
    if (!base.pinSospechoso) {
      const { data: mismo } = await admin.rpc("properties_within_radius", { center_lat: punto.lat, center_lng: punto.lng, radius_meters: 1, prop_type: "venta", prop_dorms: null, prop_comuna: null, prop_condicion: null }).order("id").limit(200);
      const ids = ((mismo ?? []) as { id: string }[]).map((x) => x.id).filter((x) => x !== avisoId);
      if (ids.length && sp.comuna) {
        const { data: com } = await admin.from("scraped_properties").select("id, comuna, is_active").in("id", ids.slice(0, 100)).order("id").limit(100);
        if (((com ?? []) as { comuna: string | null; is_active: boolean }[]).some((x) => x.is_active && x.comuna && x.comuna !== sp.comuna)) base.pinSospechoso = true;
      }
    }
  }
  // Los vecinos del edificio: venta a < 30 m, mismos dormitorios, ±20 % m², sin el propio ni sus duplicados.
  const { data: cerca } = await admin.rpc("properties_within_radius", { center_lat: punto.lat, center_lng: punto.lng, radius_meters: 30, prop_type: "venta", prop_dorms: d, prop_comuna: null, prop_condicion: null }).order("id").limit(300);
  const cand = ((cerca ?? []) as { id: string; precio: number | null; moneda: string | null; superficie_m2: number | null }[])
    .filter((x) => x.id !== avisoId && num(x.superficie_m2) != null && num(x.superficie_m2)! >= m2 * 0.8 && num(x.superficie_m2)! <= m2 * 1.2 && num(x.precio) != null && num(x.precio)! > 0);
  const { data: extra } = cand.length ? await admin.from("scraped_properties").select("id, banos, is_active").in("id", cand.map((x) => x.id).slice(0, 100)).order("id").limit(100) : { data: [] };
  const banos = new Map(((extra ?? []) as { id: string; banos: number | null; is_active: boolean }[]).map((x) => [x.id, x]));
  const propios = sp.banos;
  const ufm2: number[] = [];
  for (const x of cand) {
    const e = banos.get(x.id);
    if (e && e.is_active === false) continue;
    const precioUF = x.moneda === "UF" ? Number(x.precio) : Number(x.precio) / uf;
    const xm2 = Number(x.superficie_m2);
    const duplicado = Math.abs(xm2 - m2) <= 1 && (e?.banos ?? null) === (propios ?? null) && Math.abs(precioUF / publicadoUF - 1) <= 0.03;
    if (duplicado) continue;
    ufm2.push(precioUF / xm2);
  }
  base.vecinos = { ufm2, propioUfm2: publicadoUF / m2 };
  return base;
}

export interface OfertaVista {
  id: string;
  estado: string;
  postura: Rango["postura"];
  descuentoPct: number;
  pisoUF: number;
  recomendadoUF: number;
  altoUF: number;
  techoUF: number;
  /** En un Ajusta supuestos, el precio al que vuelve a Comprar (sobre él, el aviso «deja de convenir»); null en un Comprar. */
  comprarUF: number | null;
  publicadoUF: number;
  razones: string[];
  corregida: { por: string | null; at: string } | null;
  montoUF: number | null;
  firmadaAt: string | null;
  texto: string | null;
  textoVersion: string | null;
  /** Segunda vuelta (23-nov): si quedó en firme sin visitar (el camino deja la visita gris hueco). */
  enFirmeComo?: string | null;
  /** El precio acordado, si quedó en firme a otro monto (la ficha lo usa en «Con el precio acordado»). */
  precioFinalUF?: number | null;
  // B4 (23-nov-2026): presentar y responder.
  ronda?: number;
  anteriorId?: string | null;
  /** Cómo nació esta ronda: «aceptar» (aceptó la contraoferta), «proponer» (otro monto), «reactivar» (respuesta fuera de plazo) o «volver» (volver a presentarla). */
  tipoRonda?: string | null;
  presentadaAt?: string | null;
  vigenteHasta?: string | null;
  respuesta?: string | null;
  respuestaAt?: string | null;
  contraofertaUF?: number | null;
  contraofertaNota?: string | null;
  contraofertaVence?: string | null;
  sugeridaUF?: number | null;
  sugeridaReglaUF?: number | null;
  sugeridaFuente?: string | null;
  sinAcuerdoMotivo?: string | null;
  respuestaTardia?: string | null;
  respuestaTardiaUF?: number | null;
  respuestaTardiaAt?: string | null;
  tardiaDecision?: string | null;
  retiradaAt?: string | null;
  retiradaDesde?: string | null;
  updatedAt?: string | null;
  // La visita antes del precio (24-nov-2026): Franco pidió mantener la contraoferta, qué respondió quien vende y la fecha de antes; la
  // visita que respalda esta ronda (un ajuste bajo la anterior); y la visita del depto con su reporte (la carga leerPaginaDepto).
  mantenerPedidoAt?: string | null;
  mantenerRespuesta?: string | null;
  contraofertaVenceOriginal?: string | null;
  visitaId?: string | null;
  visita?: VisitaResumen | null;
  /** En un ajuste después de la visita, el monto de la ronda anterior («Antes»). */
  anteriorMontoUF?: number | null;
}

function aVista(f: Record<string, unknown>): OfertaVista {
  const s = (f.senales ?? {}) as { alto?: number; descuentoPct?: number; comprarUF?: number | null; corregido?: { por: string | null; at: string } };
  return {
    id: f.id as string, estado: f.estado as string, postura: (f.postura_recomendada as Rango["postura"]) ?? "negocia_poco", descuentoPct: Number(s.descuentoPct ?? 0),
    pisoUF: Number(f.piso_uf), recomendadoUF: Number(f.recomendado_uf), altoUF: Number(s.alto ?? f.techo_uf), techoUF: Number(f.techo_uf), comprarUF: num(s.comprarUF), publicadoUF: Number(f.publicado_uf),
    razones: Array.isArray(f.razones) ? (f.razones as string[]) : [], corregida: s.corregido ?? null, montoUF: num(f.monto_uf), firmadaAt: (f.firmada_at as string | null) ?? null,
    texto: (f.texto as string | null) ?? null, textoVersion: (f.texto_version as string | null) ?? null, enFirmeComo: (f.en_firme_como as string | null) ?? null,
    precioFinalUF: num(f.precio_final_uf),
    ronda: num(f.ronda) ?? 1, anteriorId: (f.anterior_id as string | null) ?? null, tipoRonda: ((f.senales as { b4?: { tipo?: string } } | null)?.b4?.tipo) ?? null,
    presentadaAt: (f.presentada_at as string | null) ?? null, vigenteHasta: (f.vigente_hasta as string | null) ?? null,
    respuesta: (f.respuesta as string | null) ?? null, respuestaAt: (f.respuesta_at as string | null) ?? null,
    contraofertaUF: num(f.contraoferta_uf), contraofertaNota: (f.contraoferta_nota as string | null) ?? null, contraofertaVence: (f.contraoferta_vence as string | null) ?? null,
    sugeridaUF: num(f.sugerida_uf), sugeridaReglaUF: num(f.sugerida_regla_uf), sugeridaFuente: (f.sugerida_fuente as string | null) ?? null,
    sinAcuerdoMotivo: (f.sin_acuerdo_motivo as string | null) ?? null,
    respuestaTardia: (f.respuesta_tardia as string | null) ?? null, respuestaTardiaUF: num(f.respuesta_tardia_uf), respuestaTardiaAt: (f.respuesta_tardia_at as string | null) ?? null,
    tardiaDecision: (f.tardia_decision as string | null) ?? null,
    retiradaAt: (f.retirada_at as string | null) ?? null, retiradaDesde: (f.retirada_desde as string | null) ?? null, updatedAt: (f.updated_at as string | null) ?? null,
    mantenerPedidoAt: (f.mantener_pedido_at as string | null) ?? null, mantenerRespuesta: (f.mantener_respuesta as string | null) ?? null,
    contraofertaVenceOriginal: (f.contraoferta_vence_original as string | null) ?? null, visitaId: (f.visita_id as string | null) ?? null,
  };
}
export { aVista as ofertaDeFila };
const COLS = "id, estado, postura_recomendada, piso_uf, recomendado_uf, techo_uf, publicado_uf, razones, senales, monto_uf, firmada_at, texto, texto_version, rango_fuente, regla_version, en_firme_como, precio_final_uf, ronda, anterior_id, presentada_at, vigente_hasta, respuesta, respuesta_at, contraoferta_uf, contraoferta_nota, contraoferta_vence, sugerida_uf, sugerida_regla_uf, sugerida_fuente, sin_acuerdo_motivo, respuesta_tardia, respuesta_tardia_uf, respuesta_tardia_at, tardia_decision, retirada_at, retirada_desde, updated_at, mantener_pedido_at, mantener_respuesta, contraoferta_vence_original, visita_id";
export const COLS_OFERTA = COLS;

/** La oferta abierta del depto (borrador o ya firmada), sin calcular nada. */
export async function ofertaAbierta(admin: SupabaseClient, deptoId: string): Promise<OfertaVista | null> {
  const { data } = await admin.from(T_OF).select(COLS).eq("depto_id", deptoId).in("estado", ABIERTAS).maybeSingle();
  return data ? aVista(data as Record<string, unknown>) : null;
}

/** La última ronda del depto (la de número más alto), sea cual sea su estado. */
export async function ultimaOferta(admin: SupabaseClient, deptoId: string): Promise<OfertaVista | null> {
  const { data } = await admin.from(T_OF).select(COLS).eq("depto_id", deptoId).order("ronda", { ascending: false }).limit(1).maybeSingle();
  return data ? aVista(data as Record<string, unknown>) : null;
}

/** El número de la próxima ronda del depto. */
export async function proximaRonda(admin: SupabaseClient, deptoId: string): Promise<number> {
  const { data } = await admin.from(T_OF).select("ronda").eq("depto_id", deptoId).order("ronda", { ascending: false }).limit(1).maybeSingle();
  return (num(data?.ronda) ?? 0) + 1;
}

/** EL RANGO DEL DEPTO: la oferta abierta; si es borrador (o no existe) y el depto está listo, se calcula con la regla y se guarda. Se
 *  recalcula si cambió el precio publicado (o la regla), aunque el admin lo haya corregido; firmada, queda congelada. */
export async function asegurarRango(admin: SupabaseClient, userId: string, avisoId: string, ahora: Date = new Date(), opts: { nueva?: boolean } = {}): Promise<OfertaVista | null> {
  const { data: d } = await admin.from("inv_deptos").select("id, estado, etapa, es_prueba, datos, vigente").eq("user_id", userId).eq("aviso_id", avisoId).maybeSingle();
  if (!d) return null;
  const abierta = await ofertaAbierta(admin, d.id as string);
  if (abierta && abierta.estado !== "borrador") return abierta;
  if (etapaDe({ estado: d.estado as string, etapa: (d.etapa as string | null) ?? null }) !== "listo") return abierta;
  // B4: si la última ronda cerró sin acuerdo, el depto muestra su cierre; la ronda nueva nace solo cuando la persona pide hacer otra oferta.
  if (!abierta && !opts.nueva) {
    const ultima = await ultimaOferta(admin, d.id as string);
    if (ultima && (CERRADAS as readonly string[]).includes(ultima.estado)) return null;
  }
  const ubic = (await leerUbicaciones(admin, [avisoId]))[avisoId] ?? null;
  const datos = numerosDe(vigenteSobre((d.datos ?? {}) as DatosDepto, d.vigente as Partial<Vigente> | null), ubic);
  const publicadoUF = Number(datos.precioUF);
  if (!(publicadoUF > 0)) return abierta;
  const { data: filaAbierta } = abierta ? await admin.from(T_OF).select("publicado_uf, regla_version").eq("id", abierta.id).maybeSingle() : { data: null };
  if (abierta && filaAbierta && Math.abs(Number(filaAbierta.publicado_uf) - publicadoUF) <= 0.5 && filaAbierta.regla_version === REGLA_VERSION) return abierta;
  const [cfg, s] = await Promise.all([leerConfigRango(admin), senalesDe(admin, avisoId, publicadoUF, ubic ? { lat: ubic.lat, lng: ubic.lng } : null)]);
  // En un Ajusta supuestos, el precio al que vuelve a Comprar entra a la regla (v1.1): techo del rango y, si hace falta, el recomendado.
  const r = calcularRango(publicadoUF, s, ahora, cfg, ubic?.precioComprarUF ?? null);
  const fila = {
    postura_recomendada: r.postura, postura: r.postura, publicado_uf: publicadoUF, piso_uf: r.pisoUF, recomendado_uf: r.recomendadoUF, techo_uf: r.techoUF,
    rango_fuente: "regla", regla_version: r.regla, razones: r.razones,
    senales: { alto: r.altoUF, descuentoPct: r.descuentoPct, comprarUF: r.comprarUF, aplicado: r.aplicado, bajada: s.bajada, vecinos: s.vecinos ? { n: s.vecinos.ufm2.length } : null, pinSospechoso: s.pinSospechoso, estadoArriendo: s.estadoArriendo, arreglos: s.arreglos, publicadoDesde: s.publicadoDesde ?? null, eslabones: s.eslabones ?? 0, calculadoAt: ahora.toISOString() },
    updated_at: ahora.toISOString(),
  };
  const q = abierta
    ? await admin.from(T_OF).update(fila).eq("id", abierta.id).eq("estado", "borrador").select(COLS).maybeSingle()
    : await admin.from(T_OF).insert({ ...fila, user_id: userId, depto_id: d.id, aviso_id: avisoId, estado: "borrador", ronda: await proximaRonda(admin, d.id as string), es_prueba: d.es_prueba === true }).select(COLS).maybeSingle();
  if (q.error || !q.data) { if (q.error) console.error("[inv2] rango:", q.error.message); return abierta ?? (await ofertaAbierta(admin, d.id as string)); }
  return aVista(q.data as Record<string, unknown>);
}

/** EL TEXTO QUE SE FIRMA (B3; también las rondas de B4): el mismo para la primera oferta, una contraoferta aceptada o un monto nuevo. */
export function textoDeFirma(x: { orden: { nombre: string; rut: string }; pre: Awaited<ReturnType<typeof leerPreaprobacion>>; tituloConNumero: string; datos: DatosDepto; montoUF: number; publicadoUF: number }): string {
  const pagas = x.pre.estado === "sin_credito" ? FIRMA_COPY.sinCredito : `${FIRMA_COPY.pieYCredito(Math.round(x.montoUF * 0.2))}, ${FIRMA_COPY.conPreaprobacion(x.pre.doc?.banco ?? null, x.pre.doc?.montoAprobadoUF ?? null, fechaLarga(x.pre.doc?.vigenteHasta ?? null)).replace(/^Con/, "con")}`;
  return textoPlanoOferta({ nombre: x.orden.nombre, rut: x.orden.rut, depto: [x.tituloConNumero, lineaDepto(x.datos)].join(" · "), montoUF: x.montoUF, publicadoUF: x.publicadoUF, pagas, sujetaAVisita: true, vigenciaDias: 5 });
}

export type ErrorFirma = "depto" | "etapa" | "preaprobacion" | "rango" | "monto" | "casilla" | "orden" | "ubicacion" | "guardar";

/** FIRMAR LA OFERTA (5.1b). La persona elige el monto (sin límite: los avisos no bloquean); se firma el texto exacto. */
export async function firmarOferta(admin: SupabaseClient, user: { id: string; email: string | null }, avisoId: string, pedido: { montoUF?: unknown; acepto?: unknown; leyo?: unknown }, ctx: ContextoPedido | null): Promise<{ ok: true; estado: string } | { ok: false; error: ErrorFirma }> {
  if (pedido.acepto !== true) return { ok: false, error: "casilla" };
  const monto = Math.round(Number(pedido.montoUF));
  const p = await leerPaginaDepto(admin, user.id, avisoId, { nuevaRonda: true });
  if (!p) return { ok: false, error: "depto" };
  if (p.etapa !== "listo") return { ok: false, error: "etapa" };
  if (!puedeOfertar(p.preaprobacion)) return { ok: false, error: "preaprobacion" };
  if (!p.ubicacion) return { ok: false, error: "ubicacion" };
  const of = await asegurarRango(admin, user.id, avisoId, new Date(), { nueva: true });
  if (!of || of.estado !== "borrador") return { ok: false, error: "rango" };
  // El tope duro es el precio publicado (23-nov-2026): nunca se firma una oferta sobre lo publicado, venga de donde venga el monto.
  if (!(monto > 0) || monto > topeOferta(of.publicadoUF)) return { ok: false, error: "monto" };
  const [orden, pre, { data: d }, { data: viva }, cfg] = await Promise.all([
    ultimaOrdenDe(admin, user.id), leerPreaprobacion(admin, user.id),
    admin.from("inv_deptos").select("id, es_prueba").eq("user_id", user.id).eq("aviso_id", avisoId).maybeSingle(),
    admin.from(T_OF).select("id").eq("user_id", user.id).in("estado", VIVAS).limit(1),
    leerConfigRango(admin),
  ]);
  if (!orden) return { ok: false, error: "orden" };
  const texto = textoDeFirma({ orden, pre, tituloConNumero: p.tituloConNumero, datos: p.datos, montoUF: monto, publicadoUF: of.publicadoUF });
  const aviso = avisoOferta(monto, of, of.publicadoUF, cfg);
  const estado = (viva ?? []).length ? "en_cola" : "firmada";
  const ahora = new Date().toISOString();
  const { error } = await admin.from(T_OF).update({
    estado, monto_uf: monto, aviso_nivel: aviso, insistio_at: aviso === "ninguno" ? null : ahora, sujeta_a_visita: true, vigencia_dias: 5,
    nombre: orden.nombre, rut: orden.rut, texto_version: VERSION_TEXTO_OFERTA, texto, texto_sha256: sha256(texto), acepto_casilla: true, leyo_hasta_el_final: pedido.leyo === true,
    firmada_at: ahora, ip: ctx?.ip ?? null, user_agent: ctx?.ua ? ctx.ua.slice(0, 500) : null, updated_at: ahora,
  }).eq("id", of.id).eq("estado", "borrador");
  if (error) { console.error("[inv2] firmar oferta:", error.message); return { ok: false, error: /ubicaci/.test(error.message) ? "ubicacion" : "guardar" }; }
  if (estado === "firmada") await admin.from("inv_tareas").insert({ user_id: user.id, tipo: "presentar_oferta", aviso_id: avisoId, estado: "pendiente", detalle: { oferta_id: of.id, monto_uf: monto, aviso }, es_prueba: d?.es_prueba === true });
  await anotar(admin, { userId: user.id, email: user.email, ordenId: orden.id, actor: "persona", accion: "oferta_firmada", detalle: { aviso_id: avisoId, oferta_id: of.id, monto_uf: monto, estado, aviso, texto_version: VERSION_TEXTO_OFERTA }, ctx, esPrueba: d?.es_prueba === true });
  return { ok: true, estado };
}

/** «Hablarlo con Franco» (5.1): deja una tarea para que Franco la llame (una por depto al día). */
export async function hablarConFranco(admin: SupabaseClient, user: { id: string; email: string | null }, avisoId: string, montoUF: unknown): Promise<{ ok: boolean }> {
  const desde = new Date(Date.now() - 864e5).toISOString();
  const { count } = await admin.from("inv_tareas").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("aviso_id", avisoId).eq("tipo", "hablar_oferta").gte("created_at", desde);
  if ((count ?? 0) > 0) return { ok: true };
  const { data: d } = await admin.from("inv_deptos").select("es_prueba").eq("user_id", user.id).eq("aviso_id", avisoId).maybeSingle();
  const { error } = await admin.from("inv_tareas").insert({ user_id: user.id, tipo: "hablar_oferta", aviso_id: avisoId, estado: "pendiente", detalle: { monto_uf: Number(montoUF) || null }, es_prueba: d?.es_prueba === true });
  return { ok: !error };
}

/** EL ADMIN CORRIGE el rango de un depto (no es obligatorio): postura, piso, recomendado, borde alto y razones; queda quién. */
export async function corregirRango(admin: SupabaseClient, quien: { email: string | null }, userId: string, avisoId: string, b: { postura?: unknown; piso?: unknown; recomendado?: unknown; alto?: unknown; razones?: unknown }): Promise<{ ok: true } | { ok: false; error: "datos" | "estado" | "guardar" }> {
  const piso = Math.round(Number(b.piso)), rec = Math.round(Number(b.recomendado)), alto = Math.round(Number(b.alto));
  const razones = Array.isArray(b.razones) ? (b.razones as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 3).map((x) => x.trim()).slice(0, 4) : [];
  if (!["asegura", "negocia_poco", "negocia_argumentos"].includes(String(b.postura)) || !(piso > 0 && piso <= rec && rec <= alto) || !razones.length) return { ok: false, error: "datos" };
  const { data: d } = await admin.from("inv_deptos").select("id").eq("user_id", userId).eq("aviso_id", avisoId).maybeSingle();
  if (!d) return { ok: false, error: "datos" };
  const { data: f } = await admin.from(T_OF).select("id, techo_uf, senales").eq("depto_id", d.id as string).eq("estado", "borrador").maybeSingle();
  if (!f) return { ok: false, error: "estado" };
  if (alto > Number(f.techo_uf)) return { ok: false, error: "datos" };
  const ahora = new Date().toISOString();
  const { error } = await admin.from(T_OF).update({ postura_recomendada: b.postura, postura: b.postura, piso_uf: piso, recomendado_uf: rec, razones, rango_fuente: "admin", senales: { ...((f.senales ?? {}) as Record<string, unknown>), alto, corregido: { por: quien.email, at: ahora } }, updated_at: ahora }).eq("id", f.id as string);
  if (error) return { ok: false, error: "guardar" };
  await anotar(admin, { userId, email: null, actor: "admin", actorEmail: quien.email, accion: "rango_corregido", detalle: { aviso_id: avisoId, postura: b.postura, piso, recomendado: rec, alto }, esPrueba: false });
  return { ok: true };
}
