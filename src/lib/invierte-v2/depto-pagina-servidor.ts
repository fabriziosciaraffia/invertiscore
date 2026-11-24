// ─────────────────────────────────────────────────────────────────────────────
// LO QUE MUESTRA LA PÁGINA DE UN DEPTO (etapa 3, B1, 21-nov-2026; láminas 4.1 y 4.2). Solo lee: la fila del depto de la persona, sus
// números (con ubicación confirmada, los del análisis rehecho: depto-servidor › numerosDe), su ficha (título, fotos, cap rate), lo
// que cambió en su publicación, la preaprobación, el número de «Pregúntale a Franco» y, si no avanzó, la alternativa que eligió la
// persona de Franco. Ninguna ficha, ningún crédito.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { filaCambio, lineaCambio, type TipoCambio, type Vigente } from "./cambios";
import { etapaDe, type Etapa, type PreguntaDepto } from "./depto-flujo";
import { asegurarPreguntasDeLectura, leerPreguntas, leerUbicaciones, numerosDe, type Ubicacion } from "./depto-servidor";
import { fichasDe, type FichaDepto } from "./ficha-depto-servidor";
import { numeroFranco, vigenteSobre, type DatosDepto } from "./base-servidor";
import { aOpcion, filaEntrada, leerPerfilInv } from "./perfil-servidor";
import { leerPreaprobacion } from "./preaprobacion-servidor";
import type { EstadoVisible } from "./preaprobacion";
import { direccionDepto, tituloDepto } from "./titulo-depto";
import { CERRADAS, asegurarRango, ofertaAbierta, ultimaOferta, type OfertaVista } from "./rango-servidor";
import { OFERTAS_VIVAS, sePuedeRetirar } from "./b4";
import { bloqueOfertaCifras } from "./cifras-motor";
import { visitaParaRonda } from "./visita-lectura";
import type { VisitaResumen } from "./visita";
import type { BloqueCifrasOferta } from "./cifras";

export interface PaginaDepto {
  avisoId: string;
  etapa: Etapa;
  noAvanzaMotivo: string | null;
  datos: DatosDepto;
  ficha: FichaDepto | null;
  /** El título con el número: el confirmado, o el que la lectura sacó limpio de la publicación. */
  tituloConNumero: string;
  /** La dirección sola (calle y número si la ubicación está confirmada o la lectura lo sacó limpio), sin metro; null sin calle. */
  direccion: string | null;
  ubicacion: Ubicacion | null;
  cambios: string[];
  /** Las mismas, como filas del tablero (rediseño del 23-nov-2026). */
  cambiosFilas: NonNullable<ReturnType<typeof filaCambio>>[];
  preaprobacion: EstadoVisible;
  whatsapp: string | null;
  alternativa: { avisoId: string; datos: DatosDepto; ficha: FichaDepto | null; alcanza: boolean } | null;
  /** Sus deptos elegidos, para «Seguir con este» (con seis, pregunta cuál deja). */
  activos: { avisoId: string; datos: DatosDepto }[];
  /** «Lo que Franco averiguó» (B2): las preguntas del depto, con su respuesta. */
  preguntas: PreguntaDepto[];
  /** «Documentos de este depto» (B2): por ahora ninguno; la oferta, el reporte de visita y la promesa llegan con B3-B6. */
  documentos: { id: string; tipo: string; creadoAt: string }[];
  /** B3: la oferta del depto —el borrador con el rango de la regla v1, o la firmada—, si hay. */
  oferta: OfertaVista | null;
  /** La ficha (23-nov-2026): con una oferta viva, sus cifras a ese monto; con precio acordado, a ese precio. Del motor. */
  bloqueOferta: BloqueCifrasOferta | null;
  /** B4: sin oferta abierta, la última ronda si cerró sin acuerdo (no la aceptaron, venció, respondieron fuera de plazo, la retiró). */
  cierre?: OfertaVista | null;
  /** La visita del depto (24-nov-2026): la abierta, o la última con el reporte publicado. También va dentro de la oferta (oferta.visita). */
  visita?: VisitaResumen | null;
  /** B4: otra oferta viva de la persona, en otro depto (para elegir con cuál se queda ante una respuesta fuera de plazo). */
  otraViva?: { avisoId: string; titulo: string; estado: string; firme: { venceAt: string | null } | null } | null;
}

