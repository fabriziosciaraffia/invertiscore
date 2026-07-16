"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UnifiedNav } from "@/components/chrome/UnifiedNav";
import { ShareButton } from "@/components/chrome/ShareButton";
import { AppFooter } from "@/components/chrome/AppFooter";
import { WalletStatusCTA } from "@/components/chrome/WalletStatusCTA";
import { HeroComparativa } from "@/components/comparativa/HeroComparativa";
import { TablaSideBySide } from "@/components/comparativa/TablaSideBySide";
import { PatrimonioChartComparativa } from "@/components/comparativa/PatrimonioChartComparativa";
import { FlujoMensualChart } from "@/components/comparativa/FlujoMensualChart";
import { NarrativaIAComparativa } from "@/components/comparativa/NarrativaIAComparativa";
import { PiramideComparativa } from "@/components/comparativa/PiramideComparativa";
import { ctxFromResults, buildFindingsComparativa } from "@/lib/comparativa-findings";
import type {
  FullAnalysisResult,
  AIAnalysisComparativa,
  RecomendacionModalidadAmbas,
} from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import {
  normalizeLegacyVerdict,
} from "@/lib/types";
import { readVeredicto } from "@/lib/results-helpers";
import { deriveRecomendacionModalidad } from "@/lib/engines/str-universo-santiago";

type AccessLevel = "guest" | "free" | "premium" | "subscriber";
type STRVerdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

interface Props {
  ltrId: string;
  strId: string;
  shareToken: string;
  nombre: string;
  comuna: string;
  ciudad: string;
  direccion?: string;
  dormitorios: number;
  banos: number;
  superficie: number;
  precioUF: number;
  antiguedad?: number;
  piePct?: number;
  plazoAnios?: number;
  tasaPct?: number;
  ltrScore: number;
  strScore: number;
  // Resultados nested (refactor Step 1+2)
  ltrResults: FullAnalysisResult | null;
  strResults: ShortTermResult | null;
  cachedAI: AIAnalysisComparativa | null;
  // Inputs específicos (necesarios para tabla + pirámide)
  costoAmoblamiento: number;
  modoGestion: "auto" | "admin";
  comisionAdministrador: number;
  edificioPermiteAirbnb: string;
  // UI
  ufValue: number;
  accessLevel: AccessLevel;
  isOwner: boolean;
  isSharedView: boolean;
  userCredits: number;
  welcomeAvailable: boolean;
}

