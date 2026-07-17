"use client";

// ─── Pirámide diferencial AMBAS (D3) + Drawers puente (D4) ───────────────────
// Forma canon LTR/STR (PiramideHallazgos): #1 dominante ancho completo · nivel medio de 2
// en fila · base de chips recesivos. La jerarquía se VE (tamaño, no color). Los educativos
// (capital, patrimonio) caen en la base por el orden. Anatomía de card canon
// (GenericFindingCard): kicker · titular serif · KPI mono · ksub · cuerpo · lado + procedencia
// + "Ver cómo se calcula →". Cada card abre su drawer puente: la aritmética del delta
// (planteada antes de la resta) + links al hijo. Cero verde: lado favorable en Ink.

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { FindingComparativa, FindingLado } from "@/lib/comparativa-findings";

interface Props {
  findings: FindingComparativa[];
  ltrId: string;
  strId: string;
}

function ladoMeta(lado: FindingLado): { color: string; label: string } {
  if (lado === "ltr") return { color: "var(--franco-text)", label: "A favor de renta larga" };
  if (lado === "str") return { color: "var(--franco-text)", label: "A favor de renta corta" };
  return { color: "var(--franco-text-tertiary)", label: "Educativo" };
}

// Columnas de la base (nivel 3) según cuántos chips quedan. Clases estáticas (Tailwind JIT).
function colsNivel3(n: number): string {
  if (n >= 3) return "md:grid-cols-3";
  if (n === 2) return "md:grid-cols-2";
  return "";
}

export function PiramideComparativa({ findings, ltrId, strId }: Props) {
  // A7: índice (no el finding) para derivar prev/next desde el ORDEN de la pirámide
  // (fuente única, mismo patrón que AnalysisDrawer.sequence).
  const [puenteIdx, setPuenteIdx] = useState<number | null>(null);
  if (findings.length === 0) return null;

  const nivel1 = findings[0];
  const nivel2 = findings.slice(1, 3);
  const nivel3 = findings.slice(3);

  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-3 mb-4">
        <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)]">
          LO QUE DECIDE
        </p>
        <h2 className="font-heading text-[19px] sm:text-[22px] font-bold text-[var(--franco-text)] leading-tight">
          Dónde se juega la diferencia
        </h2>
        <span className="font-body ml-auto shrink-0 text-[12px] text-[var(--franco-text-tertiary)]">
          {findings.length} factores
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Nivel 1 — dominante, ancho completo */}
        <FindingCard finding={nivel1} nivel={1} onOpen={() => setPuenteIdx(0)} />

        {/* Nivel 2 — los dos siguientes, en fila */}
        {nivel2.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nivel2.map((f, i) => (
              <FindingCard key={f.id} finding={f} nivel={2} onOpen={() => setPuenteIdx(1 + i)} />
            ))}
          </div>
        )}

        {/* Nivel 3 — base de chips recesivos (educativos + condicionales) */}
        {nivel3.length > 0 && (
          <div className={`grid grid-cols-1 ${colsNivel3(nivel3.length)} gap-3`}>
            {nivel3.map((f, i) => (
              <FindingCard key={f.id} finding={f} nivel={3} onOpen={() => setPuenteIdx(3 + i)} />
            ))}
          </div>
        )}
      </div>

      <DrawerPuente
        findings={findings}
        idx={puenteIdx}
        ltrId={ltrId}
        strId={strId}
        onClose={() => setPuenteIdx(null)}
        onNavigate={setPuenteIdx}
      />
    </div>
  );
}

