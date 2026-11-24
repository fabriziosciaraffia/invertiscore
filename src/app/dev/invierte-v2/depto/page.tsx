// /dev/invierte-v2/depto (etapa 3, B1, 21-nov-2026): la página de un depto con datos de muestra, para revisar en pantalla cada etapa
// sin cuentas ni escrituras. ?etapa=confirmando (por defecto) | sin_preaprobacion | revision | corregir | listo | no_avanza | dejo
//   · ?aviso=<uuid>: toma las fotos de ese aviso real (la ruta de fotos pide una orden firmada: con la cuenta de QA).
//   · ?confirmada=1: con la ubicación confirmada (sin la línea de «aproximada», con el número en el título).
//   · ?pocos=1: las cuatro cifras con la marca «Estimado con pocos arriendos comparables» (23-nov-2026).
//   · B4 (con ?etapa=listo&confirmada=1): ?oferta=firmada | en_cola | comunicar | presentada | presentada_hoy | contraoferta | aceptada_sujeta
//     (después de firmar), y ?cierre=rechazada | vencida | contra_vencida | tardia | tardia_contra | retirada | no_gracias (cuando no hubo
//     acuerdo); ?otra=1 agrega otra oferta viva (la respuesta fuera de plazo pide elegir con cuál se queda).
//   · Las cuatro cifras y el bloque de la oferta salen del motor, con los datos fijos de un depto real (muestra-motor.ts).
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { visitaMuestra } from "@/lib/invierte-v2/muestra-visita";
import { VistaDepto } from "@/components/invierte-v2/VistaDepto";
import { DEPTO_COPY, type Etapa } from "@/lib/invierte-v2/depto-flujo";
import type { PaginaDepto } from "@/lib/invierte-v2/depto-pagina-servidor";
import type { EstadoVisible } from "@/lib/invierte-v2/preaprobacion";
import { filaCambio, lineaCambio } from "@/lib/invierte-v2/cambios";
import { direccionDepto, tituloDepto } from "@/lib/invierte-v2/titulo-depto";
import { bloqueOfertaCifras, cifrasDeDepto } from "@/lib/invierte-v2/cifras-motor";
import { MOTOR_MUESTRA } from "@/lib/invierte-v2/muestra-motor";
import { venceAlTerminar } from "@/lib/invierte-v2/b4";

export const dynamic = "force-dynamic";

