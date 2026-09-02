"use client";

import { useRef } from "react";
import { usePostHog } from "posthog-js/react";
import type { AIAnalysisSTRv2, Hallazgo } from "@/lib/types";
import { normalizeLegacyVerdict } from "@/lib/types";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import { ProgresoGeneracion, ETAPAS_GENERACION_STR, COPY_TIEMPO_STR } from "@/components/analysis/ProsaSkeleton";
import { renderPlumon, plumonInline } from "@/components/analysis/hallazgos/plumon";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { DrawerKeySTR } from "@/components/analysis/str/DrawerSTR";

/**
 * Hero de resultados STR (E.5) — port del patrón HeroLTR al módulo renta corta.
 * Reemplaza el paradigma viejo (HeroVerdictBlockSTR: HeroTopStrip + callout
 * veredictoFrase + 3 DatoCards). UNA superficie continua dividida por hairlines:
 *   F1 identidad (dirección + toggle) · F3 score+gauge+chips | mapa (ubicación) ·
 *   F4 veredicto (prosa) | TOP-3 hallazgos + puente a la pirámide · pie firma.
 *
 * Decisiones de producto (⛔#1 Fabrizio):
 *  · Variante A CON mapa, con comparables igual que HeroLTR (mismo endpoint
 *    /api/data/suggestions type=venta; STR tiene comuna/superficie/dorm/lat/lng).
 *    ZonaCardSTR conserva el suyo — la redundancia de dos mapas se ajusta en rama
 *    posterior si molesta en producción, no recortando el del hero.
 *  · Título: conviene.pregunta ?? hardcode por veredicto (v3 podó `pregunta`).
 *  · veredictoFrase NO se renderiza (LTR lo mató; la prosa fundida lo dice).
 *
 * Los primitivos visuales (CurrencyToggle/ScoreBar/Chip/Wordmark/renderProsaMono/
 * FindingRow) se replican self-contained a propósito (HeroLTR queda intacto —
 * producción crítica). Consolidación en un shared: paso posterior.
 */

// ── Formato chileno ──
// CLP en millones abreviados ("$158,8 MM"); bajo $1 MM en miles.