function FindingCard({ finding: f, nivel, onOpen }: { finding: FindingComparativa; nivel: 1 | 2 | 3; onOpen: () => void }) {
  const lado = ladoMeta(f.lado);
  const chip = nivel === 3;
  const pad = nivel === 1 ? "p-6 sm:p-7" : nivel === 2 ? "p-5" : "p-4";
  const titleSize = nivel === 1 ? "text-[21px] sm:text-[24px]" : nivel === 2 ? "text-[17px]" : "text-[14px]";
  const kpiSize = nivel === 1 ? "text-[34px] sm:text-[40px]" : nivel === 2 ? "text-[26px]" : "text-[20px]";
  const bodySize = nivel === 1 ? "text-[14px]" : "text-[12.5px]";
  const border = nivel === 1 ? "var(--franco-text-tertiary)" : "var(--franco-border)";
  const bg = chip ? "color-mix(in srgb, var(--franco-text) 3%, var(--franco-card))" : "var(--franco-card)";
  const kick = nivel === 1 ? `Lo más decisivo · ${f.kicker.toLowerCase()}` : f.kicker;

  // Nivel 3: chip recesivo, toda la card es el trigger (sin footer). Niveles 1-2: footer con link.
  return (
    <div
      className={`rounded-2xl ${pad} ${chip ? "cursor-pointer transition-shadow hover:shadow-sm" : ""}`}
      style={{ background: bg, border: `${nivel === 1 ? "0.75px" : "0.5px"} solid ${border}` }}
      {...(chip
        ? {
            role: "button" as const,
            tabIndex: 0,
            onClick: onOpen,
            onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } },
          }
        : {})}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono uppercase tracking-[0.07em]" style={{ fontSize: chip ? 9 : 10, color: "var(--franco-text-tertiary)" }}>
            {kick}
          </div>
          <div
            className={`font-heading font-bold leading-[1.2] mt-2 ${titleSize}`}
            style={{ color: chip ? "var(--franco-text-secondary)" : "var(--franco-text)" }}
          >
            {f.titular}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 shrink-0 pt-1">
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: lado.color }} aria-hidden />
          <span className="font-mono uppercase tracking-[0.06em] whitespace-nowrap hidden sm:inline" style={{ fontSize: 9, color: "var(--franco-text-tertiary)" }}>
            {lado.label}
          </span>
        </span>
      </div>

      <div className={`font-mono font-bold leading-none mt-3.5 ${kpiSize}`} style={{ color: f.kpiRed ? "var(--signal-red)" : chip ? "var(--franco-text-secondary)" : "var(--franco-text)" }}>
        {f.kpi}
      </div>
      <div className="font-mono uppercase tracking-[0.05em] mt-2" style={{ fontSize: chip ? 9 : 10, color: "var(--franco-text-tertiary)" }}>
        {f.ksub}
      </div>

      <p className={`font-body leading-[1.55] mt-3.5 ${bodySize}`} style={{ color: "var(--franco-text-secondary)" }}>
        {f.cuerpo}
      </p>

      {!chip && (
        <div className="mt-4 pt-3.5 flex items-center justify-between gap-3" style={{ borderTop: "0.5px solid var(--franco-border)" }}>
          <span className="font-body min-w-0 text-[11px]" style={{ color: "var(--franco-text-muted)" }}>
            {f.procedencia}
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="font-mono uppercase tracking-[0.06em] shrink-0 transition-colors hover:text-[var(--franco-text-secondary)]"
            style={{ fontSize: 10, color: "var(--franco-text-tertiary)" }}
          >
            Ver cómo se calcula →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Drawer puente (D4) · planta qué se compara → aritmética → links al hijo ──
// A7: navegación prev/next entre drawers desde el ORDEN de la pirámide (fuente única),
// patrón AnalysisDrawer (sequence + flechas + ArrowLeft/Right). Label humano = kicker.
function DrawerPuente({ findings, idx, ltrId, strId, onClose, onNavigate }: { findings: FindingComparativa[]; idx: number | null; ltrId: string; strId: string; onClose: () => void; onNavigate: (i: number) => void }) {
  const prevIdx = idx != null && idx > 0 ? idx - 1 : null;
  const nextIdx = idx != null && idx < findings.length - 1 ? idx + 1 : null;
  useEffect(() => {
    if (idx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && nextIdx != null) onNavigate(nextIdx);
      if (e.key === "ArrowLeft" && prevIdx != null) onNavigate(prevIdx);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [idx, nextIdx, prevIdx, onClose, onNavigate]);
  if (idx == null) return null;
  const f = findings[idx];
  if (!f) return null;

  const hrefHijo = (l: { hijo: "ltr" | "str"; seccion: string }) =>
    l.hijo === "ltr" ? `/analisis/${ltrId}#${l.seccion}` : `/analisis/renta-corta/${strId}#${l.seccion}`;

  return (
    <>
      {/* Overlay + panel homologados al canon AnalysisDrawer (R3): desktop panel derecho
          75/70/min(960,65)vw, mobile bottom-sheet 85vh. */}
      <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn" />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-50 overflow-y-auto
          md:top-0 md:right-0 md:bottom-0 md:w-[75vw] lg:w-[70vw] xl:w-[min(960px,65vw)] md:border-l md:border-[var(--franco-border)] md:animate-slideInRight
          max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[85vh] max-md:rounded-t-2xl max-md:border-t max-md:border-[var(--franco-border)] max-md:animate-slideInUp"
        style={{ background: "var(--franco-card)" }}
      >
        <div className="sticky top-0 z-10 px-5 md:px-6 py-5" style={{ background: "var(--franco-card)", borderBottom: "0.5px solid var(--franco-border)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-1.5">
                {f.kicker}
              </p>
              <h2 className="font-heading text-[20px] md:text-[24px] font-bold text-[var(--franco-text)] leading-tight">{f.puente.titulo}</h2>
            </div>
            <button type="button" onClick={onClose} className="text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors" aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-5 md:px-6 py-5">
          {/* Lead: planta QUÉ se compara antes de la aritmética (C2) */}
          <p className="font-body text-[13.5px] leading-[1.6] mb-4" style={{ color: "var(--franco-text-secondary)" }}>
            {f.puente.lead}
          </p>

          {/* Aritmética del delta. Si ninguna fila tiene lado LARGA, es una derivación de una
              sola columna (C5b): sin columnas vacías con guiones. */}
          {f.puente.filas.every((fila) => fila.ltr == null) ? (
            <div className="rounded-xl border border-[var(--franco-border)] overflow-hidden mb-4">
              {f.puente.filas.map((fila, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-3 px-4 py-3"
                  style={{ borderTop: i === 0 ? "none" : "0.5px solid var(--franco-border)", background: "var(--franco-bg)" }}
                >
                  <span className="font-body text-[12.5px] text-[var(--franco-text)]">{fila.label}</span>
                  <span className="font-mono text-[13px] font-medium shrink-0" style={{ color: "var(--franco-text)" }}>{fila.str ?? "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--franco-border)] overflow-hidden mb-4">
              <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-px" style={{ background: "var(--franco-border)" }}>
                <Cell head>Concepto</Cell>
                <Cell head right>Larga</Cell>
                <Cell head right>Corta</Cell>
                {f.puente.filas.map((fila, i) => (
                  <FilaRow key={i} label={fila.label} ltr={fila.ltr} str={fila.str} delta={fila.delta} />
                ))}
              </div>
            </div>
          )}

          {f.puente.nota && (
            <p className="font-body text-[13px] leading-[1.55] mb-5" style={{ color: "var(--franco-text-secondary)" }}>
              {f.puente.nota}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {f.puente.links.map((l, i) => (
              <Link
                key={i}
                href={hrefHijo(l)}
                className="inline-flex items-center justify-between gap-2 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-bg)] px-4 py-3 hover:border-[var(--franco-text-secondary)] transition-colors"
              >
                <span className="font-body text-[13px] font-medium text-[var(--franco-text)]">{l.label}</span>
                <span className="font-mono text-[11px] uppercase tracking-[1px] text-signal-red">
                  {l.hijo === "ltr" ? "Renta larga" : "Renta corta"} →
                </span>
              </Link>
            ))}
          </div>

          {/* A7 · Navegación prev/next entre drawers (orden de la pirámide) */}
          <div className="flex justify-between gap-2 mt-6 pt-4 border-t border-[var(--franco-border)]">
            {prevIdx != null ? (
              <button
                type="button"
                onClick={() => onNavigate(prevIdx)}
                className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
              >
                ← {findings[prevIdx].kicker}
              </button>
            ) : (
              <span />
            )}
            {nextIdx != null ? (
              <button
                type="button"
                onClick={() => onNavigate(nextIdx)}
                className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
              >
                {findings[nextIdx].kicker} →
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] px-2 py-1.5"
              >
                Cerrar ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Cell({ children, head, right }: { children: React.ReactNode; head?: boolean; right?: boolean }) {
  return (
    <div
      className={`px-3 py-2.5 ${right ? "text-right" : ""} ${head ? "font-mono text-[9px] uppercase tracking-[1.5px]" : ""}`}
      style={{ background: "var(--franco-bg)", color: head ? "var(--franco-text-tertiary)" : "var(--franco-text)" }}
    >
      {children}
    </div>
  );
}

function FilaRow({ label, ltr, str, delta }: { label: string; ltr?: string; str?: string; delta?: string }) {
  return (
    <>
      <div className="px-3 py-2.5" style={{ background: "var(--franco-bg)" }}>
        <span className="font-body text-[12.5px] text-[var(--franco-text)]">{label}</span>
        {delta && <span className="font-mono text-[10px] ml-2" style={{ color: "var(--franco-text-tertiary)" }}>Δ {delta}</span>}
      </div>
      <div className="px-3 py-2.5 text-right font-mono text-[12.5px]" style={{ background: "var(--franco-bg)", color: "var(--franco-text)" }}>{ltr ?? "—"}</div>
      <div className="px-3 py-2.5 text-right font-mono text-[12.5px]" style={{ background: "var(--franco-bg)", color: "var(--franco-text)" }}>{str ?? "—"}</div>
    </>
  );
}
