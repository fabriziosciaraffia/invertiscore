"use client";

// Wizard v4 — Pantallas del Acto 1 (QUÉ COMPRAS).
// tipo, entrega, antigüedad, tamaño. La dirección vive en `screenEntrada.tsx`
// (es la pantalla de entrada, no un paso más del acto).

import type { WizardV4Answers, NodeId, Antiguedad } from "./wizardV4Nodes";
import { DEC } from "./wizardV4Nodes";
import type { WizardV4Data } from "./useWizardV4Data";
import { ChoiceTile, FieldLabel, FuenteLine, PrimaryBtn, Segmented } from "./ui";
import { NumericInput } from "./NumericInput";
import { leerNum } from "./derive";
import { escalaSuperficie } from "./avisoEscala";

export interface ScreenProps {
  answers: WizardV4Answers;
  data: WizardV4Data;
  patchAnswers: (p: Partial<WizardV4Answers>) => void;
  answer: (node: NodeId, patch?: Partial<WizardV4Answers>) => void;
  goDetour: (fix: NodeId, patch?: Partial<WizardV4Answers>) => void;
}

// La pantalla de `dir` se mudó a `screenEntrada.tsx` (19-ago-2026): dejó de ser
// "un campo de dirección" y pasó a ser la portada del producto, con sus tres
// estados. Este archivo se queda con el resto del Acto 1.

// ── tipo ─────────────────────────────────────────────────────────────────────

export function TipoScreen({ answers, answer }: ScreenProps) {
  return (
    <div className="flex flex-col gap-3">
      <ChoiceTile
        selected={answers.tipoPropiedad === "usado"}
        onClick={() => answer("tipo", { tipoPropiedad: "usado" })}
        ariaLabel="Usado. Ya tuvo dueño — se vende por particular o corredor."
      >
        <span className="font-medium">Usado</span>
        <span className="block font-body text-[13px] text-[var(--franco-text-secondary)] mt-0.5">
          Ya tuvo dueño — se vende por particular o corredor.
        </span>
      </ChoiceTile>
      <ChoiceTile
        selected={answers.tipoPropiedad === "nuevo"}
        onClick={() => answer("tipo", { tipoPropiedad: "nuevo" })}
        ariaLabel="Nuevo. Primera venta directa de la inmobiliaria, incluye entrega futura o en verde."
      >
        <span className="font-medium">Nuevo</span>
        <span className="block font-body text-[13px] text-[var(--franco-text-secondary)] mt-0.5">
          Primera venta directa de la inmobiliaria (incluye entrega futura / en verde).
        </span>
      </ChoiceTile>
    </div>
  );
}

