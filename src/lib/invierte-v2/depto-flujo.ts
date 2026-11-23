// ─────────────────────────────────────────────────────────────────────────────
// EL FLUJO DE CADA DEPTO (etapa 3, parte B1, 21-nov-2026; láminas 4.1-confirmando, 4.1-no-avanza y 4.2-pagina-del-depto, y la tabla
// 0-estados-de-un-depto). Puro: las reglas y los textos; lo usan la página del depto, la base, el admin y el tier.
//   · La etapa de un depto elegido: confirmando (el primer estado de todo elegido) → no_avanza (sin acuerdo, o la ubicación confirmada
//     lo dejó sin convenir) | sin_preaprobacion | listo. Un elegido sin etapa guardada está confirmando.
//   · Pasa de confirmando solo con el acuerdo con quien vende Y la ubicación confirmada con su análisis rehecho (decisión de Fabrizio,
//     20-nov-2026): Comprar, o Ajusta supuestos con el precio al que vuelve a Comprar. Lo demás no avanza, «dejó de convenir». Con eso,
//     listo si la preaprobación deja ofertar (aprobada o compra sin crédito); si no, sin_preaprobacion. La base lo impone también
//     (trigger inv_deptos_transicion).
//   · «Lo que sigue»: un solo bloque con a lo más UN botón, rojo solo cuando le toca a la persona.
// ─────────────────────────────────────────────────────────────────────────────
import { puedeOfertar, type EstadoVisible } from "./preaprobacion";

export const ETAPAS = ["confirmando", "no_avanza", "sin_preaprobacion", "listo", "en_pausa", "en_firme", "promesa", "escritura", "inscrito", "no_sigo"] as const;
export type Etapa = (typeof ETAPAS)[number];
export const esEtapa = (x: unknown): x is Etapa => (ETAPAS as readonly unknown[]).includes(x);

/** La página de un depto: a donde lleva la tarjeta de la base. */
export const urlDepto = (avisoId: string) => `/invierte/depto/${encodeURIComponent(avisoId)}`;

/** La etapa que se muestra: la guardada; un elegido sin etapa está confirmando. Las opciones y los descartados no tienen página. */
export function etapaDe(f: { estado: string; etapa: string | null }): Etapa | null {
  if (esEtapa(f.etapa)) return f.etapa;
  return f.estado === "elegido" ? "confirmando" : null;
}

export type Acuerdo = "pendiente" | "con_acuerdo" | "sin_acuerdo";
export interface UbicacionAnalizada { veredicto: string | null; precioComprarUF: number | null }

/** ¿Convence el análisis rehecho con la ubicación real? Comprar, o Ajusta supuestos con un precio al que vuelve a Comprar. */
export const ubicacionConviene = (u: UbicacionAnalizada | null) => !!u && (u.veredicto === "COMPRAR" || (u.veredicto === "AJUSTA SUPUESTOS" && u.precioComprarUF != null));

/** A qué etapa pasa un depto en confirmando, con lo que se sabe. `null`: sigue confirmando (falta el acuerdo o la ubicación). */
export function etapaSiguiente(p: { acuerdo: Acuerdo | null; ubicacion: UbicacionAnalizada | null; preaprobacion: EstadoVisible }): { etapa: Etapa; motivo?: "sin_acuerdo" | "dejo_de_convenir" } | null {
  if (p.acuerdo === "sin_acuerdo") return { etapa: "no_avanza", motivo: "sin_acuerdo" };
  if (p.acuerdo !== "con_acuerdo" || !p.ubicacion) return null;
  if (!ubicacionConviene(p.ubicacion)) return { etapa: "no_avanza", motivo: "dejo_de_convenir" };
  return { etapa: puedeOfertar(p.preaprobacion) ? "listo" : "sin_preaprobacion" };
}

/** Con la preaprobación que cambia: los que esperaban pasan a listo, y al revés. Las demás etapas no se tocan. */
export function etapaConPreaprobacion(etapa: Etapa, preaprobacion: EstadoVisible): Etapa {
  if (etapa === "sin_preaprobacion" && puedeOfertar(preaprobacion)) return "listo";
  if (etapa === "listo" && !puedeOfertar(preaprobacion)) return "sin_preaprobacion";
  return etapa;
}

