"use client";

import { fechaCortaCL } from "@/lib/fecha-cl";
import type { AIAnalysisSTRv2, Hallazgo, HallazgoDistanciaVeredicto, HallazgoVentajaVsLtr, Veredicto } from "@/lib/types";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import type { SimulacionStr } from "@/lib/analysis/simular-str";
import { lineaFooterVias } from "@/lib/palancas-en-palabras";
import { ProgresoGeneracion, ETAPAS_GENERACION_STR, COPY_TIEMPO_STR } from "@/components/analysis/ProsaSkeleton";
import { renderPlumon } from "@/components/analysis/hallazgos/plumon";
import { VProsa, VViz, VCierre, Dial, type ZonaDial, type BordeDial } from "@/components/analysis/hallazgos/vocabulario";
import { DrawerDistanciaStr } from "@/components/analysis/drawers/DrawersPropios";
import { PosicionFranco, type FooterPosicion } from "@/components/analysis/shared";
import { esProsaStrPodada } from "@/components/analysis/AIInsightSection";
import { lineaQueDeclara } from "@/lib/veredicto-etiqueta";
import type { ReactNode } from "react";
import { etiquetaVeredicto } from "@/lib/veredicto-etiqueta";
import { useRediseno } from "@/components/analysis/RedisenoContexto";
import { SeccionInforme } from "@/components/analysis/SeccionInforme";
import { MarcaSeccion } from "@/components/analysis/informeTelemetry";
import { construirLoQueHariaYo, estadoRecomendacion } from "@/lib/lo-que-haria-yo";
import { LoQueHariaYoBloque } from "@/components/analysis/shared/LoQueHariaYoBloque";
import { DIST_PREC_PTS } from "@/lib/distancia-veredicto-hallazgo";

