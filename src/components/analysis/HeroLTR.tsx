"use client";

import { useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { renderPlumon } from "./hallazgos/plumon";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult, Hallazgo, HallazgoDistanciaVeredicto, HallazgoSensibilidad } from "@/lib/types";
import type { DrawerKey } from "@/components/ui/AnalysisDrawer";
import { Modal } from "./hallazgos/vocabulario";
import { DrawerDistanciaLtr, DrawerSensibilidadLtr } from "./drawers/DrawersPropios";
import { ProgresoGeneracion } from "@/components/analysis/ProsaSkeleton";

/**
 * Hero de resultados LTR — rediseño dark (Fase 1a). Referencia visual aprobada:
 * mockup-hero-dark.html. Reemplaza al HeroVerdictBlock legacy dentro del
 * SubjectCardGrid; las MiniCards 2×2, Zona y drawers quedan intactas.
 *
 * UNA superficie continua dividida por hairlines HORIZONTALES (no cajas
 * tintadas por sección; sin borde vertical entre columnas — A1). Estructura:
 *  F1 identidad · F2 chips · F3 score|mapa · F4 veredicto|findings · pie firma.
 *
 * Construcción por etapas: E1 = F1 + F2.
 */
export function HeroLTR({
  data,
  currency,
  veredicto,
  valorUF,
  results,
  createdAt,
  fechaProsa,
  prosaError,
  onRetryProsa,
}: {
  /** Prosa IA. `null` mientras se genera (Goal C/E/E.2: veredicto inmediato) —
   *  el hero renderiza todo lo que viene del motor y el slot de prosa muestra
   *  ProgresoGeneracion (skeleton didáctico) hasta que llegue. */
  data: AIAnalysisV2 | null;
  currency: "CLP" | "UF";
  onCurrencyChange: (c: "CLP" | "UF") => void;
  veredicto: string;
  score: number;
  propiedadTitle: string;
  inputData: AnalisisInput | null | undefined;
  results: FullAnalysisResult | null | undefined;
  comuna?: string;
  /** Abre un drawer desde "La posición de Franco". Sin este callback el bloque queda
   *  informativo (sin affordance), que es el comportamiento previo. */
  onOpenDrawer?: (key: DrawerKey) => void;
  ciudad?: string;
  valorUF: number;
  createdAt?: string;
  /** Fecha de la PROSA vigente (`fin_at` de la última generación exitosa).
   *  El pie del informe la prefiere sobre `createdAt`: con lazy-regen por bump
   *  de PROMPT_VERSION, la fila puede ser de abril y la prosa de agosto.
   *  Ausente en filas anteriores a la instrumentación → cae a `createdAt`. */
  fechaProsa?: string;
  /** Fallo de la generación de prosa: se muestra inline en el slot (el resto del
   *  hero sigue vivo) con CTA de reintento. */
  prosaError?: string | null;
  onRetryProsa?: () => void;
}) {
  // FASE 3: F1/F2/F3 murieron — identidad, chips, score y mapa viven en la
  // PORTADA (PortadaInforme + useComparablesCercanos). Acá queda solo F4.

  // ── Veredicto / findings (F4) ──
  // Con prosa en vuelo (data null): el slot muestra ProgresoGeneracion (Goal
  // E.2 — skeleton didáctico), o el error inline si la generación falló.
  const conviene = data?.conviene;
  const respuesta =
    (currency === "CLP" ? conviene?.respuestaDirecta_clp : conviene?.respuestaDirecta_uf) ?? null;
  const cajaAccionable =
    (currency === "CLP" ? conviene?.cajaAccionable_clp : conviene?.cajaAccionable_uf) ?? null;
  // FNOTE por CURADURÍA (decisión b del PARÁ 0): la nota al margen no es un campo
  // IA nuevo — es la primera oración de una cajaAccionable que la prosa YA trae, y
  // se elige la de costoMensual (la más cercana al bolsillo). Si mide más de ~18
  // palabras no se muestra: una nota larga deja de ser nota.
  const fnote = (() => {
    const fuente = (currency === "CLP" ? data?.costoMensual?.cajaAccionable_clp : data?.costoMensual?.cajaAccionable_uf) ?? "";
    const primera = fuente.split(/(?<=[.?!])\s/)[0]?.trim() ?? "";
    const palabras = (primera.match(/\S+/g) || []).length;
    return primera && palabras <= 18 ? primera : null;
  })();
  // veredictoFrase (schema.conviene) ya no se renderiza en el hero compacto — la
  // prosa fundida lo dice. El campo sigue en el schema (Entrega 2 decide su destino).
  const pregunta = conviene?.pregunta || "¿Conviene o no conviene?";
  // ÍNDICE del informe: los primeros 3 del ORDEN ÚNICO — el MISMO array que renderiza
  // la pirámide (fuente única: ordenarHallazgosPiramide). El hero los numera 01-03 y
  // cada fila ancla a su card; la pirámide continúa la numeración.
  // Goal E.2 — la apertura estática del 01 MURIÓ (confundía: parecía prosa
  // cortada, no prosa creciendo — decisión post-deploy). El slot en carga es
  // ProgresoGeneracion: skeleton didáctico con stepper + barra conservadora +
  // rango honesto. Contrato: mockup-hero-skeleton-didactico.html.

  // CTA contextual de la posición de Franco — por VEREDICTO (contrato FASE 2 §4),
  // no por qué hallazgo exista: BUSCAR OTRA → "Por qué no cierra" · AJUSTA → "Ver
  // las vías" · COMPRAR → "Qué verificar antes de firmar". El destino sigue siendo
  // el drawer de distancia (o sensibilidad en COMPRAR), que es donde vive la
  // respuesta; lo que se fija es el LABEL, que antes prometía cosas distintas
  // según el inventario de hallazgos.
  const hallazgosRow = (results?.hallazgos ?? []) as Hallazgo[];
  const distanciaRow = hallazgosRow.find((h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto");
  const sensibilidadRow = hallazgosRow.find((h): h is HallazgoSensibilidad => h.id === "sensibilidad");
  // FOOTER DE LA POSICIÓN — contrato CONGELADO 02-sep-2026 (T2). Por veredicto:
  // AJUSTA y BUSCAR OTRA abren "Lo que te separa" (la matriz de vías, en modal);
  // COMPRAR abre "Cuánto aguanta este veredicto" (la sensibilidad del arriendo).
  // Sin distancia cae a sensibilidad si existe; sin ninguna, no hay footer. Es
  // información de otra índole que no compite con el flujo de lectura: modal,
  // no drawer, y el único botón real del informe hasta que exista el CTA.
  const footer =
    distanciaRow && veredicto !== "COMPRAR"
      ? {
          key: "distanciaVeredicto" as const,
          k: "Lo que te separa del veredicto de arriba",
          // Cuántos de los cuatro cruzan, leído de `vias` (goal "cuatro palancas
          // siempre"). Sin `vias` (filas viejas) queda la línea genérica.
          l: (() => {
            const vias = distanciaRow.valor.vias;
            if (!vias || vias.length === 0) return "Franco probó cuatro ajustes que mueven el veredicto.";
            const n = vias.filter((v) => v.estado === "cruza").length;
            const cuantos = n === 0 ? "Ninguno mueve" : n === 1 ? "Uno mueve" : n === 2 ? "Dos mueven" : n === 3 ? "Tres mueven" : "Los cuatro mueven";
            return `Franco probó cuatro ajustes. ${cuantos} el veredicto.`;
          })(),
          btn: "Ver ajustes",
          // Sin bajada: la intro del modal es UN solo párrafo y vive en el cuerpo
          // (DrawerDistanciaLtr), que sabe cuántas vías cruzan.
          sub: undefined,
          cuerpo: <DrawerDistanciaLtr hallazgo={distanciaRow} currency={currency} valorUF={valorUF} />,
        }
      : sensibilidadRow && results
        ? {
            key: "sensibilidad" as const,
            k: "Cuánto aguanta este veredicto",
            l: "Franco probó hasta dónde puede caer el arriendo sin que cambie la conclusión.",
            btn: "Ver margen",
            sub: "Bajamos el arriendo declarado hasta que el veredicto se mueve. Esto es lo que aguanta antes de cambiar.",
            cuerpo: <DrawerSensibilidadLtr hallazgo={sensibilidadRow} results={results} currency={currency} valorUF={valorUF} />,
          }
        : null;
  const [modalAbierto, setModalAbierto] = useState(false);
  // POR QUÉ NO CIERRA (LTR) — puerto del patrón STR (§1.12.8): la glosa de los
  // motivos que decidieron el veredicto, SOLO cuando lo decidió un gate y no la
  // banda del score. Los brazos del Gate 1 viajan en el hallazgo de distancia
  // (recomputado — misma fuente que su drawer); la capa del Gate 2 no tiene
  // brazo persistido y se deriva: score en banda COMPRAR (≥70) con veredicto
  // AJUSTA ⇒ el gate capó. Veredicto de banda pura → null y no se muestra nada:
  // inventar una causa sería peor que no darla (§1.9.3).
  const fechaFirma = formatFecha(fechaProsa ?? createdAt);

  // Evento propio de la posición de Franco: su apertura NO es un hallazgo (la
  // distancia al veredicto está excluida de la pirámide por diseño), así que
  // colgaba de `informe_drawer_abierto` sin par de hallazgo — el falso hueco que
  // Claude chat cazó en la línea base. Ahora tiene su propia serie.
  const posthog = usePostHog();
  const posicionMedida = useRef(false);
  const abrirPosicion = () => {
    if (posicionMedida.current) return;
    posicionMedida.current = true;
    try {
      posthog?.capture("informe_posicion_abierta", { veredicto, tipo: "ltr", destino: footer?.key });
    } catch {
      /* la telemetría jamás rompe la lectura */
    }
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
      (window.__informeEvents ??= []).push({
        name: "informe_posicion_abierta",
        props: { veredicto, tipo: "ltr", destino: footer?.key },
      });
    }
  };

  // FASE 3 rediseño Dictamen: F1 (identidad+toggle), F2/F3 (chips, score 48px,
  // gauge, badge, mapa) MURIERON — la portada nueva (PortadaInforme) los absorbe:
  // eyebrow, banda semántica (M2: único color de estado), barra fina de score,
  // link de ficha y mapa. El hero conserva F4 (veredicto narrado + prosa +
  // índice), la posición de Franco y el pie de firma. Sin data-verdict: el wash
  // por veredicto del hero-block contradecía M2.
  // SIN CARD. El bloque era una card gris flotante (`franco-hero-block`: gradiente,
  // borde y sombra) sobre el papel del informe. Ahora es texto directo sobre el fondo,
  // como ya lo era "La posicion de Franco" -- que queda como la UNICA caja del bloque,
  // y por eso vuelve a significar algo.
  //
  // SIN GRID 52/48: la columna derecha estaba VACIA (un solo hijo en una grilla de
  // dos), asi que el hero desperdiciaba el 48% de su ancho y la prosa se leia en una
  // columna angosta sin razon. Pasa a ancho completo con su ``, que es lo
  // que gobierna la medida de lectura.
  //
  // FUERA el rotulo "Veredicto": la banda de la portada ya lo dice a ancho completo y
  // repetirlo era etiquetar lo obvio. En su lugar, la pregunta la firma Franco.
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
              `no-cierra-copy.ts` nació el 06-ago-2026 para ALIMENTAR EL PROMPT —"si le
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
          {/* El chip `f.` entra al TITULO -- mismo isotipo que el sticky del margen, inline. */}
          <h2 className="font-heading font-bold text-[21px] md:text-[23px] leading-[1.22] tracking-[-0.01em] text-[var(--franco-text)] mb-3.5 m-0 flex items-baseline gap-2.5">
            <span className="doc-fmark-inline shrink-0 select-none" aria-hidden="true">
              f.
            </span>
            <span className="min-w-0">{pregunta}</span>
          </h2>
          {/* A3: alineación izquierda (no justificado), ~65ch, 14-15px */}
          {/* La prosa cuelga del TEXTO del titulo, no del borde del bloque: `ml-9` = 36px
              = el ancho del chip `f.` (26px) mas el `gap-2.5` (10px) del h2. Asi el
              unico elemento en el borde izquierdo es el isotipo, que queda de nota al
              margen, y prosa y titulo comparten una sola linea vertical.
              Antes arrancaba en x=138 con techo de 675px, o sea todo el aire sobrante
              se apilaba a la derecha y el bloque se leia volcado al borde.
              Solo desde `md`: bajo 768px no hay aire que repartir y 36px se comerian
              el ancho de lectura. */}
          {respuesta ? (
            <div className="font-body text-left text-[14px] md:text-[15px] leading-[1.62] text-[var(--franco-text-secondary)] max-w-[75ch] md:ml-9">
              {renderPlumon(respuesta)}
              {fnote && <p className="doc-fnote">{fnote}</p>}
            </div>
          ) : prosaError ? (
            /* Error de generación inline: el hero (veredicto/score/índice) sigue
               vivo; solo el slot de prosa reporta y ofrece reintentar. */
            <div className="">
              <p className="font-body text-[13.5px] leading-[1.55] text-[var(--franco-text-secondary)] m-0 mb-2">
                No pudimos completar la redacción del análisis.
              </p>
              {onRetryProsa && (
                <button
                  type="button"
                  onClick={onRetryProsa}
                  className="font-body text-sm font-medium text-signal-red hover:underline"
                >
                  Reintentar
                </button>
              )}
            </div>
          ) : (
            /* Prosa en vuelo (Goal E.2): skeleton didáctico — inequívoco que se
               está generando, en qué etapa va y cuánto suele tomar. */
            <ProgresoGeneracion />
          )}
        </div>

      </div>
      {/* ═══ LA POSICIÓN DE FRANCO — card con footer propio (contrato CONGELADO, T2) ═══
          La caja IA + la firma van en el cuerpo con la línea roja; el footer "Lo que
          te separa" / "Cuánto aguanta" tiene fondo propio, regla de 1px y el botón
          real que abre el modal. Cuelga del texto del título (md:ml-9) igual que la
          prosa, para compartir su línea vertical. Sin caja ni footer no hay bloque. */}
      {(cajaAccionable || footer) && (
        <div className="pb-2 md:ml-9">
          <div className="pos-card">
            <div className="pos-main">
              <span className="pos-t">La posición de Franco</span>
              {cajaAccionable && <div className="pos-p">{renderPlumon(cajaAccionable)}</div>}
              <div className="pos-firma">
                <span className="doc-fmark-inline shrink-0 select-none" aria-hidden="true" style={{ width: 22, height: 22, fontSize: 10 }}>
                  f.
                </span>
                <span>
                  Franco
                  <small>Análisis generado por IA{fechaFirma ? ` · ${fechaFirma}` : ""}</small>
                </span>
              </div>
            </div>
            {footer && (
              <div className="pos-foot">
                <div>
                  <span className="k">{footer.k}</span>
                  <span className="l">{footer.l}</span>
                </div>
                <button
                  type="button"
                  className="doc-btn"
                  onClick={() => {
                    abrirPosicion();
                    setModalAbierto(true);
                  }}
                >
                  {footer.btn} →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {footer && (
        <Modal abierto={modalAbierto} onClose={() => setModalAbierto(false)} titulo={footer.k} sub={footer.sub}>
          {/* .doc-tokens: los cuerpos de los drawers resuelven --doc-* también fuera de .doc-dictamen */}
          <div className="doc-tokens">{footer.cuerpo}</div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// F4 helpers — findings, prosa con números en mono, firma
// ═══════════════════════════════════════════════════════════════════════════

// Fecha de la firma: "3 jul 2026" (es-CL). Vacío si no hay createdAt válido.
function formatFecha(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}