export const DEPTO_COPY = {
  cabecera: "Tu depto",
  publicado: (uf: string) => `Publicado en UF ${uf}`,
  verDetalles: "Ver los detalles",
  ubicacionAproximada: "Ubicación aproximada, según la publicación. Franco la confirma con quien lo vende.",
  loQueSigue: "Lo que sigue",
  // El tablero (rediseño del 23-nov-2026, láminas 4.2).
  volverInversion: "Mi inversión",
  publicadoEt: "Publicado",
  capRate: "Cap rate",
  alMes: "Al mes",
  arriendo: "Arriendo estimado",
  ubicacionConfirmada: "Ubicación confirmada",
  ubicacionAprox: "Ubicación aproximada, según la publicación",
  verMapa: "Ver mapa",
  verDetallesDepto: "Ver los detalles del depto",
  caminoT: "El camino de este depto",
  pasoDe: (n: number, de: number) => `Paso ${n} de ${de}`,
  respondidas: (n: number, de: number) => `${n} de ${de} respondida${de === 1 ? "" : "s"}`,
  esperando: "Esperando respuesta",
  preguntado: (f: string) => `Preguntado el ${f}`,
  verMiOferta: "Ver mi oferta",
  cambiosT: "Cambios en la publicación",
  preguntale: "Pregúntale a Franco por este depto",
  preguntaWhatsapp: (titulo: string) => `Hola, tengo una pregunta sobre ${titulo}.`,
  // No avanza (lámina 4.1-no-avanza): no se dice por qué ni se nombra a quien vende.
  noAvanzaT: "No pudimos avanzar con este depto",
  noAvanzaLinea: "Pasa a veces: no todos los deptos se pueden gestionar. Seguimos trabajando con las otras opciones.",
  dejoDeConvenirLinea: "Al confirmar dónde está, los números cambiaron y este depto dejó de convenir. Seguimos trabajando con las otras opciones.",
  alternativaRotulo: "El más parecido que sí podemos gestionar",
  seguirConEste: "Seguir con este",
  verMisOpciones: "Ver mis otras opciones",
  buscarEnMapa: "Buscar otro en el mapa",
} as const;

export type Tono = "gris" | "ciruela";
export interface LoQueSigue {
  chip: string; tono: Tono; titulo: string; texto: string | null; boton: { texto: string; href: string } | null;
  /** Las cifras en fila del tablero (rediseño del 23-nov-2026): «Publicado · Franco recomienda · Rebaja», «Tu oferta · Firmada». */
  cifras?: { et: string; v: string; azul?: boolean }[];
  /** La barra del rango, en chico (solo «Haz tu oferta»). */
  barra?: boolean;
  /** La línea chica debajo del botón. */
  nota?: string;
}

/** La oferta del depto, lo que «Lo que sigue» necesita saber (B3). */
export interface OfertaResumen { estado: string; postura: "asegura" | "negocia_poco" | "negocia_argumentos"; pisoUF: number; altoUF: number; montoUF: number | null; publicadoUF?: number; firmadaAt?: string | null }
const uf0 = (n: number) => `UF ${Math.round(n).toLocaleString("es-CL")}`;
/** La página de la oferta del depto (lámina 5.1). */
export const urlOferta = (avisoId: string) => `${urlDepto(avisoId)}/oferta`;

/** «Lo que sigue» en la página del depto, según su etapa y la preaprobación. null en no_avanza (la página entera cambia). */
export function loQueSigue(etapa: Etapa, pre: EstadoVisible, urlPreaprobacion: string, oferta: OfertaResumen | null = null, urlDeLaOferta = ""): LoQueSigue | null {
  if (etapa === "confirmando") {
    return { chip: "Franco está en eso", tono: "gris", titulo: "Estamos confirmando este depto", texto: "Franco está coordinando con el vendedor para dejarlo listo para tu oferta o tu visita. Te avisamos apenas esté.", boton: null };
  }
  if (etapa === "sin_preaprobacion") {
    if (pre === "en_revision") return { chip: "Franco está en eso", tono: "gris", titulo: "Tu preaprobación está en revisión", texto: "Apenas la revisemos, puedes ofertar o pedir una visita.", boton: null };
    if (pre === "por_corregir") return { chip: "Te toca a ti", tono: "ciruela", titulo: "Sube de nuevo tu preaprobación para ofertar o visitar", texto: null, boton: { texto: "Subir otra", href: `${urlPreaprobacion}?subir=1` } };
    return { chip: "Te toca a ti", tono: "ciruela", titulo: "Sube tu preaprobación para ofertar o visitar", texto: "Se sube una vez y vale para todos tus deptos.", boton: { texto: "Subir mi preaprobación", href: urlPreaprobacion } };
  }
  if (etapa === "listo" && oferta?.estado === "borrador") {
    // B3 (lámina 4.2 del 23-nov): las tres cifras, la barra del rango en chico y el único botón rojo de la página.
    const pub = oferta.publicadoUF ?? null;
    const rebaja = pub ? `${Math.round((1 - oferta.altoUF / pub) * 100)} % a ${Math.round((1 - oferta.pisoUF / pub) * 100)} %` : null;
    return {
      chip: "Te toca a ti", tono: "ciruela", titulo: "Haz tu oferta", texto: null, barra: pub != null,
      cifras: [...(pub ? [{ et: "Publicado", v: uf0(pub) }] : []), { et: "Franco recomienda", v: `${uf0(oferta.pisoUF)} a ${Math.round(oferta.altoUF).toLocaleString("es-CL")}`, azul: true }, ...(rebaja ? [{ et: "Rebaja", v: rebaja }] : [])],
      boton: { texto: "Ver la oferta que recomienda Franco", href: urlDeLaOferta }, nota: "Queda sujeta a tu visita: si después no te convence, la retiras.",
    };
  }
  if (etapa === "listo" && oferta?.estado === "firmada") {
    // Lámina 4.2-estados (firmada): plana, chip gris, sin botón; «Ver mi oferta» abre el documento firmado.
    return {
      chip: "Franco está en eso", tono: "gris", titulo: "Franco presenta tu oferta", texto: "Va por escrito a quien vende. Te avisamos la respuesta.", boton: null,
      cifras: [...(oferta.montoUF ? [{ et: "Tu oferta", v: uf0(oferta.montoUF) }] : []), ...(oferta.firmadaAt ? [{ et: "Firmada", v: diaMes(oferta.firmadaAt) }] : [])],
    };
  }
  if (etapa === "listo" && oferta?.estado === "en_cola") {
    return { chip: "Franco está en eso", tono: "gris", titulo: "Tu oferta quedó preparada", texto: "Franco la presenta cuando termine la oferta que tienes vigente. Nunca se presenta sola.", boton: null };
  }
  if (etapa === "listo") {
    // Sin rango calculado todavía (sin precio publicado): sin botón.
    return { chip: "Te toca a ti", tono: "ciruela", titulo: "Listo para ofertar o visitar", texto: "Franco ya lo dejó listo con quien lo vende. Muy pronto vas a poder hacer tu oferta o pedir una visita desde aquí.", boton: null };
  }
  return null;
}