// ─── CurrencyToggle compartido ───────────────────────────────────────────
function CurrencyToggle({
  currency, onToggle, uf,
}: { currency: "CLP" | "UF"; onToggle: () => void; uf: number }) {
  return (
    <div className="flex items-center justify-between border border-[var(--franco-border)] bg-[var(--franco-card)] rounded-2xl px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="relative flex h-8 w-20 items-center rounded-full bg-[var(--franco-border)] p-1 transition-colors"
          aria-label="Cambiar moneda"
        >
          <div
            className={`absolute h-6 w-9 rounded-full bg-[var(--franco-text)] transition-transform ${currency === "UF" ? "translate-x-[40px]" : "translate-x-0"}`}
          />
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "CLP" ? "text-[var(--franco-bg)]" : "text-[var(--franco-text-secondary)]"}`}>
            CLP
          </span>
          <span className={`relative z-10 flex-1 text-center text-xs font-medium ${currency === "UF" ? "text-[var(--franco-bg)]" : "text-[var(--franco-text-secondary)]"}`}>
            UF
          </span>
        </button>
        {currency === "CLP" && (
          <span className="text-xs text-[var(--franco-text-secondary)]">
            UF = ${uf.toLocaleString("es-CL")}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Fallback de recomendacionModalidad para análisis legacy ─────────────
// Delega en `deriveRecomendacionModalidad` del motor (única fuente de verdad
// compartida con el endpoint comparativa/ai server-side).
function deriveRecomendacionFallback(
  strResults: ShortTermResult | null,
): RecomendacionModalidadAmbas {
  if (!strResults) return "INDIFERENTE";
  return deriveRecomendacionModalidad({
    recomendacionModalidad: strResults.recomendacionModalidad,
    zonaSTR: strResults.zonaSTR,
    sobreRentaPct: strResults.comparativa?.sobreRentaPct ?? 0,
    // P3 (Rama 0b): contexto para clasificar por absoluto cuando el ratio degenera.
    ltrNoiMensual: strResults.comparativa?.ltr?.noiMensual,
    sobreRenta: strResults.comparativa?.sobreRenta,
    strNoiMensual: strResults.comparativa?.str_auto?.noiMensual,
  });
}

// ─── Componente principal ───────────────────────────────────────────────
export function ComparativaClient(p: Props) {
  const router = useRouter();
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const [deleting, setDeleting] = useState(false);
  const uf = p.ufValue;

  // Pirámide diferencial (D3) — findings motor-templated, recomputados por moneda.
  const findings = useMemo(() => {
    const ctx = ctxFromResults(p.ltrResults, p.strResults, {
      modoGestion: p.modoGestion,
      comisionAdministrador: p.comisionAdministrador,
      costoAmoblamiento: p.costoAmoblamiento,
      edificioPermiteAirbnb: p.edificioPermiteAirbnb,
    });
    return ctx ? buildFindingsComparativa(ctx, currency, uf) : [];
  }, [p.ltrResults, p.strResults, p.modoGestion, p.comisionAdministrador, p.costoAmoblamiento, p.edificioPermiteAirbnb, currency, uf]);

  // Subsidio: mini-línea solo si califica de un lado (idéntico en ambas modalidades).
  const subsidioCalifica =
    (p.ltrResults?.metrics?.subsidioTasa?.califica ?? false) ||
    (p.strResults?.subsidioTasa?.califica ?? false);

  // Delete group-aware: el comparativo es el producto — borrarlo elimina las DOS
  // filas hijas (LTR + STR). Confirm explícito con el alcance real. Solo owner.
  const handleDeleteGroup = async () => {
    if (deleting) return;
    if (!confirm("Esto elimina la comparativa y sus dos análisis (renta larga y renta corta). ¿Continuar?")) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("analisis").delete().in("id", [p.ltrId, p.strId]);
    router.push("/dashboard");
    router.refresh();
  };

  // Recomendación driver
  const recomendacion = useMemo(
    () => deriveRecomendacionFallback(p.strResults),
    [p.strResults],
  );

  // Veredictos individuales
  const ltrVerdict = useMemo(
    () => readVeredicto(p.ltrResults) ?? null,
    [p.ltrResults],
  );
  const strVerdict = useMemo<STRVerdict | null>(
    () => (normalizeLegacyVerdict(p.strResults?.veredicto) as STRVerdict) ?? null,
    [p.strResults],
  );

  // KPIs derivados para la tabla (Acto 3) + el delta del hero.
  const ltrNOIMensual = (p.ltrResults?.metrics?.noi ?? 0) / 12;
  const ltrNOIAnualY1 = ltrNOIMensual * 12;
  // Año 5 — usar projection si existe; fallback al año 1 con ajuste inflación 3%.
  const ltrY5 = p.ltrResults?.projections?.[4];
  const ltrNOIAnualY5 = ltrY5 ? ltrY5.flujoAnual + (p.ltrResults?.metrics?.dividendo ?? 0) * 12 : ltrNOIAnualY1 * Math.pow(1.03, 4);
  // Capital inicial simétrico vs STR.capitalInvertido: LTR inversionInicial (pie+cierre+
  // CapEx+corretaje) del objeto retorno/exit; fallback a pieCLP si no llega. Coherente con
  // el finding de capital de la pirámide (evita la contradicción pieCLP vs capitalInvertido).
  const ltrRetorno = p.ltrResults as unknown as { retorno?: { inversionInicial?: number }; exitScenario?: { inversionInicial?: number } } | null;
  const ltrCapital =
    ltrRetorno?.retorno?.inversionInicial ?? ltrRetorno?.exitScenario?.inversionInicial ?? p.ltrResults?.metrics?.pieCLP ?? 0;

  const strBase = p.strResults?.escenarios?.base;
  const strNOIMensual = strBase?.noiMensual ?? 0;
  const strRampUp = p.strResults?.perdidaRampUp ?? 0;
  const strNOIAnualY1 = strNOIMensual * 12 - strRampUp;
  const strY5 = p.strResults?.projections?.[4];
  const strNOIAnualY5 = strY5
    ? (strY5.flujoOperacionalAnual + (p.strResults?.dividendoMensual ?? 0) * 12)
    : strNOIMensual * 12 * Math.pow(1.03, 4);
  const strCapital = p.strResults?.capitalInvertido ?? 0;

  const deltaNOIMensual = strNOIMensual - ltrNOIMensual;

  // Chrome
  const footerLinks = (
    <div className="flex items-center gap-4">
      <Link href="/terms" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
        Términos
      </Link>
      <Link href="/privacy" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
        Privacidad
      </Link>
      <Link href="/privacy#cookies" className="font-body text-[11px] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] transition-colors">
        Cookies
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--franco-bg)] flex flex-col">
      <UnifiedNav
        variant="app"
        actionsSlot={
          <div className="flex items-center gap-2">
            <ShareButton
              path={`/share/comparativa/${p.shareToken}`}
              analysisId={p.shareToken}
              modalidad="AMBAS"
              pdfUrl={`/api/share/comparativa/${p.shareToken}/pdf`}
              title={`Comparativa Franco: ${p.nombre || `Depto en ${p.comuna}`}`}
              text="¿Arriendo tradicional o Airbnb? Franco comparó las dos modalidades de este depto con datos reales."
              comuna={p.comuna}
            />
            {/* Delete group-aware — solo owner (subordinación: el comparativo es
                el producto; borrarlo elimina ambos hijos). */}
            {p.isOwner && (
              <button
                type="button"
                onClick={handleDeleteGroup}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-body text-[13px] text-[var(--franco-text-secondary)] transition-colors hover:text-signal-red disabled:opacity-50"
                title="Eliminar comparativa (borra ambos análisis)"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
          </div>
        }
      />

      <main className="flex-1">
        <div className="container mx-auto max-w-[1100px] px-4 sm:px-6 py-8">
          {/* Toggle moneda */}
          <div className="mb-5">
            <CurrencyToggle
              currency={currency}
              onToggle={() => setCurrency((c) => (c === "CLP" ? "UF" : "CLP"))}
              uf={uf}
            />
          </div>

          {/* ── ACTO 1 · Hero — veredicto de modalidad protagonista + TOP-3 + minis + posición ── */}
          <HeroComparativa
            recomendacion={recomendacion}
            fragil={p.strResults?.veredictoComparativo?.fragil ?? false}
            nombre={p.nombre}
            comuna={p.comuna}
            direccion={p.direccion}
            superficie={p.superficie}
            precioUF={p.precioUF}
            dormitorios={p.dormitorios}
            banos={p.banos}
            antiguedad={p.antiguedad}
            piePct={p.piePct}
            plazoAnios={p.plazoAnios}
            tasaPct={p.tasaPct}
            deltaNOIMensual={deltaNOIMensual}
            findings={findings}
            ltrId={p.ltrId}
            strId={p.strId}
            ltrScore={p.ltrScore}
            ltrVerdict={ltrVerdict}
            strScore={p.strScore}
            strVerdict={strVerdict}
            currency={currency}
            ufValue={uf}
          />

          {/* ── ACTO 2 · Pirámide diferencial (D3) + drawers puente (D4) ── */}
          {findings.length > 0 && (
            <PiramideComparativa findings={findings} ltrId={p.ltrId} strId={p.strId} />
          )}

          {/* ── ACTO 3 · La evidencia — superficie recesiva que respalda la pirámide ── */}
          <div className="mb-8">
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[3px] mb-1" style={{ color: "var(--franco-text-secondary)" }}>
                03 · LA EVIDENCIA
              </p>
              <h2 className="font-heading text-[19px] sm:text-[22px] font-bold leading-tight" style={{ color: "var(--franco-text)" }}>
                El destino es el mismo; el camino, distinto
              </h2>
            </div>

            {/* Tabla línea-por-línea (podada: sin fila veredicto motor) */}
            <TablaSideBySide
              ltrNOIMensual={ltrNOIMensual}
              strNOIMensual={strNOIMensual}
              ltrNOIAnualY1={ltrNOIAnualY1}
              strNOIAnualY1={strNOIAnualY1}
              ltrNOIAnualY5={ltrNOIAnualY5}
              strNOIAnualY5={strNOIAnualY5}
              ltrCapital={ltrCapital}
              strCapital={strCapital}
              costoAmoblamiento={p.costoAmoblamiento}
              modoGestion={p.modoGestion}
              comisionAdministrador={p.comisionAdministrador}
              currency={currency}
              ufValue={uf}
            />

            {/* Dos columnas: Patrimonio (destino igual) | Volatilidad (camino distinto) */}
            {p.ltrResults && p.strResults && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <PatrimonioChartComparativa ltrResults={p.ltrResults} strResults={p.strResults} currency={currency} ufValue={uf} />
                <FlujoMensualChart ltrResults={p.ltrResults} strResults={p.strResults} currency={currency} ufValue={uf} />
              </div>
            )}

            {/* Slot de prosa IA (la vieja hasta Fase C, mismo lugar) */}
            <div className="mt-4">
              <NarrativaIAComparativa ltrId={p.ltrId} strId={p.strId} cached={p.cachedAI} />
            </div>
          </div>

          {/* Reclasificación de drawers viejos: Zona → F4 · Riesgos → F5 · Sensibilidad → hijos.
              Subsidio 21.748 → mini-línea (idéntico en ambas modalidades, no es diferencial;
              solo se muestra si califica de un lado). */}
          {subsidioCalifica && (
            <div className="mb-8 rounded-xl border border-[var(--franco-border)] bg-[var(--franco-card)] px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--franco-text-muted)] mb-1">
                Subsidio Ley 21.748
              </p>
              <p className="font-body text-[12.5px] text-[var(--franco-text-secondary)] leading-snug">
                Esta propiedad podría calificar al subsidio a la tasa (misma palanca para ambas modalidades).
                El detalle está en cada análisis individual.
              </p>
            </div>
          )}

          {/* WalletStatusCTA */}
          <div className="mb-6">
            <WalletStatusCTA
              welcomeAvailable={p.welcomeAvailable}
              credits={p.userCredits}
              isSubscriber={p.accessLevel === "subscriber"}
              isAdmin={false}
              isSharedView={p.isSharedView}
              source="comparativa"
            />
          </div>

          {/* Footer interno */}
          <div className="mb-4 flex justify-center">
            <Link
              href="/analisis/nuevo-v2"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-signal-red hover:opacity-80 transition-opacity"
            >
              Comparar otra propiedad
              <span aria-hidden>→</span>
            </Link>
          </div>

          {/* Disclaimer */}
          <p
            className="font-body text-[11px] text-center mt-8"
            style={{ color: "color-mix(in srgb, var(--franco-text) 35%, transparent)" }}
          >
            Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
          </p>
        </div>
      </main>

      <AppFooter variant="minimal" linksSlot={footerLinks} />
    </div>
  );
}
