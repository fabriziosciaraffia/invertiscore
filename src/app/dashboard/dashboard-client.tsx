"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Analisis } from "@/lib/types";
import { User } from "lucide-react";

type LTRVerdict = "COMPRAR" | "AJUSTA EL PRECIO" | "BUSCAR OTRA";
type STRVerdict = "VIABLE" | "AJUSTA ESTRATEGIA" | "NO RECOMENDADO";
type AnyVerdict = LTRVerdict | STRVerdict;
type VerdictFilter = "todos" | AnyVerdict;
type TypeFilter = "todos" | "ltr" | "str";

function getVerdict(score: number, veredictoMotor?: string): LTRVerdict {
  if (veredictoMotor === "COMPRAR" || veredictoMotor === "AJUSTA EL PRECIO" || veredictoMotor === "BUSCAR OTRA") return veredictoMotor;
  if (score >= 75) return "COMPRAR";
  if (score >= 40) return "AJUSTA EL PRECIO";
  return "BUSCAR OTRA";
}

function getSTRVerdict(item: Analisis): STRVerdict {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = item.results as any;
  const v = r?.francoScore?.veredicto ?? r?.veredicto;
  if (v === "VIABLE" || v === "AJUSTA ESTRATEGIA" || v === "NO RECOMENDADO") return v;
  return "NO RECOMENDADO";
}

function getSTRScore(item: Analisis): number | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (item.results as any)?.francoScore?.score;
  return typeof s === "number" ? s : null;
}

function getAnyVerdict(item: Analisis): AnyVerdict {
  return isShortTerm(item) ? getSTRVerdict(item) : getVerdict(item.score, item.results?.veredicto);
}

function isShortTerm(item: Analisis): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = item.results as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const i = item.input_data as any;
  return r?.tipoAnalisis === "short-term" || i?.tipoAnalisis === "short-term";
}

type CardMetrics = {
  isSTR: boolean;
  flujoMensual: number;
  primary: { label: string; value: string };
  secondary: { label: string; value: string };
};

function getMetrics(item: Analisis): CardMetrics {
  const r = item.results;

  if (isShortTerm(item)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = r as any;
    const base = str?.escenarios?.base;
    const flujo = base?.flujoCajaMensual ?? 0;
    const capRatePct = (base?.capRate ?? 0) * 100;
    const sobreRentaPct = (str?.comparativa?.sobreRentaPct ?? 0) * 100;
    return {
      isSTR: true,
      flujoMensual: flujo,
      primary: { label: "CAP RATE", value: `${capRatePct.toFixed(1)}%` },
      secondary: {
        label: "VS LTR",
        value: sobreRentaPct === 0 ? "—" : `${sobreRentaPct > 0 ? "+" : ""}${sobreRentaPct.toFixed(0)}%`,
      },
    };
  }

  if (r?.metrics) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = r.metrics as any;
    const rentabilidadBruta = raw.rentabilidadBruta ?? raw.yieldBruto ?? 0;
    const flujoMensual = r.metrics.flujoNetoMensual ?? 0;
    const multiplicador = r.exitScenario?.multiplicadorCapital ?? 0;
    return {
      isSTR: false,
      flujoMensual,
      primary: { label: "RENT.", value: `${rentabilidadBruta.toFixed(1)}%` },
      secondary: { label: "RETORNO", value: multiplicador > 0 ? `${multiplicador.toFixed(1)}x` : "—" },
    };
  }

  const precioCLP = item.precio * 38800;
  const rentabilidadBruta = precioCLP > 0 ? ((item.arriendo * 12) / precioCLP) * 100 : 0;
  const flujoMensual = item.arriendo - item.gastos - item.contribuciones;
  return {
    isSTR: false,
    flujoMensual,
    primary: { label: "RENT.", value: `${rentabilidadBruta.toFixed(1)}%` },
    secondary: { label: "RETORNO", value: "—" },
  };
}