export async function leerPaginaDepto(admin: SupabaseClient, userId: string, avisoId: string, opts: { nuevaRonda?: boolean } = {}): Promise<PaginaDepto | null> {
  const { data: f } = await admin.from("inv_deptos").select("aviso_id, estado, etapa, no_avanza_motivo, alternativa_aviso_id, datos, vigente, es_prueba, id").eq("user_id", userId).eq("aviso_id", avisoId).maybeSingle();
  if (!f) return null;
  const etapa = etapaDe({ estado: f.estado as string, etapa: (f.etapa as string | null) ?? null });
  if (!etapa) return null;
  const alt = (f.alternativa_aviso_id as string | null) ?? null;
  const [ubic, pre, whatsapp, { data: cs }, perfil, { data: elegidos }] = await Promise.all([
    leerUbicaciones(admin, [avisoId]),
    leerPreaprobacion(admin, userId),
    numeroFranco(admin),
    admin.from("inv_cambios").select("tipo, antes, despues, fecha").eq("user_id", userId).eq("aviso_id", avisoId).eq("en_base", true).order("created_at", { ascending: false }).limit(10),
    alt ? leerPerfilInv(admin, userId) : Promise.resolve(null),
    admin.from("inv_deptos").select("aviso_id, datos").eq("user_id", userId).eq("estado", "elegido"),
  ]);
  const u = ubic[avisoId] ?? null;
  const datos = numerosDe(vigenteSobre((f.datos ?? {}) as DatosDepto, f.vigente as Partial<Vigente> | null), u);
  let alternativa: PaginaDepto["alternativa"] = null;
  if (etapa === "no_avanza" && alt) {
    const e = await filaEntrada(admin, alt);
    if (e) {
      const o = aOpcion(e.fila, perfil?.topeUF ?? 0, false, e.veredicto);
      alternativa = { avisoId: alt, datos: { precioUF: o.precioUF, veredicto: o.veredicto, score: o.score, flujoCLP: o.flujoCLP, comuna: o.comuna, m2: o.m2, dormitorios: o.dormitorios, banos: o.banos }, ficha: null, alcanza: o.alcanza };
    }
  }
  const fichas = await fichasDe(admin, [avisoId, ...(alternativa ? [alternativa.avisoId] : [])], { [avisoId]: datos.precioUF ?? null }, { [avisoId]: datos.flujoCLP ?? null });
  const ficha = fichas[avisoId] ?? null;
  if (alternativa) alternativa.ficha = fichas[alternativa.avisoId] ?? null;
  // El número de la calle va solo con la ubicación confirmada por Franco (LEEME del rediseño, 23-nov-2026); sin confirmar, solo la calle.
  const calle = u?.direccion ?? ficha?.lectura?.calle ?? null;
  const numero = u ? u.numero : null;
  const tituloConNumero = tituloDepto({ calle, numero, metro: ficha?.metro ?? null, comuna: ficha?.comuna ?? datos.comuna ?? null });
  const direccion = direccionDepto({ calle, numero, comuna: ficha?.comuna ?? datos.comuna ?? null });
  // Las preguntas que dejó la lectura se copian una vez al depto (B2); después las responde Franco desde el admin.
  await asegurarPreguntasDeLectura(admin, avisoId, ficha?.lectura?.preguntas ?? [], f.es_prueba === true);
  // B3: con el depto listo, el rango se calcula (o se recalcula si cambió el precio) en la oferta borrador; firmada, queda como está.
  const oferta = etapa === "listo" ? await asegurarRango(admin, userId, avisoId, new Date(), { nueva: opts.nuevaRonda }) : await ofertaAbierta(admin, f.id as string);
  // B4: sin oferta abierta, la última ronda cerrada (su tarjeta de cierre) y, si hay, otra oferta viva en otro depto.
  const ultima = !oferta ? await ultimaOferta(admin, f.id as string) : null;
  const cierre = ultima && (CERRADAS as readonly string[]).includes(ultima.estado) ? ultima : null;
  // Una a firme vigente va primero: con ella no se oferta por este depto (24-nov-2026).
  const { data: otras } = cierre ? await admin.from("inv_ofertas").select("aviso_id, estado, sujeta_a_visita, vigente_hasta").eq("user_id", userId).neq("depto_id", f.id as string).in("estado", OFERTAS_VIVAS as unknown as string[]) : { data: null };
  const filasOtras = (otras ?? []) as { aviso_id: string; estado: string; sujeta_a_visita: boolean | null; vigente_hasta: string | null }[];
  const otraFirme = filasOtras.find((o) => !sePuedeRetirar({ estado: o.estado, sujetaAVisita: o.sujeta_a_visita !== false })) ?? null;
  const otra = otraFirme ?? filasOtras[0] ?? null;
  const otraFicha = otra ? (await fichasDe(admin, [otra.aviso_id as string]))[otra.aviso_id as string] ?? null : null;
  // La visita (24-nov-2026): va dentro de la oferta, para «Lo que sigue», el camino, la contraoferta y la ronda nueva; y en un ajuste, el
  // monto de la ronda anterior («Antes»).
  const visita = etapa === "listo" || etapa === "en_firme" ? await visitaParaRonda(admin, f.id as string) : null;
  if (oferta) {
    oferta.visita = visita;
    if (oferta.tipoRonda === "ajustar" && oferta.anteriorId) {
      const { data: ant } = await admin.from("inv_ofertas").select("monto_uf").eq("id", oferta.anteriorId).maybeSingle();
      oferta.anteriorMontoUF = ant?.monto_uf != null ? Number(ant.monto_uf) : null;
    }
  }
  const [preguntas, { data: docs }] = await Promise.all([
    leerPreguntas(admin, avisoId),
    admin.from("inv_documentos").select("id, tipo, created_at").eq("user_id", userId).eq("depto_id", f.id as string).order("created_at", { ascending: false }).limit(20),
  ]);
  const filasCs = (cs ?? []) as { tipo: TipoCambio; antes: Record<string, unknown>; despues: Record<string, unknown>; fecha: string }[];
  const cambios = filasCs.map((c) => lineaCambio(c, c.fecha)).filter((x): x is string => !!x);
  const cambiosFilas = filasCs.map((c) => filaCambio(c, c.fecha)).filter((x): x is NonNullable<ReturnType<typeof filaCambio>> => !!x);
  return { avisoId, etapa, noAvanzaMotivo: (f.no_avanza_motivo as string | null) ?? null, datos, ficha, tituloConNumero, direccion, ubicacion: u, cambios, cambiosFilas, preaprobacion: pre.estado, whatsapp, alternativa, activos: (elegidos ?? []).map((e) => ({ avisoId: e.aviso_id as string, datos: (e.datos ?? {}) as DatosDepto })),
    oferta, cierre, visita, otraViva: otra ? { avisoId: otra.aviso_id, titulo: otraFicha?.titulo ?? "otro depto", estado: otra.estado, firme: otraFirme ? { venceAt: otraFirme.vigente_hasta } : null } : null, bloqueOferta: bloqueOfertaCifras(u?.analisis?.motor ?? null, oferta, ficha?.cifras.publicadoUF ?? datos.precioUF ?? null), preguntas, documentos: ((docs ?? []) as { id: string; tipo: string; created_at: string }[]).map((d) => ({ id: d.id, tipo: d.tipo, creadoAt: d.created_at })) };
}
