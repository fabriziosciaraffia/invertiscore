// ─────────────────────────────────────────────────────────────────────────────
// LA VISITA ANTES DE CERRAR EL PRECIO (etapa 3, 24-nov-2026; paquete «visita antes del precio» del 23 y 24-nov y las decisiones de
// Fabrizio en su respuesta a la FASE 0). Lo puro: el punto que suma un arreglo que se vio en la visita, el rango y lo que sugiere Franco
// después de la visita, qué salidas tiene la persona y los textos. Sin base ni red: lo lee también el navegador.
//   · La primera oferta va sin visita. Cuando quien vende responde, lo que sigue es la visita: con contraoferta, «Visitar antes de
//     responder»; aceptada, «Pedir la visita» (y «Confirmar sin visitar» como enlace, con confirmación explícita).
//   · Pedir la visita solo avisa a Franco y deja la tarea: quién va está sin decidir (no hay pantalla de elegir cómo, ni horarios).
//   · Con contraoferta, Franco le pide a quien vende mantenerla mientras se visita; si acepta, la fecha nueva reemplaza al vencimiento.
//   · El reporte (lo carga el admin): lo que se revisó punto por punto; un punto con arreglo es concreto. Decisión 1: un arreglo que no se
//     veía en las fotos suma su punto (una vez, como hoy un arreglo de las fotos); uno que ya se veía no suma de nuevo; remodelación, como
//     hoy (lleva los puntos de remodelación, descontado lo que ya sumaron las fotos). Si coincide con las fotos, el rango no cambia.
//   · Ofrecer menos que la oferta anterior: solo después de la visita y solo si el reporte nombra un arreglo concreto (lo fija también un
//     trigger en la base). Con la oferta aceptada y una visita que coincide, «Ajustar el precio» no aparece (decisión 2).
// ─────────────────────────────────────────────────────────────────────────────
import { CONFIG_RANGO_V1, puntosArreglos, type ConfigRango } from "./rango";

export const VISITAS_ABIERTAS = ["pedida", "agendada", "visitada"] as const;
export type EstadoReporte = "coincide" | "arreglos_menores" | "remodelacion";

/** Un punto de lo que se revisó: el tema («Baños»), lo que se vio, si es un arreglo concreto y si ya se veía en las fotos. */
export interface PuntoVisita { tema: string; texto: string; arreglo: boolean; enFotos: boolean }

/** Lo que la oferta y la página necesitan saber de la visita del depto. */
export interface VisitaResumen {
  id: string;
  estado: string;
  pedidaDesde: string | null;
  visitadaAt: string | null;
  reporteEstado: EstadoReporte | null;
  reporteLinea: string | null;
  arreglos: string[];
  puntos: PuntoVisita[];
  fotos: string[];
  /** Cuántos puntos de rebaja sumó la visita (0 si coincide o si sus arreglos ya se veían en las fotos). */
  delta: number;
  /** El rango después de la visita (igual al de antes si no sumó puntos). */
  pisoUF: number | null;
  altoUF: number | null;
  sugeridaAntesUF: number | null;
  sugeridaDespuesUF: number | null;
}

export const visitaPublicada = (v: VisitaResumen | null | undefined): v is VisitaResumen => !!v && v.estado === "reporte_publicado";
export const visitaAbierta = (v: VisitaResumen | null | undefined): v is VisitaResumen => !!v && (VISITAS_ABIERTAS as readonly string[]).includes(v.estado);
/** ¿El reporte nombra un arreglo concreto? Es lo único que permite bajar de la oferta anterior. */
export const conArreglo = (v: VisitaResumen | null | undefined) => visitaPublicada(v) && v.arreglos.length > 0;

/** El estado del reporte sale de los puntos: sin arreglos, «coincide»; con alguno, «arreglos menores», salvo que el admin marque remodelación. */
export function estadoDelReporte(puntos: readonly PuntoVisita[], remodelacion: boolean): EstadoReporte {
  if (!puntos.some((p) => p.arreglo)) return "coincide";
  return remodelacion ? "remodelacion" : "arreglos_menores";
}

