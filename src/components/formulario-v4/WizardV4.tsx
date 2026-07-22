"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Wizard v4 — Shell + router de pantallas (FASE 1: scaffolding)
//
// Header con rótulo de acto (mono uppercase) + barra de progreso Signal Red +
// chevron atrás. Reacción de Franco sobre la pregunta. Transición slide+fade.
// Draft con banner de retomar. Las pantallas son placeholders grises con su
// título y los botones que dirigen la navegación (la lógica de negocio y el copy
// final llegan en Fases 2-4). NO hay lógica de negocio acá todavía.
// ─────────────────────────────────────────────────────────────────────────────

import { ChevronLeft } from "lucide-react";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { useWizardV4 } from "./useWizardV4";
import {
  ACTO_BY_NODE,
  ACTO_LABEL,
  NODE_TITLE,
  progressFor,
  reactionText,
  stepCounter,
  type NodeId,
} from "./wizardV4Nodes";

// ── Botonera reusable ────────────────────────────────────────────────────────

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono uppercase font-medium text-[12px] tracking-[0.06em] text-white px-6 py-3.5 rounded-lg bg-signal-red hover:bg-signal-red/90 transition-colors min-h-[44px] flex items-center justify-center gap-2"
    >
      {children}
    </button>
  );
}

function ChoiceBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="franco-tile-target text-left rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-5 py-4 font-body text-[15px] text-[var(--franco-text)] w-full"
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-body font-medium text-[13px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-3 py-2 min-h-[44px]"
    >
      {children}
    </button>
  );
}

/** Caja placeholder de contenido de pantalla (se reemplaza en Fases 2-3). */
function PlaceholderBox({ node }: { node: NodeId }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--franco-border-strong)] bg-[var(--franco-card)] px-5 py-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] m-0">
        Pantalla · {node}
      </p>
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)] mt-2 mb-0">
        Contenido e inputs reales en Fases 2–4.
      </p>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export function WizardV4({ resume }: { resume: boolean }) {
  const w = useWizardV4({ resume });
  const { nav } = w;
  const acto = ACTO_BY_NODE[nav.current];
  const actoLabel = ACTO_LABEL[acto];
  const progress = progressFor(nav.current, nav.answers);
  const { step, total } = stepCounter(nav.current, nav.answers);
  const reaction = nav.reactionSource ? reactionText(nav.reactionSource, nav.answers) : null;

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      <UnifiedNav variant="app" />

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* Header: chevron + acto + progreso. Superficie card atenuada (dec. D v3). */}
        <div className="mb-8 rounded-2xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] shadow-sm p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
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
            {nav.current !== "resumen" && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-muted)]">
                Paso {step} de {total}
              </span>
            )}
          </div>
          {/* Barra de progreso Signal Red */}
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
            {/* Reacción de Franco: sobre la pregunta, borde izq Signal Red, label mono */}
            {reaction && (
              <div className="mb-5 pl-3 border-l-2 border-signal-red">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-signal-red m-0 mb-1">
                  Franco
                </p>
                <p className="font-body text-[14px] italic text-[var(--franco-text-secondary)] m-0 leading-snug">
                  {reaction}
                </p>
              </div>
            )}

            <h1 className="font-heading text-2xl md:text-[30px] font-bold text-[var(--franco-text)] m-0 mb-6 leading-tight">
              {NODE_TITLE[nav.current]}
            </h1>

            <Screen node={nav.current} w={w} />
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Router de pantallas (placeholders navegables) ────────────────────────────

