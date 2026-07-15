"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import type { Analisis } from "@/lib/types";
import { readVeredicto } from "@/lib/results-helpers";
import { normalizeLegacyVerdict } from "@/lib/types";
import { fmtM, fmtPct, fmtMult } from "@/components/analysis/utils";
import { sobreRentaPctEsConfiable } from "@/lib/engines/str-universo-santiago";

// Vocabulario unificado LTR + STR (Commit 1 · 2026-05-11). Análisis legacy
// con strings antiguos (VIABLE / AJUSTA ESTRATEGIA / NO RECOMENDADO / AJUSTA
// EL PRECIO) se normalizan en read path via `normalizeLegacyVerdict`.
type UnifiedVerdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";
type LTRVerdict = UnifiedVerdict;
type STRVerdict = UnifiedVerdict;
type AnyVerdict = UnifiedVerdict;
type VerdictFilter = "todos" | AnyVerdict;
type TypeFilter = "todos" | "ltr" | "str";

function getVerdict(score: number, veredictoMotor?: string): LTRVerdict {
  // Commit E.3 · 2026-05-13 — normalizeLegacyVerdict coerce RECONSIDERA →
  // AJUSTA SUPUESTOS. El dashboard ya no necesita branch especial.
  // Fallback por score sigue thresholds canónicos E.1 (70 / 45 / 0).
  const norm = normalizeLegacyVerdict(veredictoMotor);
  if (norm) return norm;
  if (score >= 70) return "COMPRAR";
  if (score >= 45) return "AJUSTA SUPUESTOS";
  return "BUSCAR OTRA";
}

function getSTRVerdict(item: Analisis): STRVerdict {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = item.results as any;
  const raw = r?.francoScore?.veredicto ?? r?.veredicto;
  const norm = normalizeLegacyVerdict(raw);
  return norm ?? "BUSCAR OTRA";
}

function getSTRScore(item: Analisis): number | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (item.results as any)?.francoScore?.score;
  return typeof s === "number" ? s : null;
}

function getAnyVerdict(item: Analisis): AnyVerdict {
  return isShortTerm(item) ? getSTRVerdict(item) : getVerdict(item.score, readVeredicto(item.results));
}

function isShortTerm(item: Analisis): boolean {
  // Paridad con guards LTR/STR (E.1.1): columna SQL es autoritativa, jsonb
  // solo cubre análisis pre-migration 20260510 (cuando la columna era null).
  // Antes leía jsonb solo; eso desincronizaba filtros/conteos del dashboard
  // de los redirects que páginas individuales ya hacían por SQL.
  const sqlTipo = (item as unknown as { tipo_analisis?: string | null }).tipo_analisis;
  if (sqlTipo === "short-term") return true;
  if (sqlTipo === "long-term") return false;
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
    const sobreRentaPctRaw = str?.comparativa?.sobreRentaPct ?? 0;
    const sobreRentaPct = sobreRentaPctRaw * 100;
    // P3 (Rama 0b): % no confiable (NOI-LTR ≤0 o ratio explotado) → "N/D" en vez de un % absurdo.
    // El flag no vive en filas persistidas viejas: lo derivamos inline con el mismo predicado.
    const vsLtrConfiable = sobreRentaPctEsConfiable(str?.comparativa?.ltr?.noiMensual ?? 0, sobreRentaPctRaw);
    return {
      isSTR: true,
      flujoMensual: flujo,
      primary: { label: "CAP RATE", value: fmtPct(capRatePct, 1) },
      secondary: {
        label: "VS LTR",
        value: !vsLtrConfiable ? "N/D" : sobreRentaPct === 0 ? "—" : `${sobreRentaPct > 0 ? "+" : ""}${sobreRentaPct.toFixed(0)}%`,
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
      primary: { label: "RENT.", value: fmtPct(rentabilidadBruta, 1) },
      secondary: { label: "RETORNO", value: multiplicador > 0 ? fmtMult(multiplicador, 1) : "—" },
    };
  }

  const precioCLP = item.precio * 38800;
  const rentabilidadBruta = precioCLP > 0 ? ((item.arriendo * 12) / precioCLP) * 100 : 0;
  const flujoMensual = item.arriendo - item.gastos - item.contribuciones;
  return {
    isSTR: false,
    flujoMensual,
    primary: { label: "RENT.", value: fmtPct(rentabilidadBruta, 1) },
    secondary: { label: "RETORNO", value: "—" },
  };
}