export function HeroSTR({
  ai,
  results,
  veredicto,
  createdAt,
  fechaProsa,
  aiLoading,
  onOpenDrawer,
}: {
  ai: AIAnalysisSTRv2 | null;
  // `francoScore` viaja colgado del results persistido (mismo shape que usa el caller
  // y ai-generation-str). Se necesita para los motivos del gate — ver `motivos` abajo.
  results: ShortTermResult & { francoScore?: FrancoScoreSTR };
  veredicto: STRVerdict;
  score: number | null;
  inputData: Record<string, unknown> | null;
  comuna: string;
  ciudad?: string;
  createdAt?: string;
  /** Fecha de la PROSA vigente (`fin_at` de la última generación exitosa).
   *  El pie del informe la prefiere sobre `createdAt`: con lazy-regen por bump
   *  de PROMPT_VERSION, la fila puede ser de abril y la prosa de agosto.
   *  Ausente en filas anteriores a la instrumentación → cae a `createdAt`. */
  fechaProsa?: string;
  aiLoading?: boolean;
  /** Abre un drawer del informe. Ausente ⇒ la caja de posición no es clickeable. */
  onOpenDrawer?: (key: DrawerKeySTR) => void;
}) {
  const v = (normalizeLegacyVerdict(veredicto) as STRVerdict | null) ?? "BUSCAR OTRA";

  // FASE 3: F1/F3 murieron — identidad, chips, score, gauge y mapa viven en
  // la PORTADA (PortadaInforme + useComparablesCercanos). Acá queda solo F4.

  // ── F4 veredicto ──
  const conviene = ai?.conviene;
  const respuesta = conviene?.respuestaDirecta?.trim() || null;
  const reencuadre = conviene?.reencuadre?.trim() || null;
  // CÁPSULA (v10). El campo existió hasta v6 y se podó en v7 con una razón textual:
  // "se generaba y no se renderizaba". Vuelve CON su render — si no, se repite
  // exactamente el motivo por el que murió. Las filas viejas que lo traen (57 en el
  // parque) siguen leyéndose sin regenerar.
  const capsula = conviene?.veredictoFrase?.trim() || null;
  const cajaAccionable = conviene?.cajaAccionable?.trim() || null;
  // v3 podó `pregunta` → fallback hardcode por veredicto es el caso dominante.
  const pregunta =
    conviene?.pregunta?.trim() ||
    (v === "BUSCAR OTRA"
      ? "¿Conviene operar este depto en renta corta?"
      : v === "AJUSTA SUPUESTOS"
        ? "¿Cómo puedes hacer rendir este depto en renta corta?"
        : "¿Es buena oportunidad para renta corta?");

  const isNeutro = v === "COMPRAR";
  const cajaLabel = isNeutro ? "Considera antes de cerrar" : "La posición de Franco";

  // Destino del drawer de la posición de Franco, por veredicto (espejo de HeroLTR):
  //  · no-COMPRAR con hallazgo de distancia → "Lo que te separa". El label distingue el
  //    caso estructural: prometer "vías" donde no las hay sería mentir en el botón.
  //  · COMPRAR → el margen (sensibilidad), porque ahí la pregunta que sigue no es qué
  //    falta sino cuánto aguanta antes de dejar de convenir.
  // Sin destino, la caja queda como estaba: texto sin callback (no un botón muerto).
  const hallazgosHero = (results?.hallazgos ?? []) as Hallazgo[];
  const distanciaHero = hallazgosHero.find((h) => h.id === "distancia_veredicto");
  const posicionDrawer: { key: DrawerKeySTR; label: string } | null = distanciaHero
    ? {
        key: "distanciaVeredicto",
        label:
          distanciaHero.id === "distancia_veredicto" && distanciaHero.valor.esEstructural
            ? "Por qué no cierra"
            : "Ver las vías",
      }
    : hallazgosHero.some((h) => h.id === "sensibilidad_str")
      ? { key: "sensibilidad", label: "Ver el margen" }
      : null;
  const posicionClickeable = posicionDrawer != null && onOpenDrawer != null;

  // (c) FASE 4.1 — la apertura de la posición de Franco se mide también en STR. El evento
  // existía solo en LTR, así que el 55% del parque abría `distanciaVeredicto` —el cuerpo
  // más denso del informe— sin dejar rastro. Mismo nombre, mismo shape y mismo disparo
  // único por montaje que HeroLTR, para que las dos series se lean juntas.
  const posthog = usePostHog();
  const posicionMedida = useRef(false);
  const abrirPosicion = () => {
    if (!posicionMedida.current) {
      posicionMedida.current = true;
      try {
        posthog?.capture("informe_posicion_abierta", { veredicto: v, tipo: "str", destino: posicionDrawer?.key });
      } catch {
        /* la telemetría jamás rompe la lectura */
      }
      if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
        (window.__informeEvents ??= []).push({
          name: "informe_posicion_abierta",
          props: { veredicto: v, tipo: "str", destino: posicionDrawer?.key },
        });
      }
    }
    if (posicionDrawer) onOpenDrawer?.(posicionDrawer.key);
  };

  // POR QUÉ NO CIERRA — los motivos que decidieron el veredicto, cuando lo decidió un
  // gate y no la banda del score. Sin esto, en 12 de 96 análisis el lector ve un score
  // que no explica su veredicto (el peor: 59 con BUSCAR OTRA) y no tiene dónde
  // entenderlo. Cuando el veredicto viene de la banda, `motivos` es null y NO se
  // muestra nada: inventar una causa sería peor que no darla.

  const fechaFirma = formatFecha(fechaProsa ?? createdAt);

  // SIN CARD y SIN GRID 52/48 -- mismo cambio que HeroLTR. Aca la columna derecha SI
  // tenia contenido, el indice "Leelo en este orden", y se RETIRO: duplicaba el
  // acordeon que arranca ~30px mas abajo. Medido: mismo array
  // (`ordenarHallazgosPiramideSTR`), mismos strings (`findingDisplay`), mismo orden, y
  // el acordeon ademas trae el `ksub` que el indice no mostraba -- o sea el indice era
  // un SUBCONJUNTO. LTR ya vivia sin el, asi que esto alinea las dos modalidades.
  // Lo unico exclusivo que se pierde es el atajo de navegacion por ancla.
  return (
    <div className="mb-3">
      {/* SIN PADDING HORIZONTAL. El `px-6 md:px-8` era el padding INTERNO de la
          card: al retirarla quedo empujando el texto 32px hacia adentro, y el
          bloque dejo de alinear con el acordeon. Medido en prod: el contenedor
          esta en x=216, el mismo que el acordeon, pero el contenido caia en 248.
          El acordeon tiene padding 0; el bloque tambien, ahora. */}
      <div className="py-[9px]">
        <div>
          {/* EL PÁRRAFO DE MOTIVOS SALIÓ DEL HERO (la glosa SIGUE yendo al prompt).
              Espejo de HeroLTR. `no-cierra-copy.ts` nació el 06-ago-2026 para ALIMENTAR EL PROMPT —"si le
              pasas el concepto-motor lo copia; si le pasas la consecuencia, la narra"—
              y el render en el hero llegó ocho días después. El prompt sigue recibiendo
              la glosa con la instrucción "úsala, no la re-derives ni la contradigas",
              así que el mismo texto aparecía DOS VECES por diseño: narrado por la prosa
              y literal encima.
              Medido sobre 200 análisis: el 88,2% de los hechos que afirmaba el párrafo
              ya estaban en la prosa o el titular, y en el 78,4% de los casos NO aportaba
              ningún hecho nuevo. Encima se contradecía —abría con "No cierra por una
              sola cosa" y enumeraba tres— y repetía el hecho del bolsillo dos veces.
              Lo que decía no se pierde: la prosa lo narra, que es su trabajo. */}
          {/* Chip `f.` en el titulo -- espejo de HeroLTR. */}
          <h2 className="font-heading font-bold text-[21px] md:text-[23px] leading-[1.22] tracking-[-0.01em] text-[var(--franco-text)] mb-3.5 m-0 flex items-baseline gap-2.5">
            <span className="doc-fmark-inline shrink-0 select-none" aria-hidden="true">
              f.
            </span>
            <span className="min-w-0">{pregunta}</span>
          </h2>
          {/* La prosa cuelga del TEXTO del titulo, no del borde del bloque: `ml-9` = 36px
              = el ancho del chip `f.` (26px) mas el `gap-2.5` (10px) del h2. Asi el
              unico elemento en el borde izquierdo es el isotipo, que queda de nota al
              margen, y prosa y titulo comparten una sola linea vertical.
              Antes arrancaba en x=138 con techo de 675px, o sea todo el aire sobrante
              se apilaba a la derecha y el bloque se leia volcado al borde.
              Solo desde `md`: bajo 768px no hay aire que repartir y 36px se comerian
              el ancho de lectura. */}
          <div className="font-body text-left text-[14px] md:text-[15px] leading-[1.62] text-[var(--franco-text-secondary)] max-w-[75ch] md:ml-9">
            {/* Goal F: la espera hereda ProgresoGeneracion (E.2) con etapas y
                copy STR propios — skeleton didáctico en vez del mensaje fijo. */}
            {respuesta ? renderPlumon(respuesta) : aiLoading ? <ProgresoGeneracion etapas={ETAPAS_GENERACION_STR} copyTiempo={COPY_TIEMPO_STR} /> : null}
            {/* La cápsula va DENTRO de la prosa, entre la respuesta y el reencuadre:
                es la voz de Franco interrumpiendo su propio análisis. Barra roja a la
                izquierda + itálica, el mismo tratamiento que ya tiene "La posición de
                Franco" al cierre — no una primitiva nueva. */}
            {capsula && (
              <p
                className="font-body italic text-[13.5px] leading-[1.5] mt-3 mb-0 pl-3"
                style={{ borderLeft: "2px solid var(--signal-red)", color: "var(--signal-red)" }}
              >
                <span className="font-mono not-italic font-semibold mr-1">f.</span>—{" "}
                {capsula}
              </p>
            )}
            {reencuadre && <div className="mt-3">{renderPlumon(reencuadre)}</div>}
          </div>
        </div>

      </div>

      {/* ═══ POSICIÓN DE FRANCO — full-width, ambas columnas (A5) · isNeutro preservado ═══ */}
      {/* (b) FASE 4.1 — el bloque ya no cuelga de `cajaAccionable`: sin caja seguía habiendo
          destino, y perderlo cerraba la única puerta a `distanciaVeredicto`. La caja pasa a
          ser opcional adentro; el bloque existe si hay algo de posición que mostrar. */}
      {(cajaAccionable || posicionClickeable) && (
        <div className="pb-4">
          <div
            style={{
              borderLeft: `3px solid ${isNeutro ? "var(--franco-text-secondary)" : "var(--signal-red)"}`,
              borderRadius: "0 8px 8px 0",
              background: isNeutro ? "var(--franco-bg-alt)" : "color-mix(in srgb, var(--signal-red) 5%, transparent)",
            }}
          >
            <div className="px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.06em] font-semibold"
                  style={{ color: isNeutro ? "var(--franco-text-tertiary)" : "var(--signal-red)" }}
                >
                  {cajaLabel}
                </span>
              </div>
              {/* Sin caja el bloque queda en su fila de arriba (label + destino), que ya es
                  una línea: no hay párrafo vacío que deje hueco. */}
              {cajaAccionable && (
                <p
                  className="font-body text-[13.5px] leading-[1.55] text-[var(--franco-text)] m-0"
                  style={{ fontStyle: isNeutro ? "normal" : "italic" }}
                >
                  {plumonInline(cajaAccionable)}
                </p>
              )}
              {/* FIRMA DENTRO DE LA CAJA — espejo de HeroLTR. La línea "Análisis
                  generado por IA" nunca estuvo acá: era el pie del hero, y la card que
                  envolvía todo la hacía PARECER parte del bloque. Sin card quedaba
                  huérfana sobre el papel. El destino del drawer sube desde la fila del
                  label a esta misma línea, que es donde el mockup lo pone. */}
              <div
                className="mt-3 pt-2.5 flex items-center justify-between gap-3"
                style={{
                  borderTop: `1px solid ${isNeutro ? "var(--franco-border)" : "color-mix(in srgb, var(--signal-red) 20%, transparent)"}`,
                }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="doc-fmark-inline shrink-0 select-none" aria-hidden="true">
                    f.
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-[11.5px] font-semibold text-[var(--franco-text)] leading-tight">
                      Franco
                    </span>
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] leading-tight">
                      Análisis generado por IA{fechaFirma ? ` · ${fechaFirma}` : ""}
                    </span>
                  </span>
                </span>
                {posicionClickeable && (
                  /* Botón real (no un div con onClick) para que teclado y lectores de
                     pantalla lo alcancen. */
                  <button
                    type="button"
                    onClick={abrirPosicion}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] font-semibold underline underline-offset-2 decoration-dotted hover:opacity-70 transition-opacity"
                    style={{ color: isNeutro ? "var(--franco-text-secondary)" : "var(--signal-red)" }}
                  >
                    {posicionDrawer!.label} →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-px" style={{ background: "var(--franco-border)" }} />

      {/* PIE · solo el wordmark. El disclaimer de IA se mudo DENTRO de la caja de
          posicion, junto a la firma: sin la card que envolvia el bloque, una linea
          suelta sobre el papel no se leia como parte de nada. */}
      <div className="flex items-center justify-end gap-3 py-2">
        <Wordmark />
      </div>
    </div>
  );
}

// ── Wordmark refranco.ai ──
function Wordmark() {
  return (
    <span className="inline-flex items-baseline leading-none">
      <span className="font-heading italic font-light text-[17px]" style={{ color: "var(--franco-wm-re)", marginRight: "-0.08em" }}>re</span>
      <span className="font-heading font-bold text-[17px]" style={{ color: "var(--franco-wm-franco)" }}>franco</span>
      <span className="font-body font-semibold tracking-wide text-[#C8323C]" style={{ fontSize: "0.35em", letterSpacing: "0.1em", marginLeft: 1 }}>.ai</span>
    </span>
  );
}


// Fecha firma "3 jul 2026" (es-CL).
function formatFecha(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}