/** DECISIÓN 1: los puntos que suma la visita. `estadoFotos`/`arreglosFotos`: los de la lectura de las fotos (lo que ya sumó el rango). */
export function puntosVisita(p: { estadoFotos: string | null; arreglosFotos: readonly string[]; reporte: EstadoReporte; puntos: readonly PuntoVisita[] }, c: ConfigRango = CONFIG_RANGO_V1): number {
  const yaSumado = puntosArreglos(p.estadoFotos, p.arreglosFotos, c);
  if (p.reporte === "remodelacion") return Math.max(0, c.remodelacion - yaSumado);
  if (p.reporte === "arreglos_menores" && p.puntos.some((x) => x.arreglo && !x.enFotos)) return c.arreglos;
  return 0;
}

/** EL RANGO DESPUÉS DE LA VISITA: la misma regla del rango con los puntos de la visita sumados al descuento (entre el mínimo y el máximo). */
export function rangoTrasVisita(o: { publicadoUF: number; descuentoPct: number; comprarUF: number | null; pisoUF: number; altoUF: number }, delta: number, c: ConfigRango = CONFIG_RANGO_V1): { descuentoPct: number; pisoUF: number; altoUF: number; recomendadoUF: number } {
  const pub = o.publicadoUF;
  if (!delta || !(pub > 0)) return { descuentoPct: o.descuentoPct, pisoUF: o.pisoUF, altoUF: o.altoUF, recomendadoUF: Math.round(pub * (1 - o.descuentoPct / 100)) };
  const d = Math.min(c.max, Math.max(c.min, o.descuentoPct + delta));
  const recomendadoUF = Math.round(pub * (1 - d / 100));
  const techo = o.comprarUF != null && o.comprarUF > 0 && o.comprarUF < pub ? Math.round(o.comprarUF) : Math.round(pub);
  const altoUF = Math.min(techo, Math.round(pub * (1 - (d - c.banda) / 100)), o.altoUF);
  const pisoUF = Math.min(Math.round(pub * (1 - (d + c.banda) / 100)), altoUF);
  return { descuentoPct: d, pisoUF, altoUF, recomendadoUF: Math.min(recomendadoUF, altoUF) };
}

/** Lo que sugiere Franco con la oferta aceptada después de una visita con un arreglo: el borde alto nuevo, nunca sobre lo aceptado. */
export function ajusteSugerido(aceptadaUF: number, altoUF: number): number {
  return Math.min(Math.round(aceptadaUF) - 1, Math.round(altoUF));
}

