"use client";

import { fechaCortaCL } from "@/lib/fecha-cl";
import type { AIAnalysisSTRv2, Hallazgo, HallazgoDistanciaVeredicto, HallazgoVentajaVsLtr, Veredicto } from "@/lib/types";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import type { SimulacionStr } from "@/lib/analysis/simular-str";
import { lineaFooterVias } from "@/lib/palancas-en-palabras";
import { salidaPorMixStr, mixAlEscalonStr } from "@/lib/salida-por-mix";
import { ProgresoGeneracion, ETAPAS_GENERACION_STR, COPY_TIEMPO_STR } from "@/components/analysis/ProsaSkeleton";
import { renderPlumon } from "@/components/analysis/hallazgos/plumon";
import { PopupAjustes, hayAjustesQueMostrar } from "@/components/analysis/shared/PopupAjustes";
import { metricaValorONull } from "@/lib/types";
import { PopupAjustesTokens } from "@/components/analysis/shared/PopupAjustesTokens";
import { PosicionFranco, type FooterPosicion } from "@/components/analysis/shared";
import { esProsaStrPodada } from "@/components/analysis/AIInsightSection";
import { lineaQueDeclara } from "@/lib/veredicto-etiqueta";
import type { ReactNode } from "react";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { SeccionInforme } from "@/components/analysis/SeccionInforme";
import { MarcaSeccion } from "@/components/analysis/informeTelemetry";
import { construirLoQueHariaYo, estadoRecomendacion } from "@/lib/lo-que-haria-yo";
import { LoQueHariaYoBloque } from "@/components/analysis/shared/LoQueHariaYoBloque";
import { DIST_PREC_PTS } from "@/lib/distancia-veredicto-hallazgo";

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
  ai,
  results,
  veredicto,
  simulacion,
  currency,
  valorUF,
  createdAt,
  fechaProsa,
  aiLoading,
  prosaError,
  onRetryProsa,
}: {
  /** Contrato §2 (bloque B): la sección de hallazgos YA ARMADA por la página, que este
   *  componente monta entre el hero y la recomendación. Solo con el rediseño. */
  hallazgos?: ReactNode;
  /** Para las marcas de telemetría de las secciones que emite. */
  accessLevel: string;
  ai: AIAnalysisSTRv2 | null;
  results: ShortTermResult;
  veredicto: STRVerdict;
  simulacion: SimulacionStr | null;
  currency: "CLP" | "UF";
  valorUF: number;
  createdAt?: string;
  fechaProsa?: string;
  aiLoading?: boolean;
  prosaError?: string | null;
  onRetryProsa?: () => void;
}) {
  // ── EL DISCRIMINADOR ──────────────────────────────────────────────────────
  // Prosa podada (v17) o los siete bloques viejos. El camino viejo es permanente para
  // las 94 filas anónimas del parque STR, que no pueden regenerar.
  const podada = esProsaStrPodada(ai);
  const conviene = ai?.conviene;
  const respuesta = conviene?.respuestaDirecta?.trim() || null;
  const reencuadre = conviene?.reencuadre?.trim() || null;
  // LA CÁPSULA MURIÓ EN v17. Con el título del bloque siendo la línea que declara
  // («Compra.» / «Ajusta los números.» / «Busca otro.»), esta línea en primera persona
  // decía la conclusión por TERCERA vez: la banda de la portada, el título y ella. La
  // prosa vieja la conserva porque su cuerpo fue escrito con ella en el medio.
  const capsula = podada ? null : conviene?.veredictoFrase?.trim() || null;
  const cajaAccionable = conviene?.cajaAccionable?.trim() || null;
  // LA ACCIÓN, dentro de «Lo que haría yo» (v17): el único bloque de prosa que no tenía
  // equivalente determinista. Antes no se renderizaba en ninguna parte de la página.
  const estrategia = podada ? ai?.vsLTR?.estrategiaSugerida?.trim() || null : null;
  // EL TÍTULO ES LA RESPUESTA, NO LA PREGUNTA (v17) — mismo criterio y misma fuente que
  // LTR: `lineaQueDeclara` sobre los tres veredictos, que STR persiste iguales. No hay
  // una formulación propia de STR: la decisión que el lector toma es la misma, y tener
  // dos redacciones por modalidad sería lo que la fuente única vino a evitar.
  const pregunta = (podada ? lineaQueDeclara(veredicto) : conviene?.pregunta?.trim()) || "¿Conviene o no conviene?";
  const fechaFirma = fechaCortaCL(fechaProsa ?? createdAt);

  // `hallazgos` (prop) es la SECCIÓN que la página arma; los del motor van con apellido.
  const hallazgosMotor = (results.hallazgos ?? []) as Hallazgo[];
  const distancia = hallazgosMotor.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");
  const fr = simulacion?.fronterasIngreso ?? null;
  const adr = results.metrics?.tarifaNoche ?? results.ejesAplicados?.adrFinal ?? results.escenarios.base.adrReferencia;

  // FOOTER DE LA POSICIÓN — por veredicto (contrato CONGELADO): AJUSTA y BUSCAR OTRA
  // abren "Lo que te separa" (la matriz de vías, en modal); COMPRAR abre "Cuánto
  // aguanta este veredicto" (hasta dónde cae la tarifa). Sin distancia ni frontera, no
  // hay footer: la caja queda informativa.

  // ── EL BLOQUE DETERMINISTA DE §5 (bloque C · 11-sep-2026) ──────────────────
  // El MISMO constructor de LTR con `modalidad: "str"`: dice «tarifa» donde LTR dice
  // «arriendo», lee `palancasHastaComprar` y `mixPalancasHastaComprar` del motor en BUSCAR,
  // y en COMPRAR recibe las dos filas ya resueltas acá, que es donde vive el dato:
  //   · AGUANTA sale de la frontera de tarifa del motor (`fronterasIngreso.abajo`): hasta
  //     dónde cae la tarifa antes de que el veredicto cambie. Sin frontera dentro del rango
  //     explorado (−70%), o con la frontera a la mitad o más, aguanta «−50% o más».
  //   · VERIFICA solo si la tarifa la definiste tú (`adrFuente === "override"`): con la
  //     mediana de la zona no hay nada que verificar y la fila no va.
  const bloqueDeterminista = construirLoQueHariaYo({
        modalidad: "str",
        veredicto: veredicto as Veredicto,
        distancia: distancia ?? null,
        currency,
        valorUF,
        aguanta: fr
          ? fr.abajo
            ? fr.abajo.factor <= 0.5
              ? { marginPct: 50, firme: true }
              : { marginPct: Math.round((1 - fr.abajo.factor) * 1000) / 10, firme: false }
            : { marginPct: 70, firme: true }
          : null,
        verifica: results.adrFuente === "override" ? { cifraCLP: adr } : null,
        // El piso en pesos cuelga de la tarifa que USA el análisis, tuya o de la zona.
        montoMercadoCLP: adr,
        // El otro margen de COMPRAR: `fronteraPrecio.caeA` ya existía —el precio al que
        // el veredicto cae subiendo el precio—; el máximo es un paso de precisión por
        // debajo, para que lo que se imprime todavía sea Comprar.
        precioMax: (() => {
          const fp = simulacion?.fronteraPrecio ?? null;
          if (!fp?.caeA || !(fp.precioUFActual > 0)) return null;
          const uf = Math.floor(fp.precioUFActual * (fp.caeA.factor - DIST_PREC_PTS / 100));
          return uf > fp.precioUFActual ? { uf, pct: Math.round((uf / fp.precioUFActual - 1) * 1000) / 10 } : null;
        })(),
      });

  // ¿HAY ALGO QUE MOSTRAR? (13-sep-2026) Sin grilla NI palancas que crucen, la card ya lo
  // dice todo y el pop-up repetiría. Ahí no se dibuja el botón: 73 filas STR.
  const hayQueMostrar = hayAjustesQueMostrar({
    veredicto: veredicto as Veredicto,
    distancia: distancia ?? null,
    filasComprar: bloqueDeterminista?.filas ?? null,
  });
  const cuerpoAjustes = (
    <>
      <PopupAjustesTokens />
      <PopupAjustes
        modalidad="str"
        veredicto={veredicto as Veredicto}
        distancia={distancia ?? null}
        filasComprar={bloqueDeterminista?.filas ?? null}
        currency={currency}
        valorUF={valorUF}
        precioUF={Number(simulacion?.fronteraPrecio?.precioUFActual ?? 0)}
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
          k: "Recomendación de ajustes",
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
          btn: "Ver ajustes",
          cuerpo: cuerpoAjustes,
        }
      : veredicto === "COMPRAR"
        ? {
            // COMPRAR: no hay a dónde subir. Van los márgenes de la card —Margen, Precio,
            // Verifica— con su oración completa; el dial se queda en su capítulo.
            key: "sensibilidad",
            k: "Recomendación de ajustes",
            l: "Franco probó hasta dónde puede moverse cada supuesto sin que cambie la conclusión.",
            btn: "Ver margen",
            cuerpo: cuerpoAjustes,
          }
        : null;
  // §5: LA BAJADA SE DIBUJA POR ESTADO, y el estado sale del bloque construido: «comprar»,
  // «con_salida», «sin_salida», o «sin_bloque» solo si el motor no midió (filas viejas).
  const estadoRec = estadoRecomendacion(veredicto, bloqueDeterminista);
  const sinSalidaRecomendacion = estadoRec === "sin_salida";
  // LA SALIDA DE STR EN SIN SALIDA (§5 y §11): «Analízalo como renta larga» —mismo depto,
  // mismo precio, otra operación— SOLO cuando el motor lo dice: el hallazgo
  // `ventaja_vs_ltr` adverso con el porcentaje confiable. Si no, la card cae al puente.
  // Las comunas alternativas de STR quedan para cuando el motor STR las calcule (§12).
  const ventaja = hallazgosMotor.find((h): h is HallazgoVentajaVsLtr => h.id === "ventaja_vs_ltr");
  const alternativa =
    sinSalidaRecomendacion && ventaja && ventaja.direccion === "adverso" && ventaja.valor.pctConfiable
      ? "Analízalo como renta larga"
      : null;
  const recomendacion = (
    <PosicionFranco
      cajaAccionable={cajaAccionable ? renderPlumon(cajaAccionable) : null}
      prosa={estrategia ? renderPlumon(estrategia) : undefined}
      bloque={
        bloqueDeterminista ? (
          <LoQueHariaYoBloque bloque={bloqueDeterminista} veredicto={veredicto} alternativa={alternativa} />
        ) : undefined
      }
      titulo="La recomendación de Franco"
      estado={estadoRec}
      fechaFirma={fechaFirma}
      footer={
        /* EL CTA DEL ESTADO SIN SALIDA nombra lo que hay del otro lado: no quedan ajustes
           que hacer, queda ver QUÉ SE PROBÓ. El pop-up es el mismo; cambia el rótulo. */
        footer && sinSalidaRecomendacion ? { ...footer, btn: "Ver qué se probó" } : footer
      }
      tipo="str"
      veredicto={veredicto}
    />
  );

  /* ¿EL HERO TIENE CUERPO PROPIO? Con prosa podada el h2 no va (§10 se lo da a la sección
     de hallazgos) y la apertura TAMPOCO (12-sep-2026: `respuestaDirecta` y `reencuadre`
     no se montan, igual que LTR, aunque el prompt v19 los siga generando y la base los
     conserve), así que lo que queda es el error o el skeleton. Sin ninguno de los dos, la
     sección no se monta: §2 pide «nada más». El camino viejo conserva su apertura: su h2
     es la pregunta de esa prosa y la respuesta la contesta. */
  const heroTieneCuerpo = !podada || Boolean(prosaError) || Boolean(aiLoading);

  const cuerpoHero = (
      <div className="py-[9px]">
        <div>
          {/* CON PROSA PODADA ESTE TÍTULO NO VA: es la línea que declara, y §10 se la da
              como título a la sección de hallazgos, que vive suelta después del hero.
              Repetirla acá dejaría el mismo texto dos veces seguidas. La prosa vieja lo
              conserva: su título es la pregunta de su propia prosa. */}
          {!podada && (
            <h2 className="font-heading font-bold text-[21px] md:text-[23px] leading-[1.22] tracking-[-0.01em] text-[var(--franco-text)] mb-3.5 m-0 flex items-baseline gap-2.5">
              <span className="doc-fmark-inline shrink-0 select-none" aria-hidden="true">
                f.
              </span>
              <span className="min-w-0">{pregunta}</span>
            </h2>
          )}
          {/* LA APERTURA SOLO CON PROSA VIEJA (12-sep-2026). Con prosa podada la línea que
              declara ya titula los hallazgos y la recomendación lleva «Lo que haría yo»:
              la respuesta y el reencuadre repetían en prosa lo que el motor ya muestra. */}
          {!podada && respuesta ? (
            <div className="font-body text-left text-[14px] md:text-[15px] leading-[1.62] text-[var(--franco-text-secondary)] max-w-[75ch] md:ml-9">
              {renderPlumon(respuesta)}
              {capsula && (
                <p className="font-body italic text-[13.5px] leading-[1.5] mt-3 mb-0 pl-3" style={{ borderLeft: "2px solid var(--signal-red)", color: "var(--signal-red)" }}>
                  <span className="font-mono not-italic font-semibold mr-1">f.</span>— {capsula}
                </p>
              )}
              {reencuadre && <div className="mt-3">{renderPlumon(reencuadre)}</div>}
            </div>
          ) : prosaError ? (
            <div className="md:ml-9">
              <p className="font-body text-[13.5px] leading-[1.55] text-[var(--franco-text-secondary)] m-0 mb-2">No pudimos completar la redacción del análisis.</p>
              {onRetryProsa && (
                <button type="button" onClick={onRetryProsa} className="font-body text-sm font-medium text-signal-red hover:underline">
                  Reintentar
                </button>
              )}
            </div>
          ) : aiLoading ? (
            <div className="md:ml-9">
              <ProgresoGeneracion etapas={ETAPAS_GENERACION_STR} copyTiempo={COPY_TIEMPO_STR} />
            </div>
          ) : null}
        </div>
      </div>
  );

  /* EL ORDEN DEL CONTRATO §2: hero → hallazgos → recomendación. Hasta hoy la
     recomendación vivía DENTRO del hero, así que el lector leía la conclusión antes que
     lo que la sostiene. Mismo reparto que en `HeroLTR`: las tres secciones las emite el
     hero, porque la recomendación se arma con lo que se calcula acá (footer, prosa,
     estado); la página decide QUÉ va en el medio y lo pasa por `hallazgos`. */
  return (
    <>
      {heroTieneCuerpo && (
        <SeccionInforme id="hero" tono="paper2">
          <MarcaSeccion seccion="hero" tipo="str" accessLevel={accessLevel} />
          <div className="mb-3">{cuerpoHero}</div>
        </SeccionInforme>
      )}
      {hallazgos}
      {/* LA SEGUNDA CAJA de §2. La primera es «portada»; ésta nace con este orden. */}
      <SeccionInforme id="recomendacion" tono="paper2" caja>
        <MarcaSeccion seccion="recomendacion" tipo="str" accessLevel={accessLevel} />
        {recomendacion}
      </SeccionInforme>
    </>
  );
}
