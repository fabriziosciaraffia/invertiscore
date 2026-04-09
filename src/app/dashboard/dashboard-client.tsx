"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import FrancoLogo from "@/components/franco-logo";
import { LogoutButton } from "@/components/logout-button";
import type { Analisis } from "@/lib/types";
import { User } from "lucide-react";

type VerdictFilter = "todos" | "COMPRAR" | "AJUSTA EL PRECIO" | "BUSCAR OTRA";

function getVerdict(score: number, veredictoMotor?: string): "COMPRAR" | "AJUSTA EL PRECIO" | "BUSCAR OTRA" {
  if (veredictoMotor === "COMPRAR" || veredictoMotor === "AJUSTA EL PRECIO" || veredictoMotor === "BUSCAR OTRA") return veredictoMotor;
  if (score >= 75) return "COMPRAR";
  if (score >= 40) return "AJUSTA EL PRECIO";
  return "BUSCAR OTRA";
}


function getMetrics(item: Analisis) {
  const r = item.results;
  if (r?.metrics) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = r.metrics as any;
    return {
      rentabilidadBruta: raw.rentabilidadBruta ?? raw.yieldBruto ?? 0,
      flujoMensual: r.metrics.flujoNetoMensual ?? 0,
      capRate: raw.capRate ?? 0,
      precioM2: r.metrics.precioM2 ?? 0,
      multiplicador: r.exitScenario?.multiplicadorCapital ?? 0,
    };
  }
  const precioCLP = item.precio * 38800;
  const rentabilidadBruta = precioCLP > 0 ? ((item.arriendo * 12) / precioCLP) * 100 : 0;
  const flujoMensual = item.arriendo - item.gastos - item.contribuciones;
  return {
    rentabilidadBruta,
    flujoMensual,
    capRate: 0,
    precioM2: item.superficie > 0 ? item.precio / item.superficie : 0,
    multiplicador: 0,
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

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, { color: string; bg: string; border: string }> = {
    COMPRAR: { color: "#B0BEC5", bg: "rgba(176,190,197,0.07)", border: "rgba(176,190,197,0.2)" },
    "AJUSTA EL PRECIO": { color: "#FBBF24", bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.2)" },
    "BUSCAR OTRA": { color: "#C8323C", bg: "rgba(220,38,38,0.07)", border: "rgba(220,38,38,0.2)" },
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

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 75 ? "#B0BEC5" : score >= 40 ? "#FBBF24" : "#C8323C";
  const dashLen = (score / 100) * 126;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
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
        <span className="font-heading text-base font-bold text-[#FAFAF8]">{score}</span>
      </div>
    </div>
  );
}

