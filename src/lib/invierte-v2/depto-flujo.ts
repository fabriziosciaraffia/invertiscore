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
import { B4_COPY, cierreDe, fechaCorta, fraccionVigencia, lineaVence, ultimoDia } from "./b4";

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
  // B4 (23-nov-2026): la barra de los días de vigencia (cuánto pasó, 0 a 1), el segundo botón, los enlaces grises que hacen algo
  // («Retirarla» con su confirmación, «No, gracias»), «Ver mi oferta» y una línea de aviso arriba de los botones.
  vigencia?: number;
  secundario?: { texto: string; href: string } | null;
  acciones?: ("retirar" | "no_gracias")[];
  verOferta?: boolean;
  aviso?: string | null;
}

/** La oferta del depto, lo que «Lo que sigue» necesita saber (B3). */
export interface OfertaResumen {
  estado: string; postura: "asegura" | "negocia_poco" | "negocia_argumentos"; pisoUF: number; altoUF: number; montoUF: number | null; publicadoUF?: number; firmadaAt?: string | null;
  // B4: lo que la oferta necesita mostrar después de firmar (rango-servidor.ts › OfertaVista las trae todas).
  id?: string; tipoRonda?: string | null; presentadaAt?: string | null; vigenteHasta?: string | null; respuesta?: string | null; respuestaAt?: string | null;
  contraofertaUF?: number | null; contraofertaVence?: string | null; sugeridaUF?: number | null; sinAcuerdoMotivo?: string | null;
  respuestaTardia?: string | null; respuestaTardiaUF?: number | null; tardiaDecision?: string | null; retiradaAt?: string | null;
}
const uf0 = (n: number) => `UF ${Math.round(n).toLocaleString("es-CL")}`;
/** La página de la oferta del depto (lámina 5.1). */
export const urlOferta = (avisoId: string) => `${urlDepto(avisoId)}/oferta`;
/** Responder la contraoferta (lámina 5.2, B4). */
export const urlContraoferta = (avisoId: string) => `${urlDepto(avisoId)}/contraoferta`;
/** «Revisa y firma» de una ronda nueva: desde qué oferta, con qué monto (y si elige quedarse con esta ante otra viva). */
export const urlFirmaRonda = (avisoId: string, montoUF: number, desdeId: string, retirarOtra = false) =>
  `${urlOferta(avisoId)}/firmar?monto=${Math.round(montoUF)}&desde=${encodeURIComponent(desdeId)}${retirarOtra ? "&retirarOtra=1" : ""}`;
const FRANCO_EN_ESO = "Franco está en eso", TE_TOCA = "Te toca a ti";
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Las tres cifras de la contraoferta, lado a lado (lámina 4.2-estados): tú, ellos y lo que sugiere Franco. */
function tresCifras(o: OfertaResumen): { et: string; v: string; azul?: boolean }[] {
  return [
    ...(o.montoUF ? [{ et: B4_COPY.tu, v: uf0(o.montoUF) }] : []),
    ...(o.contraofertaUF ? [{ et: B4_COPY.ellos, v: uf0(o.contraofertaUF) }] : []),
    ...(o.sugeridaUF ? [{ et: B4_COPY.francoSugiere, v: uf0(o.sugeridaUF), azul: true }] : []),
  ];
}