/** La línea de estado de la tarjeta en la base (lámina 3.3-base): el chip y qué pasa ahora. */
export function estadoEnBase(etapa: Etapa, pre: EstadoVisible, motivo: string | null): { chip: string; tono: Tono; linea: string } {
  if (etapa === "no_avanza") return { chip: "No avanzó", tono: "gris", linea: motivo === "dejo_de_convenir" ? "Al confirmar dónde está, dejó de convenir" : "Te mostramos el más parecido que sí podemos gestionar" };
  if (etapa === "sin_preaprobacion") return pre === "en_revision"
    ? { chip: "Franco está en eso", tono: "gris", linea: "Revisando tu preaprobación" }
    : { chip: "Te toca a ti", tono: "ciruela", linea: "Sube tu preaprobación para ofertar o visitar" };
  if (etapa === "listo") return { chip: "Te toca a ti", tono: "ciruela", linea: "Listo para ofertar o visitar" };
  return { chip: "Franco está en eso", tono: "gris", linea: "Confirmando con quien lo vende que sigue disponible" };
}

// ── LO QUE FRANCO AVERIGUÓ (B2, 22-nov-2026; láminas 4.1 y 4.2) ──────────────
export const FUENTES_RESPUESTA = ["quien_vende", "documento", "visita", "publicacion"] as const;
export type FuenteRespuesta = (typeof FUENTES_RESPUESTA)[number];
const QUIEN: Record<FuenteRespuesta, string> = {
  quien_vende: "Respondió quien lo vende",
  documento: "Según un documento de quien lo vende",
  visita: "Lo vio Franco en la visita",
  publicacion: "Según la publicación",
};
export interface PreguntaDepto { id: string; pregunta: string; enviadaAt: string | null; respuesta: string | null; fuente: FuenteRespuesta | null; respondidaAt: string | null }

export const AVERIGUO_COPY = {
  titulo: "Lo que Franco averiguó",
  linea: "Las preguntas que le hicimos a quien lo vende, y lo que respondió.",
  mientras: "Mientras, ya le hicimos las preguntas que quedaron pendientes.",
  documentosT: "Documentos de este depto",
  sinDocumentosT: "Todavía no hay documentos",
  sinDocumentos: "Aquí queda cada uno con «Ver»: oferta, contraofertas, reporte de visita, promesa.",
} as const;

/** La fecha corta de una fila: «18 nov». */
export function diaMes(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "short" }).format(new Date(iso)).replace(".", "");
}

/** Lo que se ve bajo cada pregunta: la respuesta con quién la dio y cuándo, o desde cuándo se espera. Las no enviadas no se muestran. */
export function lineaPregunta(p: PreguntaDepto): string | null {
  if (p.respuesta) {
    const r = p.respuesta.trim().replace(/[.\s]+$/, "");
    return `${r}. ${p.fuente ? QUIEN[p.fuente] : QUIEN.quien_vende}${p.respondidaAt ? `, el ${diaMes(p.respondidaAt)}` : ""}.`;
  }
  return p.enviadaAt ? `Preguntado el ${diaMes(p.enviadaAt)}. Esperando respuesta.` : null;
}

