"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Shell + router de pantallas
//
// Header con rótulo de acto (mono uppercase) + barra de progreso Signal Red
// (monotónica) + chevron atrás. Reacción de Franco (datos reales) sobre la
// pregunta. Transición slide+fade. Draft con banner de retomar.
//
// Actos 1-2 (FASE 2): pantallas reales con inputs, Places, mapa, estimaciones.
// Acto 3 + resumen: placeholders navegables (Fases 3-4).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { trackWizard } from "./track";
import { useWizardV4 } from "./useWizardV4";
import { useWizardV4Data } from "./useWizardV4Data";
import { useWizardV4Tier, esNuevoConAnalisisGratis } from "./useWizardV4Tier";
import { metaTrackCustom } from "@/lib/meta/pixel";
import { ResumenScreen } from "./screenResumen";
import {
  ACTO_BY_NODE,
  ACTO_LABEL,
  NODE_TITLE,
  reactionText,
  type NodeId,
  type ReactionLive,
  type WizardV4Answers,
} from "./wizardV4Nodes";
import { cuotaCLP, fmtCLP, parseNum } from "./derive";
import { avisoSubsidioAplica } from "./wizardV4Subsidio";
import { ChoiceTile, FrancoReaction, GhostBtn, PrimaryBtn } from "./ui";
import {
  AntiguedadScreen,
  DireccionScreen,
  EntregaScreen,
  TamanoScreen,
  TipoScreen,
  type ScreenProps,
} from "./screensActo1";
import { PieScreen, PlazoScreen, PrecioScreen, TasaFixScreen, TasaScreen } from "./screensActo2";
import { AdrFixScreen, AdrScreen, ArrFixScreen, ArrScreen } from "./screensActo3";
import { InformeScreen } from "./screenInforme";
import { ModalPlausibilidad } from "./ModalPlausibilidad";
import { buildPlausibilidadParcial } from "./wizardV4Submit";
import { evaluarPlausibilidad, type Anomalia, type Regla } from "@/lib/plausibilidad";

/** Guard de sesión del StartFreeAnalysis (1 disparo por pestaña/sesión). */
const SFA_SESSION_KEY = "meta_sfa_fired";

/** Rótulo corto de modalidad para el chip del header (uppercase por CSS). */
const MOD_CHIP: Record<string, string> = {
  ltr: "Renta larga",
  str: "Renta corta",
  both: "Comparativo",
};

/** Caja placeholder de contenido de pantalla (Acto 3 / resumen → Fases 3-4). */
function PlaceholderBox({ node }: { node: NodeId }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--franco-border-strong)] bg-[var(--franco-card)] px-5 py-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] m-0">
        Pantalla · {node}
      </p>
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mt-2 mb-0">
        Contenido e inputs reales en Fases 3–4.
      </p>
    </div>
  );
}