/**
 * Hero STR con el contrato LTR (T1 · 04-sep-2026): chip `f.` en el título, prosa a
 * 75ch colgando del texto del título, la cápsula y el reencuadre dentro de la prosa,
 * "La posición de Franco" con firma (pieza compartida) y el footer "Lo que te separa"
 * con el conteo REAL de vías (cinco en STR: precio · tarifa · plazo · pie · gestión) y
 * el botón VER AJUSTES que abre el modal de vías. Con COMPRAR el footer es "Cuánto
 * aguanta este veredicto": hasta dónde puede caer la tarifa (frontera del motor).
 * Reemplaza a HeroSTR en la página; HeroSTR sigue en el repo (T3).
 *
 * CON EL REDISEÑO (bloque B · 11-sep-2026) EMITE LAS TRES SECCIONES DE §2, igual que
 * `HeroLTR`: hero → `{hallazgos}` → recomendación con caja. La página le pasa la sección
 * de hallazgos ya armada y deja de envolverlo en la suya. Apagado, devuelve UNA sección
 * «hero» con todo adentro, como siempre.
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
  razones,
}: {
  /** Las cuatro líneas de hallazgo. En v17 se leen DENTRO de este bloque, debajo de la
   *  línea que declara; con prosa vieja el caller las monta en su sección aparte y acá
   *  no llega nada. (El bloque de regulación que las acompañaba se retiró el 11-sep-2026.) */
  razones?: ReactNode;
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
  const rediseno = useRediseno();
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
  const money = (n: number) => (currency === "UF" ? `UF ${(n / (valorUF || 1)).toFixed(1).replace(".", ",")}` : `$${Math.round(n).toLocaleString("es-CL")}`);

  // `hallazgos` (prop) es la SECCIÓN que la página arma; los del motor van con apellido.
  const hallazgosMotor = (results.hallazgos ?? []) as Hallazgo[];
  const distancia = hallazgosMotor.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");
  const fr = simulacion?.fronterasIngreso ?? null;
  const adr = results.metrics?.tarifaNoche ?? results.ejesAplicados?.adrFinal ?? results.escenarios.base.adrReferencia;

  // FOOTER DE LA POSICIÓN — por veredicto (contrato CONGELADO): AJUSTA y BUSCAR OTRA
  // abren "Lo que te separa" (la matriz de vías, en modal); COMPRAR abre "Cuánto
  // aguanta este veredicto" (hasta dónde cae la tarifa). Sin distancia ni frontera, no
  // hay footer: la caja queda informativa.
  const footer: FooterPosicion | null =
    distancia && veredicto !== "COMPRAR"
      ? {
          key: "distanciaVeredicto",
          k: "Lo que te separa del veredicto de arriba",
          l: (() => {
            const vias = distancia.valor.vias;
            if (!vias || vias.length === 0) return lineaFooterVias(null, 5);
            return lineaFooterVias(vias.filter((v) => v.estado === "cruza").length, vias.length);
          })(),
          btn: "Ver ajustes",
          cuerpo: <DrawerDistanciaStr hallazgo={distancia} currency={currency} valorUF={valorUF} />,
        }
      : fr?.abajo
        ? {
            key: "sensibilidad",
            k: "Cuánto aguanta este veredicto",
            l: "Franco probó hasta dónde puede caer la tarifa sin que cambie la conclusión.",
            btn: "Ver margen",
            sub: "Bajamos la tarifa por noche hasta que el veredicto se mueve. Esto es lo que aguanta antes de cambiar.",
            cuerpo: (() => {
              const abajo = fr.abajo!;
              const lo = Math.min(0.6, abajo.factor - 0.1);
              const hi = 1.2;
              const pos = (x: number) => ((x - lo) / (hi - lo)) * 100;
              const tono = (v: string): ZonaDial["tono"] => (v === "COMPRAR" ? "comprar" : v === "AJUSTA SUPUESTOS" ? "ajusta" : "buscar");
              const nombre = (v: string) => etiquetaVeredicto(v, "frase");
              const zonas: ZonaDial[] = [
                { k: nombre(abajo.veredicto), pct: pos(abajo.factor) - pos(lo), tono: tono(abajo.veredicto) },
                { k: "Comprar", pct: pos(hi) - pos(abajo.factor), tono: "comprar" },
              ];
              const bordes: BordeDial[] = [{ pos: pos(abajo.factor), delta: `−${((1 - abajo.factor) * 100).toFixed(1).replace(".", ",")}%`, v: `${money(adr * abajo.factor)} por noche`, k: `y cae a ${nombre(abajo.veredicto)}`, dir: "abajo" }];
              return (
                <div>
                  <VProsa>
                    Tu veredicto es COMPRAR con {money(adr)} por noche. Bajamos la tarifa con el resto fijo: aguanta hasta {money(adr * abajo.factor)} (−{((1 - abajo.factor) * 100).toFixed(1).replace(".", ",")}%) antes de caer a {nombre(abajo.veredicto)}.
                  </VProsa>
                  <VViz t="Tu veredicto según la tarifa por noche">
                    <Dial zonas={zonas} bordes={bordes} marcaPct={pos(1)} marcaK={results.adrFuente === "override" ? "Tu tarifa" : "Mediana de la zona"} marcaV={money(adr)} />
                  </VViz>
                  <VCierre titulo="Qué significa">
                    <mark>El colchón es de {money(adr - adr * abajo.factor)} por noche.</mark> Si la zona baja más que eso de forma sostenida, el veredicto cambia; hasta ahí, la conclusión se sostiene.
                  </VCierre>
                </div>
              );
            })(),
          }
        : null;

  // ── EL BLOQUE DETERMINISTA DE §5 (bloque C · 11-sep-2026) ──────────────────
  // El MISMO constructor de LTR con `modalidad: "str"`: dice «tarifa» donde LTR dice
  // «arriendo», lee `palancasHastaComprar` y `mixPalancasHastaComprar` del motor en BUSCAR,
  // y en COMPRAR recibe las dos filas ya resueltas acá, que es donde vive el dato:
  //   · AGUANTA sale de la frontera de tarifa del motor (`fronterasIngreso.abajo`): hasta
  //     dónde cae la tarifa antes de que el veredicto cambie. Sin frontera dentro del rango
  //     explorado (−70%), o con la frontera a la mitad o más, aguanta «−50% o más».
  //   · VERIFICA solo si la tarifa la definiste tú (`adrFuente === "override"`): con la
  //     mediana de la zona no hay nada que verificar y la fila no va.
  // Solo con el rediseño: apagado no hay bloque y el informe de siempre no cambia.
  const bloqueDeterminista = rediseno
    ? construirLoQueHariaYo({
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
      })
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
        /* SOLO CON EL REDISEÑO: la rama vieja de PosicionFranco dibujaría el bloque de
           «Lo que haría yo» en el informe apagado, que no cambia. */
        rediseno && bloqueDeterminista ? (
          <LoQueHariaYoBloque bloque={bloqueDeterminista} veredicto={veredicto} alternativa={alternativa} />
        ) : undefined
      }
      titulo={rediseno ? "La recomendación de Franco" : podada ? "Lo que haría yo" : undefined}
      estado={rediseno ? estadoRec : undefined}
      fechaFirma={fechaFirma}
      footer={
        /* EL CTA DEL ESTADO SIN SALIDA nombra lo que hay del otro lado: no quedan ajustes
           que hacer, queda ver QUÉ SE PROBÓ. El pop-up es el mismo; cambia el rótulo. */
        rediseno && footer && sinSalidaRecomendacion ? { ...footer, btn: "Ver qué se probó" } : footer
      }
      tipo="str"
      veredicto={veredicto}
    />
  );

  /* ¿EL HERO TIENE CUERPO PROPIO? Con el rediseño y prosa podada el h2 no va (§10 se lo da
     a la sección de hallazgos), así que lo que queda es la apertura —respuesta y
     reencuadre, que se conservan (decisión del 11-sep-2026)—, el error o el skeleton.
     Sin ninguna de las tres, la sección no se monta: §2 pide «nada más». */
  const heroTieneCuerpo = !(rediseno && podada) || Boolean(respuesta) || Boolean(prosaError) || Boolean(aiLoading);

  const cuerpoHero = (
      <div className="py-[9px]">
        <div>
          {/* CON EL REDISEÑO Y PROSA PODADA ESTE TÍTULO NO VA: es la línea que declara,
              y §10 se la da como título a la sección de hallazgos, que ahora vive suelta
              después del hero. Repetirla acá dejaría el mismo texto dos veces seguidas.
              El camino viejo lo conserva: su título es la pregunta de su propia prosa. */}
          {!(rediseno && podada) && (
            <h2 className="font-heading font-bold text-[21px] md:text-[23px] leading-[1.22] tracking-[-0.01em] text-[var(--franco-text)] mb-3.5 m-0 flex items-baseline gap-2.5">
              <span className="doc-fmark-inline shrink-0 select-none" aria-hidden="true">
                f.
              </span>
              <span className="min-w-0">{pregunta}</span>
            </h2>
          )}
          {respuesta ? (
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
  if (!rediseno) {
    return (
      <SeccionInforme id="hero" tono="paper2">
        <MarcaSeccion seccion="hero" tipo="str" accessLevel={accessLevel} />
        <div className="mb-3">
          {cuerpoHero}
          {/* LAS RAZONES, dentro del mismo bloque (v17): las cuatro líneas de hallazgo suben
              acá desde su sección propia. «Qué determina el veredicto» no se borra — se
              fusiona: la línea que declara ya es ese título. */}
          {podada && razones}
          {recomendacion}
        </div>
      </SeccionInforme>
    );
  }
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
