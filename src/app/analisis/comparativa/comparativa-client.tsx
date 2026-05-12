"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppNav } from "@/components/chrome/AppNav";
import { AppFooter } from "@/components/chrome/AppFooter";
import { WalletStatusCTA } from "@/components/chrome/WalletStatusCTA";
import { Button } from "@/components/ui/button";
import { ViabilidadSTRBanner } from "@/components/analysis/str/ViabilidadSTRBanner";
import {
  HeroComparativa,
} from "@/components/comparativa/HeroComparativa";
import { ResumenCards } from "@/components/comparativa/ResumenCards";
import { TablaSideBySide } from "@/components/comparativa/TablaSideBySide";
import { PatrimonioChartComparativa } from "@/components/comparativa/PatrimonioChartComparativa";
import { FlujoMensualChart } from "@/components/comparativa/FlujoMensualChart";
import { NarrativaIAComparativa } from "@/components/comparativa/NarrativaIAComparativa";
import {
  DrawerZona,
  DrawerSensibilidad,
  DrawerSubsidio,
  DrawerRiesgos,
  type DrawerKey,
} from "@/components/comparativa/DrawersComparativa";
import type {
  FullAnalysisResult,
  FrancoVerdict,
  AIAnalysisComparativa,
  RecomendacionModalidadAmbas,
} from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import {
  normalizeLegacyVerdict,
} from "@/lib/types";
import { readFrancoVerdict } from "@/lib/results-helpers";
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
  dormitorios: number;
  banos: number;
  superficie: number;
  precioUF: number;
  ltrScore: number;
  strScore: number;
  // Resultados nested (refactor Step 1+2)
  ltrResults: FullAnalysisResult | null;
  strResults: ShortTermResult | null;
  cachedAI: AIAnalysisComparativa | null;
  // Inputs específicos (necesarios para tabla)
  costoAmoblamiento: number;
  modoGestion: "auto" | "admin";
  comisionAdministrador: number;
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
  });
}

// ─── Veredicto unificado de la modalidad recomendada ─────────────────────
function deriveVerdictUnificado(
  reco: RecomendacionModalidadAmbas,
  ltrVerdict: FrancoVerdict | null,
  strVerdict: STRVerdict | null,
): STRVerdict {
  if (reco === "LTR_PREFERIDO") {
    // Coercer LTR FrancoVerdict (4 valores) a STRVerdict (3) — RECONSIDERA → AJUSTA.
    if (ltrVerdict === "BUSCAR OTRA") return "BUSCAR OTRA";
    if (ltrVerdict === "COMPRAR") return "COMPRAR";
    return "AJUSTA SUPUESTOS"; // AJUSTA SUPUESTOS, RECONSIDERA LA ESTRUCTURA, null
  }
  if (reco === "STR_VENTAJA_CLARA") {
    return strVerdict ?? "COMPRAR";
  }
  // INDIFERENTE → toma el "peor" de los dos (la decisión es por esfuerzo,
  // pero el cliente debe ver el techo real de riesgo).
  const rank: Record<STRVerdict, number> = {
    "COMPRAR": 3,
    "AJUSTA SUPUESTOS": 2,
    "BUSCAR OTRA": 1,
  };
  const lCoerced: STRVerdict =
    ltrVerdict === "BUSCAR OTRA" ? "BUSCAR OTRA" :
    ltrVerdict === "COMPRAR" ? "COMPRAR" :
    "AJUSTA SUPUESTOS";
  const l = rank[lCoerced];
  const s = strVerdict ? rank[strVerdict] : 3;
  return l <= s ? lCoerced : (strVerdict ?? "COMPRAR");
}