export function WizardV4({
  resume,
  comunaInicial = null,
}: {
  resume: boolean;
  /** Comuna precargada desde ?comuna= (páginas SEO). Solo contexto: la pantalla
   *  de dirección igual exige una dirección confirmada de Places. */
  comunaInicial?: { comuna: string; ciudad: string } | null;
}) {
  const posthog = usePostHog();
  const emitEvent = useCallback(
    (name: string, props?: Record<string, unknown>) => { trackWizard(posthog, name, props); },
    [posthog],
  );

  const w = useWizardV4({ resume, onEvent: emitEvent });
  const { nav } = w;
  const data = useWizardV4Data(nav.answers);
  const { tier, isLoggedIn } = useWizardV4Tier();

  const acto = ACTO_BY_NODE[nav.current];
  const actoLabel = ACTO_LABEL[acto];
  // Chip de modalidad: persistente desde que se elige el informe, para que el
  // usuario nunca olvide qué está armando. Ink (no Signal Red — no es atención).
  const modLabel = nav.answers.modalidad ? MOD_CHIP[nav.answers.modalidad] : null;
  const progress = w.progress;

  // Precarga de comuna (?comuna=). Una sola vez y solo si el usuario todavía no
  // tiene una: nunca debe pisar lo que ya eligió, ni al retomar un draft.
  const comunaPrecargada = useRef(false);
  useEffect(() => {
    if (comunaPrecargada.current || !comunaInicial) return;
    comunaPrecargada.current = true;
    if (nav.answers.comuna) return;
    w.patchAnswers({ comuna: comunaInicial.comuna, ciudad: comunaInicial.ciudad });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comunaInicial]);

  // step_viewed: una vez por cambio de nodo (guard anti-doble en StrictMode).
  const lastStep = useRef<NodeId | null>(null);
  useEffect(() => {
    if (lastStep.current === nav.current) return;
    lastStep.current = nav.current;
    trackWizard(posthog, "wizard4_step_viewed", { node: nav.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.current, posthog]);

  // Meta Pixel · StartFreeAnalysis (custom, browser-only): "usuario elegible
  // entró al wizard". Se evalúa al montar y de nuevo cuando llega /api/me/tier
  // (el gate necesita el tier; mientras sea null no se decide nada). NO depende
  // del nodo actual ni excluye ?resume=1: el recién registrado vuelve por
  // /register?next=/analisis/nuevo-v4?resume=1 y ese es justamente el segmento
  // que la campaña mide — como guest no disparó (tier="guest"), dispara al
  // volver logueado.
  //
  // Una sola vez por sesión de navegador: sessionStorage para sobrevivir
  // remounts/navegación same-tab, más un ref en memoria que cubre el doble
  // render de StrictMode y el caso en que sessionStorage tire (modo privado) —
  // ahí se dispara igual, degradado, antes que perder el evento.
  //
  // Sin event_id: no hay contraparte CAPI que deduplicar. Gate de infra
  // heredado: sin NEXT_PUBLIC_META_PIXEL_ID no existe fbq y metaTrackCustom es
  // no-op (mismo trato que PageView e InitiateCheckout).
  const sfaFired = useRef(false);
  useEffect(() => {
    if (sfaFired.current) return;
    if (!esNuevoConAnalisisGratis(tier)) return;
    try {
      if (sessionStorage.getItem(SFA_SESSION_KEY)) {
        sfaFired.current = true;
        return;
      }
      sessionStorage.setItem(SFA_SESSION_KEY, "1");
    } catch {
      // sessionStorage no disponible → seguimos con el guard en memoria.
    }
    sfaFired.current = true;
    metaTrackCustom("StartFreeAnalysis");
  }, [tier]);

  // abandoned (best-effort): pagehide sin haber llegado a terminal (generar /
  // pagar / crear cuenta), y solo si el usuario ya arrancó. terminatedRef lo
  // marca la CTA final; navSnap da el nodo/modalidad al momento de salir.
  const terminatedRef = useRef(false);
  const markTerminal = useCallback(() => { terminatedRef.current = true; }, []);
  const navSnap = useRef(nav);
  useEffect(() => { navSnap.current = nav; }, [nav]);
  useEffect(() => {
    const onHide = () => {
      if (terminatedRef.current) return;
      const s = navSnap.current;
      const started = s.answers.modalidad != null || s.history.length > 0;
      if (!started) return;
      trackWizard(posthog, "wizard4_abandoned", { node: s.current, modalidad: s.answers.modalidad });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [posthog]);

  // Reacción de Franco con datos reales (comparables, UF del día, cuota, aviso subsidio).
  const live: ReactionLive = {};
  if (data.comparablesCount > 0) live.comparables = data.comparablesCount;
  const puf = parseNum(nav.answers.precio ?? "");
  if (puf > 0 && data.ufCLP > 0) live.precioCLP = fmtCLP(puf * data.ufCLP);
  const cuota = cuotaCLP(nav.answers, data.ufCLP);
  if (cuota > 0) live.cuota = fmtCLP(cuota);
  live.subsidioAviso = avisoSubsidioAplica(nav.answers, data.precioM2UF);
  const reaction = nav.reactionSource ? reactionText(nav.reactionSource, nav.answers, live) : null;

  // Evento del funnel: aviso de subsidio efectivamente mostrado.
  const avisoVisible = nav.reactionSource === "tam" && live.subsidioAviso === true;
  useEffect(() => {
    if (avisoVisible) trackWizard(posthog, "wizard4_subsidio_hint_shown", { comuna: nav.answers.comuna });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avisoVisible]);

  // ── ALERTA TEMPRANA (PIEZA B2) ─────────────────────────────────────────────
  //
  // Cada regla dispara cuando sus insumos existen: UF/m² se puede calcular
  // apenas hay precio y superficie, cinco pantallas antes del resumen. No hay
  // chequeo nuevo — es `evaluarPlausibilidad` con el input PARCIAL que haya, y
  // el fail-open por regla se encarga de que lo que no tiene insumos no corra.
  //
  // Se evalúa en CADA respuesta, no en una lista de pantallas: así una
  // corrección hacia atrás (editar la superficie después del precio) también
  // dispara. En el avance normal el efecto es el de la tabla del contrato,
  // porque una regla sin insumos no devuelve nada.
  const [alerta, setAlerta] = useState<{ anomalias: Anomalia[]; seguir: () => void } | null>(null);
  // Una vez por VALOR y por REGLA: se recuerda con qué valor se mostró cada una.
  // Si el usuario cierra y no toca el dato, no vuelve; si lo edita y sigue fuera
  // de rango, el valor cambia y vuelve a avisar.
  const vistas = useRef<Partial<Record<Regla, number>>>({});

  const answerConAlerta = useCallback(
    (node: NodeId, patch?: Partial<WizardV4Answers>) => {
      const avanzar = () => w.answer(node, patch);
      if (data.ufCLP <= 0) { avanzar(); return; }
      const answersConPatch = { ...nav.answers, ...patch };
      let nuevas: Anomalia[] = [];
      try {
        nuevas = evaluarPlausibilidad(buildPlausibilidadParcial(answersConPatch, data.ufCLP))
          .filter((an) => vistas.current[an.regla] !== an.valor);
      } catch {
        nuevas = []; // fail-open: el resumen y el server siguen siendo las redes duras.
      }
      if (nuevas.length === 0) { avanzar(); return; }
      for (const an of nuevas) vistas.current[an.regla] = an.valor;
      // Blur ANTES de abrir: acá el usuario viene de tipear y en mobile el
      // teclado está abierto — sin esto el modal nace aplastado arriba.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      trackWizard(posthog, "wizard4_alerta_temprana", {
        node, reglas: nuevas.map((x) => x.regla), modalidad: nav.answers.modalidad,
      });
      setAlerta({ anomalias: nuevas, seguir: avanzar });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w.answer, nav.answers, data.ufCLP, posthog],
  );

  const screenProps: ScreenProps = {
    answers: nav.answers,
    data,
    patchAnswers: w.patchAnswers,
    answer: answerConAlerta,
    goDetour: w.goDetour,
  };

  // El resumen (documento maestro) usa contenedor propio ancho (~1160px, deja
  // ~100px de margen por lado en 1366) para que las 3 cards respiren y no hagan
  // wrap agresivo. Las pantallas de pregunta siguen angostas (foco en 1 decisión).
  const esResumen = nav.current === "resumen";

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <UnifiedNav variant="app" />

      <main className={`wizard4-main mx-auto px-4 md:px-8 ${esResumen ? "pt-6 pb-1 max-w-[1160px]" : "py-6 md:py-12 max-w-3xl"}`}>
        {/* Header: chevron + acto + progreso. Superficie card atenuada (dec. D v3).
            En el resumen (ancho, denso) se compacta el margen para caber en 1366x768. */}
        <div className={`wizard4-headcard rounded-2xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm ${esResumen ? "p-4 mb-3" : "p-5 md:p-6 mb-8"}`}>
          <div className="flex items-center gap-3 mb-4 min-w-0">
            {w.canGoBack && (
              <button
                type="button"
                onClick={w.goBack}
                aria-label="Volver a la pregunta anterior"
                className="shrink-0 -ml-1 flex items-center justify-center w-8 h-8 rounded-lg text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] hover:bg-[var(--franco-border)] transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--franco-text-tertiary)] truncate">
              {actoLabel}
            </span>
            {modLabel && (
              <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-md border-[0.5px] border-[var(--franco-border)] text-[var(--franco-text-secondary)]">
                {modLabel}
              </span>
            )}
          </div>
          <div className="h-[3px] w-full rounded-full bg-[var(--franco-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-signal-red transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>

        {/* Banner de retomar draft */}
        {w.draftPendiente && (
          <div className="mb-6 rounded-2xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)] m-0 mb-1.5">
              Análisis sin terminar
            </p>
            <p className="font-body text-sm text-[var(--franco-text)] m-0">
              Tienes un análisis a medias. ¿Lo retomas donde lo dejaste?
            </p>
            <div className="mt-3 flex items-center gap-1">
              <button
                type="button"
                onClick={w.resumeDraft}
                className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-[var(--franco-bg)] bg-[var(--franco-text)] px-4 py-2 rounded-lg hover:opacity-90 transition-opacity min-h-[44px]"
              >
                Retomar
              </button>
              <GhostBtn onClick={w.discardDraft}>Empezar de cero</GhostBtn>
            </div>
          </div>
        )}

        {/* Contenido de pantalla con transición slide+fade */}
        <div className="overflow-hidden">
          <div key={nav.current} className="wizard4-screen" data-dir={nav.dir}>
            {reaction && <FrancoReaction>{reaction}</FrancoReaction>}

            <h1 className={`wizard4-steptitle font-heading text-2xl md:text-[30px] font-bold text-[var(--franco-text)] m-0 leading-tight ${esResumen ? "mb-2" : "mb-6"}`}>
              {NODE_TITLE[nav.current]}
            </h1>

            <Screen node={nav.current} w={w} screenProps={screenProps} data={data} tier={tier} isLoggedIn={isLoggedIn} onTerminal={markTerminal} />
          </div>
        </div>
      </main>

      {/* Alerta temprana: mismo componente que el resumen, en modo "aviso".
          Avisa y deja seguir — el resumen y el server siguen bloqueando. */}
      <ModalPlausibilidad
        open={alerta !== null}
        anomalias={alerta?.anomalias ?? []}
        modo="aviso"
        onSeguir={() => {
          const seguir = alerta?.seguir;
          setAlerta(null);
          seguir?.();
        }}
        onCerrar={() => {
          setAlerta(null);
          // "Corregir": el foco vuelve al campo de ESTA pantalla.
          window.setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>(".wizard4-screen input");
            input?.focus();
            input?.select?.();
          }, 0);
        }}
      />
    </div>
  );
}

// ── Router de pantallas ──────────────────────────────────────────────────────

function Screen({
  node,
  w,
  screenProps,
  data,
  tier,
  isLoggedIn,
  onTerminal,
}: {
  node: NodeId;
  w: ReturnType<typeof useWizardV4>;
  screenProps: ScreenProps;
  data: ReturnType<typeof useWizardV4Data>;
  tier: ReturnType<typeof useWizardV4Tier>["tier"];
  isLoggedIn: boolean;
  onTerminal: () => void;
}) {
  switch (node) {
    // ── Acto 1 ──
    case "dir":
      return <DireccionScreen {...screenProps} />;
    case "tipo":
      return <TipoScreen {...screenProps} />;
    case "ent":
      return <EntregaScreen {...screenProps} />;
    case "ant":
      return <AntiguedadScreen {...screenProps} />;
    case "tam":
      return <TamanoScreen {...screenProps} />;

    // ── Acto 2 ──
    case "precio":
      return <PrecioScreen {...screenProps} />;
    case "pie":
      return <PieScreen {...screenProps} />;
    case "tasa":
      return <TasaScreen {...screenProps} />;
    case "tasaFix":
      return <TasaFixScreen {...screenProps} />;
    case "plazo":
      return <PlazoScreen {...screenProps} />;

    // ── EL INFORME (primera pantalla) ──
    case "mod":
      return <InformeScreen {...screenProps} />;

    // ── Acto 3 ──
    case "gate":
      return (
        <div className="flex flex-col gap-4">
          <p className="font-body text-[14px] text-[var(--franco-text-secondary)] m-0 leading-relaxed">
            Muchos edificios prohíben el arriendo por noche en su reglamento. Es lo primero que hay
            que confirmar: sin permiso, la renta corta no corre.
          </p>
          <div className="flex flex-col gap-3">
            <ChoiceTile onClick={() => w.answer("gate", { edificioPermiteAirbnb: "si" })}>Sí permite</ChoiceTile>
            <ChoiceTile onClick={() => w.answer("gate", { edificioPermiteAirbnb: "no" })}>No permite</ChoiceTile>
            <ChoiceTile onClick={() => w.answer("gate", { edificioPermiteAirbnb: "no_seguro" })}>No estoy seguro</ChoiceTile>
          </div>
        </div>
      );
    case "gateNo": {
      // En AMBAS el arriendo ya está respondido → la salida conserva la renta
      // larga y va directo al resumen; el copy lo reconoce. En STR puro, seguir
      // con LTR lleva a responder el arriendo (arr pendiente).
      const esBoth = w.nav.answers.modalidad === "both";
      return (
        <>
          <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
            <p className="font-body text-[14px] text-[var(--franco-text-secondary)] m-0 leading-relaxed">
              El edificio no permite arriendo por noche. Sin permiso del reglamento, el informe de
              renta corta nace muerto — Franco no te va a dejar gastar un crédito en eso.
              {esBoth && (
                <>
                  {" "}
                  <span className="text-[var(--franco-text)]">Tu informe de renta larga sigue en pie — seguimos con ese.</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start gap-3 mt-6">
            <PrimaryBtn onClick={w.gateNoSwitchToLtr}>Seguir con informe de renta larga</PrimaryBtn>
            <GhostBtn onClick={w.gateNoBack}>Me equivoqué — volver</GhostBtn>
          </div>
        </>
      );
    }
    case "arr":
      return <ArrScreen {...screenProps} />;
    case "arrFix":
      return <ArrFixScreen {...screenProps} />;
    case "adr":
      return <AdrScreen {...screenProps} />;
    case "adrFix":
      return <AdrFixScreen {...screenProps} />;

    case "resumen":
      return <ResumenScreen w={w} data={data} tier={tier} isLoggedIn={isLoggedIn} onTerminal={onTerminal} />;

    default:
      return <PlaceholderBox node={node} />;
  }
}