/** «Lo que sigue» después de firmar (B4; lámina 4.2-estados-despues-de-firmar): firmada, en cola, presentada, contraoferta y aceptada. */
function despuesDeFirmar(o: OfertaResumen, avisoId: string, ahora: Date): LoQueSigue | null {
  const tu = o.montoUF ? uf0(o.montoUF) : null;
  const tuCifra = tu ? [{ et: B4_COPY.tuOferta, v: tu }] : [];
  if (o.estado === "firmada" && (o.tipoRonda === "aceptar" || o.tipoRonda === "reactivar")) {
    return { chip: FRANCO_EN_ESO, tono: "gris", titulo: B4_COPY.comunicarT, texto: B4_COPY.comunicarTxt, boton: null, cifras: tuCifra, verOferta: true, acciones: ["retirar"] };
  }
  if (o.estado === "firmada") {
    return { chip: FRANCO_EN_ESO, tono: "gris", titulo: o.tipoRonda === "proponer" ? B4_COPY.rondaNuevaT : B4_COPY.firmadaT, texto: B4_COPY.firmadaTxt, boton: null, cifras: [...tuCifra, ...(o.firmadaAt ? [{ et: "Firmada", v: diaMes(o.firmadaAt) }] : [])], verOferta: true, acciones: ["retirar"] };
  }
  if (o.estado === "en_cola") return { chip: FRANCO_EN_ESO, tono: "gris", titulo: B4_COPY.enColaT, texto: B4_COPY.enColaTxt, boton: null, cifras: tuCifra, verOferta: true, acciones: ["retirar"] };
  if (o.estado === "presentada") {
    const vence = o.vigenteHasta ? new Date(o.vigenteHasta) : null;
    const l = vence ? lineaVence(vence, ahora) : null;
    const primero = l ? (l.vencida ? l.vence : l.quedan ? mayuscula(l.quedan) : l.vence) : null;
    return {
      chip: FRANCO_EN_ESO, tono: "gris", titulo: B4_COPY.presentadaT, boton: null,
      cifras: [...tuCifra, ...(vence ? [{ et: "Vence", v: fechaCorta(ultimoDia(vence)) }] : [])],
      vigencia: vence && o.presentadaAt ? fraccionVigencia(new Date(o.presentadaAt), vence, ahora) : undefined,
      // Entre la medianoche en que vence y la pasada de la mañana que la cierra, solo «Venció sin respuesta».
      texto: l?.vencida ? "Venció sin respuesta" : [primero, B4_COPY.presentadaTxt].filter(Boolean).join(" · "), verOferta: true, acciones: ["retirar"],
    };
  }
  if (o.estado === "contraoferta") {
    const v = o.contraofertaVence ? lineaVence(new Date(o.contraofertaVence), ahora) : null;
    return { chip: TE_TOCA, tono: "ciruela", titulo: B4_COPY.piden(uf0(o.contraofertaUF ?? 0)), texto: null, cifras: tresCifras(o), boton: { texto: B4_COPY.responder, href: urlContraoferta(avisoId) }, nota: v ? v.vence : undefined };
  }
  if (o.estado === "aceptada_sujeta") {
    // La visita es de B5: en B4 la tarjeta dice que aceptaron y que Franco coordina la visita, sin «Pedir la visita» ni «Confirmar sin visitar».
    return { chip: TE_TOCA, tono: "ciruela", titulo: B4_COPY.aceptadaT(tu ?? ""), texto: B4_COPY.aceptadaTxt, boton: null, acciones: ["retirar"] };
  }
  return null;
}

/** «Lo que sigue» cuando la oferta no llegó a acuerdo (B4; lámina 4.2-cuando-no-hay-acuerdo): el depto vuelve al paso 2. */
export function cuandoNoHayAcuerdo(c: OfertaResumen, avisoId: string, otraViva: { titulo: string } | null, ahora: Date = new Date()): LoQueSigue | null {
  const cierre = cierreDe(c);
  const tu = c.montoUF ? uf0(c.montoUF) : null;
  const tuCifra = tu ? [{ et: B4_COPY.tuOferta, v: tu }] : [];
  const otra = { texto: B4_COPY.hacerOtra, href: urlOferta(avisoId) };
  const vencio = c.vigenteHasta ? [{ et: "Venció", v: fechaCorta(ultimoDia(new Date(c.vigenteHasta))) }] : [];
  if (cierre === "rechazada") return { chip: TE_TOCA, tono: "ciruela", titulo: B4_COPY.rechazadaT, texto: B4_COPY.rechazadaTxt, cifras: [...tuCifra, ...(c.respuestaAt ? [{ et: "Respondieron", v: diaMes(c.respuestaAt) }] : [])], boton: otra };
  if (cierre === "vencida" && c.respuesta === "contraoferta") return { chip: TE_TOCA, tono: "ciruela", titulo: B4_COPY.contraVencidaT, texto: B4_COPY.contraVencidaTxt, cifras: [...tuCifra, ...(c.contraofertaUF ? [{ et: B4_COPY.ellos, v: uf0(c.contraofertaUF) }] : [])], boton: otra };
  if (cierre === "vencida") return { chip: TE_TOCA, tono: "ciruela", titulo: B4_COPY.vencidaT, texto: B4_COPY.vencidaTxt, cifras: [...tuCifra, ...vencio], boton: c.id && c.montoUF ? { texto: B4_COPY.volverAPresentar, href: urlFirmaRonda(avisoId, c.montoUF, c.id) } : otra, secundario: { texto: B4_COPY.cambiarMonto, href: urlOferta(avisoId) } };
  if (cierre === "tardia" && c.respuestaTardia === "contraoferta") {
    const v = c.contraofertaVence ? lineaVence(new Date(c.contraofertaVence), ahora) : null;
    return { chip: TE_TOCA, tono: "ciruela", titulo: B4_COPY.tardiaContraT(uf0(c.contraofertaUF ?? 0)), texto: B4_COPY.fueraDePlazo, cifras: tresCifras(c), boton: { texto: B4_COPY.responder, href: urlContraoferta(avisoId) }, nota: v ? v.vence : undefined };
  }
  if (cierre === "tardia") {
    const m = c.respuestaTardiaUF ?? c.montoUF ?? 0;
    return {
      chip: TE_TOCA, tono: "ciruela", titulo: B4_COPY.tardiaT(uf0(m)), texto: B4_COPY.tardiaTxt, cifras: [...tuCifra, ...vencio],
      aviso: otraViva ? B4_COPY.tardiaOtra(otraViva.titulo) : null,
      boton: c.id ? { texto: B4_COPY.reactivar, href: urlFirmaRonda(avisoId, m, c.id, !!otraViva) } : null, acciones: ["no_gracias"],
    };
  }
  if (cierre === "retirada") return { chip: "Sin oferta", tono: "gris", titulo: B4_COPY.retiradaT, texto: B4_COPY.retiradaTxt, cifras: [...tuCifra, ...(c.retiradaAt ? [{ et: "Retirada", v: diaMes(c.retiradaAt) }] : [])], boton: null, secundario: otra };
  if (cierre === "no_gracias") return { chip: "Sin oferta", tono: "gris", titulo: B4_COPY.noGraciasT, texto: B4_COPY.noGraciasTxt, cifras: tuCifra, boton: null, secundario: otra };
  return null;
}