export function DashboardClient({ analisis, firstName = "" }: { analisis: Analisis[]; firstName?: string }) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<VerdictFilter>("todos");

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

  // Verdict counts
  const verdictCounts = useMemo(() => {
    const counts: Record<string, number> = { COMPRAR: 0, "AJUSTA EL PRECIO": 0, "BUSCAR OTRA": 0 };
    analisis.forEach((a) => { counts[getVerdict(a.score, a.results?.veredicto)]++; });
    return counts;
  }, [analisis]);

  // Filtered list
  const filtered = useMemo(() => {
    if (activeFilter === "todos") return analisis;
    return analisis.filter((a) => getVerdict(a.score, a.results?.veredicto) === activeFilter);
  }, [analisis, activeFilter]);

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

  const filters: { key: VerdictFilter; label: string; count: number; color: string | null }[] = [
    { key: "todos", label: "Todos", count: analisis.length, color: null },
    { key: "COMPRAR", label: "Comprar", count: verdictCounts.COMPRAR, color: "#B0BEC5" },
    { key: "AJUSTA EL PRECIO", label: "Ajusta precio", count: verdictCounts["AJUSTA EL PRECIO"], color: "#FBBF24" },
    { key: "BUSCAR OTRA", label: "Buscar otra", count: verdictCounts["BUSCAR OTRA"], color: "#C8323C" },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0F0F0F]">
        <div className="mx-auto flex h-14 max-w-[820px] items-center justify-between px-5">
          <FrancoLogo size="header" href="/" inverted />
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <span className="rounded-md bg-[#C8323C] px-3 py-1.5 font-body text-sm font-bold text-white transition-colors hover:bg-[#C8323C]/90">Premium</span>
            </Link>
            <Link href="/cuenta">
              <Button variant="ghost" size="sm" className="gap-1.5 text-[#FAFAF8]/50 hover:text-[#FAFAF8]">
                <User className="h-4 w-4" /> <span className="hidden sm:inline">Mi Cuenta</span>
              </Button>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-[820px] px-5 py-7">
        {analisis.length === 0 ? (
          /* ─── Empty State ─── */
          <div className="px-6 py-16 text-center">
            <div className="mb-6 flex select-none items-baseline justify-center opacity-[0.08]">
              <span className="font-heading text-[64px] font-normal italic leading-none tracking-tight text-[#FAFAF8]">re</span>
              <span className="font-heading text-[64px] font-bold leading-none tracking-tight text-[#FAFAF8]">franco</span>
              <span className="ml-1 font-body text-sm font-semibold uppercase tracking-wider text-[#C8323C]">.ai</span>
            </div>
            <div className="mb-1.5 font-heading text-xl font-bold text-[#FAFAF8]">
              Todavía no has analizado ningún departamento
            </div>
            <div className="mx-auto mb-6 max-w-[340px] font-body text-[13px] text-[#FAFAF8]/50">
              Ingresa los datos de cualquier propiedad y Franco te dice si vale la pena en 30 segundos.
            </div>
            <Link href="/analisis/nuevo">
              <button className="rounded-lg bg-[#C8323C] px-7 py-3 font-body text-sm font-bold text-white shadow-[0_2px_12px_rgba(200,50,60,0.2)]">
                Analizar mi primer departamento →
              </button>
            </Link>
            <div className="mt-3">
              <a href="/analisis/6db7a9ac-f030-4ccf-b5a8-5232ae997fb1" className="font-body text-xs text-[#FAFAF8]/50 no-underline hover:text-[#FAFAF8]">
                O mira un ejemplo primero →
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* ─── Header ─── */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h1 className="font-heading text-2xl font-bold text-[#FAFAF8]">{firstName ? `${firstName}, estas son tus inversiones` : "Tus inversiones"}</h1>
                <p className="mt-0.5 font-body text-[13px] text-[#FAFAF8]/50">
                  {analisis.length} propiedad{analisis.length !== 1 ? "es" : ""} analizada{analisis.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Link href="/analisis/nuevo">
                <button className="rounded-lg bg-[#C8323C] px-5 py-2.5 font-body text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(200,50,60,0.15)]">
                  Analizar nuevo →
                </button>
              </Link>
            </div>

            {/* ─── Summary Cards ─── */}
            {summaryData && (
              <div className="mb-5 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                {/* Best analysis */}
                <div className="rounded-[10px] border border-white/[0.08] bg-[#151515] p-3.5 px-4">
                  <div className="mb-1 font-body text-[9px] uppercase tracking-wide text-[#FAFAF8]/50">MEJOR ANÁLISIS</div>
                  <div className="font-body text-[13px] font-semibold text-[#FAFAF8]">
                    {summaryData.best.nombre} · {summaryData.best.comuna}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#FAFAF8]/50">Score {summaryData.best.score}</div>
                </div>
                {/* Average */}
                <div className="rounded-[10px] border border-white/[0.08] bg-[#151515] p-3.5 px-4">
                  <div className="mb-1 font-body text-[9px] uppercase tracking-wide text-[#FAFAF8]/50">PROMEDIO</div>
                  <div className="font-heading text-[22px] font-bold text-[#FAFAF8]">{summaryData.avgScore}</div>
                  <div className="mt-0.5 font-body text-[10px] text-[#FAFAF8]/50">score promedio</div>
                </div>
                {/* Positive flow */}
                <div className="rounded-[10px] border border-white/[0.08] bg-[#151515] p-3.5 px-4">
                  <div className="mb-1 font-body text-[9px] uppercase tracking-wide text-[#FAFAF8]/50">FLUJO POSITIVO</div>
                  <div className={`font-heading text-[22px] font-bold ${summaryData.positiveFlowCount === 0 ? "text-[#C8323C]" : "text-[#FAFAF8]"}`}>
                    {summaryData.positiveFlowCount}/{summaryData.total}
                  </div>
                  <div className="mt-0.5 font-body text-[10px] text-[#FAFAF8]/50">propiedades</div>
                </div>
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
                    className += "font-semibold";
                  } else {
                    className += "font-semibold bg-white/[0.05] border-white/40 text-[#FAFAF8]";
                  }
                } else {
                  className += "bg-[#151515] border-white/[0.08] text-[#FAFAF8]/50";
                }

                return (
                  <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={className}
                    style={isActive && c ? {
                      backgroundColor: `${c}10`,
                      borderColor: `${c}66`,
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
              <div className="py-10 text-center font-body text-[13px] text-[#FAFAF8]/50">
                No hay análisis con este filtro.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filtered.map((item) => {
                  const m = getMetrics(item);
                  const verdict = getVerdict(item.score, item.results?.veredicto);
                  const isDeleting = deletingId === item.id;
                  const isSelected = selected.has(item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => router.push(`/analisis/${item.id}`)}
                      className={`cursor-pointer rounded-xl border bg-[#151515] p-4 px-5 transition-all hover:border-white/20 hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)] ${
                        isSelected ? "border-white/30" : "border-white/[0.08]"
                      } ${isDeleting ? "pointer-events-none opacity-50" : ""}`}
                    >
                      {/* Row 1: Score + Name + Verdict + Metrics */}
                      <div className="flex items-center gap-3.5">
                        {/* Compare checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-[#FAFAF8] bg-[#FAFAF8]"
                              : "border-white/[0.08] hover:border-white/40"
                          }`}
                          title={isSelected ? "Deseleccionar" : "Seleccionar para comparar"}
                        >
                          {isSelected && (
                            <svg className="h-2.5 w-2.5 text-[#0F0F0F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        <ScoreCircle score={item.score} />

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-body text-sm font-bold text-[#FAFAF8]">{item.nombre}</span>
                            <span className="text-[#FAFAF8]/50">·</span>
                            <span className="font-body text-xs text-[#FAFAF8]/50">{item.comuna}</span>
                            {item.is_premium && (
                              <span className="rounded bg-[#C8323C]/10 px-1.5 py-0.5 font-mono text-[7px] font-bold text-[#C8323C]">PRO</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <VerdictBadge verdict={verdict} />
                            <span className="text-[#FAFAF8]/50">·</span>
                            <span className="font-body text-[11px] text-[#FAFAF8]/50">{formatDate(item.created_at)}</span>
                          </div>
                        </div>

                        {/* Metrics (hidden on mobile) */}
                        <div className="hidden items-center gap-4 sm:flex">
                          <div className="min-w-[55px] text-right">
                            <div className="font-body text-[9px] uppercase tracking-wide text-[#FAFAF8]/50">FLUJO</div>
                            <div className={`font-mono text-sm font-semibold ${m.flujoMensual < 0 ? "text-[#C8323C]" : "text-[#FAFAF8]"}`}>
                              {formatCLP(m.flujoMensual)}
                            </div>
                          </div>
                          <div className="min-w-[55px] text-right">
                            <div className="font-body text-[9px] uppercase tracking-wide text-[#FAFAF8]/50">RENT.</div>
                            <div className="font-mono text-sm font-semibold text-[#FAFAF8]">
                              {m.rentabilidadBruta.toFixed(1)}%
                            </div>
                          </div>
                          <div className="min-w-[55px] text-right">
                            <div className="font-body text-[9px] uppercase tracking-wide text-[#FAFAF8]/50">RETORNO</div>
                            <div className="font-mono text-sm font-semibold text-[#FAFAF8]">
                              {m.multiplicador > 0 ? `${m.multiplicador.toFixed(1)}x` : "—"}
                            </div>
                          </div>
                        </div>

                        {/* Delete */}
                        {item.id !== "6db7a9ac-f030-4ccf-b5a8-5232ae997fb1" && (
                          <button
                            onClick={(e) => handleDelete(e, item.id)}
                            className="shrink-0 rounded-lg p-2 text-white/20 transition-colors hover:bg-red-950/30 hover:text-[#C8323C]"
                            title="Eliminar análisis"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Row 2: "Siendo franco:" summary */}
                      <div className="mt-2.5 border-t border-white/[0.08] pt-2.5">
                        <p className="font-body text-xs leading-snug text-[#FAFAF8]/50">
                          <span className="font-semibold text-[#FAFAF8]">Siendo franco:</span>{" "}
                          {item.results?.resumen
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
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#151515] shadow-2xl shadow-black/20">
          <div className="mx-auto flex max-w-[820px] items-center justify-between px-5 py-3">
            <span className="font-body text-sm font-medium text-white">
              {selected.size} análisis seleccionados
            </span>
            <Link href={`/comparar?ids=${Array.from(selected).join(",")}`}>
              <Button className="gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#0F0F0F] hover:bg-[#FAFAF8]">
                Comparar {selected.size} análisis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
