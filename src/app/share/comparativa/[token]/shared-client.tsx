"use client";

import { useState, useMemo } from "react";
import { ConversionHook, ConversionCloser } from "@/components/chrome/SharedConversionCTA";
import { PublicShareHeader } from "@/components/chrome/PublicShareHeader";
import FrancoLogo from "@/components/franco-logo";
import { HeroComparativa } from "@/components/comparativa/HeroComparativa";
import { formatDireccionDisplay } from "@/lib/format-direccion";
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
import { normalizeLegacyVerdict } from "@/lib/types";
import { readVeredicto } from "@/lib/results-helpers";
import { deriveRecomendacionModalidad } from "@/lib/engines/str-universo-santiago";

type STRVerdict = "COMPRAR" | "AJUSTA SUPUESTOS" | "BUSCAR OTRA";

interface Props {
  ltrId: string;
  strId: string;
  nombre: string;
  comuna: string;
  direccion: string;
  ciudad: string;
  dormitorios: number;
  banos: number;
  superficie: number;
  precioUF: number;
  ltrScore: number;
  strScore: number;
  ltrResults: FullAnalysisResult | null;
  strResults: ShortTermResult | null;
  cachedAI: AIAnalysisComparativa | null;
  costoAmoblamiento: number;
  modoGestion: "auto" | "admin";
  comisionAdministrador: number;
  edificioPermiteAirbnb: string;
  ufValue: number;
  printMode: boolean;
  createdAt: string;
}

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

function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

export function SharedComparativaClient(p: Props) {
  // Currency toggle solo si NO está en print mode (PDF queda fijo en CLP)
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
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

  const recomendacion = useMemo(
    () => deriveRecomendacionFallback(p.strResults),
    [p.strResults],
  );
  const ltrVerdict = useMemo(
    () => readVeredicto(p.ltrResults) ?? null,
    [p.ltrResults],
  );
  const strVerdict = useMemo<STRVerdict | null>(
    () => (normalizeLegacyVerdict(p.strResults?.veredicto) as STRVerdict) ?? null,
    [p.strResults],
  );
  // KPIs derivados
  const ltrNOIMensual = (p.ltrResults?.metrics?.noi ?? 0) / 12;
  const ltrNOIAnualY1 = ltrNOIMensual * 12;
  const ltrY5 = p.ltrResults?.projections?.[4];
  const ltrNOIAnualY5 = ltrY5
    ? ltrY5.flujoAnual + (p.ltrResults?.metrics?.dividendo ?? 0) * 12
    : ltrNOIAnualY1 * Math.pow(1.03, 4);
  // Capital inicial simétrico vs STR.capitalInvertido (ver comparativa-client): LTR
  // inversionInicial del objeto retorno/exit; fallback a pieCLP. Coherente con la pirámide.
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

  const fechaCorta = formatFechaCorta(p.createdAt);
  const direccionDisplay = p.direccion
    ? formatDireccionDisplay(p.direccion, p.comuna)
    : `Depto ${p.dormitorios}D${p.banos}B en ${p.comuna}`;

  return (
    <div
      className="min-h-screen flex flex-col"
      // En print mode renderizamos el subtree en TEMA CLARO: data-theme="light"
      // resuelve los tokens --franco-* en su versión clara (bg, cards, texto)
      // para todo el contenido del PDF. Sin esto el texto heredaba los tokens
      // dark (#FAFAF8 ≈ blanco) sobre fondo blanco → ilegible.
      data-theme={p.printMode ? "light" : undefined}
      style={{ background: "var(--franco-bg)" }}
    >
      {/* Header público (solo en NO-print, ya que PDF agrega su propio header) */}
      {!p.printMode && <PublicShareHeader date={fechaCorta} />}

      <main className="flex-1">
        <div className="container mx-auto max-w-[1100px] px-4 sm:px-6 py-6">
          {/* CTA conversión — anzuelo (superficie Ink) · solo web */}
          {!p.printMode && (
            <div className="mb-5">
              <ConversionHook href="/register" />
            </div>
          )}

          {/* Banner identificador del análisis (visible siempre) */}
          {p.printMode && (
            <div className="mb-5 pb-4" style={{ borderBottom: "1px solid var(--franco-border)" }}>
              <FrancoLogo inverted size="sm" href="/" />
              <p className="font-mono text-[10px] uppercase tracking-[3px] text-[var(--franco-text-secondary)] mt-2">
                ANÁLISIS COMPARATIVO · {direccionDisplay.toUpperCase()}
              </p>
              <p className="font-body text-[11px] text-[var(--franco-text-secondary)] mt-1">
                Generado el {fechaCorta}
              </p>
            </div>
          )}

          {/* Toggle moneda — solo en vista web, no PDF */}
          {!p.printMode && (
            <div className="mb-5">
              <div className="flex items-center justify-between border border-[var(--franco-border)] bg-[var(--franco-card)] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrency((c) => (c === "CLP" ? "UF" : "CLP"))}
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
            </div>
          )}

          {/* ── ACTO 1 · Hero — veredicto de modalidad protagonista ── */}
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

          {/* ── ACTO 3 · La evidencia ── */}
          <div className="mb-8">
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[3px] mb-1" style={{ color: "var(--franco-text-secondary)" }}>
                03 · LA EVIDENCIA
              </p>
              <h2 className="font-heading text-[19px] sm:text-[22px] font-bold leading-tight" style={{ color: "var(--franco-text)" }}>
                El destino es el mismo; el camino, distinto
              </h2>
            </div>

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

            {p.ltrResults && p.strResults && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <PatrimonioChartComparativa ltrResults={p.ltrResults} strResults={p.strResults} currency={currency} ufValue={uf} />
                <FlujoMensualChart ltrResults={p.ltrResults} strResults={p.strResults} currency={currency} ufValue={uf} />
              </div>
            )}

            <div className="mt-4">
              <NarrativaIAComparativa ltrId={p.ltrId} strId={p.strId} cached={p.cachedAI} />
            </div>
          </div>

          {/* CTA conversión — cierre (campo Signal Red) · solo en vista web */}
          {!p.printMode && (
            <div className="mt-8 mb-4">
              <ConversionCloser href="/register" />
            </div>
          )}

          {/* Disclaimer */}
          <p
            className="font-body text-[11px] text-center mt-6"
            style={{ color: p.printMode ? "#666" : "color-mix(in srgb, var(--franco-text) 35%, transparent)" }}
          >
            Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
            refranco.ai · análisis no constituye recomendación financiera.
          </p>
        </div>
      </main>
    </div>
  );
}
