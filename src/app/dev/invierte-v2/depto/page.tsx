// /dev/invierte-v2/depto (etapa 3, B1, 21-nov-2026): la página de un depto con datos de muestra, para revisar en pantalla cada etapa
// sin cuentas ni escrituras. ?etapa=confirmando (por defecto) | sin_preaprobacion | revision | corregir | listo | no_avanza | dejo
//   · ?aviso=<uuid>: toma las fotos de ese aviso real (la ruta de fotos pide una orden firmada: con la cuenta de QA).
//   · ?confirmada=1: con la ubicación confirmada (sin la línea de «aproximada», con el número en el título).
// Gate en el servidor: dev y previews de Vercel sí; producción, 404.
import { notFound } from "next/navigation";
import { MarcoInvierte } from "@/components/invierte-v2/MarcoInvierte";
import { VistaDepto } from "@/components/invierte-v2/VistaDepto";
import { DEPTO_COPY, type Etapa } from "@/lib/invierte-v2/depto-flujo";
import type { PaginaDepto } from "@/lib/invierte-v2/depto-pagina-servidor";
import type { EstadoVisible } from "@/lib/invierte-v2/preaprobacion";
import { lineaCambio } from "@/lib/invierte-v2/cambios";
import { direccionDepto, tituloDepto } from "@/lib/invierte-v2/titulo-depto";

export const dynamic = "force-dynamic";

export default function DeptoDemo({ searchParams }: { searchParams: { etapa?: string; aviso?: string; confirmada?: string; preguntas?: string; oferta?: string } }) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") notFound();
  const e = searchParams.etapa ?? "confirmando";
  const etapa: Etapa = e === "revision" || e === "corregir" ? "sin_preaprobacion" : e === "dejo" ? "no_avanza" : (["confirmando", "sin_preaprobacion", "listo", "no_avanza"].includes(e) ? e : "confirmando") as Etapa;
  const pre: EstadoVisible = e === "revision" ? "en_revision" : e === "corregir" ? "por_corregir" : e === "listo" ? "aprobada" : "subir";
  const confirmada = searchParams.confirmada === "1";
  const avisoId = searchParams.aviso && /^[0-9a-f-]{36}$/i.test(searchParams.aviso) ? searchParams.aviso : "muestra";
  const metro = { estacion: "Parque Bustamante", metros: 420 };
  const p: PaginaDepto = {
    avisoId, etapa, noAvanzaMotivo: e === "dejo" ? "dejo_de_convenir" : e === "no_avanza" ? "sin_acuerdo" : null,
    datos: { comuna: "Providencia", dormitorios: 2, banos: 2, m2: 58, precioUF: 3090, veredicto: "COMPRAR", score: 81, flujoCLP: -45000 },
    ficha: { titulo: tituloDepto({ calle: "Avenida Libertador Bernardo O'Higgins", metro, comuna: "Providencia" }), metro, comuna: "Providencia", fotos: avisoId === "muestra" ? 0 : 3, capRatePct: 5.1, lectura: null },
    tituloConNumero: tituloDepto({ calle: "Avenida Libertador Bernardo O'Higgins", numero: confirmada ? "1302" : null, metro, comuna: "Providencia" }),
    direccion: direccionDepto({ calle: "Avenida Libertador Bernardo O'Higgins", numero: confirmada ? "1302" : null, comuna: "Providencia" }),
    ubicacion: confirmada ? { avisoId, direccion: "Avenida Libertador Bernardo O'Higgins", numero: "1302", lat: -33.44, lng: -70.63, distanciaM: 180, analisis: null, precioComprarUF: null, cargadaAt: "2026-11-21T12:00:00Z" } : null,
    cambios: [lineaCambio({ tipo: "precio_baja", antes: { precioUF: 3170 }, despues: { precioUF: 3090 } }, "2026-11-12")!, ...(confirmada ? [lineaCambio({ tipo: "ubicacion", antes: {}, despues: { flujoCLP: -45000 } }, "2026-11-21")!] : [])],
    preaprobacion: pre, whatsapp: "+56912345678",
    alternativa: e === "no_avanza" || e === "dejo" ? { avisoId: "alt", datos: { comuna: "Providencia", dormitorios: 2, banos: 2, m2: 60, precioUF: 3180, veredicto: "COMPRAR", score: 77 }, ficha: { titulo: "Av. Irarrázaval · Metro Chile España", metro: null, comuna: "Ñuñoa", fotos: 0, capRatePct: 5.0, lectura: null }, alcanza: true } : null,
    activos: [],
    // «Lo que Franco averiguó» (B2): en confirmando, las tres preguntadas; desde listo, dos respondidas (lámina 4.2). ?preguntas=0 las saca.
    preguntas: searchParams.preguntas === "0" ? [] : [
      { id: "q1", pregunta: "¿Incluye estacionamiento?", enviadaAt: "2026-11-18T15:00:00Z", respuesta: etapa === "confirmando" ? null : "Sí, uno, inscrito con el depto", fuente: etapa === "confirmando" ? null : "quien_vende", respondidaAt: etapa === "confirmando" ? null : "2026-11-19T15:00:00Z" },
      { id: "q2", pregunta: "¿Cuánto son los gastos comunes?", enviadaAt: "2026-11-18T15:00:00Z", respuesta: etapa === "confirmando" ? null : "$95.000 al mes", fuente: etapa === "confirmando" ? null : "quien_vende", respondidaAt: etapa === "confirmando" ? null : "2026-11-19T15:00:00Z" },
      { id: "q3", pregunta: "¿De qué año es el edificio?", enviadaAt: "2026-11-18T15:00:00Z", respuesta: null, fuente: null, respondidaAt: null },
    ],
    documentos: [],
    // B3: en listo, la oferta borrador con el rango de la regla v1 (?oferta=firmada la muestra firmada).
    oferta: etapa === "listo" ? {
      id: "of", estado: searchParams.oferta === "firmada" ? "firmada" : "borrador", postura: "negocia_poco", descuentoPct: 5, pisoUF: 2905, recomendadoUF: 2936, altoUF: 2967, techoUF: 3090, comprarUF: null, publicadoUF: 3090,
      razones: ["Ya bajó UF 80 hace tres semanas: quien vende está dispuesto a moverse.", "La cocina tiene muebles dañados y piso manchado: es un argumento concreto para pedir rebaja."],
      corregida: null, montoUF: searchParams.oferta === "firmada" ? 2930 : null, firmadaAt: searchParams.oferta === "firmada" ? "2026-11-22T15:00:00Z" : null,
      texto: searchParams.oferta === "firmada" ? "BORRADOR · TEXTO DE PRUEBA · EN REVISIÓN LEGAL\n\nOFERTA DE COMPRA\n\nTexto de muestra." : null, textoVersion: null,
    } : null,
  };
  return (
    <MarcoInvierte volver={null} pantalla="depto" layout="contenido" cabecera={DEPTO_COPY.cabecera} pc={{ sesionEmail: "muestra@ejemplo.cl", invierte: "inversion" }} miInversion>
      <VistaDepto p={p} />
    </MarcoInvierte>
  );
}