function formatCLP(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${n >= 0 ? "" : "-"}$${(Math.abs(n) / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${n >= 0 ? "" : "-"}$${Math.round(Math.abs(n) / 1000)}K`;
  return `$${Math.round(n)}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getSiendoFranco(score: number, flujo: number) {
  if (score >= 75) return "Flujo positivo y buena plusvalía. Da los números.";
  if (score >= 40) return `Te cuesta ${formatCLP(Math.abs(flujo))}/mes. Negociable si consigues mejor precio.`;
  return "Flujo muy negativo y retorno bajo. No vale la pena.";
}

function getSTRSiendoFranco(item: Analisis): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = item.results as any;
  const sobreRenta = r?.comparativa?.sobreRenta ?? 0;
  const sobreRentaPct = Math.round((r?.comparativa?.sobreRentaPct ?? 0) * 100);
  const veredicto = getSTRVerdict(item);
  if (veredicto === "VIABLE") {
    return `Airbnb genera +${sobreRentaPct}% más que arriendo largo. Sobre-renta de $${Math.abs(Math.round(sobreRenta)).toLocaleString("es-CL")}/mes.`;
  }
  if (veredicto === "AJUSTA ESTRATEGIA") {
    return `Airbnb genera levemente más que arriendo largo (+${sobreRentaPct}%). Evalúa si el esfuerzo operativo vale la pena.`;
  }
  return "El arriendo tradicional es más rentable para esta propiedad. La renta corta no cubre los costos operativos adicionales.";
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, { color: string; bg: string; border: string }> = {
    COMPRAR: { color: "var(--franco-v-buy)", bg: "var(--franco-v-buy-bg)", border: "var(--franco-v-buy-bg)" },
    "AJUSTA EL PRECIO": { color: "var(--franco-v-adjust)", bg: "var(--franco-v-adjust-bg)", border: "var(--franco-v-adjust-bg)" },
    "BUSCAR OTRA": { color: "var(--franco-v-avoid)", bg: "var(--franco-v-avoid-bg)", border: "var(--franco-v-avoid-bg)" },
    VIABLE: { color: "var(--franco-v-buy)", bg: "var(--franco-v-buy-bg)", border: "var(--franco-v-buy-bg)" },
    "AJUSTA ESTRATEGIA": { color: "var(--franco-v-adjust)", bg: "var(--franco-v-adjust-bg)", border: "var(--franco-v-adjust-bg)" },
    "NO RECOMENDADO": { color: "var(--franco-v-avoid)", bg: "var(--franco-v-avoid-bg)", border: "var(--franco-v-avoid-bg)" },
  };
  const s = styles[verdict] || styles["AJUSTA EL PRECIO"];
  return (
    <span
      className="inline-flex font-mono text-[9px] font-bold tracking-wide"
      style={{ padding: "3px 10px", borderRadius: 5, background: s.bg, border: `1.5px solid ${s.border}`, color: s.color }}
    >
      {verdict}
    </span>
  );
}

function STRScoreIcon({ verdict }: { verdict: STRVerdict }) {
  const config = {
    VIABLE: { icon: "✓", color: "var(--franco-v-buy)" },
    "AJUSTA ESTRATEGIA": { icon: "⚠", color: "var(--franco-v-adjust)" },
    "NO RECOMENDADO": { icon: "✗", color: "var(--signal-red)" },
  }[verdict];
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke={config.color} strokeWidth="3" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading text-xl font-bold leading-none" style={{ color: config.color }}>{config.icon}</span>
      </div>
    </div>
  );
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 75 ? "var(--franco-v-buy)" : score >= 40 ? "var(--franco-v-adjust)" : "var(--signal-red)";
  const dashLen = (score / 100) * 126;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--franco-border)" strokeWidth="3" />
        <circle
          cx="24" cy="24" r="20" fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${dashLen} 126`}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading text-base font-bold text-[var(--franco-text)]">{score}</span>
      </div>
    </div>
  );
}

export function DashboardClient({ analisis, firstName = "" }: { analisis: Analisis[]; firstName?: string }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<VerdictFilter>("todos");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todos");

  const handleCardClick = (item: Analisis) => {
    if (isShortTerm(item)) {
      router.push(`/analisis/renta-corta/${item.id}`);
    } else {
      router.push(`/analisis/${item.id}`);
    }
  };

  // Check welcome email for new users (fire and forget)
  useEffect(() => {
    fetch("/api/user/check-welcome", { method: "POST" }).catch(() => {});
  }, []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Summary stats
  const summaryData = useMemo(() => {
    if (analisis.length < 3) return null;
    const best = analisis.reduce((a, b) => (a.score > b.score ? a : b));
    const avgScore = Math.round(analisis.reduce((sum, a) => sum + a.score, 0) / analisis.length);
    const positiveFlowCount = analisis.filter((a) => getMetrics(a).flujoMensual >= 0).length;
    return { best, avgScore, positiveFlowCount, total: analisis.length };
  }, [analisis]);

  // Type-filtered base list (applied before verdict filter)
  const typeFiltered = useMemo(() => {
    if (typeFilter === "todos") return analisis;
    if (typeFilter === "str") return analisis.filter((a) => isShortTerm(a));
    return analisis.filter((a) => !isShortTerm(a));
  }, [analisis, typeFilter]);

  // Type counts
  const typeCounts = useMemo(() => {
    let str = 0;
    analisis.forEach((a) => { if (isShortTerm(a)) str++; });
    return { str, ltr: analisis.length - str, total: analisis.length };
  }, [analisis]);

  // Verdict counts (within type-filtered set)
  const verdictCounts = useMemo(() => {
    const counts: Record<string, number> = {
      COMPRAR: 0, "AJUSTA EL PRECIO": 0, "BUSCAR OTRA": 0,
      VIABLE: 0, "AJUSTA ESTRATEGIA": 0, "NO RECOMENDADO": 0,
    };
    typeFiltered.forEach((a) => { counts[getAnyVerdict(a)]++; });
    return counts;
  }, [typeFiltered]);

  // Filtered list
  const filtered = useMemo(() => {
    if (activeFilter === "todos") return typeFiltered;
    return typeFiltered.filter((a) => getAnyVerdict(a) === activeFilter);
  }, [typeFiltered, activeFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id === "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1") return;
    if (!confirm("¿Estás seguro de eliminar este análisis?")) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("analisis").delete().eq("id", id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDeletingId(null);
    router.refresh();
  };

  const ltrVerdictFilters: { key: VerdictFilter; label: string; color: string }[] = [
    { key: "COMPRAR", label: "Comprar", color: "var(--ink-400)" },
    { key: "AJUSTA EL PRECIO", label: "Ajusta precio", color: "var(--ink-500)" },
    { key: "BUSCAR OTRA", label: "Buscar otra", color: "var(--signal-red)" },
  ];
  const strVerdictFilters: { key: VerdictFilter; label: string; color: string }[] = [
    { key: "VIABLE", label: "Viable", color: "var(--ink-400)" },
    { key: "AJUSTA ESTRATEGIA", label: "Ajusta estrategia", color: "var(--ink-500)" },
    { key: "NO RECOMENDADO", label: "No recomendado", color: "var(--signal-red)" },
  ];
  const verdictFilterSet =
    typeFilter === "str" ? strVerdictFilters :
    typeFilter === "ltr" ? ltrVerdictFilters :
    [...ltrVerdictFilters, ...strVerdictFilters].filter((f) => (verdictCounts[f.key as string] ?? 0) > 0);

  const filters: { key: VerdictFilter; label: string; count: number; color: string | null }[] = [
    { key: "todos", label: "Todos", count: typeFiltered.length, color: null },
    ...verdictFilterSet.map((f) => ({ key: f.key, label: f.label, count: verdictCounts[f.key as string] ?? 0, color: f.color })),
  ];

  const typeFilters: { key: TypeFilter; label: string; count: number }[] = [
    { key: "todos", label: "Todos los análisis", count: typeCounts.total },
    { key: "ltr", label: "Renta larga", count: typeCounts.ltr },
    { key: "str", label: "Renta corta", count: typeCounts.str },
  ];

  return (
    <div className="min-h-screen bg-[var(--franco-bg)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[var(--franco-border)] bg-[var(--franco-bg)]">
        <div className="mx-auto flex h-14 max-w-[820px] items-center justify-between px-5">
          <FrancoLogo size="header" href="/" inverted />
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <span className="rounded-md bg-signal-red px-3 py-1.5 font-body text-sm font-medium text-white transition-colors hover:bg-signal-red/90">Premium</span>
            </Link>
            <Link href="/cuenta">
              <Button variant="ghost" size="sm" className="gap-1.5 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)]">
                <User className="h-4 w-4" /> <span className="hidden sm:inline">Mi Cuenta</span>
              </Button>
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-[820px] px-5 py-7">
        {analisis.length === 0 ? (
          /* ─── Empty State ─── */
          <div className="px-6 py-16 text-center">
            <div className="mb-6 flex select-none items-baseline justify-center opacity-[0.08]">
              <span className="font-heading text-[64px] font-normal italic leading-none tracking-tight text-[var(--franco-text)]">re</span>
              <span className="font-heading text-[64px] font-bold leading-none tracking-tight text-[var(--franco-text)]">franco</span>
              <span className="ml-1 font-body text-sm font-medium uppercase tracking-wider text-signal-red">.ai</span>
            </div>
            <div className="mb-1.5 font-heading text-xl font-bold text-[var(--franco-text)]">
              Analiza tu primera inversión
            </div>
            <div className="mx-auto mb-6 max-w-[360px] font-body text-[13px] text-[var(--franco-text-secondary)]">
              Renta larga, renta corta o ambas. Franco te dice si el número da en 30 segundos.
            </div>
            <Link href="/analisis/nuevo-v2">
              <button className="rounded-lg bg-signal-red px-7 py-3 font-body text-sm font-medium text-white shadow-[0_2px_12px_color-mix(in_srgb,var(--signal-red)_20%,transparent)]">
                Analizar tu primera inversión →
              </button>
            </Link>
            <div className="mt-3 flex flex-col items-center gap-1.5">
              <a href="/analisis/6db7a9ac-f030-4ccf-b5a8-5232ae997fb1" className="font-body text-xs text-[var(--franco-text-secondary)] no-underline hover:text-[var(--franco-text)]">
                O mira un ejemplo primero →
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* ─── Header ─── */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h1 className="font-heading text-2xl font-bold text-[var(--franco-text)]">{firstName ? `${firstName}, estas son tus inversiones` : "Tus inversiones"}</h1>
                <p className="mt-0.5 font-body text-[13px] text-[var(--franco-text-secondary)]">
                  {analisis.length} propiedad{analisis.length !== 1 ? "es" : ""} analizada{analisis.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Link href="/analisis/nuevo-v2">
                  <button className="rounded-lg bg-signal-red px-5 py-2.5 font-body text-[13px] font-medium text-white shadow-[0_2px_10px_color-mix(in_srgb,var(--signal-red)_15%,transparent)]">
                    Analizar inversión →
                  </button>
                </Link>
              </div>
            </div>

            {/* ─── Summary Cards ─── */}
            {summaryData && (
              <div className="mb-5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                {/* Best analysis */}
                <div className="rounded-[10px] border border-[var(--franco-border)] bg-[var(--franco-card)] p-3.5 px-4">
                  <div className="mb-1 font-body text-[9px] uppercase tracking-wide text-[var(--franco-text-muted)]">MEJOR ANÁLISIS</div>
                  <div className="font-body text-[13px] font-medium text-[var(--franco-text)]">
                    {summaryData.best.nombre} · {summaryData.best.comuna}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[var(--franco-text-secondary)]">Score {summaryData.best.score}</div>
                </div>
                {/* Average */}
                <div className="rounded-[10px] border border-[var(--franco-border)] bg-[var(--franco-card)] p-3.5 px-4">
                  <div className="mb-1 font-body text-[9px] uppercase tracking-wide text-[var(--franco-text-muted)]">PROMEDIO</div>
                  <div className="font-heading text-[22px] font-bold text-[var(--franco-text)]">{summaryData.avgScore}</div>
                  <div className="mt-0.5 font-body text-[10px] text-[var(--franco-text-secondary)]">score promedio</div>
                </div>
                {/* Positive flow */}
                <div className="rounded-[10px] border border-[var(--franco-border)] bg-[var(--franco-card)] p-3.5 px-4">
                  <div className="mb-1 font-body text-[9px] uppercase tracking-wide text-[var(--franco-text-muted)]">FLUJO POSITIVO</div>
                  <div className={`font-heading text-[22px] font-bold ${summaryData.positiveFlowCount === 0 ? "text-signal-red" : "text-[var(--franco-text)]"}`}>
                    {summaryData.positiveFlowCount}/{summaryData.total}
                  </div>
                  <div className="mt-0.5 font-body text-[10px] text-[var(--franco-text-secondary)]">propiedades</div>
                </div>
              </div>
            )}

            {/* ─── Type Filters ─── */}
            {typeCounts.str > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {typeFilters.map((f) => {
                  const isActive = typeFilter === f.key;
                  const className = `font-body text-xs px-3 py-1 rounded-md cursor-pointer border transition-colors ${
                    isActive
                      ? "font-medium bg-[var(--franco-text)] border-[var(--franco-text)] text-[var(--franco-bg)]"
                      : "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)]"
                  }`;
                  return (
                    <button
                      key={f.key}
                      onClick={() => { setTypeFilter(f.key); setActiveFilter("todos"); }}
                      className={className}
                    >
                      {f.label} <span className="ml-1 font-mono text-[10px] opacity-70">{f.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ─── Verdict Filters ─── */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {filters.map((f) => {
                const isActive = activeFilter === f.key;
                const c = f.color;

                let className = "font-body text-xs px-3.5 py-1.5 rounded-md cursor-pointer border transition-colors ";
                if (isActive) {
                  if (c) {
                    // Colored active filter - use inline styles for dynamic colors
                    className += "font-medium";
                  } else {
                    className += "font-medium bg-[var(--franco-card)] border-[var(--franco-border-hover)] text-[var(--franco-text)]";
                  }
                } else {
                  className += "bg-[var(--franco-card)] border-[var(--franco-border)] text-[var(--franco-text-secondary)]";
                }

                return (
                  <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={className}
                    style={isActive && c ? {
                      backgroundColor: `color-mix(in srgb, ${c} 6%, transparent)`,
                      borderColor: `color-mix(in srgb, ${c} 40%, transparent)`,
                      color: c,
                      borderWidth: "1.5px",
                    } : undefined}
                  >
                    {f.label} <span className="ml-1 font-mono text-[10px] opacity-70">{f.count}</span>
                  </button>
                );
              })}
            </div>

            {/* ─── Analysis Cards ─── */}
            {filtered.length === 0 ? (
              <div className="py-10 text-center font-body text-[13px] text-[var(--franco-text-secondary)]">
                No hay análisis con este filtro.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filtered.map((item) => {
                  const m = getMetrics(item);
                  const verdict: AnyVerdict = getAnyVerdict(item);
                  const isDeleting = deletingId === item.id;
                  const isSelected = selected.has(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleCardClick(item)}
                      className={`cursor-pointer rounded-xl border bg-[var(--franco-card)] p-4 px-5 transition-all hover:border-[var(--franco-border-hover)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)] ${
                        isSelected ? "border-[var(--franco-border-hover)]" : "border-[var(--franco-border)]"
                      } ${isDeleting ? "pointer-events-none opacity-50" : ""}`}
                    >
                      {/* Row 1: Score + Name + Verdict + Metrics */}
                      <div className="flex items-center gap-3.5">
                        {/* Compare checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-[var(--franco-text)] bg-[var(--franco-text)]"
                              : "border-[var(--franco-border)] hover:border-[var(--franco-border-hover)]"
                          }`}
                          title={isSelected ? "Deseleccionar" : "Seleccionar para comparar"}
                        >
                          {isSelected && (
                            <svg className="h-2.5 w-2.5 text-[var(--franco-bg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        {m.isSTR
                          ? (() => {
                              const strScore = getSTRScore(item);
                              return strScore !== null
                                ? <ScoreCircle score={strScore} />
                                : <STRScoreIcon verdict={verdict as STRVerdict} />;
                            })()
                          : <ScoreCircle score={item.score} />}

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-body text-sm font-medium text-[var(--franco-text)]">{item.nombre}</span>
                            <span className="text-[var(--franco-text-secondary)]">·</span>
                            <span className="font-body text-xs text-[var(--franco-text-secondary)]">{item.comuna}</span>
                            {m.isSTR && (
                              <span
                                className="rounded font-mono text-[7px] font-bold tracking-wide"
                                style={{ padding: "2px 6px", background: "color-mix(in srgb, var(--signal-red) 10%, transparent)", color: "var(--signal-red)" }}
                              >
                                AIRBNB
                              </span>
                            )}
                            {item.is_premium && (
                              <span className="rounded bg-signal-red/10 px-1.5 py-0.5 font-mono text-[7px] font-bold text-signal-red">PRO</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <VerdictBadge verdict={verdict} />
                            <span className="text-[var(--franco-text-secondary)]">·</span>
                            <span className="font-body text-[11px] text-[var(--franco-text-secondary)]">{formatDate(item.created_at)}</span>
                          </div>
                        </div>

                        {/* Metrics (hidden on mobile) */}
                        <div className="hidden items-center gap-4 sm:flex">
                          <div className="min-w-[55px] text-right">
                            <div className="font-body text-[9px] uppercase tracking-wide text-[var(--franco-text-muted)]">FLUJO</div>
                            <div className={`font-mono text-sm font-semibold ${m.flujoMensual < 0 ? "text-signal-red" : "text-[var(--franco-text)]"}`}>
                              {formatCLP(m.flujoMensual)}
                            </div>
                          </div>
                          <div className="min-w-[55px] text-right">
                            <div className="font-body text-[9px] uppercase tracking-wide text-[var(--franco-text-muted)]">{m.primary.label}</div>
                            <div className="font-mono text-sm font-semibold text-[var(--franco-text)]">
                              {m.primary.value}
                            </div>
                          </div>
                          <div className="min-w-[55px] text-right">
                            <div className="font-body text-[9px] uppercase tracking-wide text-[var(--franco-text-muted)]">{m.secondary.label}</div>
                            <div className="font-mono text-sm font-semibold text-[var(--franco-text)]">
                              {m.secondary.value}
                            </div>
                          </div>
                        </div>

                        {/* Delete */}
                        {item.id !== "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1" && (
                          <button
                            onClick={(e) => handleDelete(e, item.id)}
                            className="shrink-0 rounded-lg p-2 text-[var(--franco-text-muted)] transition-colors hover:bg-red-950/30 hover:text-signal-red"
                            title="Eliminar análisis"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Row 2: "Siendo franco:" summary */}
                      <div className="mt-2.5 border-t border-[var(--franco-border)] pt-2.5">
                        <p className="font-body text-xs leading-snug text-[var(--franco-text-secondary)]">
                          <span className="font-medium text-[var(--franco-text)]">Siendo franco:</span>{" "}
                          {m.isSTR
                            ? getSTRSiendoFranco(item)
                            : item.results?.resumen
                              ? item.results.resumen.split(".")[0] + "."
                              : getSiendoFranco(item.score, m.flujoMensual)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Floating Compare Bar ─── */}
      {selected.size >= 2 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--franco-border)] bg-[var(--franco-card)] shadow-2xl shadow-black/20">
          <div className="mx-auto flex max-w-[820px] items-center justify-between px-5 py-3">
            <span className="font-body text-sm font-medium text-[var(--franco-text)]">
              {selected.size} análisis seleccionados
            </span>
            <Link href={`/comparar?ids=${Array.from(selected).join(",")}`}>
              <Button className="gap-2 rounded-xl bg-signal-red px-6 text-sm font-medium text-white hover:bg-signal-red/90">
                Comparar {selected.size} análisis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