export default function DeptoDemo({ searchParams }: { searchParams: { etapa?: string; aviso?: string; confirmada?: string; preguntas?: string; oferta?: string; lectura?: string; fotos?: string; pocos?: string; cierre?: string; otra?: string; visita?: string; mantener?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const e = searchParams.etapa ?? "confirmando";
  const etapa: Etapa = e === "revision" || e === "corregir" ? "sin_preaprobacion" : e === "dejo" ? "no_avanza" : (["confirmando", "sin_preaprobacion", "listo", "no_avanza"].includes(e) ? e : "confirmando") as Etapa;
  const pre: EstadoVisible = e === "revision" ? "en_revision" : e === "corregir" ? "por_corregir" : e === "listo" ? "aprobada" : "subir";
  const confirmada = searchParams.confirmada === "1";
  const avisoId = searchParams.aviso && /^[0-9a-f-]{36}$/i.test(searchParams.aviso) ? searchParams.aviso : "muestra";
  const metro = { estacion: "Parque Bustamante", metros: 420 };
  const analisisMuestra = { arriendoCLP: MOTOR_MUESTRA.arriendoCLP, flujoCLP: null, motor: MOTOR_MUESTRA, comparables: searchParams.pocos === "1" ? 4 : 6 };
  const cifras = cifrasDeDepto({ publicadoUF: 3090, arriendoNoche: null, flujoNoche: null, analisis: analisisMuestra, uf: MOTOR_MUESTRA.uf, comparables: null });
  const ESTADOS = ["firmada", "ronda_nueva", "ajustada", "en_cola", "comunicar", "presentada", "presentada_hoy", "contraoferta", "aceptada_sujeta"];
  const pedido = ESTADOS.includes(searchParams.oferta ?? "") ? (searchParams.oferta as string) : "borrador";
  const estadoOferta = pedido === "comunicar" || pedido === "ronda_nueva" || pedido === "ajustada" ? "firmada" : pedido === "presentada_hoy" ? "presentada" : pedido;
  const ahora = Date.now(), DIA = 864e5;
  // Presentada hace un día (o hoy, al quinto día de su plazo, para ver «Vence hoy»); la contraoferta vence en tres días.
  const presentadaAt = new Date(ahora - (pedido === "presentada_hoy" ? 5 : 1) * DIA).toISOString();
  const b4 = {
    presentadaAt: ["presentada", "contraoferta", "aceptada_sujeta"].includes(estadoOferta) ? presentadaAt : null,
    vigenteHasta: estadoOferta === "presentada" ? venceAlTerminar(new Date(presentadaAt)).toISOString() : null,
    tipoRonda: pedido === "comunicar" ? "aceptar" : pedido === "ronda_nueva" ? "proponer" : pedido === "ajustada" ? "ajustar" : null,
    contraofertaUF: estadoOferta === "contraoferta" ? 3010 : null, contraofertaVence: estadoOferta === "contraoferta" ? venceAlTerminar(new Date(ahora - 2 * DIA)).toISOString() : null,
    sugeridaUF: estadoOferta === "contraoferta" ? 2966 : null, respuesta: estadoOferta === "contraoferta" ? "contraoferta" : estadoOferta === "aceptada_sujeta" ? "aceptada_sujeta" : null,
  };
  const CIERRES = ["rechazada", "vencida", "contra_vencida", "tardia", "tardia_contra", "retirada", "no_gracias"];
  const cierrePedido = CIERRES.includes(searchParams.cierre ?? "") ? (searchParams.cierre as string) : null;
  const p: PaginaDepto = {
    avisoId, etapa, noAvanzaMotivo: e === "dejo" ? "dejo_de_convenir" : e === "no_avanza" ? "sin_acuerdo" : null,
    datos: { comuna: "Providencia", dormitorios: 2, banos: 2, m2: 58, precioUF: 3090, veredicto: "COMPRAR", score: 81, flujoCLP: -45000 },
    ficha: { titulo: tituloDepto({ calle: "Avenida Libertador Bernardo O'Higgins", metro, comuna: "Providencia" }), metro, comuna: "Providencia", fotos: avisoId === "muestra" ? 0 : Math.min(24, Number(searchParams.fotos) || 3), capRatePct: cifras.capRatePct, punto: { lat: -33.4372, lng: -70.6311 }, cifras,
      // «Lo que ve Franco» (segunda vuelta, 23-nov): una lectura de muestra; ?lectura=0 la saca (la tarjeta no se dibuja).
      lectura: searchParams.lectura === "0" ? null : { alerta: { nivel: "ninguna", motivo: null }, calle: "Avenida Libertador Bernardo O'Higgins",
        corta: ["Cap rate de 5,1 %, amoblado y en buen estado: listo para arrendar.", "A 4 cuadras del metro Parque Bustamante.", "Ya bajó UF 80: quien vende está dispuesto a moverse."],
        larga: [{ etiqueta: "Estado", texto: "Amoblado y en buen estado según las fotos." }, { etiqueta: "Para arrendar", texto: "Listo para arrendar tal como está." }, { etiqueta: "Ubicación", texto: "A 4 cuadras del metro Parque Bustamante." }, { etiqueta: "Ojo", texto: "La publicación no dice los gastos comunes." }] } as never },
    tituloConNumero: tituloDepto({ calle: "Avenida Libertador Bernardo O'Higgins", numero: confirmada ? "1302" : null, metro, comuna: "Providencia" }),
    direccion: direccionDepto({ calle: "Avenida Libertador Bernardo O'Higgins", numero: confirmada ? "1302" : null, comuna: "Providencia" }),
    ubicacion: confirmada ? { avisoId, direccion: "Avenida Libertador Bernardo O'Higgins", numero: "1302", lat: -33.44, lng: -70.63, distanciaM: 180, analisis: null, precioComprarUF: null, cargadaAt: "2026-11-21T12:00:00Z" } : null,
    cambios: [lineaCambio({ tipo: "precio_baja", antes: { precioUF: 3170 }, despues: { precioUF: 3090 } }, "2026-11-12")!, ...(confirmada ? [lineaCambio({ tipo: "ubicacion", antes: {}, despues: { flujoCLP: -45000 } }, "2026-11-21")!] : [])],
    cambiosFilas: [filaCambio({ tipo: "precio_baja", antes: { precioUF: 3170 }, despues: { precioUF: 3090 } }, "2026-11-12")!],
    preaprobacion: pre, whatsapp: "+56912345678",
    alternativa: e === "no_avanza" || e === "dejo" ? { avisoId: "alt", datos: { comuna: "Providencia", dormitorios: 2, banos: 2, m2: 60, precioUF: 3180, veredicto: "COMPRAR", score: 77 }, ficha: { titulo: "Av. Irarrázaval · Metro Chile España", metro: null, comuna: "Ñuñoa", fotos: 0, capRatePct: 5.0, lectura: null, cifras }, alcanza: true } : null,
    activos: [],
    // «Lo que Franco averiguó» (B2): en confirmando, las tres preguntadas; desde listo, dos respondidas (lámina 4.2). ?preguntas=0 las saca.
    preguntas: searchParams.preguntas === "0" ? [] : [
      { id: "q1", pregunta: "¿Incluye estacionamiento?", enviadaAt: "2026-11-18T15:00:00Z", respuesta: etapa === "confirmando" ? null : "Sí, uno, inscrito con el depto", fuente: etapa === "confirmando" ? null : "quien_vende", respondidaAt: etapa === "confirmando" ? null : "2026-11-19T15:00:00Z" },
      { id: "q2", pregunta: "¿Cuánto son los gastos comunes?", enviadaAt: "2026-11-18T15:00:00Z", respuesta: etapa === "confirmando" ? null : "$95.000 al mes", fuente: etapa === "confirmando" ? null : "quien_vende", respondidaAt: etapa === "confirmando" ? null : "2026-11-19T15:00:00Z" },
      { id: "q3", pregunta: "¿De qué año es el edificio?", enviadaAt: "2026-11-18T15:00:00Z", respuesta: null, fuente: null, respondidaAt: null },
      { id: "q4", pregunta: "¿Cuánto son las contribuciones?", enviadaAt: "2026-11-18T15:00:00Z", respuesta: null, fuente: null, respondidaAt: null },
    ],
    documentos: [],
    // B3: en listo, la oferta borrador con el rango de la regla v1 (?oferta=firmada la muestra firmada).
    oferta: etapa === "listo" ? {
      id: "of", estado: estadoOferta, ...b4, postura: "negocia_poco", descuentoPct: 5, pisoUF: 2905, recomendadoUF: 2936, altoUF: 2967, techoUF: 3090, comprarUF: null, publicadoUF: 3090,
      razones: ["Ya bajó UF 80 hace tres semanas: quien vende está dispuesto a moverse.", "La cocina tiene muebles dañados y piso manchado: es un argumento concreto para pedir rebaja."],
      corregida: null, montoUF: estadoOferta !== "borrador" ? 2930 : null, firmadaAt: estadoOferta !== "borrador" ? "2026-11-22T15:00:00Z" : null,
      texto: estadoOferta !== "borrador" ? "BORRADOR · TEXTO DE PRUEBA · EN REVISIÓN LEGAL\n\nOFERTA DE COMPRA\n\nTexto de muestra." : null, textoVersion: null,
    } : null,
    bloqueOferta: null,
  };
  // B4: cuando no hubo acuerdo, sin oferta abierta y con la ronda cerrada (lámina 4.2-cuando-no-hay-acuerdo).
  if (cierrePedido && etapa === "listo" && p.oferta) {
    const base = { ...p.oferta, montoUF: 2936, firmadaAt: new Date(ahora - 7 * DIA).toISOString(), presentadaAt: new Date(ahora - 6 * DIA).toISOString(), vigenteHasta: venceAlTerminar(new Date(ahora - 6 * DIA)).toISOString(), texto: "BORRADOR · TEXTO DE PRUEBA · EN REVISIÓN LEGAL\n\nOFERTA DE COMPRA\n\nTexto de muestra." };
    p.cierre = cierrePedido === "rechazada" ? { ...base, estado: "sin_acuerdo", sinAcuerdoMotivo: "rechazada", respuesta: "rechazada", respuestaAt: new Date(ahora - 3 * DIA).toISOString() }
      : cierrePedido === "vencida" ? { ...base, estado: "sin_acuerdo", sinAcuerdoMotivo: "vencida" }
      : cierrePedido === "contra_vencida" ? { ...base, estado: "sin_acuerdo", sinAcuerdoMotivo: "vencida", respuesta: "contraoferta", contraofertaUF: 3010 }
      : cierrePedido === "tardia" ? { ...base, estado: "sin_acuerdo", sinAcuerdoMotivo: "vencida", respuestaTardia: "aceptada_sujeta", respuestaTardiaUF: 2936 }
      : cierrePedido === "tardia_contra" ? { ...base, estado: "sin_acuerdo", sinAcuerdoMotivo: "vencida", respuestaTardia: "contraoferta", respuestaTardiaUF: 3010, contraofertaUF: 3010, sugeridaUF: 2966, contraofertaVence: venceAlTerminar(new Date(ahora - DIA)).toISOString() }
      : cierrePedido === "retirada" ? { ...base, estado: "retirada", retiradaAt: new Date(ahora - 2 * DIA).toISOString(), retiradaDesde: "presentada" }
      : { ...base, estado: "sin_acuerdo", sinAcuerdoMotivo: "vencida", respuestaTardia: "aceptada_sujeta", respuestaTardiaUF: 2936, tardiaDecision: "no_gracias" };
    p.oferta = null;
    p.otraViva = searchParams.otra === "1" ? { avisoId: "otro", titulo: "Av. Irarrázaval 2315", estado: "presentada" } : null;
  }
  // La visita (24-nov-2026): ?visita=pedida | hecha (coincide) | arreglo (con un arreglo que no se veía), y ?mantener=acepta | no.
  if (p.oferta && (searchParams.visita || pedido === "ajustada")) {
    const caso = searchParams.visita === "arreglo" || pedido === "ajustada" ? "arreglo" : "coincide";
    p.visita = visitaMuestra(caso, searchParams.visita === "pedida" ? "pedida" : "reporte_publicado");
    p.oferta.visita = p.visita;
    if (searchParams.mantener === "acepta" || searchParams.mantener === "no") p.oferta.mantenerRespuesta = searchParams.mantener === "acepta" ? "acepta" : "no_acepta";
    if (pedido === "ajustada") { p.oferta.montoUF = 2900; p.oferta.anteriorMontoUF = 2966; }
    if (pedido === "aceptada_sujeta") p.oferta.montoUF = 2966;
  }
  // El bloque de la oferta de la ficha, con el motor (firmada o presentada: «Con tu oferta»; aceptada: «Con el precio acordado»).
  p.bloqueOferta = bloqueOfertaCifras(MOTOR_MUESTRA, p.oferta, 3090);
  return (
    <MarcoInvierte volver={null} pantalla="depto" layout="contenido" cabecera={DEPTO_COPY.cabecera} pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }} miInversion>
      <VistaDepto p={p} />
    </MarcoInvierte>
  );
}
