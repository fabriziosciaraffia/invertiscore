"use client";

import { fechaCortaCL } from "@/lib/fecha-cl";
import { construirCardStr } from "@/lib/card-recomendacion";
import type { Hallazgo, HallazgoDistanciaVeredicto, Veredicto } from "@/lib/types";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import type { SimulacionStr } from "@/lib/analysis/simular-str";
import { lineaFooterVias } from "@/lib/palancas-en-palabras";
import { salidaPorMixStr, mixAlEscalonStr } from "@/lib/salida-por-mix";
import { PopupAjustes, hayAjustesQueMostrar } from "@/components/analysis/shared/PopupAjustes";
import { PopupAjustesTokens } from "@/components/analysis/shared/PopupAjustesTokens";
import { PosicionFranco, type FooterPosicion } from "@/components/analysis/shared";
import type { ReactNode } from "react";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { SeccionInforme } from "@/components/analysis/SeccionInforme";
import { MarcaSeccion } from "@/components/analysis/informeTelemetry";
import { estadoRecomendacion } from "@/lib/lo-que-haria-yo";
import { LoQueHariaYoBloque, CardBuscarOtra } from "@/components/analysis/shared/LoQueHariaYoBloque";
import { metricaValorONull } from "@/lib/types";

/**
 * Hero STR con el contrato LTR (T1 · 04-sep-2026): chip `f.` en el título, prosa a
 * 75ch colgando del texto del título, la cápsula y el reencuadre dentro de la prosa
 * —SOLO en el camino de la prosa vieja desde el 12-sep-2026; con prosa podada el hero no
 * monta apertura, igual que LTR—, "La posición de Franco" con firma (pieza compartida)
 * y el footer "Lo que te separa"
 * con el conteo REAL de vías (cinco en STR: precio · tarifa · plazo · pie · gestión) y
 * el botón VER AJUSTES que abre el modal de vías. Con COMPRAR el footer es "Cuánto
 * aguanta este veredicto": hasta dónde puede caer la tarifa (frontera del motor).
 * Reemplaza a HeroSTR en la página; HeroSTR sigue en el repo (T3).
 *
 * EMITE LAS TRES SECCIONES DE §2 (bloque B · 11-sep-2026), igual que `HeroLTR`: hero →
 * `{hallazgos}` → recomendación con caja. La página le pasa la sección de hallazgos ya
 * armada y deja de envolverlo en la suya.
 */