function formatCLP(n: number) {
  return (n < 0 ? "-" : "") + fmtM(Math.abs(n));
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
  const sobreRentaPctRaw = r?.comparativa?.sobreRentaPct ?? 0;
  const sobreRentaPct = Math.round(sobreRentaPctRaw * 100);
  // P3 (Rama 0b): con NOI-LTR ≤0 o ínfimo el % no informa → narrar el monto absoluto, nunca el %.
  const confiable = sobreRentaPctEsConfiable(r?.comparativa?.ltr?.noiMensual ?? 0, sobreRentaPctRaw);
  const sobreRentaAbs = `$${Math.abs(Math.round(sobreRenta)).toLocaleString("es-CL")}/mes`;
  const veredicto = getSTRVerdict(item);
  if (veredicto === "COMPRAR") {
    return confiable
      ? `Airbnb genera +${sobreRentaPct}% más que arriendo largo. Sobre-renta de ${sobreRentaAbs}.`
      : `Airbnb genera ${sobreRentaAbs} más que arriendo largo (el arriendo largo apenas cubre costos, así que el porcentaje no aplica).`;
  }
  if (veredicto === "AJUSTA SUPUESTOS") {
    return confiable
      ? `Airbnb genera levemente más que arriendo largo (+${sobreRentaPct}%). Evalúa si el esfuerzo operativo vale la pena.`
      : `Airbnb genera ${sobreRentaAbs} más que arriendo largo. Evalúa si el esfuerzo operativo vale la pena.`;
  }
  return "El arriendo tradicional es más rentable para esta propiedad. La renta corta no cubre los costos operativos adicionales.";
}

// Commit 1 · 2026-05-11: badges en Ink + Signal Red (Capa 1 binaria del
// franco-design-system). Las variables --franco-v-buy / --franco-v-adjust
// migran a Ink: el color del badge ya no expresa "verde positivo" / "amber
// warning"; expresa jerarquía (Ink primary / Ink secondary / Signal Red).
function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, { color: string; bg: string; border: string }> = {
    COMPRAR: {
      color: "var(--franco-text)",
      bg: "color-mix(in srgb, var(--franco-text) 8%, transparent)",
      border: "color-mix(in srgb, var(--franco-text) 18%, transparent)",
    },
    "AJUSTA SUPUESTOS": {
      color: "var(--franco-text-secondary)",
      bg: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
      border: "color-mix(in srgb, var(--franco-text) 12%, transparent)",
    },
    "BUSCAR OTRA": {
      color: "var(--signal-red)",
      bg: "color-mix(in srgb, var(--signal-red) 6%, transparent)",
      border: "color-mix(in srgb, var(--signal-red) 25%, transparent)",
    },
  };
  // Coerce legacy strings on render (no DB rewrite). normalizeLegacyVerdict
  // mapea RECONSIDERA legacy → AJUSTA SUPUESTOS desde E.3.
  const normalized = normalizeLegacyVerdict(verdict);
  const displayLabel = normalized ?? verdict;
  const s = styles[displayLabel] || styles["AJUSTA SUPUESTOS"];
  return (
    <span
      className="inline-flex font-mono text-[9px] font-bold tracking-wide"
      style={{ padding: "3px 10px", borderRadius: 5, background: s.bg, border: `1.5px solid ${s.border}`, color: s.color }}
    >
      {displayLabel}
    </span>
  );
}

