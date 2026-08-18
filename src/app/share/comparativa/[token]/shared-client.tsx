"use client";

import { useState, useMemo } from "react";
import { ConversionHook, ConversionCloser } from "@/components/chrome/SharedConversionCTA";
import { PublicShareHeader } from "@/components/chrome/PublicShareHeader";
import { HeroComparativa } from "@/components/comparativa/HeroComparativa";
import { TablaSideBySide } from "@/components/comparativa/TablaSideBySide";
import { PatrimonioChartComparativa } from "@/components/comparativa/PatrimonioChartComparativa";
import { hayAsimetriaDeEntrega } from "@/lib/comparativa-patrimonio";
import { FlujoMensualChart } from "@/components/comparativa/FlujoMensualChart";
import { useComparativaAI } from "@/components/comparativa/use-comparativa-ai";
import { PiramideComparativa } from "@/components/comparativa/PiramideComparativa";
import { ctxFromResults, buildFindingsComparativa } from "@/lib/comparativa-findings";
import type {
  FullAnalysisResult,
  AIAnalysisComparativa,
} from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { normalizeLegacyVerdict } from "@/lib/types";
import type { Hallazgo, HallazgoDistanciaVeredicto } from "@/lib/types";
import { readVeredicto } from "@/lib/results-helpers";
import { buildHeroAmbas } from "@/lib/comparativa-hero-copy";
import { buildAperturaComparativa } from "@/lib/comparativa-apertura";
import { lineaDistanciaMini } from "@/lib/distancia-copy";

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
  antiguedad?: number;
  piePct?: number;
  plazoAnios?: number;
  tasaPct?: number;
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
  createdAt: string;
  /** Fecha de la PROSA vigente; el pie la prefiere sobre `createdAt`. Ver
   *  fechaProsaVigente() en pipeline-timing.ts. */
  fechaProsa?: string;
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

  // Prosa comparativa (Fase C) — integrada al hero. canGenerate=false: el share es
  // público (sin auth), usa lo persistido tal cual y NUNCA regenera.
  const { ai: comparativaAI, loading: aiLoading } = useComparativaAI(
    p.ltrId, p.strId, p.cachedAI, false,
  );

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

  // ── Hero 3 ejes — MISMO builder que la vista logueada (fuente única) ──
  const ltrFlujoMensual = p.ltrResults?.metrics?.flujoNetoMensual ?? 0;
  const strFlujoMensual = strBase?.flujoCajaMensual ?? 0;
  const hero = useMemo(
    () =>
      buildHeroAmbas({
        banda: p.strResults?.veredictoComparativo?.banda ?? "INDIFERENTE",
        fragil: p.strResults?.veredictoComparativo?.fragil ?? false,
        ltrVerdict,
        strVerdict,
        ltrFlujoMensual,
        strFlujoMensual,
        sobreRentaPct: p.strResults?.comparativa?.sobreRentaPct ?? 0,
        sobreRentaPctConfiable: p.strResults?.comparativa?.sobreRentaPctConfiable ?? true,
        sobreRentaCLP: p.strResults?.comparativa?.sobreRenta ?? 0,
      }),
    [p.strResults, ltrVerdict, strVerdict, ltrFlujoMensual, strFlujoMensual],
  );
  const buscarDistancia = (hallazgos: unknown): HallazgoDistanciaVeredicto | null => {
    const arr = Array.isArray(hallazgos) ? (hallazgos as Hallazgo[]) : [];
    return (arr.find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined) ?? null;
  };
  const ltrDistancia = lineaDistanciaMini(buscarDistancia(p.ltrResults?.hallazgos), ltrVerdict);
  const strDistancia = lineaDistanciaMini(buscarDistancia((p.strResults as { hallazgos?: Hallazgo[] } | null)?.hallazgos), strVerdict);

  // Apertura del motor (ver comparativa-client): en el share pesa más — acá la
  // prosa vieja se OCULTA sin regenerar, así que este es el cuerpo que queda.
  const aperturaMotor = useMemo(
    () =>
      buildAperturaComparativa({
        topId: findings[0]?.id ?? "flujo",
        topLado: findings[0]?.lado ?? "neutro",
        banda: p.strResults?.veredictoComparativo?.banda ?? "INDIFERENTE",
        estadoHero: hero.estado,
        sobreRentaPct: p.strResults?.comparativa?.sobreRentaPct ?? 0,
        sobreRentaPctConfiable: p.strResults?.comparativa?.sobreRentaPctConfiable ?? true,
      }),
    [findings, p.strResults, hero.estado],
  );

  const fechaCorta = formatFechaCorta(p.createdAt);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--franco-bg)" }}
    >
      {/* El PDF ya no usa esta página: vive en /share/comparativa/[token]/documento. */}
      <PublicShareHeader date={fechaCorta} />

      <main className="flex-1">
        <div className="container mx-auto max-w-[1100px] px-4 sm:px-6 py-6">
          {/* CTA conversión — anzuelo (superficie Ink) */}
          <div className="mb-5">
            <ConversionHook />
          </div>

          {/* ── ACTO 1 · Hero — veredicto + prosa integrada + toggle (F-C3b) ── */}
          <HeroComparativa
            hero={hero}
            ltrDistancia={ltrDistancia}
            strDistancia={strDistancia}
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
            findings={findings}
            ltrId={p.ltrId}
            strId={p.strId}
            ltrScore={p.ltrScore}
            ltrVerdict={ltrVerdict}
            strScore={p.strScore}
            strVerdict={strVerdict}
            ai={comparativaAI}
            aiLoading={aiLoading}
            aperturaMotor={aperturaMotor}
            createdAt={p.createdAt}
            fechaProsa={p.fechaProsa}
            currency={currency}
            onCurrencyChange={setCurrency}
            ufValue={uf}
          />

          {/* ── ACTO 2 · Pirámide diferencial (D3) + drawers puente (D4) ── */}
          {findings.length > 0 && (
            <div id="piramide-comparativa" className="scroll-mt-20">
              <PiramideComparativa findings={findings} ltrId={p.ltrId} strId={p.strId} />
            </div>
          )}

          {/* ── ACTO 3 · La evidencia ── */}
          <div className="mb-8">
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-[3px] mb-1" style={{ color: "var(--franco-text-secondary)" }}>
                LA EVIDENCIA
              </p>
              <h2 className="font-heading text-[19px] sm:text-[22px] font-bold leading-tight" style={{ color: "var(--franco-text)" }}>
                {hayAsimetriaDeEntrega(p.ltrResults?.projections, p.ltrResults?.metrics, p.strResults?.projections)
                  ? "Los caminos se comparan; el destino todavía no"
                  : "El destino es el mismo; el camino, distinto"}
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

          </div>

          {/* CTA conversión — cierre (campo Signal Red) */}
          {(
            <div className="mt-8 mb-4">
              <ConversionCloser />
            </div>
          )}

          {/* Disclaimer */}
          <p
            className="font-body text-[11px] text-center mt-6"
            style={{ color: "color-mix(in srgb, var(--franco-text) 35%, transparent)" }}
          >
            Análisis generado por IA. Verifica los datos antes de tomar decisiones financieras.
            refranco.ai · análisis no constituye recomendación financiera.
          </p>
        </div>
      </main>
    </div>
  );
}