/** «Lo que sigue» en la página del depto, según su etapa y la preaprobación. null en no_avanza (la página entera cambia). */
export function loQueSigue(etapa: Etapa, pre: EstadoVisible, urlPreaprobacion: string, oferta: OfertaResumen | null = null, urlDeLaOferta = "", extra: { avisoId?: string; ahora?: Date; cierre?: OfertaResumen | null; otraViva?: { titulo: string } | null } = {}): LoQueSigue | null {
  const avisoId = extra.avisoId ?? "";
  const ahora = extra.ahora ?? new Date();
  if (etapa === "confirmando") {
    return { chip: "Franco está en eso", tono: "gris", titulo: "Estamos confirmando este depto", texto: "Franco está coordinando con quien lo vende para dejarlo listo para tu oferta o tu visita. Te avisamos apenas esté.", boton: null };
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
  if (etapa === "listo" && oferta) {
    const d = despuesDeFirmar(oferta, avisoId, ahora);
    if (d) return d;
  }
  if (etapa === "listo" && !oferta && extra.cierre) {
    const c = cuandoNoHayAcuerdo(extra.cierre, avisoId, extra.otraViva ?? null, ahora);
    if (c) return c;
  }
  if (etapa === "listo") {
    // Sin rango calculado todavía (sin precio publicado): sin botón.
    return { chip: "Te toca a ti", tono: "ciruela", titulo: "Listo para ofertar o visitar", texto: "Franco ya lo dejó listo con quien lo vende. Muy pronto vas a poder hacer tu oferta o pedir una visita desde aquí.", boton: null };
  }
  return null;
}

/** La oferta del depto que la base y el camino necesitan (una sola consulta para toda la base: base-servidor.ts). */
export interface OfertaBase {
  estado: string; pisoUF: number | null; altoUF: number | null; montoUF?: number | null; presentadaAt?: string | null; contraofertaUF?: number | null; enFirmeComo?: string | null;
  // B4: el vencimiento, cómo terminó y cómo nació la ronda.
  vigenteHasta?: string | null; sinAcuerdoMotivo?: string | null; respuesta?: string | null; respuestaTardia?: string | null; tardiaDecision?: string | null; retiradaAt?: string | null; tipoRonda?: string | null;
}

/** Los tres niveles de la base (segunda vuelta del rediseño, 23-nov-2026; regla de Fabrizio): si la persona tiene un botón principal
 *  que apretar, «Te toca a ti»; si el depto ya avanzó y el siguiente movimiento es de Franco o de quien vende, «En curso con Franco»;
 *  si no ha pasado nada todavía, «Recién partiendo». */
export type NivelBase = "tuyo" | "curso" | "partiendo";
export interface EstadoBase { chip: string; tono: Tono; linea: string; titulo?: string; nivel: NivelBase }
const FRANCO = "Franco está en eso", TUYO = "Te toca a ti";
/** «día 2 de 5» de una oferta presentada (vigente por 5 días). */
export function diaVigencia(presentadaAt: string, ahora: Date = new Date()): number {
  return Math.min(5, Math.max(1, Math.floor((ahora.getTime() - new Date(presentadaAt).getTime()) / 864e5) + 1));
}
/** El estado de la tarjeta en la base: el chip, qué pasa (`titulo`), el dato que importa (`linea`) y su nivel. */
export function estadoEnBase(etapa: Etapa, pre: EstadoVisible, motivo: string | null, oferta: OfertaBase | null = null, ahora: Date = new Date()): EstadoBase {
  const monto = oferta?.montoUF ? uf0(oferta.montoUF) : null;
  if (etapa === "no_avanza") return { chip: "No avanzó", tono: "gris", nivel: "partiendo", linea: motivo === "dejo_de_convenir" ? "Al confirmar dónde está, dejó de convenir" : "Te mostramos el más parecido que sí podemos gestionar" };
  if (etapa === "sin_preaprobacion") return pre === "en_revision"
    ? { chip: FRANCO, tono: "gris", nivel: "partiendo", titulo: "Revisando tu preaprobación", linea: "Te avisamos apenas esté" }
    : { chip: TUYO, tono: "ciruela", nivel: "tuyo", titulo: "Sube tu preaprobación", linea: "Para ofertar o visitar" };
  if (etapa === "listo") {
    const e = oferta?.estado ?? "borrador";
    if (e === "firmada" && (oferta?.tipoRonda === "aceptar" || oferta?.tipoRonda === "reactivar")) return { chip: FRANCO, tono: "gris", nivel: "curso", titulo: "Aceptas su precio", linea: [monto, "Franco se lo comunica"].filter(Boolean).join(" · ") };
    if (e === "firmada") return { chip: FRANCO, tono: "gris", nivel: "curso", titulo: "Oferta firmada", linea: [monto, "Franco la presenta"].filter(Boolean).join(" · ") };
    if (e === "en_cola") return { chip: FRANCO, tono: "gris", nivel: "curso", titulo: "Oferta preparada", linea: [monto, "se presenta después de la vigente"].filter(Boolean).join(" · ") };
    // B4 (punto 7 de Fabrizio): sin «día n de 5»: «vence el sábado 28»; el último día, «vence hoy».
    if (e === "presentada") return { chip: FRANCO, tono: "gris", nivel: "curso", titulo: "Oferta presentada", linea: [monto, oferta?.vigenteHasta ? lineaVence(new Date(oferta.vigenteHasta), ahora).vence.toLowerCase() : null].filter(Boolean).join(" · ") };
    if (e === "contraoferta") return { chip: TUYO, tono: "ciruela", nivel: "tuyo", titulo: "Responde la contraoferta", linea: oferta?.contraofertaUF ? `Ellos: ${uf0(oferta.contraofertaUF)}` : "Quien vende te respondió con otro precio" };
    if (e === "aceptada_sujeta") return { chip: TUYO, tono: "ciruela", nivel: "tuyo", titulo: "Pide la visita", linea: monto ? `Aceptaron tu oferta: ${monto}` : "Aceptaron tu oferta" };
    // B4: cuando no hubo acuerdo, el depto vuelve al paso 2 con lo que pasó (lámina 4.2-cuando-no-hay-acuerdo).
    const cierre = oferta ? cierreDe(oferta) : null;
    if (cierre === "rechazada") return { chip: TUYO, tono: "ciruela", nivel: "tuyo", titulo: "No aceptaron tu oferta", linea: "Puedes hacer otra o dejar este depto" };
    if (cierre === "vencida") return { chip: TUYO, tono: "ciruela", nivel: "tuyo", titulo: oferta?.respuesta === "contraoferta" ? "La contraoferta venció" : "Tu oferta venció", linea: "Quedaste libre para ofertar por otro" };
    if (cierre === "tardia") return { chip: TUYO, tono: "ciruela", nivel: "tuyo", titulo: "Respondieron fuera de plazo", linea: oferta?.respuestaTardia === "contraoferta" ? "Contraofertaron: responde si sigues" : "Aceptaron: reactívala si sigues" };
    if (cierre === "retirada" || cierre === "no_gracias") return { chip: "Sin oferta", tono: "gris", nivel: "partiendo", titulo: cierre === "retirada" ? "Retiraste tu oferta" : "No seguiste con su respuesta", linea: "Puedes hacer otra cuando quieras" };
    const rango = oferta?.pisoUF && oferta.altoUF ? `Franco recomienda ${uf0(oferta.pisoUF)} a ${Math.round(oferta.altoUF).toLocaleString("es-CL")}` : "Franco ya lo dejó listo con quien lo vende";
    return { chip: TUYO, tono: "ciruela", nivel: "tuyo", titulo: "Haz tu oferta", linea: rango };
  }
  if (etapa === "en_firme") return { chip: FRANCO, tono: "gris", nivel: "curso", titulo: "Oferta en firme", linea: monto ?? "Franco prepara la promesa" };
  if (etapa === "promesa") return { chip: FRANCO, tono: "gris", nivel: "curso", titulo: "Promesa", linea: monto ?? "Franco coordina la promesa" };
  if (etapa === "escritura") return { chip: FRANCO, tono: "gris", nivel: "curso", titulo: "Escritura", linea: monto ?? "Franco coordina la escritura" };
  if (etapa === "inscrito") return { chip: "Listo", tono: "gris", nivel: "curso", titulo: "Inscrito a tu nombre", linea: monto ?? "El depto ya es tuyo" };
  if (etapa === "en_pausa") return { chip: FRANCO, tono: "gris", nivel: "partiendo", titulo: "En pausa", linea: "Franco te escribe para retomarlo" };
  return { chip: FRANCO, tono: "gris", nivel: "partiendo", titulo: "Confirmando el depto", linea: "Con quien lo vende" };
}
const RANGO_NIVEL: Record<NivelBase, number> = { tuyo: 0, curso: 1, partiendo: 2 };
/** El orden de la base: primero «Te toca a ti», después «En curso», después «Recién partiendo»; dentro de cada nivel, primero el depto
 *  más avanzado en el camino (el mismo camino de la página del depto); a igual paso, en el orden en que llegaron. Dentro de «Recién
 *  partiendo», en pausa y no avanzó van al final (decisión de Fabrizio, 23-nov-2026). */
const AL_FINAL: readonly Etapa[] = ["en_pausa", "no_avanza"];
export function ordenBase<T extends { etapa: Etapa; noAvanzaMotivo: string | null; oferta: OfertaBase | null }>(xs: T[], pre: EstadoVisible): T[] {
  const clave = (d: T) => ({ n: RANGO_NIVEL[estadoEnBase(d.etapa, pre, d.noAvanzaMotivo, d.oferta).nivel], fin: AL_FINAL.includes(d.etapa) ? 1 : 0, paso: caminoDepto(d.etapa, d.oferta).actual });
  return xs.map((d, i) => ({ d, i, k: clave(d) })).sort((a, b) => a.k.n - b.k.n || a.k.fin - b.k.fin || b.k.paso - a.k.paso || a.i - b.i).map((x) => x.d);
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
export type EstadoPaso = "hecho" | "tuyo" | "franco" | "pendiente" | "omitido";
export interface PasoCamino { n: number; t: string; s: string | null; /** El de la línea de PC: «Listo», «Te toca a ti», «Después de la respuesta». */ corto: string | null; estado: EstadoPaso }
export const PASOS_CAMINO = ["Depto confirmado", "Oferta", "Visita", "Oferta en firme", "Promesa", "Escritura"] as const;
/** Los seis pasos con el actual marcado: ciruela si le toca a la persona, negro si lo lleva Franco. La oferta y la visita son pasos del
 *  camino (sale la tarjeta «Oferta · Sin presentar»). Es LA fuente del camino: la página del depto y el camino chico de la base lo
 *  dibujan desde aquí. Segunda vuelta (23-nov): el paso 1 se llama «Confirmar el depto» mientras está en curso; la visita que no hubo
 *  queda «omitida» (gris hueco) cuando el depto ya pasó de ahí; la oferta aceptada pasa a la visita, nunca a «Haz tu oferta». */
export function caminoDepto(etapa: Etapa, oferta: (Pick<OfertaBase, "estado" | "enFirmeComo" | "montoUF"> & Partial<OfertaBase>) | null): { actual: number; pasos: PasoCamino[] } {
  // La visita deja de ser «Opcional» (LEEME del 23-nov): antes de la respuesta, «Después de la respuesta».
  const subs: (string | null)[] = [null, null, "Después de la respuesta", null, null, null];
  let actual = 1, estado: EstadoPaso = "franco";
  if (etapa === "confirmando" || etapa === "en_pausa") { subs[0] = "Franco lo está confirmando con quien lo vende"; }
  else if (etapa === "sin_preaprobacion") { actual = 2; estado = "tuyo"; subs[1] = "Te toca a ti: sube tu preaprobación"; }
  else if (etapa === "listo") {
    actual = 2;
    const e = oferta?.estado ?? "borrador";
    const cierre = oferta ? cierreDe(oferta as Parameters<typeof cierreDe>[0]) : null;
    if (e === "firmada" && (oferta?.tipoRonda === "aceptar" || oferta?.tipoRonda === "reactivar")) { estado = "franco"; subs[1] = oferta?.montoUF ? `Aceptas ${uf0(oferta.montoUF)} · Franco se lo comunica` : "Aceptas · Franco se lo comunica"; }
    else if (e === "firmada") { estado = "franco"; subs[1] = oferta?.tipoRonda === "proponer" ? "Nueva oferta · Franco la va a presentar" : "Firmada · Franco la va a presentar"; }
    else if (e === "en_cola") { estado = "franco"; subs[1] = "Preparada · Franco la presenta después de la vigente"; }
    else if (e === "presentada") { estado = "franco"; subs[1] = "Presentada · esperando respuesta"; }
    else if (e === "contraoferta") { estado = "tuyo"; subs[1] = "Contraoferta · te toca a ti"; }
    else if (e === "aceptada_sujeta") { actual = 3; estado = "tuyo"; subs[1] = oferta?.montoUF ? `Aceptada en ${uf0(oferta.montoUF)}` : "Aceptada"; subs[2] = "Visita pendiente · Franco la coordina"; }
    else if (cierre === "rechazada") { estado = "tuyo"; subs[1] = "No aceptada · te toca a ti"; }
    else if (cierre === "vencida") { estado = "tuyo"; subs[1] = "Vencida · te toca a ti"; }
    else if (cierre === "tardia") { estado = "tuyo"; subs[1] = "Respondieron tarde · te toca a ti"; }
    else if (cierre === "retirada") { estado = "pendiente"; subs[1] = oferta?.retiradaAt ? `Retirada el ${diaMes(oferta.retiradaAt)}` : "Retirada"; }
    else if (cierre === "no_gracias") { estado = "pendiente"; subs[1] = "Sin oferta · puedes hacer otra"; }
    else { estado = "tuyo"; subs[1] = "Te toca a ti: haz tu oferta"; }
  }
  else if (etapa === "en_firme") actual = 4;
  else if (etapa === "promesa") actual = 5;
  else if (etapa === "escritura") actual = 6;
  else if (etapa === "inscrito") actual = 7;
  if (actual > 1) subs[0] = "Dirección y disponibilidad confirmadas";
  const sinVisita = actual > 3 && oferta?.enFirmeComo === "sin_visitar";
  if (sinVisita) subs[2] = "No hubo visita";
  const pasos = PASOS_CAMINO.map((t0, i): PasoCamino => {
    const n = i + 1;
    const e: EstadoPaso = n === 3 && sinVisita ? "omitido" : n < actual ? "hecho" : n === actual ? estado : "pendiente";
    const t = n === 1 && actual === 1 ? "Confirmar el depto" : t0;
    const corto = e === "omitido" ? "Sin visita" : e === "hecho" ? "Listo" : e === "tuyo" ? "Te toca a ti" : e === "franco" ? "Franco está en eso" : n === 3 ? subs[2] : null;
    return { n, t, s: n === actual || n === 1 || n === 3 || (n === 2 && !!subs[1]) ? subs[i] : null, corto, estado: e };
  });
  return { actual: Math.min(actual, PASOS_CAMINO.length), pasos };
}

/** «A 4 cuadras del metro» (una cuadra ≈ 100 m), hasta 12 cuadras; más lejos, nada. */
export function cuadrasMetro(metros: number | null | undefined): string | null {
  if (metros == null || !Number.isFinite(metros) || metros > 1250) return null;
  const c = Math.max(1, Math.round(metros / 100));
  return c === 1 ? "A una cuadra del metro" : `A ${c} cuadras del metro`;
}

/** «Documentos de este depto» va desde que el depto está listo (lámina 4.2; la 4.1 no lo trae). */
export const conDocumentos = (e: Etapa) => e !== "confirmando" && e !== "no_avanza" && e !== "no_sigo";
