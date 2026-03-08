"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  BarChart3,
  Search,
  Trash2,
  ArrowRight,
  User,
  ArrowUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/components/logout-button";
import type { Analisis } from "@/lib/types";

type SortKey = "score" | "date" | "precio" | "flujo";
type FilterKey = "all" | "buena" | "regular" | "debil";

function getScoreColor(score: number) {
  if (score >= 80) return "#059669";
  if (score >= 65) return "#059669";
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

function getMetrics(item: Analisis) {
  const r = item.results;
  if (r?.metrics) {
    return {
      yieldBruto: r.metrics.yieldBruto,
      flujoMensual: r.metrics.flujoNetoMensual,
      capRate: r.metrics.capRate,
      precioM2: r.metrics.precioM2,
    };
  }
  // Fallback: calculate basic metrics from raw data
  const precioCLP = item.precio * 38800;
  const yieldBruto = precioCLP > 0 ? ((item.arriendo * 12) / precioCLP) * 100 : 0;
  const flujoMensual = item.arriendo - item.gastos - item.contribuciones;
  return {
    yieldBruto,
    flujoMensual,
    capRate: 0,
    precioM2: item.superficie > 0 ? item.precio / item.superficie : 0,
  };
}

function formatCLP(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${n >= 0 ? "" : "-"}$${(Math.abs(n) / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${n >= 0 ? "" : "-"}$${Math.round(Math.abs(n) / 1000)}K`;
  return `$${Math.round(n)}`;
}

export function DashboardClient({ analisis }: { analisis: Analisis[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    if (analisis.length === 0) return null;
    const scores = analisis.map((a) => a.score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const best = analisis.reduce((a, b) => (a.score > b.score ? a : b));
    return { count: analisis.length, avgScore, bestName: best.nombre, bestScore: best.score };
  }, [analisis]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = analisis.filter((a) =>
      a.nombre.toLowerCase().includes(search.toLowerCase())
    );
    if (filter === "buena") list = list.filter((a) => a.score >= 60);
    else if (filter === "regular") list = list.filter((a) => a.score >= 40 && a.score < 60);
    else if (filter === "debil") list = list.filter((a) => a.score < 40);

    list.sort((a, b) => {
      switch (sortBy) {
        case "score": return b.score - a.score;
        case "date": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "precio": return b.precio - a.precio;
        case "flujo": return getMetrics(b).flujoMensual - getMetrics(a).flujoMensual;
        default: return 0;
      }
    });
    return list;
  }, [analisis, search, filter, sortBy]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
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

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "score", label: "Score" },
    { key: "date", label: "Fecha" },
    { key: "precio", label: "Precio" },
    { key: "flujo", label: "Flujo" },
  ];

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "buena", label: "Buena (60+)" },
    { key: "regular", label: "Regular (40-59)" },
    { key: "debil", label: "Débil (<40)" },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Navbar */}
      <nav className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="font-serif text-xl font-bold text-[#1a1a1a]">
            InvertiScore
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/perfil">
              <Button variant="ghost" size="sm" className="gap-1.5 text-[#6b7280] hover:text-[#1a1a1a]">
                <User className="h-4 w-4" /> <span className="hidden sm:inline">Mi Perfil</span>
              </Button>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#111827] sm:text-3xl">Mis Análisis</h1>
            {stats && (
              <p className="mt-1 text-sm text-[#6b7280]">
                {stats.count} análisis · Score promedio: {stats.avgScore} · Mejor inversión: {stats.bestName}
              </p>
            )}
          </div>
          <Link href="/analisis/nuevo">
            <Button className="w-full gap-2 rounded-xl bg-[#059669] text-white transition-all hover:bg-[#047857] hover:shadow-md sm:w-auto">
              <Plus className="h-4 w-4" /> Nuevo Análisis
            </Button>
          </Link>
        </div>

        {analisis.length === 0 ? (
          /* Empty state */
          <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d1d5db] bg-white p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ecfdf5]">
              <BarChart3 className="h-8 w-8 text-[#059669]" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[#111827]">Aún no has analizado ninguna propiedad</h2>
            <p className="mt-2 text-[#6b7280]">
              Crea tu primer análisis y descubre si es buena inversión.
            </p>
            <Link href="/analisis/nuevo" className="mt-6">
              <Button className="gap-2 rounded-xl bg-[#059669] px-6 py-5 text-white transition-all hover:bg-[#047857] hover:shadow-md">
                Hacer mi primer análisis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Filters bar */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 rounded-lg border-[#e5e7eb] pl-9 text-sm focus-visible:ring-[#059669]"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white p-0.5">
                  <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-[#9ca3af]" />
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setSortBy(opt.key)}
                      className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        sortBy === opt.key
                          ? "bg-[#059669] text-white"
                          : "text-[#6b7280] hover:text-[#111827]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white p-0.5">
                  {filterOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setFilter(opt.key)}
                      className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        filter === opt.key
                          ? "bg-[#059669] text-white"
                          : "text-[#6b7280] hover:text-[#111827]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results count */}
            <p className="mt-4 text-xs text-[#9ca3af]">
              {filtered.length} de {analisis.length} análisis
              {selected.size > 0 && ` · ${selected.size} seleccionados`}
            </p>

            {/* Analysis cards */}
            <div className="mt-4 space-y-3">
              {filtered.map((item) => {
                const m = getMetrics(item);
                const color = getScoreColor(item.score);
                const label = getScoreLabel(item.score);
                const isSelected = selected.has(item.id);
                const isDeleting = deletingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`group rounded-xl border bg-white transition-all duration-200 hover:shadow-md ${
                      isSelected ? "border-[#059669] shadow-sm" : "border-[#e5e7eb]"
                    } ${isDeleting ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <div className="flex items-start gap-3 p-4 sm:items-center sm:gap-4 sm:p-5">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(item.id)}
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors sm:mt-0 ${
                          isSelected
                            ? "border-[#059669] bg-[#059669]"
                            : "border-[#d1d5db] hover:border-[#059669]"
                        }`}
                        title={isSelected ? "Deseleccionar" : "Seleccionar para comparar"}
                      >
                        {isSelected && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Score circle */}
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px]"
                        style={{ borderColor: color }}
                      >
                        <div className="text-center">
                          <div className="text-sm font-bold" style={{ color }}>{item.score}</div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <Link href={`/analisis/${item.id}`} className="truncate text-sm font-semibold text-[#111827] hover:text-[#059669] sm:text-base">
                            {item.nombre}
                          </Link>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${color}15`, color }}>
                              {label}
                            </span>
                            {item.is_premium && (
                              <span className="rounded-full bg-[#059669]/10 px-2 py-0.5 text-[11px] font-medium text-[#059669]">Pro</span>
                            )}
                            {!item.is_premium && (
                              <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-medium text-[#9ca3af]">Gratis</span>
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-[#9ca3af]">
                          {item.comuna} · {new Date(item.created_at).toLocaleDateString("es-CL")}
                        </p>

                        {/* Metrics mini-grid */}
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4 sm:gap-x-6">
                          <div>
                            <span className="text-[11px] text-[#9ca3af]">Yield bruto</span>
                            <div className="text-xs font-semibold text-[#111827]">{m.yieldBruto.toFixed(1)}%</div>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#9ca3af]">Flujo mensual</span>
                            <div className={`text-xs font-semibold ${m.flujoMensual >= 0 ? "text-[#059669]" : "text-[#ef4444]"}`}>
                              {formatCLP(m.flujoMensual)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#9ca3af]">CAP rate</span>
                            <div className="text-xs font-semibold text-[#111827]">{m.capRate.toFixed(1)}%</div>
                          </div>
                          <div>
                            <span className="text-[11px] text-[#9ca3af]">UF/m²</span>
                            <div className="text-xs font-semibold text-[#111827]">{m.precioM2.toFixed(1)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-2">
                        <Link href={`/analisis/${item.id}`}>
                          <Button variant="ghost" size="sm" className="hidden text-xs text-[#059669] hover:bg-[#ecfdf5] hover:text-[#047857] sm:inline-flex">
                            Ver análisis
                          </Button>
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg p-2 text-[#d1d5db] transition-colors hover:bg-red-50 hover:text-[#ef4444]"
                          title="Eliminar análisis"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && analisis.length > 0 && (
              <div className="mt-8 text-center">
                <p className="text-sm text-[#9ca3af]">No se encontraron análisis con ese filtro.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating compare bar */}
      {selected.size >= 2 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#047857] bg-[#059669] shadow-2xl shadow-black/20">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 sm:px-6">
            <span className="text-sm font-medium text-white">
              {selected.size} análisis seleccionados
            </span>
            <Link href={`/comparar?ids=${Array.from(selected).join(",")}`}>
              <Button className="gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#059669] hover:bg-[#f0fdf4]">
                Comparar {selected.size} análisis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