// Commit 1 · 2026-05-11: iconos Ink + Signal Red. Antes COMPRAR usaba
// teal/gray, AJUSTA usaba amber. Capa 1 binaria los reemplaza por gradación
// de Ink + Signal Red exclusivamente para criticidad.
function STRScoreIcon({ verdict }: { verdict: STRVerdict }) {
  const config = {
    COMPRAR: { icon: "✓", color: "var(--franco-text)" },
    "AJUSTA SUPUESTOS": { icon: "⚠", color: "var(--franco-text-secondary)" },
    "BUSCAR OTRA": { icon: "✗", color: "var(--signal-red)" },
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
  // Capa 1 binaria: ScoreCircle migra a Ink + Signal Red.
  // Score >= 75 → Ink primary (operación sólida).
  // Score 40-74 → Ink secondary (operación con ajustes).
  // Score < 40  → Signal Red (criticidad).
  const color = score >= 75
    ? "var(--franco-text)"
    : score >= 40
      ? "var(--franco-text-secondary)"
      : "var(--signal-red)";
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

// ─── Subordinación AMBAS (migración 20260715) ────────────────────────────
// Un AMBAS son DOS filas `analisis` (LTR + STR) con el mismo `ambas_group_id`.
// En "Mis análisis" el par se colapsa en UNA card comparativa; las filas hijas
// nunca aparecen sueltas. Un grupo incompleto (huérfano por fallo parcial de
// creación: un lado no se creó) degrada a card suelta — el hermano no existe.
type DisplayItem =
  | { kind: "single"; row: Analisis }
  | { kind: "ambas"; groupId: string; ltr: Analisis; str: Analisis; created_at: string };

function buildDisplayItems(analisis: Analisis[]): DisplayItem[] {
  const groups = new Map<string, Analisis[]>();
  const items: DisplayItem[] = [];
  for (const a of analisis) {
    const gid = a.ambas_group_id;
    if (gid) {
      const arr = groups.get(gid);
      if (arr) arr.push(a);
      else groups.set(gid, [a]);
    } else {
      items.push({ kind: "single", row: a });
    }
  }
  groups.forEach((members, groupId) => {
    const ltr = members.find((m) => m.ambas_role === "ltr") ?? members.find((m) => !isShortTerm(m));
    const str = members.find((m) => m.ambas_role === "str") ?? members.find((m) => isShortTerm(m));
    if (ltr && str && ltr.id !== str.id) {
      const created_at = ltr.created_at > str.created_at ? ltr.created_at : str.created_at;
      items.push({ kind: "ambas", groupId, ltr, str, created_at });
    } else {
      // Grupo incompleto → degradar cada miembro a card suelta.
      members.forEach((m) => items.push({ kind: "single", row: m }));
    }
  });
  // Reordenar por fecha desc tras agrupar (la lista entra ya ordenada, pero el
  // colapso del par altera el orden).
  items.sort((a, b) => {
    const da = a.kind === "single" ? a.row.created_at : a.created_at;
    const db = b.kind === "single" ? b.row.created_at : b.created_at;
    return db.localeCompare(da);
  });
  return items;
}

function itemVerdicts(item: DisplayItem): AnyVerdict[] {
  if (item.kind === "single") return [getAnyVerdict(item.row)];
  return [getAnyVerdict(item.ltr), getAnyVerdict(item.str)];
}

// ─── Card comparativa (AMBAS) para "Mis análisis" ────────────────────────
// Una sola card por par: abre la comparativa (/analisis/comparativa?ltr=&str=).
// El delete es group-aware (borra las dos filas), con confirm explícito.
function AmbasCard({
  item, onOpen, onDelete, isDeleting,
}: {
  item: Extract<DisplayItem, { kind: "ambas" }>;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}) {
  const { ltr, str } = item;
  const ltrVerdict = getVerdict(ltr.score, readVeredicto(ltr.results));
  const strVerdict = getSTRVerdict(str);
  const strScore = getSTRScore(str) ?? str.score;
  const premium = ltr.is_premium || str.is_premium;

  return (
    <div
      onClick={onOpen}
      className={`cursor-pointer rounded-xl border bg-[var(--franco-card)] p-4 px-5 transition-all hover:border-[var(--franco-border-hover)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)] border-[var(--franco-border)] ${isDeleting ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3.5">
        <ScoreCircle score={ltr.score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-body text-sm font-medium text-[var(--franco-text)]">{ltr.nombre}</span>
            <span className="text-[var(--franco-text-secondary)]">·</span>
            <span className="font-body text-xs text-[var(--franco-text-secondary)]">{ltr.comuna}</span>
            <span
              className="rounded font-mono text-[7px] font-bold tracking-wide"
              style={{ padding: "2px 6px", background: "color-mix(in srgb, var(--franco-text) 10%, transparent)", color: "var(--franco-text)" }}
            >
              AMBAS
            </span>
            {premium && (
              <span className="rounded bg-signal-red/10 px-1.5 py-0.5 font-mono text-[7px] font-bold text-signal-red">✓</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <VerdictBadge verdict={ltrVerdict} />
            <span className="text-[var(--franco-text-secondary)]">·</span>
            <span className="font-body text-[11px] text-[var(--franco-text-secondary)]">{formatDate(item.created_at)}</span>
          </div>
        </div>

        {/* Mini-scores de cada lado (oculto en mobile) */}
        <div className="hidden items-center gap-4 sm:flex">
          <div className="min-w-[70px] text-right">
            <div className="font-body text-[9px] uppercase tracking-wide text-[var(--franco-text-muted)]">RENTA LARGA</div>
            <div className="font-mono text-sm font-semibold text-[var(--franco-text)]">{ltr.score} · {ltrVerdict === "BUSCAR OTRA" ? "✗" : ltrVerdict === "COMPRAR" ? "✓" : "⚠"}</div>
          </div>
          <div className="min-w-[70px] text-right">
            <div className="font-body text-[9px] uppercase tracking-wide text-[var(--franco-text-muted)]">RENTA CORTA</div>
            <div className="font-mono text-sm font-semibold text-[var(--franco-text)]">{strScore} · {strVerdict === "BUSCAR OTRA" ? "✗" : strVerdict === "COMPRAR" ? "✓" : "⚠"}</div>
          </div>
        </div>

        {/* Delete group-aware */}
        <button
          onClick={onDelete}
          className="shrink-0 rounded-lg p-2 text-[var(--franco-text-muted)] transition-colors hover:bg-red-950/30 hover:text-signal-red"
          title="Eliminar comparativa (borra ambos análisis)"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2.5 border-t border-[var(--franco-border)] pt-2.5 flex items-center justify-between">
        <p className="font-body text-xs leading-snug text-[var(--franco-text-secondary)]">
          <span className="font-medium text-[var(--franco-text)]">Comparativa:</span>{" "}
          renta larga vs renta corta para esta propiedad.
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[1px] text-signal-red shrink-0 ml-3">Ver comparativa →</span>
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

  // El welcome email ahora se dispara server-side en dashboard/page.tsx
  // (ensureWelcomeEmail), idempotente y desacoplado del cliente.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Colapsa los pares AMBAS en una card comparativa (subordinación). Todo lo de
  // abajo opera sobre displayItems, no sobre `analisis` crudo.
  const displayItems = useMemo(() => buildDisplayItems(analisis), [analisis]);

  // Summary stats — cada item cuenta como UNA propiedad. Para un AMBAS se toma
  // el mejor de los dos lados como su representante.
  const summaryData = useMemo(() => {
    if (displayItems.length < 3) return null;
    const units = displayItems.map((i) => {
      if (i.kind === "single") {
        return { nombre: i.row.nombre, comuna: i.row.comuna, score: i.row.score, flujo: getMetrics(i.row).flujoMensual };
      }
      const best = i.ltr.score >= i.str.score ? i.ltr : i.str;
      const flujoL = getMetrics(i.ltr).flujoMensual;
      const flujoS = getMetrics(i.str).flujoMensual;
      return { nombre: best.nombre, comuna: best.comuna, score: Math.max(i.ltr.score, i.str.score), flujo: Math.max(flujoL, flujoS) };
    });
    const best = units.reduce((a, b) => (a.score > b.score ? a : b));
    const avgScore = Math.round(units.reduce((sum, u) => sum + u.score, 0) / units.length);
    const positiveFlowCount = units.filter((u) => u.flujo >= 0).length;
    return { best, avgScore, positiveFlowCount, total: units.length };
  }, [displayItems]);

  // Type-filtered base list (applied before verdict filter). Los AMBAS solo
  // aparecen bajo "todos" — no son de una modalidad única.
  const typeFiltered = useMemo(() => {
    if (typeFilter === "todos") return displayItems;
    if (typeFilter === "str") return displayItems.filter((i) => i.kind === "single" && isShortTerm(i.row));
    return displayItems.filter((i) => i.kind === "single" && !isShortTerm(i.row));
  }, [displayItems, typeFilter]);

  // Type counts (single-only para ltr/str; ambas como su propia categoría).
  const typeCounts = useMemo(() => {
    let str = 0, ltr = 0, ambas = 0;
    displayItems.forEach((i) => {
      if (i.kind === "ambas") ambas++;
      else if (isShortTerm(i.row)) str++;
      else ltr++;
    });
    return { str, ltr, ambas, total: displayItems.length };
  }, [displayItems]);

  // Verdict counts (within type-filtered set). Un AMBAS aporta los veredictos
  // de sus dos lados (Set → no duplica si coinciden).
  const verdictCounts = useMemo(() => {
    const counts: Record<string, number> = {
      COMPRAR: 0, "AJUSTA SUPUESTOS": 0, "BUSCAR OTRA": 0,
    };
    typeFiltered.forEach((i) => {
      new Set(itemVerdicts(i)).forEach((v) => { counts[v]++; });
    });
    return counts;
  }, [typeFiltered]);

  // Filtered list — un AMBAS matchea si CUALQUIERA de sus lados tiene el veredicto.
  const filtered = useMemo(() => {
    if (activeFilter === "todos") return typeFiltered;
    return typeFiltered.filter((i) => itemVerdicts(i).includes(activeFilter));
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

  // Delete group-aware: borra las DOS filas del par por ambas_group_id. Confirm
  // explícito con el alcance real (elimina la comparativa + ambos análisis).
  const handleGroupDelete = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    if (!confirm("Esto elimina la comparativa y sus dos análisis (renta larga y renta corta). ¿Continuar?")) return;
    setDeletingId(groupId);
    const supabase = createClient();
    await supabase.from("analisis").delete().eq("ambas_group_id", groupId);
    setDeletingId(null);
    router.refresh();
  };

  // Vocabulario unificado (Commit 1 · 2026-05-11) → un solo set de filtros
  // sirve para LTR, STR y "todos". El typeFilter sigue separando listados;
  // sólo los nombres de filtro se consolidan.
  const unifiedVerdictFilters: { key: VerdictFilter; label: string; color: string }[] = [
    { key: "COMPRAR", label: "Comprar", color: "var(--franco-text)" },
    { key: "AJUSTA SUPUESTOS", label: "Ajusta supuestos", color: "var(--franco-text-secondary)" },
    { key: "BUSCAR OTRA", label: "Buscar otra", color: "var(--signal-red)" },
  ];
  const verdictFilterSet = unifiedVerdictFilters.filter((f) =>
    typeFilter !== "todos" || (verdictCounts[f.key as string] ?? 0) > 0
  );

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
      <UnifiedNav variant="app" />

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
                  {displayItems.length} propiedad{displayItems.length !== 1 ? "es" : ""} analizada{displayItems.length !== 1 ? "s" : ""}
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
                {filtered.map((disp) => {
                  // AMBAS → una card comparativa (subordinación). Nunca renderiza
                  // sus filas hijas por separado.
                  if (disp.kind === "ambas") {
                    return (
                      <AmbasCard
                        key={disp.groupId}
                        item={disp}
                        onOpen={() => router.push(`/analisis/comparativa?ltr=${disp.ltr.id}&str=${disp.str.id}`)}
                        onDelete={(e) => handleGroupDelete(e, disp.groupId)}
                        isDeleting={deletingId === disp.groupId}
                      />
                    );
                  }
                  const item = disp.row;
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
                              <span className="rounded bg-signal-red/10 px-1.5 py-0.5 font-mono text-[7px] font-bold text-signal-red">✓</span>
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