function Screen({ node, w }: { node: NodeId; w: ReturnType<typeof useWizardV4> }) {
  switch (node) {
    case "tipo":
      return (
        <div className="flex flex-col gap-3">
          <ChoiceBtn onClick={() => w.answer("tipo", { tipoPropiedad: "usado" })}>Usado</ChoiceBtn>
          <ChoiceBtn onClick={() => w.answer("tipo", { tipoPropiedad: "nuevo" })}>Nuevo (en verde / entrega futura)</ChoiceBtn>
        </div>
      );

    case "tasa":
      return (
        <>
          <PlaceholderBox node={node} />
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <PrimaryBtn onClick={() => w.answer("tasa", { tasaModo: "estimada" })}>Usar estimación →</PrimaryBtn>
            <GhostBtn onClick={() => w.goDetour("tasaFix", { tasaModo: "preaprobada" })}>
              Tengo una tasa pre-aprobada distinta
            </GhostBtn>
          </div>
        </>
      );

    case "mod":
      return (
        <div className="flex flex-col gap-3">
          <ChoiceBtn onClick={() => w.answer("mod", { modalidad: "ltr" })}>
            Informe renta larga
          </ChoiceBtn>
          <ChoiceBtn onClick={() => w.answer("mod", { modalidad: "str" })}>
            Informe renta corta
          </ChoiceBtn>
          <button
            type="button"
            onClick={() => w.answer("mod", { modalidad: "both" })}
            className="franco-tile-target text-left rounded-xl border-[1.5px] border-signal-red bg-[var(--franco-card)] px-5 py-4 font-body text-[15px] text-[var(--franco-text)] w-full"
          >
            Informe comparativo
          </button>
        </div>
      );

    case "gate":
      return (
        <div className="flex flex-col gap-3">
          <ChoiceBtn onClick={() => w.answer("gate", { edificioPermiteAirbnb: "si" })}>Sí permite</ChoiceBtn>
          <ChoiceBtn onClick={() => w.answer("gate", { edificioPermiteAirbnb: "no_seguro" })}>No estoy seguro</ChoiceBtn>
          <ChoiceBtn onClick={() => w.answer("gate", { edificioPermiteAirbnb: "no" })}>No permite</ChoiceBtn>
        </div>
      );

    case "gateNo":
      return (
        <>
          <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
            <p className="font-body text-[14px] text-[var(--franco-text-secondary)] m-0 leading-relaxed">
              El edificio no permite arriendo por noche. Sin permiso del reglamento, el informe de
              renta corta nace muerto — Franco no te va a dejar gastar un crédito en eso.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start gap-3 mt-6">
            <PrimaryBtn onClick={w.gateNoSwitchToLtr}>Seguir con informe de renta larga</PrimaryBtn>
            <GhostBtn onClick={w.gateNoBack}>Me equivoqué — volver</GhostBtn>
          </div>
        </>
      );

    case "arr":
      return (
        <>
          <PlaceholderBox node={node} />
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <PrimaryBtn onClick={() => w.answer("arr", { arrModo: "estimacion" })}>Usar estimación →</PrimaryBtn>
            <GhostBtn onClick={() => w.goDetour("arrFix", { arrModo: "corregir" })}>Corregir</GhostBtn>
          </div>
        </>
      );

    case "adr":
      return (
        <>
          <PlaceholderBox node={node} />
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <PrimaryBtn onClick={() => w.answer("adr", { adrModo: "estimacion" })}>Usar estimación →</PrimaryBtn>
            <GhostBtn onClick={() => w.goDetour("adrFix", { adrModo: "corregir" })}>Corregir</GhostBtn>
          </div>
        </>
      );

    case "tasaFix":
    case "arrFix":
    case "adrFix":
      return (
        <>
          <PlaceholderBox node={node} />
          <div className="mt-6">
            <PrimaryBtn onClick={() => w.answer(node)}>Guardar y continuar →</PrimaryBtn>
          </div>
        </>
      );

    case "resumen":
      return <ResumenPlaceholder w={w} />;

    // Pantallas lineales genéricas (dir, ent, ant, tam, precio, pie, plazo)
    default:
      return (
        <>
          <PlaceholderBox node={node} />
          <div className="mt-6">
            <PrimaryBtn onClick={() => w.answer(node)}>Continuar →</PrimaryBtn>
          </div>
        </>
      );
  }
}

// ── Resumen (placeholder de FASE 1: demuestra edición + invalidación de rama) ──

function ResumenPlaceholder({ w }: { w: ReturnType<typeof useWizardV4> }) {
  const { answers } = w.nav;
  const rows: Array<{ label: string; value: string; edit: NodeId }> = [
    { label: "Tipo", value: answers.tipoPropiedad ?? "—", edit: "tipo" },
    { label: "Modalidad", value: answers.modalidad ?? "—", edit: "mod" },
  ];
  if (answers.modalidad === "str" || answers.modalidad === "both") {
    rows.push({ label: "Edificio permite Airbnb", value: answers.edificioPermiteAirbnb ?? "—", edit: "gate" });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)] m-0">
        Zonas del resumen (informe · respuestas · supuestos) en Fase 4. Acá, la
        mecánica de edición con retorno directo e invalidación de rama.
      </p>

      <div className="rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
        <dl className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.edit}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-dashed border-[var(--franco-border)] last:border-b-0"
            >
              <dt className="font-body text-[13px] text-[var(--franco-text-secondary)]">{r.label}</dt>
              <dd className="flex items-center gap-3 m-0">
                <span className="font-mono text-[13px] text-[var(--franco-text)]">{r.value}</span>
                <button
                  type="button"
                  onClick={() => w.editField(r.edit)}
                  className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] underline underline-offset-4 decoration-dotted"
                >
                  Editar →
                </button>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="pt-4 mt-2 border-t border-[var(--franco-border)]">
        <PlaceholderBox node="resumen" />
        <p className="font-body text-[12px] text-[var(--franco-text-muted)] mt-4 mb-0">
          El botón «✦ Generar análisis» tier-aware (crédito / desbloquear / crear cuenta) llega en Fase 4.
        </p>
      </div>
    </div>
  );
}
