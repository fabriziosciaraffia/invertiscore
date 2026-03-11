"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign } from "lucide-react";
import FrancoLogo from "@/components/franco-logo";
import type { Analisis, Desglose } from "@/lib/types";

const CHART_COLORS = ["#0F0F0F", "#3b82f6", "#f59e0b"];
const UF_CLP = 38800;

function getScoreColor(score: number) {
  if (score >= 65) return "#16A34A";
  if (score >= 50) return "#eab308";
  if (score >= 30) return "#f59e0b";
  return "#ef4444";
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Excelente";
  if (score >= 65) return "Buena";
  if (score >= 50) return "Regular";
  if (score >= 30) return "Débil";
  return "Evitar";
}

function formatCLP(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${n >= 0 ? "" : "-"}$${(Math.abs(n) / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${n >= 0 ? "" : "-"}$${Math.round(Math.abs(n) / 1000).toLocaleString("es-CL")}K`;
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function formatPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function formatUF(n: number) {
  return `UF ${n.toLocaleString("es-CL", { maximumFractionDigits: 1 })}`;
}

interface MetricRow {
  label: string;
  values: (string | number)[];
  raw: number[];
  higherIsBetter: boolean;
}

function getMetricRows(analisis: Analisis[], currency: "CLP" | "UF"): { section: string; rows: MetricRow[] }[] {
  const sections: { section: string; rows: MetricRow[] }[] = [];

  // Datos básicos
  sections.push({
    section: "Datos básicos",
    rows: [
      {
        label: currency === "UF" ? "Precio (UF)" : "Precio (CLP)",
        values: analisis.map((a) => currency === "UF" ? formatUF(a.precio) : formatCLP(a.precio * UF_CLP)),
        raw: analisis.map((a) => a.precio),
        higherIsBetter: false,
      },
      {
        label: "Superficie",
        values: analisis.map((a) => `${a.superficie} m²`),
        raw: analisis.map((a) => a.superficie),
        higherIsBetter: true,
      },
      {
        label: "Dormitorios / Baños",
        values: analisis.map((a) => `${a.dormitorios}D / ${a.banos}B`),
        raw: analisis.map((a) => a.dormitorios),
        higherIsBetter: true,
      },
      {
        label: "Arriendo mensual",
        values: analisis.map((a) => currency === "UF" ? formatUF(a.arriendo / UF_CLP) : formatCLP(a.arriendo)),
        raw: analisis.map((a) => a.arriendo),
        higherIsBetter: true,
      },
      {
        label: currency === "UF" ? "Precio/m² (UF)" : "Precio/m² (CLP)",
        values: analisis.map((a) => a.superficie > 0 ? (currency === "UF" ? formatUF(a.precio / a.superficie) : formatCLP(a.precio / a.superficie * UF_CLP)) : "—"),
        raw: analisis.map((a) => a.superficie > 0 ? a.precio / a.superficie : 0),
        higherIsBetter: false,
      },
    ],
  });

  // Rentabilidad
  sections.push({
    section: "Rentabilidad",
    rows: [
      {
        label: "Rentabilidad Bruta",
        values: analisis.map((a) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = a.results?.metrics as any;
          return raw ? formatPct(raw.rentabilidadBruta ?? raw.yieldBruto ?? 0) : "—";
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw: analisis.map((a) => { const raw = a.results?.metrics as any; return raw?.rentabilidadBruta ?? raw?.yieldBruto ?? 0; }),
        higherIsBetter: true,
      },
      {
        label: "Rentabilidad Neta",
        values: analisis.map((a) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = a.results?.metrics as any;
          return raw ? formatPct(raw.rentabilidadNeta ?? raw.yieldNeto ?? 0) : "—";
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw: analisis.map((a) => { const raw = a.results?.metrics as any; return raw?.rentabilidadNeta ?? raw?.yieldNeto ?? 0; }),
        higherIsBetter: true,
      },
      {
        label: "Rent. Operativa (CAP Rate)",
        values: analisis.map((a) => a.results?.metrics ? formatPct(a.results.metrics.capRate ?? 0) : "—"),
        raw: analisis.map((a) => a.results?.metrics?.capRate ?? 0),
        higherIsBetter: true,
      },
      {
        label: "Cash-on-Cash",
        values: analisis.map((a) => a.results?.metrics ? formatPct(a.results.metrics.cashOnCash) : "—"),
        raw: analisis.map((a) => a.results?.metrics?.cashOnCash ?? 0),
        higherIsBetter: true,
      },
    ],
  });

  // Flujo
  sections.push({
    section: "Flujo",
    rows: [
      {
        label: "Flujo mensual",
        values: analisis.map((a) => a.results?.metrics ? (currency === "UF" ? formatUF(a.results.metrics.flujoNetoMensual / UF_CLP) : formatCLP(a.results.metrics.flujoNetoMensual)) : "—"),
        raw: analisis.map((a) => a.results?.metrics?.flujoNetoMensual ?? 0),
        higherIsBetter: true,
      },
      {
        label: "Flujo anual",
        values: analisis.map((a) => a.results?.metrics ? (currency === "UF" ? formatUF(a.results.metrics.flujoNetoMensual * 12 / UF_CLP) : formatCLP(a.results.metrics.flujoNetoMensual * 12)) : "—"),
        raw: analisis.map((a) => (a.results?.metrics?.flujoNetoMensual ?? 0) * 12),
        higherIsBetter: true,
      },
    ],
  });

  // Proyección 10 años
  sections.push({
    section: "Proyección 10 años",
    rows: [
      {
        label: "ROI Total",
        values: analisis.map((a) => {
          const exit = a.results?.exitScenario;
          return exit ? `${exit.multiplicadorCapital.toFixed(2)}x` : "—";
        }),
        raw: analisis.map((a) => a.results?.exitScenario?.multiplicadorCapital ?? 0),
        higherIsBetter: true,
      },
      {
        label: "TIR",
        values: analisis.map((a) => {
          const exit = a.results?.exitScenario;
          return exit ? formatPct(exit.tir) : "—";
        }),
        raw: analisis.map((a) => a.results?.exitScenario?.tir ?? 0),
        higherIsBetter: true,
      },
      {
        label: "Multiplicador capital",
        values: analisis.map((a) => {
          const exit = a.results?.exitScenario;
          return exit ? `${exit.multiplicadorCapital.toFixed(1)}x` : "—";
        }),
        raw: analisis.map((a) => a.results?.exitScenario?.multiplicadorCapital ?? 0),
        higherIsBetter: true,
      },
    ],
  });

  // Score breakdown
  sections.push({
    section: "Score",
    rows: [
      {
        label: "Franco Score total",
        values: analisis.map((a) => a.score.toString() + "/100"),
        raw: analisis.map((a) => a.score),
        higherIsBetter: true,
      },
      {
        label: "Rentabilidad",
        values: analisis.map((a) => a.desglose?.rentabilidad != null ? String(Math.round(a.desglose.rentabilidad)) : "—"),
        raw: analisis.map((a) => a.desglose?.rentabilidad ?? 0),
        higherIsBetter: true,
      },
      {
        label: "Flujo Caja",
        values: analisis.map((a) => a.desglose?.flujoCaja != null ? String(Math.round(a.desglose.flujoCaja)) : "—"),
        raw: analisis.map((a) => a.desglose?.flujoCaja ?? 0),
        higherIsBetter: true,
      },
      {
        label: "Plusvalía",
        values: analisis.map((a) => a.desglose?.plusvalia != null ? String(Math.round(a.desglose.plusvalia)) : "—"),
        raw: analisis.map((a) => a.desglose?.plusvalia ?? 0),
        higherIsBetter: true,
      },
      {
        label: "Bajo Riesgo",
        values: analisis.map((a) => a.desglose?.riesgo != null ? String(Math.round(a.desglose.riesgo)) : "—"),
        raw: analisis.map((a) => a.desglose?.riesgo ?? 0),
        higherIsBetter: true,
      },
      {
        label: "Eficiencia",
        values: analisis.map((a) => a.desglose?.eficiencia != null ? String(Math.round(a.desglose.eficiencia)) : "—"),
        raw: analisis.map((a) => a.desglose?.eficiencia ?? 0),
        higherIsBetter: true,
      },
    ],
  });

  return sections;
}

function getCellStyle(raw: number[], index: number, higherIsBetter: boolean): string {
  if (raw.every((v) => v === 0)) return "text-[#111827]";
  const val = raw[index];
  const best = higherIsBetter ? Math.max(...raw) : Math.min(...raw);
  const worst = higherIsBetter ? Math.min(...raw) : Math.max(...raw);
  if (raw.every((v) => v === val)) return "text-[#111827]";
  if (val === best) return "font-bold text-[#0F0F0F]";
  if (val === worst) return "text-[#ef4444]";
  return "text-[#111827]";
}

// Radar chart - pure SVG
function RadarChart({ analisis }: { analisis: Analisis[] }) {
  const dims: (keyof Desglose)[] = ["rentabilidad", "flujoCaja", "plusvalia", "riesgo", "eficiencia"];
  const labels = ["Rentabilidad", "Flujo Caja", "Plusvalía", "Bajo Riesgo", "Eficiencia"];
  const cx = 150, cy = 150, R = 110;
  const angleStep = (2 * Math.PI) / 5;
  const startAngle = -Math.PI / 2;

  const getPoint = (dimIdx: number, pct: number) => {
    const angle = startAngle + dimIdx * angleStep;
    const r = R * pct;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  // Grid rings
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="mt-10">
      <h3 className="text-center font-heading text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">Radar de dimensiones</h3>
      <div className="mt-6 flex justify-center">
        <svg viewBox="0 0 300 300" className="h-64 w-64 sm:h-80 sm:w-80">
          {/* Grid */}
          {rings.map((r) => (
            <polygon
              key={r}
              points={dims.map((_, i) => {
                const p = getPoint(i, r);
                return `${p.x},${p.y}`;
              }).join(" ")}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
          {/* Axes */}
          {dims.map((_, i) => {
            const p = getPoint(i, 1);
            return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth="1" />;
          })}
          {/* Data polygons */}
          {analisis.map((a, ai) => {
            const points = dims.map((dim, di) => {
              const val = a.desglose?.[dim] ?? 0;
              const pct = Math.min(val / 100, 1);
              return getPoint(di, pct);
            });
            return (
              <polygon
                key={a.id}
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={CHART_COLORS[ai]}
                fillOpacity={0.12}
                stroke={CHART_COLORS[ai]}
                strokeWidth="2"
              />
            );
          })}
          {/* Data points */}
          {analisis.map((a, ai) =>
            dims.map((dim, di) => {
              const val = a.desglose?.[dim] ?? 0;
              const pct = Math.min(val / 100, 1);
              const p = getPoint(di, pct);
              return <circle key={`${a.id}-${di}`} cx={p.x} cy={p.y} r="3" fill={CHART_COLORS[ai]} />;
            })
          )}
          {/* Labels */}
          {labels.map((label, i) => {
            const p = getPoint(i, 1.18);
            return (
              <text
                key={label}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-[#6b7280] text-[10px] sm:text-[11px]"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
        {analisis.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ background: CHART_COLORS[i] }} />
            <span className="text-xs text-[#6b7280]">{a.nombre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateVerdict(analisis: Analisis[]) {
  const sorted = [...analisis].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const rest = sorted.slice(1);

  const dims: { key: keyof Desglose; label: string }[] = [
    { key: "rentabilidad", label: "rentabilidad" },
    { key: "flujoCaja", label: "flujo de caja" },
    { key: "plusvalia", label: "plusvalía" },
    { key: "riesgo", label: "bajo riesgo" },
    { key: "eficiencia", label: "eficiencia de compra" },
  ];

  // Find what each other analysis beats the best at
  const restAdvantages = rest.map((a) => {
    const advantages = dims.filter(
      (d) => (a.desglose?.[d.key] ?? 0) > (best.desglose?.[d.key] ?? 0)
    );
    return { name: a.nombre, advantages };
  });

  // Find best's strongest dimensions
  const bestWins = dims.filter((d) =>
    rest.every((a) => (best.desglose?.[d.key] ?? 0) >= (a.desglose?.[d.key] ?? 0))
  );

  let explanation = `Tiene el mejor score global`;
  if (bestWins.length > 0) {
    explanation += ` y destaca en ${bestWins.map((d) => d.label).join(", ")}`;
  }
  explanation += ".";

  restAdvantages.forEach((ra) => {
    if (ra.advantages.length > 0) {
      explanation += ` ${ra.name} tiene mejor ${ra.advantages.map((d) => d.label).join(" y ")}, pero su score total es menor.`;
    }
  });

  return {
    bestName: best.nombre,
    bestScore: best.score,
    bestColor: getScoreColor(best.score),
    bestLabel: getScoreLabel(best.score),
    explanation,
  };
}

export function CompararClient({ analisis }: { analisis: Analisis[] }) {
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const sections = getMetricRows(analisis, currency);
  const verdict = generateVerdict(analisis);
  const colCount = analisis.length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-franco-border bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:px-6">
          <FrancoLogo size="sm" href="/" />
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-sm text-[#6b7280] transition-colors hover:text-[#111827]">
              <ArrowLeft className="h-4 w-4" /> Volver al Dashboard
            </Link>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
              Comparación de {analisis.length} propiedades
            </h1>
          </div>
        </div>

        {/* Currency toggle */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setCurrency(currency === "CLP" ? "UF" : "CLP")}
            className="flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#6b7280] transition-colors hover:bg-[#f9fafb] hover:text-[#111827]"
          >
            <DollarSign className="h-3.5 w-3.5" />
            {currency === "CLP" ? "Ver en UF" : "Ver en CLP"}
          </button>
        </div>

        {/* Desktop table */}
        <div className="mt-8 hidden md:block">
          {/* Column headers */}
          <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: `180px repeat(${colCount}, 1fr)` }}>
            <div />
            {analisis.map((a, i) => {
              const color = getScoreColor(a.score);
              return (
                <div key={a.id} className="rounded-xl border bg-white p-4 text-center" style={{ borderColor: CHART_COLORS[i], borderWidth: "2px" }}>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-[3px]" style={{ borderColor: color }}>
                    <span className="font-mono text-lg font-bold" style={{ color }}>{a.score}</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[#111827]">{a.nombre}</div>
                  <div className="text-xs text-[#9ca3af]">{a.comuna}</div>
                </div>
              );
            })}
          </div>

          {/* Metric sections */}
          {sections.map((section) => (
            <div key={section.section} className="mb-2">
              <div
                className="grid items-center gap-4 rounded-t-lg bg-[#f3f4f6] px-4 py-2"
                style={{ gridTemplateColumns: `180px repeat(${colCount}, 1fr)` }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">{section.section}</span>
              </div>
              {section.rows.map((row, ri) => (
                <div
                  key={row.label}
                  className={`grid items-center gap-4 border-b border-[#f3f4f6] px-4 py-2.5 ${ri % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}
                  style={{ gridTemplateColumns: `180px repeat(${colCount}, 1fr)` }}
                >
                  <span className="text-sm text-[#6b7280]">{row.label}</span>
                  {row.values.map((val, vi) => (
                    <span key={vi} className={`text-center text-sm ${getCellStyle(row.raw, vi, row.higherIsBetter)}`}>
                      {val}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Mobile: stacked cards */}
        <div className="mt-6 space-y-6 md:hidden">
          {analisis.map((a, ai) => {
            const color = getScoreColor(a.score);
            return (
              <div key={a.id} className="rounded-xl border-2 bg-white p-4" style={{ borderColor: CHART_COLORS[ai] }}>
                {/* Card header */}
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px]" style={{ borderColor: color }}>
                    <span className="font-mono text-sm font-bold" style={{ color }}>{a.score}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#111827]">{a.nombre}</div>
                    <div className="text-xs text-[#9ca3af]">{a.comuna} · {getScoreLabel(a.score)}</div>
                  </div>
                </div>
                {/* Metrics */}
                {sections.map((section) => (
                  <div key={section.section} className="mt-4">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">{section.section}</div>
                    <div className="space-y-1">
                      {section.rows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between py-1">
                          <span className="text-xs text-[#6b7280]">{row.label}</span>
                          <span className={`text-xs ${getCellStyle(row.raw, ai, row.higherIsBetter)}`}>
                            {row.values[ai]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Radar chart */}
        <RadarChart analisis={analisis} />

        {/* Verdict */}
        <div className="mt-10 rounded-2xl border-2 border-[#0F0F0F] bg-[#FAFAF8] p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px]" style={{ borderColor: verdict.bestColor }}>
              <span className="text-xl font-bold" style={{ color: verdict.bestColor }}>{verdict.bestScore}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#111827]">
                Mejor inversión: {verdict.bestName}
                <span className="ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: `${verdict.bestColor}15`, color: verdict.bestColor }}>
                  {verdict.bestLabel}
                </span>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">{verdict.explanation}</p>
            </div>
          </div>
        </div>

        {/* Back button */}
        <div className="mt-8 text-center">
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2 rounded-xl border-[#e5e7eb] text-[#6b7280] hover:text-[#111827]">
              <ArrowLeft className="h-4 w-4" /> Volver al Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