/** Las que la persona ve: enviadas o respondidas. */
export const preguntasVisibles = (ps: readonly PreguntaDepto[]) => ps.filter((p) => !!p.respuesta || !!p.enviadaAt);
/** El tablero (lámina 4.2 del 23-nov): lo respondido primero, con la respuesta a la vista; lo pendiente después. */
export const preguntasOrdenadas = (ps: readonly PreguntaDepto[]) => { const v = preguntasVisibles(ps); return [...v.filter((p) => !!p.respuesta), ...v.filter((p) => !p.respuesta)]; };
/** «Respondió quien lo vende · 19 nov» (respondida) o «Preguntado el 18 nov» (pendiente). */
export function metaPregunta(p: PreguntaDepto): string | null {
  if (p.respuesta) return [p.fuente ? QUIEN[p.fuente] : QUIEN.quien_vende, p.respondidaAt ? diaMes(p.respondidaAt) : null].filter(Boolean).join(" · ");
  return p.enviadaAt ? `Preguntado el ${diaMes(p.enviadaAt)}` : null;
}

// ── EL CAMINO DE ESTE DEPTO (rediseño del 23-nov-2026, láminas 4.2 y 4.2-estados) ──
export type EstadoPaso = "hecho" | "tuyo" | "franco" | "pendiente";
export interface PasoCamino { n: number; t: string; s: string | null; /** El de la línea de PC: «Listo», «Te toca a ti», «Opcional». */ corto: string | null; estado: EstadoPaso }
const PASOS = ["Depto confirmado", "Oferta", "Visita", "Oferta en firme", "Promesa", "Escritura"] as const;
/** Los seis pasos con el actual marcado: ciruela si le toca a la persona, negro si lo lleva Franco. La oferta y la visita son pasos del
 *  camino (sale la tarjeta «Oferta · Sin presentar»). */
export function caminoDepto(etapa: Etapa, oferta: Pick<OfertaResumen, "estado"> | null): { actual: number; pasos: PasoCamino[] } {
  const subs: (string | null)[] = [null, null, "Opcional", null, null, null];
  let actual = 1, estado: EstadoPaso = "franco";
  if (etapa === "confirmando" || etapa === "en_pausa") { subs[0] = "Franco lo está confirmando con quien lo vende"; }
  else if (etapa === "sin_preaprobacion") { actual = 2; estado = "tuyo"; subs[1] = "Te toca a ti: sube tu preaprobación"; }
  else if (etapa === "listo") {
    actual = 2;
    const e = oferta?.estado ?? "borrador";
    if (e === "firmada") { estado = "franco"; subs[1] = "Firmada · Franco la presenta"; }
    else if (e === "en_cola") { estado = "franco"; subs[1] = "Preparada · Franco la presenta después de la vigente"; }
    else if (e === "presentada") { estado = "franco"; subs[1] = "Presentada · esperando respuesta"; }
    else if (e === "contraoferta") { estado = "tuyo"; subs[1] = "Te toca a ti: responder"; }
    else { estado = "tuyo"; subs[1] = "Te toca a ti: haz tu oferta"; }
  }
  else if (etapa === "en_firme") actual = 4;
  else if (etapa === "promesa") actual = 5;
  else if (etapa === "escritura") actual = 6;
  else if (etapa === "inscrito") actual = 7;
  if (actual > 1) subs[0] = "Dirección y disponibilidad confirmadas";
  const pasos = PASOS.map((t, i): PasoCamino => {
    const n = i + 1;
    const e: EstadoPaso = n < actual ? "hecho" : n === actual ? estado : "pendiente";
    const corto = e === "hecho" ? "Listo" : e === "tuyo" ? "Te toca a ti" : e === "franco" ? "Franco está en eso" : n === 3 ? "Opcional" : null;
    return { n, t, s: n === actual || n === 1 || n === 3 ? subs[i] : null, corto, estado: e };
  });
  return { actual: Math.min(actual, PASOS.length), pasos };
}

/** «A 4 cuadras del metro» (una cuadra ≈ 100 m), hasta 12 cuadras; más lejos, nada. */
export function cuadrasMetro(metros: number | null | undefined): string | null {
  if (metros == null || !Number.isFinite(metros) || metros > 1250) return null;
  const c = Math.max(1, Math.round(metros / 100));
  return c === 1 ? "A una cuadra del metro" : `A ${c} cuadras del metro`;
}

/** «Documentos de este depto» va desde que el depto está listo (lámina 4.2; la 4.1 no lo trae). */
export const conDocumentos = (e: Etapa) => e !== "confirmando" && e !== "no_avanza" && e !== "no_sigo";