// ─── Componente principal ───────────────────────────────────────────────
export function ComparativaClient(p: Props) {
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const uf = p.ufValue;

  // Recomendación driver
  const recomendacion = useMemo(
    () => deriveRecomendacionFallback(p.strResults),
    [p.strResults],
  );

  // Veredictos individuales
  const ltrVerdict = useMemo(
    () => readFrancoVerdict(p.ltrResults) ?? null,
    [p.ltrResults],
  );
  const strVerdict = useMemo<STRVerdict | null>(
    () => (normalizeLegacyVerdict(p.strResults?.veredicto) as STRVerdict) ?? null,
    [p.strResults],
  );

  // Veredicto unificado para Hero
  const verdictUnificado = useMemo(
    () => deriveVerdictUnificado(recomendacion, ltrVerdict, strVerdict),
    [recomendacion, ltrVerdict, strVerdict],
  );

  // KPIs derivados
  const ltrFlujoMensual = p.ltrResults?.metrics?.flujoNetoMensual ?? 0;
  const ltrNOIMensual = (p.ltrResults?.metrics?.noi ?? 0) / 12;
  const ltrNOIAnualY1 = ltrNOIMensual * 12;
  // Año 5 — usar projection si existe; fallback al año 1 con ajuste inflación 3%.
  const ltrY5 = p.ltrResults?.projections?.[4];
  const ltrNOIAnualY5 = ltrY5 ? ltrY5.flujoAnual + (p.ltrResults?.metrics?.dividendo ?? 0) * 12 : ltrNOIAnualY1 * Math.pow(1.03, 4);
  const ltrCapital = p.ltrResults?.metrics?.pieCLP ?? 0;
  const ltrRentBruta = p.ltrResults?.metrics?.rentabilidadBruta ?? 0;
  const precioCLP = p.precioUF * uf;
  const ltrCapRate = precioCLP > 0 ? (ltrNOIMensual * 12) / precioCLP : 0;

  const strBase = p.strResults?.escenarios?.base;
  const strNOIMensual = strBase?.noiMensual ?? 0;
  const strRampUp = p.strResults?.perdidaRampUp ?? 0;
  const strNOIAnualY1 = strNOIMensual * 12 - strRampUp;
  const strY5 = p.strResults?.projections?.[4];
  const strNOIAnualY5 = strY5
    ? (strY5.flujoOperacionalAnual + (p.strResults?.dividendoMensual ?? 0) * 12)
    : strNOIMensual * 12 * Math.pow(1.03, 4);
  const strFlujoMensual = strBase?.flujoCajaMensual ?? 0;
  const strCapital = p.strResults?.capitalInvertido ?? 0;
  const strIngresoBruto = strBase?.ingresoBrutoMensual ?? 0;
  const strRentBruta = precioCLP > 0 ? (strIngresoBruto * 12) / precioCLP : 0;
  const strCapRate = strBase?.capRate ?? 0;

  const deltaNOIMensual = strNOIMensual - ltrNOIMensual;

  // Chrome
  const ctaSlot = (
    <Link href="/dashboard">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] hover:bg-[var(--franco-card)]"
      >
        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
      </Button>
    </Link>
  );
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
      <AppNav variant="app" ctaSlot={ctaSlot} />

      <main className="flex-1">
        <div className="container mx-auto max-w-[900px] px-4 py-8">
          {/* Toggle moneda */}
          <div className="mb-5">
            <CurrencyToggle
              currency={currency}
              onToggle={() => setCurrency((c) => (c === "CLP" ? "UF" : "CLP"))}
              uf={uf}
            />
          </div>

          {/* Hero único · driver = recomendacionModalidad */}
          <HeroComparativa
            recomendacion={recomendacion}
            verdictUnificado={verdictUnificado}
            nombre={p.nombre}
            comuna={p.comuna}
            superficie={p.superficie}
            precioUF={p.precioUF}
            dormitorios={p.dormitorios}
            banos={p.banos}
            deltaNOIMensual={deltaNOIMensual}
            ltrFlujoMensual={ltrFlujoMensual}
            strFlujoMensual={strFlujoMensual}
            zona={p.strResults?.zonaSTR}
            currency={currency}
            ufValue={uf}
          />

          {/* ViabilidadSTRBanner — visible cuando LTR_PREFERIDO o zona tier "baja" */}
          {p.strResults && (
            <ViabilidadSTRBanner results={p.strResults} />
          )}

          {/* Resúmenes LTR + STR (cards compactas con link al análisis completo) */}
          <ResumenCards
            ltrId={p.ltrId}
            strId={p.strId}
            ltrScore={p.ltrScore}
            ltrVerdict={ltrVerdict}
            ltrFlujoMensual={ltrFlujoMensual}
            ltrRentBruta={ltrRentBruta}
            ltrCapRate={ltrCapRate}
            strScore={p.strScore}
            strVerdict={strVerdict}
            strFlujoMensual={strFlujoMensual}
            strRentBruta={strRentBruta}
            strCapRate={strCapRate}
            currency={currency}
            ufValue={uf}
          />

          {/* Tabla side-by-side ampliada con tooltips */}
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
            ltrVerdict={
              ltrVerdict === "RECONSIDERA LA ESTRUCTURA"
                ? "AJUSTA SUPUESTOS"
                : (ltrVerdict as STRVerdict | null)
            }
            strVerdict={strVerdict}
            currency={currency}
            ufValue={uf}
          />

          {/* Gráfica 1 — Patrimonio LTR vs STR 10 años */}
          {p.ltrResults && p.strResults && (
            <PatrimonioChartComparativa
              ltrResults={p.ltrResults}
              strResults={p.strResults}
              currency={currency}
              ufValue={uf}
            />
          )}

          {/* Gráfica 2 — Flujo mensual 12 meses */}
          {p.ltrResults && p.strResults && (
            <FlujoMensualChart
              ltrResults={p.ltrResults}
              strResults={p.strResults}
              currency={currency}
              ufValue={uf}
            />
          )}

          {/* Narrativa IA "Cuál te conviene" — 4 ángulos doctrinales */}
          <NarrativaIAComparativa
            ltrId={p.ltrId}
            strId={p.strId}
            cached={p.cachedAI}
          />

          {/* Drawers compartidos — accesos en grid de tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <DrawerTrigger
              numero="03"
              label="Sensibilidad precio"
              onClick={() => setDrawer("sensibilidad")}
            />
            <DrawerTrigger
              numero="04"
              label="Subsidio 21.748"
              onClick={() => setDrawer("subsidio")}
            />
            <DrawerTrigger
              numero="05"
              label="Riesgos"
              onClick={() => setDrawer("riesgos")}
            />
            <DrawerTrigger
              numero="06"
              label="Zona STR"
              onClick={() => setDrawer("zona")}
            />
          </div>

          {/* Compartir este análisis — Commit 3c */}
          <ShareBlock token={p.shareToken} />

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

      {/* Drawers controlados */}
      {p.strResults && (
        <DrawerZona
          open={drawer === "zona"}
          onClose={() => setDrawer(null)}
          strResults={p.strResults}
          currency={currency}
          ufValue={uf}
        />
      )}
      {p.ltrResults && p.strResults && (
        <>
          <DrawerSensibilidad
            open={drawer === "sensibilidad"}
            onClose={() => setDrawer(null)}
            ltrResults={p.ltrResults}
            strResults={p.strResults}
            currency={currency}
            ufValue={uf}
          />
          <DrawerSubsidio
            open={drawer === "subsidio"}
            onClose={() => setDrawer(null)}
            ltrResults={p.ltrResults}
            strResults={p.strResults}
          />
          <DrawerRiesgos
            open={drawer === "riesgos"}
            onClose={() => setDrawer(null)}
            ltrResults={p.ltrResults}
            strResults={p.strResults}
          />
        </>
      )}
    </div>
  );
}

