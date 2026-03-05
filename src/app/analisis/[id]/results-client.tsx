"use client";

import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Lock, DollarSign, BarChart3, Brain, Calendar,
  Building2, Sparkles, ArrowRightLeft, Target, Shield,
} from "lucide-react";
import type { FullAnalysisResult } from "@/lib/types";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fmtM = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + Math.round(n);
};

function PremiumOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card/90 px-6 py-4 shadow-lg">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium">Disponible en Informe Premium</span>
      </div>
    </div>
  );
}

function SectionCard({ title, description, icon: Icon, children, premium = false }: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  premium?: boolean;
}) {
  return (
    <div className={`relative mb-8 ${premium ? "" : ""}`}>
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle>{title}</CardTitle>
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {premium && <PremiumOverlay />}
    </div>
  );
}

export function PremiumResults({ results }: { results: FullAnalysisResult }) {
  const [projectionYears, setProjectionYears] = useState(10);
  const [exitMode, setExitMode] = useState<"venta" | "refinanciamiento">("venta");
  const [cashflowView, setCashflowView] = useState(1);

  const m = results.metrics;
  const exit = results.exitScenario;
  const refi = results.refinanceScenario;

  // ===== 6. Radar Chart =====
  const radarData = [
    { dimension: "Rentabilidad", value: results.desglose.rentabilidad, fullMark: 100 },
    { dimension: "Flujo Caja", value: results.desglose.flujoCaja, fullMark: 100 },
    { dimension: "Plusvalía", value: results.desglose.plusvalia, fullMark: 100 },
    { dimension: "Bajo Riesgo", value: results.desglose.riesgo, fullMark: 100 },
    { dimension: "Ubicación", value: results.desglose.ubicacion, fullMark: 100 },
  ];

  // ===== 8. Waterfall data =====
  const waterfallData = [
    { name: "Arriendo", value: m.ingresoMensual, fill: "#059669" },
    { name: "Dividendo", value: -m.dividendo, fill: "#ef4444" },
    { name: "GGCC", value: -(m.egresosMensuales - m.dividendo - Math.round(results.metrics.precioCLP * 0.01 / 12)), fill: "#f97316" },
    { name: "Mantención", value: -Math.round(results.metrics.precioCLP * 0.01 / 12), fill: "#f59e0b" },
    { name: "Flujo Neto", value: m.flujoNetoMensual, fill: m.flujoNetoMensual >= 0 ? "#059669" : "#ef4444" },
  ];

  // ===== 9. Cashflow month by month =====
  const cashflowData = results.cashflowYear1.map((c) => ({
    name: `M${c.mes}`,
    Ingreso: c.ingreso,
    Dividendo: c.dividendo,
    Gastos: c.gastos + c.contribuciones + c.mantencion,
    Extra: c.corretaje + c.vacancia + c.serviciosBasicos,
    Acumulado: c.acumulado,
  }));

  // ===== 10. Multi-year projections =====
  const projData = results.projections.slice(0, projectionYears).map((p) => ({
    name: `Año ${p.anio}`,
    "Valor Propiedad": p.valorPropiedad,
    "Saldo Crédito": p.saldoCredito,
    "Patrimonio Neto": p.patrimonioNeto,
    "Flujo Acumulado": p.flujoAcumulado,
  }));

  // ===== 12. Sensitivity =====
  const sensitivityData = results.sensitivity;

  return (
    <>
      {/* 6. Radar Chart */}
      <SectionCard title="Dimensiones del Score" icon={Target} premium>
        <div className="mx-auto h-72 w-full max-w-md">
          <ResponsiveContainer>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
              <Radar name="Score" dataKey="value" stroke="#059669" fill="#059669" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 7. Dashboard 8 Metrics */}
      <SectionCard title="Métricas de Inversión" icon={BarChart3} premium>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Yield Bruto", value: `${m.yieldBruto.toFixed(1)}%` },
            { label: "Yield Neto", value: `${m.yieldNeto.toFixed(1)}%` },
            { label: "CAP Rate", value: `${m.capRate.toFixed(1)}%` },
            { label: "Cash-on-Cash", value: `${m.cashOnCash.toFixed(1)}%` },
            { label: "ROI Total (10a)", value: `${exit.multiplicadorCapital}x` },
            { label: "TIR", value: `${exit.tir.toFixed(1)}%` },
            { label: "Payback Pie", value: m.mesesPaybackPie < 999 ? `${m.mesesPaybackPie} meses` : "N/A" },
            { label: "UF/m²", value: `${m.precioM2.toFixed(1)}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-lg font-bold">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 8. Waterfall */}
      <SectionCard title="Cascada de Costos Mensual" description="Del arriendo bruto al flujo neto" icon={DollarSign} premium>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={waterfallData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtM} />
              <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: number) => fmt(v)) as any} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 9. Cashflow Mes a Mes */}
      <SectionCard title={`Flujo de Caja — Año ${cashflowView}`} description="Barras: ingresos y egresos. Línea: acumulado" icon={BarChart3} premium>
        <div className="mb-3 flex gap-2">
          {[1, 2, 3].map((y) => (
            <Button key={y} variant={cashflowView === y ? "default" : "outline"} size="sm" onClick={() => setCashflowView(y)}>
              Año {y}
            </Button>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={cashflowData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtM} />
              <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: number) => fmt(v)) as any} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Ingreso" stackId="a" fill="#059669" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Dividendo" stackId="b" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Gastos" stackId="b" fill="#f97316" />
              <Bar dataKey="Extra" stackId="b" fill="#f59e0b" />
              <Line type="monotone" dataKey="Acumulado" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 10. Proyección Multi-año */}
      <SectionCard title="Proyección Multi-Año" description={`Horizonte: ${projectionYears} años · Plusvalía 4%/año · Arriendos +3.5%/año`} icon={Calendar} premium>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Años:</span>
          <input
            type="range" min={3} max={20} value={projectionYears}
            onChange={(e) => setProjectionYears(Number(e.target.value))}
            className="w-48 accent-primary"
          />
          <span className="text-sm font-medium">{projectionYears}</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={projData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={fmtM} />
              <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: number) => fmt(v)) as any} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Valor Propiedad" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Saldo Crédito" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Patrimonio Neto" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Flujo Acumulado" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 11. Escenario de Salida */}
      <SectionCard title="Escenario de Salida" icon={ArrowRightLeft} premium>
        <div className="mb-4 flex overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setExitMode("venta")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${exitMode === "venta" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Venta
          </button>
          <button
            type="button"
            onClick={() => setExitMode("refinanciamiento")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${exitMode === "refinanciamiento" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            Refinanciamiento
          </button>
        </div>

        {exitMode === "venta" ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">Escenario a {exit.anios} años con plusvalía 4%/año</p>
            {[
              { label: "Valor venta estimado", value: fmt(exit.valorVenta) },
              { label: "Saldo crédito restante", value: fmt(exit.saldoCredito), negative: true },
              { label: "Comisión venta (2%)", value: fmt(exit.comisionVenta), negative: true },
              { label: "Ganancia neta venta", value: fmt(exit.gananciaNeta), positive: true },
              { label: "Flujo acumulado período", value: fmt(exit.flujoAcumulado), positive: exit.flujoAcumulado > 0 },
              { label: "Retorno total", value: fmt(exit.retornoTotal), bold: true, positive: true },
              { label: "Multiplicador de capital", value: `${exit.multiplicadorCapital}x`, bold: true },
              { label: "TIR", value: `${exit.tir.toFixed(1)}%`, bold: true },
            ].map(({ label, value, negative, positive, bold }) => (
              <div key={label} className={`flex justify-between ${bold ? "border-t border-border/50 pt-2 font-bold" : ""}`}>
                <span className="text-muted-foreground">{label}</span>
                <span className={negative ? "text-red-400" : positive ? "text-emerald-400" : ""}>{negative ? "-" : ""}{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">Refinanciamiento a 5 años (80% nuevo avalúo)</p>
            {[
              { label: "Nuevo avalúo", value: fmt(refi.nuevoAvaluo) },
              { label: "Nuevo crédito (80%)", value: fmt(refi.nuevoCredito) },
              { label: "Capital liberado", value: fmt(refi.capitalLiberado), positive: true },
              { label: "Nuevo dividendo", value: fmt(refi.nuevoDividendo) },
              { label: "Nuevo flujo neto", value: fmt(refi.nuevoFlujoNeto), positive: refi.nuevoFlujoNeto > 0 },
            ].map(({ label, value, positive }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className={positive ? "text-emerald-400 font-medium" : ""}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 12. Sensibilidad */}
      <SectionCard title="Análisis de Sensibilidad" description="Cómo cambia el score al variar parámetros clave" icon={Shield} premium>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Variable</th>
                <th className="pb-2 pr-4">Variación</th>
                <th className="pb-2 pr-4">Score</th>
                <th className="pb-2 pr-4">Flujo Neto</th>
                <th className="pb-2">Impacto</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityData.map((row, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-2 pr-4">{row.variable}</td>
                  <td className="py-2 pr-4">{row.variacion}</td>
                  <td className="py-2 pr-4 font-medium">{row.nuevoScore}</td>
                  <td className="py-2 pr-4">{fmt(row.nuevoFlujo)}</td>
                  <td className="py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      row.delta > 0 ? "bg-emerald-500/10 text-emerald-400" :
                      row.delta < -5 ? "bg-red-500/10 text-red-400" :
                      row.delta < 0 ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {row.delta > 0 ? "+" : ""}{row.delta}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 13. Comparación zona - placeholder bars */}
      <SectionCard title="Comparación con Zona" icon={Building2} premium>
        {(() => {
          const promedioM2 = m.precioM2 * 1.05;
          const promedioYield = m.yieldBruto * 0.9;
          const items = [
            { label: "Precio/m² (UF)", tuyo: m.precioM2, zona: promedioM2 },
            { label: "Yield Bruto (%)", tuyo: m.yieldBruto, zona: promedioYield },
          ];
          return (
            <div className="space-y-4">
              {items.map(({ label, tuyo, zona }) => {
                const maxVal = Math.max(tuyo, zona);
                return (
                  <div key={label}>
                    <div className="mb-1 text-xs text-muted-foreground">{label}</div>
                    <div className="mb-1 flex items-center gap-3">
                      <span className="w-20 text-xs">Tu propiedad</span>
                      <div className="h-4 flex-1 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(tuyo / maxVal) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-medium">{tuyo.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-20 text-xs">Promedio zona</span>
                      <div className="h-4 flex-1 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${(zona / maxVal) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-medium">{zona.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </SectionCard>

      {/* 14. Break-even & 15. Valor máximo */}
      <SectionCard title="Puntos Críticos" icon={Target} premium>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
            <div className="text-xs text-muted-foreground">Break-even tasa de interés</div>
            <div className="mt-1 text-2xl font-bold">{results.breakEvenTasa.toFixed(2)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Tasa a la que el flujo mensual se vuelve negativo</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
            <div className="text-xs text-muted-foreground">Precio máximo de compra</div>
            <div className="mt-1 text-2xl font-bold">{results.valorMaximoCompra.toLocaleString("es-CL")} UF</div>
            <p className="mt-1 text-xs text-muted-foreground">Precio máximo para flujo positivo con estos datos</p>
          </div>
        </div>
      </SectionCard>

      {/* 16. Análisis IA */}
      <SectionCard title="Análisis Detallado" icon={Brain} premium>
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-emerald-400">Pros</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {results.pros.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-red-400">Contras</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {results.contras.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
            <h4 className="mb-2 text-sm font-semibold">Resumen</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{results.resumen}</p>
          </div>
        </div>
      </SectionCard>

      {/* CTA Final */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Sparkles className="h-8 w-8 text-primary" />
          <h3 className="text-xl font-bold">Desbloquea el informe completo</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Accede al radar de dimensiones, 8 métricas detalladas, flujo de caja mes a mes,
            proyecciones multi-año, escenarios de salida, análisis de sensibilidad y más.
          </p>
          <Button size="lg" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Desbloquear Informe Completo — $4.990
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
