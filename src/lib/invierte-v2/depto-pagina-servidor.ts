// ─────────────────────────────────────────────────────────────────────────────
// LO QUE MUESTRA LA PÁGINA DE UN DEPTO (etapa 3, B1, 21-nov-2026; láminas 4.1 y 4.2). Solo lee: la fila del depto de la persona, sus
// números (con ubicación confirmada, los del análisis rehecho: depto-servidor › numerosDe), su ficha (título, fotos, cap rate), lo
// que cambió en su publicación, la preaprobación, el número de «Pregúntale a Franco» y, si no avanzó, la alternativa que eligió la
// persona de Franco. Ninguna ficha, ningún crédito.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { lineaCambio, type TipoCambio, type Vigente } from "./cambios";
import { etapaDe, type Etapa, type PreguntaDepto } from "./depto-flujo";
import { asegurarPreguntasDeLectura, leerPreguntas, leerUbicaciones, numerosDe, type Ubicacion } from "./depto-servidor";
import { fichasDe, type FichaDepto } from "./ficha-depto-servidor";
import { numeroFranco, vigenteSobre, type DatosDepto } from "./base-servidor";
import { aOpcion, filaEntrada, leerPerfilInv } from "./perfil-servidor";
import { leerPreaprobacion } from "./preaprobacion-servidor";
import type { EstadoVisible } from "./preaprobacion";
import { tituloDepto } from "./titulo-depto";

export interface PaginaDepto {
  avisoId: string;
  etapa: Etapa;
  noAvanzaMotivo: string | null;
  datos: DatosDepto;
  ficha: FichaDepto | null;
  /** El título con el número: el confirmado, o el que la lectura sacó limpio de la publicación. */
  tituloConNumero: string;
  ubicacion: Ubicacion | null;
  cambios: string[];
  preaprobacion: EstadoVisible;
  whatsapp: string | null;
  alternativa: { avisoId: string; datos: DatosDepto; ficha: FichaDepto | null; alcanza: boolean } | null;
  /** Sus deptos elegidos, para «Seguir con este» (con seis, pregunta cuál deja). */
  activos: { avisoId: string; datos: DatosDepto }[];
  /** «Lo que Franco averiguó» (B2): las preguntas del depto, con su respuesta. */
  preguntas: PreguntaDepto[];
  /** «Documentos de este depto» (B2): por ahora ninguno; la oferta, el reporte de visita y la promesa llegan con B3-B6. */
  documentos: { id: string; tipo: string; creadoAt: string }[];
}

export async function leerPaginaDepto(admin: SupabaseClient, userId: string, avisoId: string): Promise<PaginaDepto | null> {
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
  const fichas = await fichasDe(admin, [avisoId, ...(alternativa ? [alternativa.avisoId] : [])], { [avisoId]: datos.precioUF ?? null });
  const ficha = fichas[avisoId] ?? null;
  if (ficha && u?.analisis?.capRatePct != null) ficha.capRatePct = u.analisis.capRatePct;
  if (alternativa) alternativa.ficha = fichas[alternativa.avisoId] ?? null;
  // El número de la calle va recién aquí (LEEME de la etapa 3): el confirmado por Franco, o el que la lectura sacó limpio.
  const calle = u?.direccion ?? ficha?.lectura?.calle ?? null;
  const numero = u ? u.numero : ficha?.lectura?.numero ?? null;
  const tituloConNumero = tituloDepto({ calle, numero, metro: ficha?.metro ?? null, comuna: ficha?.comuna ?? datos.comuna ?? null });
  // Las preguntas que dejó la lectura se copian una vez al depto (B2); después las responde Franco desde el admin.
  await asegurarPreguntasDeLectura(admin, avisoId, ficha?.lectura?.preguntas ?? [], f.es_prueba === true);
  const [preguntas, { data: docs }] = await Promise.all([
    leerPreguntas(admin, avisoId),
    admin.from("inv_documentos").select("id, tipo, created_at").eq("user_id", userId).eq("depto_id", f.id as string).order("created_at", { ascending: false }).limit(20),
  ]);
  const cambios = ((cs ?? []) as { tipo: TipoCambio; antes: Record<string, unknown>; despues: Record<string, unknown>; fecha: string }[])
    .map((c) => lineaCambio(c, c.fecha)).filter((x): x is string => !!x);
  return { avisoId, etapa, noAvanzaMotivo: (f.no_avanza_motivo as string | null) ?? null, datos, ficha, tituloConNumero, ubicacion: u, cambios, preaprobacion: pre.estado, whatsapp, alternativa, activos: (elegidos ?? []).map((e) => ({ avisoId: e.aviso_id as string, datos: (e.datos ?? {}) as DatosDepto })),
    preguntas, documentos: ((docs ?? []) as { id: string; tipo: string; created_at: string }[]).map((d) => ({ id: d.id, tipo: d.tipo, creadoAt: d.created_at })) };
}
