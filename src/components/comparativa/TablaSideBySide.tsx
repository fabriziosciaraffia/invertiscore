"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { fmtMoney } from "@/components/analysis/utils";

type Verdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

interface Props {
  // NOI mensual (año 1)
  ltrNOIMensual: number;
  strNOIMensual: number;
  // NOI anual año 1 (STR descuenta estabilización inicial)
  ltrNOIAnualY1: number;
  strNOIAnualY1: number;
  // NOI anual año 5
  ltrNOIAnualY5: number;
  strNOIAnualY5: number;
  // Capital requerido
  ltrCapital: number;
  strCapital: number;
  costoAmoblamiento: number;
  // Esfuerzo
  modoGestion: "auto" | "admin";
  comisionAdministrador: number;
  // Veredicto financiero por modalidad (engineSignal)
  ltrVerdict: Verdict | null;
  strVerdict: Verdict | null;
  // UI
  currency: "CLP" | "UF";
  ufValue: number;
}

// ─── Tabla side-by-side ampliada · Patrón Sale/Refi Block adaptado ────
// 6 filas operativas + micro-tooltips. Comparativa LTR vs STR con
// indicador "Mejor" en cada fila (tono neutro, sin sesgo cromático).
export function TablaSideBySide(p: Props) {
  const rows: TableRow[] = [
    {
      label: "NOI mensual",
      tooltip: "Net Operating Income mensual estabilizado. STR usa escenario base (P50 ADR + ocupación P50 mensual). LTR usa arriendo declarado neto de gastos operativos.",
      ltr: { kind: "money", value: p.ltrNOIMensual },
      str: { kind: "money", value: p.strNOIMensual },
      mejorAlto: true,
    },
    {
      label: "NOI anual año 1",
      tooltip: "STR descuenta los primeros ~6 meses de estabilización inicial (ocupación 50/60/70/80/90% antes de llegar a target). LTR puede tener 1-2 meses de vacancia inicial.",
      ltr: { kind: "money", value: p.ltrNOIAnualY1 },
      str: { kind: "money", value: p.strNOIAnualY1 },
      mejorAlto: true,
    },
    {
      label: "NOI anual año 5",
      tooltip: "Año estabilizado con ajustes inflacionarios. Útil para ver el patrimonio que se construye más allá del año 1.",
      ltr: { kind: "money", value: p.ltrNOIAnualY5 },
      str: { kind: "money", value: p.strNOIAnualY5 },
      mejorAlto: true,
    },
    {
      label: "Capital requerido inicial",
      tooltip: `Pie + gastos de cierre (notaría, conservador, comisión corredor). STR suma amoblamiento adicional${p.costoAmoblamiento > 0 ? ` (${fmtMoney(p.costoAmoblamiento, p.currency, p.ufValue)})` : ""}.`,
      ltr: { kind: "money", value: p.ltrCapital },
      str: { kind: "money", value: p.strCapital },
      mejorAlto: false, // menor capital = mejor
    },
    {
      label: "Esfuerzo operativo",
      tooltip: "LTR: buscar inquilino una vez al año, cobrar arriendo. STR auto-gestión: precios dinámicos, check-ins, mensajes, rotación. STR admin: paga comisión sobre bruto, casi pasivo.",
      ltr: { kind: "text", value: "Bajo · ~0,5 hrs/sem" },
      str: { kind: "text", value: p.modoGestion === "auto" ? "Alto · 8-12 hrs/sem" : `Medio · ${Math.round(p.comisionAdministrador * 100)}% al admin` },
      mejorAlto: false, // menor esfuerzo = mejor
      mejorOverride: "LTR",
    },
    {
      label: "Riesgo principal",
      tooltip: "LTR: vacancia entre contratos (~1-2 meses cada 2-3 años) + morosidad del inquilino. STR: estacionalidad (Santiago: julio peak ski, febrero low), regulación del edificio, reviews tempranos 1-3★.",
      ltr: { kind: "text", value: "Vacancia entre arriendos" },
      str: { kind: "text", value: "Estacionalidad + ocupación" },
      mejorAlto: false,
      mejorOverride: "LTR",
    },
    {
      label: "Veredicto financiero motor",
      tooltip: "Veredicto matemático puro del motor para cada modalidad por separado. COMPRAR = números cierran. AJUSTA SUPUESTOS = revisa precio o supuestos. BUSCAR OTRA = no se sostiene.",
      ltr: { kind: "verdict", value: p.ltrVerdict ?? "—" },
      str: { kind: "verdict", value: p.strVerdict ?? "—" },
      mejorAlto: false,
      mejorOverride: pickMejorVerdict(p.ltrVerdict, p.strVerdict),
    },
  ];

  return (
    <div className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] overflow-hidden mb-8">
      <div className="border-b border-[var(--franco-border)] px-6 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-1">
          COMPARATIVA LÍNEA POR LÍNEA
        </p>
        <h3 className="font-heading text-[18px] font-bold text-[var(--franco-text)]">
          Lo que cambia entre renta larga y renta corta
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--franco-border)]">
              <th className="text-left px-6 py-3 font-body text-[11px] font-medium uppercase tracking-wide text-[var(--franco-text-secondary)]">
                Concepto
              </th>
              <th className="text-right px-4 py-3 font-body text-[11px] font-medium uppercase tracking-wide text-[var(--franco-text-secondary)]">
                Renta larga
              </th>
              <th className="text-right px-4 py-3 font-body text-[11px] font-medium uppercase tracking-wide text-[var(--franco-text-secondary)]">
                Renta corta
              </th>
              <th className="text-right px-6 py-3 font-body text-[11px] font-medium uppercase tracking-wide text-[var(--franco-text-secondary)]">
                Mejor
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ganador = computeGanador(r);
              const ganadorColor = ganador === "—"
                ? "var(--franco-text-muted)"
                : "var(--franco-text-tertiary)";
              return (
                <tr key={r.label} className="border-b border-[var(--franco-border)] last:border-0">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-body text-[13px] text-[var(--franco-text)]">{r.label}</span>
                      <Tooltip text={r.tooltip} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CellRender data={r.ltr} currency={p.currency} ufValue={p.ufValue} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CellRender data={r.str} currency={p.currency} ufValue={p.ufValue} />
                  </td>
                  <td
                    className="px-6 py-3 text-right font-mono text-[11px] font-medium"
                    style={{ color: ganadorColor }}
                  >
                    {ganador}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Helpers internos ────────────────────────────────────────────────────

type CellMoney = { kind: "money"; value: number };
type CellText = { kind: "text"; value: string };
type CellVerdict = { kind: "verdict"; value: string };
type CellData = CellMoney | CellText | CellVerdict;

interface TableRow {
  label: string;
  tooltip: string;
  ltr: CellData;
  str: CellData;
  mejorAlto: boolean;
  mejorOverride?: "LTR" | "STR" | "—";
}

function CellRender({ data, currency, ufValue }: { data: CellData; currency: "CLP" | "UF"; ufValue: number }) {
  if (data.kind === "money") {
    return (
      <span
        className="font-mono text-[13px] font-medium"
        style={{ color: data.value < 0 ? "var(--signal-red)" : "var(--franco-text)" }}
      >
        {fmtMoney(data.value, currency, ufValue)}
      </span>
    );
  }
  if (data.kind === "verdict") {
    return (
      <span className="font-body text-[12px] font-medium text-[var(--franco-text)]">
        {data.value}
      </span>
    );
  }
  return (
    <span className="font-body text-[13px] text-[var(--franco-text-secondary)]">
      {data.value}
    </span>
  );
}

function computeGanador(r: TableRow): "LTR" | "STR" | "—" {
  if (r.mejorOverride !== undefined) return r.mejorOverride;
  if (r.ltr.kind !== "money" || r.str.kind !== "money") return "—";
  if (r.ltr.value === r.str.value) return "—";
  const strGana = r.mejorAlto ? r.str.value > r.ltr.value : r.str.value < r.ltr.value;
  return strGana ? "STR" : "LTR";
}

function pickMejorVerdict(ltr: Verdict | null, str: Verdict | null): "LTR" | "STR" | "—" {
  const rank: Record<Verdict, number> = {
    "COMPRAR": 3,
    "AJUSTA SUPUESTOS": 2,
    "BUSCAR OTRA": 1,
  };
  const l = ltr ? rank[ltr] : 0;
  const s = str ? rank[str] : 0;
  if (l === s) return "—";
  return l > s ? "LTR" : "STR";
}

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className="text-[var(--franco-text-muted)] hover:text-[var(--franco-text-secondary)] transition-colors"
        aria-label="Más información"
      >
        <Info size={12} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-10 left-5 top-0 w-[260px] rounded-md p-3 text-left"
          style={{
            background: "var(--franco-text)",
            color: "var(--franco-bg)",
            fontSize: 11,
            lineHeight: 1.45,
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