// ── ent (solo nuevo) ──────────────────────────────────────────────────────────

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function EntregaScreen({ answers, patchAnswers, answer }: ScreenProps) {
  const estado = answers.estadoVenta;
  const futura = estado === "futura";
  const puedeSeguir = estado === "inmediata" || (futura && !!answers.fechaEntregaMes && !!answers.fechaEntregaAnio);
  const anioActual = 2026;
  const anios = [anioActual, anioActual + 1, anioActual + 2, anioActual + 3];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <ChoiceTile
          selected={estado === "inmediata"}
          onClick={() => patchAnswers({ estadoVenta: "inmediata" })}
          ariaLabel="Entrega inmediata. Ya construido, listo para escriturar."
        >
          <span className="font-medium">Entrega inmediata</span>
          <span className="block font-body text-[13px] text-[var(--franco-text-secondary)] mt-0.5">
            Ya construido, listo para escriturar.
          </span>
        </ChoiceTile>
        <ChoiceTile
          selected={futura}
          onClick={() => patchAnswers({ estadoVenta: "futura" })}
          ariaLabel="Entrega futura, en verde o en blanco. En construcción, se entrega más adelante."
        >
          <span className="font-medium">Entrega futura (en verde / blanco)</span>
          <span className="block font-body text-[13px] text-[var(--franco-text-secondary)] mt-0.5">
            En construcción — se entrega más adelante.
          </span>
        </ChoiceTile>
      </div>

      {futura && (
        <div className="flex items-end gap-3">
          <div>
            <FieldLabel>Mes estimado</FieldLabel>
            <select
              value={answers.fechaEntregaMes ?? ""}
              onChange={(e) => patchAnswers({ fechaEntregaMes: e.target.value })}
              className="h-11 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[15px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:outline-none appearance-none"
            >
              <option value="">Mes…</option>
              {MESES.map((m, i) => (
                <option key={m} value={String(i + 1)}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Año</FieldLabel>
            <select
              value={answers.fechaEntregaAnio ?? ""}
              onChange={(e) => patchAnswers({ fechaEntregaAnio: e.target.value })}
              className="h-11 rounded-lg border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] px-3 text-[15px] font-mono text-[var(--franco-text)] focus:border-signal-red focus:outline-none appearance-none"
            >
              <option value="">Año…</option>
              {anios.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("ent")} disabled={!puedeSeguir}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── ant (solo usado) ────────────────────────────────────────────────────────

const ANTIGUEDADES: Array<{ value: Antiguedad; label: string }> = [
  { value: "0-2", label: "0–2 años" },
  { value: "3-5", label: "3–5 años" },
  { value: "6-10", label: "6–10 años" },
  { value: "11-20", label: "11–20 años" },
  { value: "20+", label: "20+ años" },
];

export function AntiguedadScreen({ answer }: ScreenProps) {
  return (
    <div className="flex flex-col gap-3">
      {ANTIGUEDADES.map((a) => (
        <ChoiceTile key={a.value} onClick={() => answer("ant", { antiguedad: a.value })}>
          {a.label}
        </ChoiceTile>
      ))}
    </div>
  );
}

// ── tam ──────────────────────────────────────────────────────────────────────

export function TamanoScreen({ answers, patchAnswers, answer }: ScreenProps) {
  const sup = leerNum(answers.superficieUtil, DEC.superficie);
  const dorm = answers.esStudio ? "0" : answers.dormitorios;
  const puedeSeguir = sup > 0 && !!dorm && !!answers.banos;

  return (
    <div className="flex flex-col gap-5">
      <NumericInput
        label="Superficie útil"
        tooltip="Metros cuadrados al interior del depto, sin terrazas ni espacios comunes."
        value={answers.superficieUtil ?? ""}
        onChange={(v) => patchAnswers({ superficieUtil: v })}
        decimales={DEC.superficie}
        placeholder="50"
        sufijo="m²"
        ecoSufijo=" m²"
        escala={escalaSuperficie}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Dormitorios</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => patchAnswers({ esStudio: true, dormitorios: "0" })}
              className={`font-mono text-[13px] px-3 h-10 rounded-lg border-[0.5px] transition-colors ${
                answers.esStudio
                  ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]"
                  : "franco-tile-target bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[var(--franco-border)]"
              }`}
            >
              Studio
            </button>
            {["1", "2", "3", "4"].map((d) => {
              const active = !answers.esStudio && answers.dormitorios === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => patchAnswers({ esStudio: false, dormitorios: d })}
                  className={`font-mono text-[13px] w-10 h-10 rounded-lg border-[0.5px] transition-colors ${
                    active
                      ? "bg-[var(--franco-text)] text-[var(--franco-bg)] border-[var(--franco-text)]"
                      : "franco-tile-target bg-[var(--franco-card)] text-[var(--franco-text-secondary)] border-[var(--franco-border)]"
                  }`}
                >
                  {d === "4" ? "4+" : d}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel>Baños</FieldLabel>
          <Segmented
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3+" },
            ]}
            value={answers.banos}
            onChange={(v) => patchAnswers({ banos: v })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumericInput
          label="Estacionamientos"
          tooltip="Cuántos estacionamientos incluye. 0 si no tiene."
          value={answers.estacionamientos ?? ""}
          onChange={(v) => patchAnswers({ estacionamientos: v })}
          decimales={DEC.estacionamientos}
          placeholder="0"
          formatEco={(v) => `${v} ${v === 1 ? "estacionamiento" : "estacionamientos"}`}
        />
        <NumericInput
          label="Bodegas"
          tooltip="Cuántas bodegas incluye. 0 si no tiene."
          value={answers.bodegas ?? ""}
          onChange={(v) => patchAnswers({ bodegas: v })}
          decimales={DEC.bodegas}
          placeholder="0"
          formatEco={(v) => `${v} ${v === 1 ? "bodega" : "bodegas"}`}
        />
      </div>

      <FuenteLine>Estac. y bodega afectan precio y arriendo — déjalos en 0 si no aplican.</FuenteLine>

      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("tam")} disabled={!puedeSeguir}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}