function DrawerTrigger({
  numero, label, onClick,
}: { numero: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-4 text-left hover:border-[var(--franco-text-secondary)] transition-colors"
    >
      <p className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--franco-text-muted)] mb-1">
        {numero}
      </p>
      <p className="font-body text-[12px] font-medium text-[var(--franco-text)] leading-tight">
        {label}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--franco-text-tertiary)] mt-2">
        Abrir →
      </p>
    </button>
  );
}

// ─── Compartir este análisis · link público + PDF (Commit 3c) ───────────
function ShareBlock({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/share/comparativa/${token}`
    : `/share/comparativa/${token}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const downloadPDF = () => {
    setDownloading(true);
    // Trigger descarga directa via navegación. El endpoint responde con
    // Content-Disposition: attachment, el browser baja el archivo.
    window.location.href = `/api/share/comparativa/${token}/pdf`;
    setTimeout(() => setDownloading(false), 8000);
  };

  return (
    <div
      className="rounded-2xl border border-[var(--franco-border)] bg-[var(--franco-card)] p-5 mb-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mb-2">
        COMPARTIR ESTE ANÁLISIS
      </p>
      <p className="font-body text-[13px] text-[var(--franco-text-secondary)] leading-relaxed mb-4">
        Link público con la comparativa completa o PDF descargable. La narrativa IA y los
        números quedan congelados al momento que compartes.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={copyLink}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-[var(--franco-border)] bg-[var(--franco-bg)] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--franco-text)] transition-colors hover:border-[var(--franco-text-secondary)]"
        >
          {copied ? "✓ Link copiado" : "Copiar link"}
        </button>
        <button
          type="button"
          onClick={downloadPDF}
          disabled={downloading}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--franco-text)", color: "var(--franco-bg)" }}
        >
          {downloading ? "Generando PDF…" : "Descargar PDF"}
        </button>
      </div>
    </div>
  );
}
