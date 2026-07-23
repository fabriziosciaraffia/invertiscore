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

import { ChevronLeft } from "lucide-react";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { useWizardV4 } from "./useWizardV4";
import { useWizardV4Data } from "./useWizardV4Data";
import { useWizardV4Tier } from "./useWizardV4Tier";
import { ResumenScreen } from "./screenResumen";
import {
  ACTO_BY_NODE,
  ACTO_LABEL,
  NODE_TITLE,
  reactionText,
  type NodeId,
  type ReactionLive,
} from "./wizardV4Nodes";
import { cuotaCLP, fmtCLP, parseNum } from "./derive";
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

export function WizardV4({ resume }: { resume: boolean }) {
  const w = useWizardV4({ resume });
  const { nav } = w;
  const data = useWizardV4Data(nav.answers);
  const { tier, isLoggedIn } = useWizardV4Tier();

  const acto = ACTO_BY_NODE[nav.current];
  const actoLabel = ACTO_LABEL[acto];
  const progress = w.progress;

  // Reacción de Franco con datos reales (comparables, UF del día, cuota).
  const live: ReactionLive = {};
  if (data.comparablesCount > 0) live.comparables = data.comparablesCount;
  const puf = parseNum(nav.answers.precio ?? "");
  if (puf > 0 && data.ufCLP > 0) live.precioCLP = fmtCLP(puf * data.ufCLP);
  const cuota = cuotaCLP(nav.answers, data.ufCLP);
  if (cuota > 0) live.cuota = fmtCLP(cuota);
  const reaction = nav.reactionSource ? reactionText(nav.reactionSource, nav.answers, live) : null;

  const screenProps: ScreenProps = {
    answers: nav.answers,
    data,
    patchAnswers: w.patchAnswers,
    answer: w.answer,
    goDetour: w.goDetour,
  };

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <UnifiedNav variant="app" />

      <main className="wizard4-main max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-12">
        {/* Header: chevron + acto + progreso. Superficie card atenuada (dec. D v3). */}
        <div className="wizard4-headcard mb-8 rounded-2xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm p-5 md:p-6">
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

            <h1 className="wizard4-steptitle font-heading text-2xl md:text-[30px] font-bold text-[var(--franco-text)] m-0 mb-6 leading-tight">
              {NODE_TITLE[nav.current]}
            </h1>

            <Screen node={nav.current} w={w} screenProps={screenProps} data={data} tier={tier} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </main>
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
}: {
  node: NodeId;
  w: ReturnType<typeof useWizardV4>;
  screenProps: ScreenProps;
  data: ReturnType<typeof useWizardV4Data>;
  tier: ReturnType<typeof useWizardV4Tier>["tier"];
  isLoggedIn: boolean;
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
      return <ResumenScreen w={w} data={data} tier={tier} isLoggedIn={isLoggedIn} />;

    default:
      return <PlaceholderBox node={node} />;
  }
}