export function HeroStrDictamen({
  hallazgos,
  accessLevel,
  results,
  veredicto,
  simulacion,
  currency,
  valorUF,
  createdAt,
  fechaProsa,
}: {
  /** Contrato §2 (bloque B): la sección de hallazgos YA ARMADA por la página, que este
   *  componente monta entre el hero y la recomendación. Solo con el rediseño. */
  hallazgos?: ReactNode;
  /** Para las marcas de telemetría de las secciones que emite. */
  accessLevel: string;
  results: ShortTermResult;
  veredicto: STRVerdict;
  simulacion: SimulacionStr | null;
  currency: "CLP" | "UF";
  valorUF: number;
  createdAt?: string;
  fechaProsa?: string;
}) {
  // LA IA SALIÓ DEL INFORME (25-sep-2026, decisión de Fabrizio). Este componente ya no lee la
  // prosa: sin el h2 «¿Conviene o no conviene?», sin la apertura, la cápsula ni el reencuadre,
  // sin el skeleton de generación ni el error con Reintentar, y sin la caja ni la estrategia
  // que colgaban de la card. Todo lo que dibuja sale del motor y está al primer render. La
  // maquinaria de la IA sigue viva y se retira por partes.
  const fechaFirma = fechaCortaCL(fechaProsa ?? createdAt);

  // `hallazgos` (prop) es la SECCIÓN que la página arma; los del motor van con apellido.
  const hallazgosMotor = (results.hallazgos ?? []) as Hallazgo[];
  const distancia = hallazgosMotor.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");

  // FOOTER DE LA POSICIÓN — por veredicto (contrato CONGELADO): AJUSTA y BUSCAR OTRA
  // abren "Lo que te separa" (la matriz de vías, en modal); COMPRAR abre "Cuánto
  // aguanta este veredicto" (hasta dónde cae la tarifa). Sin distancia ni frontera, no
  // hay footer: la caja queda informativa.

  // ── EL BLOQUE DETERMINISTA DE §5 (bloque C · 11-sep-2026) ──────────────────
  // El MISMO constructor de LTR con `modalidad: "str"`: dice «tarifa» donde LTR dice
  // «arriendo», lee `palancasHastaComprar` y `mixPalancasHastaComprar` del motor en BUSCAR,
  // y en COMPRAR recibe las dos filas ya resueltas acá, que es donde vive el dato:
  //   · AGUANTA sale de la frontera de tarifa del motor (`fronterasIngreso.abajo`): hasta
  //     dónde cae la tarifa antes de que el veredicto cambie, con el número MEDIDO. Solo
  //     sin frontera dentro del rango explorado (−70%) aguanta «−70% o más».
  //   · VERIFICA solo si la tarifa la definiste tú (`adrFuente === "override"`): con la
  //     mediana de la zona no hay nada que verificar y la fila no va.
  // UNA SOLA CONSTRUCCIÓN (25-sep-2026): la misma card la lee la portada para escribir el
  // titular del motor. Ver `card-recomendacion.ts`.
  const card = construirCardStr({ veredicto: veredicto as Veredicto, results, simulacion, currency, valorUF });
  const bloqueDeterminista = card.bloque;

  // ¿HAY ALGO QUE MOSTRAR? (13-sep-2026) Sin grilla NI palancas que crucen, la card ya lo
  // dice todo y el pop-up repetiría. Ahí no se dibuja el botón: 73 filas STR.
  // BUSCAR OTRA NO TIENE POP-UP (24-sep-2026): `hayAjustesQueMostrar` lo dice por construcción.
  const hayQueMostrar = hayAjustesQueMostrar({
    veredicto: veredicto as Veredicto,
    distancia: distancia ?? null,
    mixComprar: simulacion?.mixComprar ?? null,
  });
  const cuerpoAjustes = (
    <>
      <PopupAjustesTokens />
      <PopupAjustes
        veredicto={veredicto as Veredicto}
        modalidad="STR"
        distancia={distancia ?? null}
        // La grilla de COMPRAR sale de la simulación, como las otras dos matrices de STR, y
        // no del hallazgo de distancia, que es null en COMPRAR. Ver `simular-str.ts`.
        mixComprar={simulacion?.mixComprar ?? null}
        currency={currency}
        valorUF={valorUF}
        precioUF={Number(simulacion?.fronteraPrecio?.precioUFActual ?? 0)}
        // LA COLUMNA «HOY» DE LA TABLA (25-sep-2026): el escenario base del análisis, el mismo
        // que leen las seis cifras de arriba.
        antes={(() => {
          const base = results.escenarios?.base;
          if (!base) return null;
          const coc = metricaValorONull(base.cashOnCash);
          return {
            cuotaMensual: results.metrics?.desgloseFall?.cuota ?? null,
            flujoMensual: base.flujoCajaMensual ?? null,
            cocPct: coc === null ? null : coc * 100,
            capRateNetoPct: Number.isFinite(base.capRate) ? base.capRate * 100 : null,
            tirPct: results.exitScenario ? metricaValorONull(results.exitScenario.tirAnual) : null,
            score: (results as { francoScore?: { score?: number } }).francoScore?.score ?? null,
          };
        })()}
      />
    </>
  );

  const footer: FooterPosicion | null =
    !hayQueMostrar
      ? null
      : distancia && veredicto !== "COMPRAR"
      ? {
          key: "distanciaVeredicto",
          k: "Ajustar supuestos",
          l: (() => {
            const vias = distancia.valor.vias;
            if (!vias || vias.length === 0) return lineaFooterVias(null, 5);
            // «; juntos, sí» cuando la combinación llega a Comprar; «; juntos, solo hasta Ajusta
            // supuestos» cuando llega al escalón (desde BUSCAR). Misma fuente que la card.
            const salidaComprar = salidaPorMixStr(distancia.valor);
            const salidaEscalon = salidaComprar ? null : mixAlEscalonStr(distancia.valor);
            return lineaFooterVias(
              vias.filter((v) => v.estado === "cruza").length,
              vias.length,
              salidaComprar !== null || salidaEscalon !== null,
              salidaEscalon ? etiquetaVeredicto("AJUSTA SUPUESTOS") : null,
            );
          })(),
          btn: "Ver todas las combinaciones",
          cuerpo: cuerpoAjustes,
        }
      : veredicto === "COMPRAR"
        ? {
            // COMPRAR: no hay a dónde subir. Van los márgenes de la card —Margen, Precio,
            // Verifica— con su oración completa; el dial se queda en su capítulo.
            key: "sensibilidad",
            // EN COMPRAR NO HAY AJUSTE QUE RECOMENDAR: el veredicto ya es el de arriba. Lo
            // que el pop-up muestra es hasta dónde aguanta, así que el rótulo lo dice.
            k: "Cómo queda con otro pie o plazo",
            l: "Franco probó cada combinación de pie y plazo al precio pedido.",
            btn: "Ver cómo queda con otro pie o plazo",
            cuerpo: cuerpoAjustes,
          }
        : null;
  // §5: LA BAJADA SE DIBUJA POR ESTADO, y el estado sale del bloque construido: «comprar»,
  // «con_salida», «sin_salida», o «sin_bloque» solo si el motor no midió (filas viejas).
  const estadoRec = estadoRecomendacion(veredicto, bloqueDeterminista);
  const sinSalidaRecomendacion = estadoRec === "sin_salida";
  // «Analízalo como renta larga» (la salida en sin salida) se retiró el 22-sep-2026 con la
  // ventaja vs LTR: el informe STR ya no compara contra el largo. Las comunas alternativas de
  // STR quedan para cuando el motor STR las calcule (§12).
  // ── BUSCAR OTRA: LA CAUSA Y LA DISTANCIA (24-sep-2026) ─────────────────────
  // Sin combinación que ofrecer, la card dice por qué no conviene y a qué distancia queda
  // Comprar. Sin botón y sin pop-up. El texto sale de `buscar-otra-copy.ts`.
  const esBuscar = veredicto === "BUSCAR OTRA";
  const cardBuscar = card.buscar ? <CardBuscarOtra causa={card.buscar.causa} distancia={card.buscar.distancia} /> : null;

  const recomendacion = (
    <PosicionFranco
      cajaAccionable={null}
      bloque={
        cardBuscar ?? (bloqueDeterminista ? <LoQueHariaYoBloque bloque={bloqueDeterminista} veredicto={veredicto} /> : undefined)
      }
      titulo="La recomendación de Franco"
      estado={esBuscar ? "sin_salida" : estadoRec}
      fechaFirma={fechaFirma}
      footer={
        /* EL CTA DEL ESTADO SIN SALIDA nombra lo que hay del otro lado: no quedan ajustes
           que hacer, queda ver QUÉ SE PROBÓ. El pop-up es el mismo; cambia el rótulo. */
        esBuscar ? null : footer && sinSalidaRecomendacion ? { ...footer, btn: "Ver qué se probó" } : footer
      }
      tipo="str"
      veredicto={veredicto}
    />
  );

  /* SIN SECCIÓN «HERO» PROPIA (25-sep-2026): la poblaban el h2, la apertura y el skeleton o el
     error de la prosa. La marca de telemetría «hero» queda, al inicio, como en LTR. */
  /* EL ORDEN DEL CONTRATO §2: hero → hallazgos → recomendación. Hasta hoy la
     recomendación vivía DENTRO del hero, así que el lector leía la conclusión antes que
     lo que la sostiene. Mismo reparto que en `HeroLTR`: las tres secciones las emite el
     hero, porque la recomendación se arma con lo que se calcula acá (footer, prosa,
     estado); la página decide QUÉ va en el medio y lo pasa por `hallazgos`. */
  return (
    <>
      <MarcaSeccion seccion="hero" tipo="str" accessLevel={accessLevel} />
      {hallazgos}
      {/* LA SEGUNDA CAJA de §2. La primera es «portada»; ésta nace con este orden. */}
      <SeccionInforme id="recomendacion" tono="paper2" caja>
        <MarcaSeccion seccion="recomendacion" tipo="str" accessLevel={accessLevel} />
        {recomendacion}
      </SeccionInforme>
    </>
  );
}
