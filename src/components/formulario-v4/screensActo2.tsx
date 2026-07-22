"use client";

// Wizard v4 — Pantallas del Acto 2 (CÓMO LO FINANCIAS).
// precio (dual UF/CLP, SIN prefill), pie (toggle $/UF/% + equivalencias), tasa +
// tasaFix (estimación con corrección inline), plazo (segmented).

import { useState } from "react";
import type { ScreenProps } from "./screensActo1";
import type { PieUnidad } from "./wizardV4Nodes";
import { ChoiceTile, FieldLabel, FuenteLine, PrimaryBtn, GhostBtn, Segmented, TextInput } from "./ui";
import { fmtCLP, fmtUF, parseNum, parseDecimalLocale, piePct, pieUF, pieCLP } from "./derive";

const numOk = (v: string) => v === "" || /^[\d.]*$/.test(v);
const decOk = (v: string) => v === "" || /^\d*[,]?\d*$/.test(v);

// ── precio ────────────────────────────────────────────────────────────────────

export function PrecioScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const [unidad, setUnidad] = useState<"uf" | "clp">("uf");
  const ufActual = parseNum(answers.precio ?? "");
  const [raw, setRaw] = useState<string>(() =>
    ufActual > 0 ? String(unidad === "uf" ? ufActual : Math.round(ufActual * data.ufCLP)) : "",
  );

  const onRaw = (v: string) => {
    if (!numOk(v)) return;
    setRaw(v);
    const parsed = parseNum(v);
    const uf = unidad === "uf" ? parsed : data.ufCLP > 0 ? Math.round(parsed / data.ufCLP) : 0;
    patchAnswers({ precio: uf > 0 ? String(uf) : "" });
  };

  const onToggle = (u: "uf" | "clp") => {
    const uf = parseNum(answers.precio ?? "");
    setRaw(uf > 0 ? String(u === "uf" ? uf : Math.round(uf * data.ufCLP)) : "");
    setUnidad(u);
  };

  const uf = parseNum(answers.precio ?? "");
  const equivalencia =
    uf > 0 ? (unidad === "uf" ? `= ${fmtCLP(uf * data.ufCLP)}` : `= ${fmtUF(uf)}`) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel tooltip="El precio que pide el vendedor. Franco no lo prellena — lo evalúa contra el mercado.">
          Precio pedido
        </FieldLabel>
        <Segmented
          options={[
            { value: "uf", label: "UF" },
            { value: "clp", label: "$" },
          ]}
          value={unidad}
          onChange={onToggle}
        />
      </div>

      <TextInput
        value={raw}
        onChange={onRaw}
        placeholder={unidad === "uf" ? "3.200" : "124.000.000"}
        inputMode="numeric"
        mono
        strong
        suffix={unidad === "uf" ? "UF" : "$"}
      />

      {equivalencia && (
        <p className="font-mono text-[13px] text-[var(--franco-text-secondary)] m-0">{equivalencia}</p>
      )}

      <FuenteLine>Este número lo pones tú — Franco no lo sugiere, lo evalúa.</FuenteLine>

      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("precio")} disabled={uf <= 0}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── pie ─────────────────────────────────────────────────────────────────────

const PIE_UNITS: Array<{ value: PieUnidad; label: string }> = [
  { value: "pct", label: "%" },
  { value: "uf", label: "UF" },
  { value: "clp", label: "$" },
];

export function PieScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const unidad = answers.pieUnidad ?? "pct";
  const monto = answers.pieMonto ?? "";
  const validador = unidad === "pct" ? decOk : numOk;

  const pct = piePct(answers, data.ufCLP);
  const uf = pieUF(answers, data.ufCLP);
  const clp = pieCLP(answers, data.ufCLP);

  // Equivalencias en vivo: las otras dos unidades respecto a la que escribe.
  const equiv: string[] = [];
  if (pct > 0) {
    if (unidad !== "uf") equiv.push(fmtUF(uf));
    if (unidad !== "clp") equiv.push(fmtCLP(clp));
    if (unidad !== "pct") equiv.push(`${Math.round(pct)}% del precio`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel tooltip="Lo que pagas al contado al firmar. El resto se financia con crédito hipotecario.">
          Pie
        </FieldLabel>
        <Segmented
          options={PIE_UNITS}
          value={unidad}
          onChange={(u) => patchAnswers({ pieUnidad: u, pieMonto: "" })}
        />
      </div>

      <TextInput
        value={monto}
        onChange={(v) => { if (validador(v)) patchAnswers({ pieMonto: v }); }}
        placeholder={unidad === "pct" ? "20" : unidad === "uf" ? "640" : "24.800.000"}
        inputMode={unidad === "pct" ? "decimal" : "numeric"}
        mono
        suffix={unidad === "pct" ? "%" : unidad === "uf" ? "UF" : "$"}
      />

      {equiv.length > 0 && (
        <p className="font-mono text-[13px] text-[var(--franco-text-secondary)] m-0">= {equiv.join(" · ")}</p>
      )}

      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("pie")} disabled={pct <= 0}>
          Continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── tasa ──────────────────────────────────────────────────────────────────────

function tasaStr(t: number): string {
  return t.toFixed(2).replace(".", ",");
}

export function TasaScreen({ data, answer, goDetour }: ScreenProps) {
  const t = data.tasaMercado;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border-[0.5px] border-[var(--franco-border)] bg-[var(--franco-card)] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--franco-text-muted)] m-0 mb-1">
          Tasa estimada
        </p>
        <p className="font-mono text-[28px] font-bold text-[var(--franco-text)] m-0 leading-none">
          {tasaStr(t)}%
        </p>
        <FuenteLine>tasa de mercado vigente hoy</FuenteLine>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <PrimaryBtn onClick={() => answer("tasa", { tasaModo: "estimada", tasaInteres: tasaStr(t) })}>
          Usar estimación →
        </PrimaryBtn>
        <GhostBtn onClick={() => goDetour("tasaFix", { tasaModo: "preaprobada" })}>
          Tengo una tasa pre-aprobada distinta
        </GhostBtn>
      </div>
    </div>
  );
}

export function TasaFixScreen({ answers, data, patchAnswers, answer }: ScreenProps) {
  const monto = answers.tasaInteres && parseDecimalLocale(answers.tasaInteres) > 0 ? answers.tasaInteres : "";
  const valido = parseDecimalLocale(monto) > 0;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel tooltip="La tasa anual en UF que te aprobó (o cotizó) tu banco.">Tu tasa pre-aprobada</FieldLabel>
        <TextInput
          value={monto}
          onChange={(v) => { if (decOk(v)) patchAnswers({ tasaInteres: v }); }}
          placeholder={tasaStr(data.tasaMercado)}
          inputMode="decimal"
          mono
          suffix="%"
        />
        <FuenteLine>Escríbela con coma decimal (ej: 4,50).</FuenteLine>
      </div>
      <div className="mt-1">
        <PrimaryBtn onClick={() => answer("tasaFix")} disabled={!valido}>
          Guardar y continuar →
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ── plazo ─────────────────────────────────────────────────────────────────────

export function PlazoScreen({ answers, answer }: ScreenProps) {
  return (
    <div className="flex flex-col gap-3">
      {["20", "25", "30"].map((p) => (
        <ChoiceTile
          key={p}
          selected={answers.plazoCredito === p}
          onClick={() => answer("plazo", { plazoCredito: p })}
        >
          <span className="font-mono">{p} años</span>
        </ChoiceTile>
      ))}
    </div>
  );
}