// ── LOS TEXTOS (láminas 4.2-estados, 4.2-la-visita, 5.2 y 4.4 del 24-nov, tal como están escritos) ─────────────────
export const VISITA_COPY = {
  visitarAntes: "Visitar antes de responder",
  responderSinVisitar: "Responder sin visitar",
  pedirVisita: "Pedir la visita",
  confirmarSinVisitar: "Confirmar sin visitar",
  coordinandoT: "Franco está coordinando tu visita",
  seMantieneEt: "Se mantiene hasta",
  seMantiene: (fecha: string) => `La contraoferta se mantiene hasta el ${fecha}`,
  seMantieneCorto: (fecha: string) => `Se mantiene hasta el ${fecha}`,
  noEsperaT: "Quien vende no puede esperar la visita",
  noEspera: (fecha: string) => `La contraoferta vence el ${fecha}.`,
  yaVisitasteContraT: "Ya visitaste: responde la contraoferta",
  // Con espacio que no corta: «UF 2.966» nunca queda partido en dos renglones.
  yaVisitasteAceptadaT: (uf: string) => `Ya visitaste: ¿confirmas ${uf.replace(/^UF /, "UF ")}?`,
  aceptadaSinVisitaTxt: "Antes de dejarla en firme, mira el depto.",
  confirmar: (uf: string) => `Confirmar ${uf}`,
  ajustar: "Ajustar el precio con lo que viste",
  retirarMiOferta: "Retirar mi oferta",
  enFirmeNota: "Al confirmar queda en firme y ya no se puede retirar.",
  verReporte: "Ver reporte",
  coincide: "El estado coincide con las fotos",
  ajusteRespaldo: "Va con el reporte de la visita como respaldo.",
  nuevaOferta: "Nueva oferta",
  antes: "Antes",
  // La confirmación explícita (decisión 7).
  confirmarT: (uf: string) => `¿Confirmas tu oferta en ${uf.replace(/^UF /, "UF ")}?`,
  confirmarTxt: "Queda en firme y ya no se puede retirar. Franco se lo comunica a quien vende.",
  confirmarSinVisitarT: "¿Confirmas sin visitar?",
  confirmarSinVisitarTxt: "Queda en firme sin haber visto el depto, y ya no se puede retirar.",
  confirmarSi: "Sí, confirmar",
  confirmarNo: "Volver",
  // 5.2 antes y después de la visita.
  sugiereVisitaT: "Visita antes de responder",
  sugiereVisita: (uf: string) => `Tu oferta partió de las fotos. Con lo que veas, decides si ${uf} sigue siendo lo justo.`,
  sinCambioRango: "La visita no cambió el rango.",
  visitasteEl: (fecha: string) => `Visitaste el ${fecha}`,
  // Camino.
  caminoAntesRespuesta: "Después de la respuesta",
  caminoRecomendada: "Recomendada antes de responder",
  caminoCoordina: "Franco la coordina",
  caminoHecha: (fecha: string) => `Hecha el ${fecha}`,
  caminoAceptada: "Te toca a ti: pedirla o confirmar sin visitar",
  caminoEsperaVisita: "Contraoferta · espera tu visita",
  caminoConfirmar: "Te toca a ti: confirmar, ajustar o retirar",
  caminoConfirmarSinAjuste: "Te toca a ti: confirmar o retirar",
  caminoNuevaOferta: "Nueva oferta · Franco la va a presentar",
  // El reporte (lámina 4.4 del 24-nov).
  reporteT: "Reporte de la visita",
  reporteFecha: (fecha: string) => `Visita del ${fecha}`.toUpperCase(),
  reporteArregloT: (n: number) => (n === 1 ? "Hay un arreglo que no se veía en las fotos" : `Hay ${n} arreglos que no se veían en las fotos`),
  reporteArreglosVistosT: "Los arreglos que se veían en las fotos se confirmaron",
  reporteRemodelacionT: "Necesita una remodelación",
  reporteSinCambio: "No se vio nada que cambie el precio.",
  fotosVisita: (n: number) => `${n} foto${n === 1 ? "" : "s"} de la visita · toca una para verla en grande`,
  seReviso: "Lo que se revisó",
  cambiaPrecio: "Qué cambia en el precio",
  francoSugeria: "Franco sugería",
  ahoraSugiere: "Ahora sugiere",
  noCambia: "No cambia.",
  unPuntoMas: (que: string) => `Estimamos un punto más de rebaja por ${que}.`,
  volverDepto: "Volver al depto",
  docReporte: "Reporte de la visita",
  // Los avisos (decisión 9).
} as const;

/** El título del reporte: el resultado en una frase. */
export function tituloReporte(v: Pick<VisitaResumen, "reporteEstado" | "puntos">): string {
  if (v.reporteEstado === "remodelacion") return VISITA_COPY.reporteRemodelacionT;
  const nuevos = v.puntos.filter((p) => p.arreglo && !p.enFotos).length;
  if (v.reporteEstado === "arreglos_menores") return nuevos ? VISITA_COPY.reporteArregloT(nuevos) : VISITA_COPY.reporteArreglosVistosT;
  return VISITA_COPY.coincide;
}
