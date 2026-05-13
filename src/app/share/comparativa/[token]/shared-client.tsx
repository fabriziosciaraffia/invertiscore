"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import FrancoLogo from "@/components/franco-logo";
import { ViabilidadSTRBanner } from "@/components/analysis/str/ViabilidadSTRBanner";
import { HeroComparativa } from "@/components/comparativa/HeroComparativa";
import { TablaSideBySide } from "@/components/comparativa/TablaSideBySide";
import { PatrimonioChartComparativa } from "@/components/comparativa/PatrimonioChartComparativa";
import { FlujoMensualChart } from "@/components/comparativa/FlujoMensualChart";
import { NarrativaIAComparativa } from "@/components/comparativa/NarrativaIAComparativa";
import {
  InlineZona,
  InlineSensibilidad,
  InlineSubsidio,
  InlineRiesgos,
} from "@/components/comparativa/DrawersInlineComparativa";
import type {
  FullAnalysisResult,
  Veredicto,
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
  });
}

function deriveVerdictUnificado(
  reco: RecomendacionModalidadAmbas,
  ltrVerdict: Veredicto | null,
  strVerdict: STRVerdict | null,
): STRVerdict {
  if (reco === "LTR_PREFERIDO") {
    if (ltrVerdict === "BUSCAR OTRA") return "BUSCAR OTRA";
    if (ltrVerdict === "COMPRAR") return "COMPRAR";
    return "AJUSTA SUPUESTOS";
  }
  if (reco === "STR_VENTAJA_CLARA") {
    return strVerdict ?? "COMPRAR";
  }
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
  const verdictUnificado = useMemo(
    () => deriveVerdictUnificado(recomendacion, ltrVerdict, strVerdict),
    [recomendacion, ltrVerdict, strVerdict],
  );

  // KPIs derivados
  const ltrFlujoMensual = p.ltrResults?.metrics?.flujoNetoMensual ?? 0;
  const ltrNOIMensual = (p.ltrResults?.metrics?.noi ?? 0) / 12;
  const ltrNOIAnualY1 = ltrNOIMensual * 12;
  const ltrY5 = p.ltrResults?.projections?.[4];
  const ltrNOIAnualY5 = ltrY5
    ? ltrY5.flujoAnual + (p.ltrResults?.metrics?.dividendo ?? 0) * 12
    : ltrNOIAnualY1 * Math.pow(1.03, 4);
  const ltrCapital = p.ltrResults?.metrics?.pieCLP ?? 0;

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
  const deltaNOIMensual = strNOIMensual - ltrNOIMensual;

  const fechaCorta = formatFechaCorta(p.createdAt);
  const direccionDisplay = p.direccion || `Depto ${p.dormitorios}D${p.banos}B en ${p.comuna}`;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: p.printMode ? "white" : "var(--franco-bg)" }}
    >
      {/* Header público (solo en NO-print, ya que PDF agrega su propio header) */}
      {!p.printMode && (
        <header
          className="border-b border-[var(--franco-border)] px-4 sm:px-6 py-4"
          style={{ background: "var(--franco-bg)" }}
        >
          <div className="mx-auto max-w-[900px] flex items-center justify-between gap-4">
            <FrancoLogo inverted size="sm" href="/" />
            <div className="text-right">
              <p className="font-mono text-[9px] uppercase tracking-[2px] text-[var(--franco-text-muted)] mb-0.5">
                ANÁLISIS COMPARTIDO
              </p>
              <p className="font-body text-[11px] text-[var(--franco-text-secondary)]">
                {fechaCorta}
              </p>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1">
        <div className="container mx-auto max-w-[900px] px-4 py-6">
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

          {/* Hero único */}
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

          {p.strResults && <ViabilidadSTRBanner results={p.strResults} />}

          {/* Tabla side-by-side */}
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
            ltrVerdict={ltrVerdict}
            strVerdict={strVerdict}
            currency={currency}
            ufValue={uf}
          />

          {p.ltrResults && p.strResults && (
            <PatrimonioChartComparativa
              ltrResults={p.ltrResults}
              strResults={p.strResults}
              currency={currency}
              ufValue={uf}
            />
          )}

          {p.ltrResults && p.strResults && (
            <FlujoMensualChart
              ltrResults={p.ltrResults}
              strResults={p.strResults}
              currency={currency}
              ufValue={uf}
            />
          )}

          {/* Narrativa IA — usa cache (Commit 3b) */}
          <NarrativaIAComparativa
            ltrId={p.ltrId}
            strId={p.strId}
            cached={p.cachedAI}
          />

          {/* Drawers expandidos INLINE como secciones */}
          {p.strResults && (
            <InlineZona
              strResults={p.strResults}
              currency={currency}
              ufValue={uf}
            />
          )}
          {p.ltrResults && p.strResults && (
            <>
              <InlineSensibilidad
                ltrResults={p.ltrResults}
                strResults={p.strResults}
                currency={currency}
                ufValue={uf}
              />
              <InlineSubsidio
                ltrResults={p.ltrResults}
                strResults={p.strResults}
              />
              <InlineRiesgos
                ltrResults={p.ltrResults}
                strResults={p.strResults}
              />
            </>
          )}

          {/* CTA conversión — solo en vista web, oculto en PDF */}
          {!p.printMode && (
            <div
              className="rounded-2xl border p-6 sm:p-8 mt-8 mb-4 text-center"
              style={{
                background: "color-mix(in srgb, var(--signal-red) 4%, transparent)",
                borderColor: "color-mix(in srgb, var(--signal-red) 25%, transparent)",
                borderStyle: "dashed",
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[3px] text-signal-red mb-2">
                ¿ESTÁS EVALUANDO TU PROPIA INVERSIÓN?
              </p>
              <h3 className="font-heading text-[20px] sm:text-[22px] font-bold text-[var(--franco-text)] leading-snug mb-2">
                Franco analiza tu depto y te dice si conviene comprar
              </h3>
              <p className="font-body text-[14px] text-[var(--franco-text-secondary)] leading-relaxed mb-4 max-w-[600px] mx-auto">
                Datos reales del mercado, sin conflictos de interés. Veredicto en menos de un minuto.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.06em] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--signal-red)", color: "var(--ink-100)" }}
              >
                Crear tu propio análisis →
              </Link>
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
