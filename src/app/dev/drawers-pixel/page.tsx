"use client";
// ============================================================================
// Página DEV — monta el informe y sus piezas sobre fixtures JSON congelados, sin sesión
// ni Supabase. La ruta real exige sesión de dueño/suscriptor, así que sin esto la página
// no se puede ver ni shotear sin login.
//   · ?row=staRosaStr|grajalesStr&comp=pagina  → página STR completa (STRResultsClient)
//   · ?row=providenciaLtr&comp=paginaLtr       → página LTR completa (PremiumResults)
//   · ?row=<str>&comp=<pieza>                  → piezas compartidas (matriz, planilla, fila
//     de dato, tramos, curva, cifras, día 1, patrimonio, all) sobre el recompute volcado
// T3 STR (05-sep-2026): murió la rama de los drawers STR viejos (DrawerSTR, DrawerContentSTR,
// HeroSTR) junto con esos componentes; los hallazgos viven en los capítulos.
// Los fixtures se regeneran desde la base con scripts/of-dump-fixture.ts (gitignored).
// ============================================================================
import { Suspense } from "react";
import { useSearchParams, notFound } from "next/navigation";
import type { FullAnalysisResult } from "@/lib/types";
import { TokensHallazgos } from "@/components/analysis/hallazgos/HallazgosAcordeon";
import { DocTokens } from "@/components/analysis/portada/PortadaInforme";
import { TokensShared } from "@/components/analysis/shared";
import { PiezasShared } from "./PiezasShared";
import { STRResultsClient } from "@/app/analisis/renta-corta/[id]/results-client";
import { PremiumResults } from "@/app/analisis/[id]/results-client";
import fixtures from "./fixtures.json";

type FixKey = "staRosaStr" | "grajalesStr" | "providenciaLtr";

function Inner() {
  const sp = useSearchParams();
  const rowKey = (sp.get("row") ?? "staRosaStr") as FixKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fix = (fixtures as Record<string, any>)[rowKey];
  const isSTR = fix?.tipo === "renta_corta" || fix?.tipo === "short-term";
  const results = fix?.results as FullAnalysisResult;
  const valorUF: number = fix?.uf ?? 38800;
  const comp = sp.get("comp");

  // Goal "LTR hereda piezas compartidas" (05-sep-2026) · `?row=providenciaLtr&comp=paginaLtr`
  // monta la página LTR completa con el recompute volcado de 7710a017.
  if (fix && !isSTR && comp === "paginaLtr") {
    return (
      <PremiumResults
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results={results as any}
        accessLevel="subscriber"
        analysisId={fix.id}
        inputData={fix.input_data}
        comuna={fix.comuna}
        score={fix.score ?? results?.score ?? 0}
        freeYieldBruto={results?.metrics?.rentabilidadBruta ?? 0}
        freeFlujo={results?.metrics?.flujoNetoMensual ?? 0}
        freePrecioM2={results?.metrics?.precioM2 ?? 0}
        resumenEjecutivo=""
        ufValue={valorUF}
        aiAnalysisInitial={fix.ai_analysis ?? undefined}
        aiStale={false}
        puedeRegenerarProsa={false}
        nombre={fix.nombre ?? ""}
        ciudad={fix.ciudad ?? "Santiago"}
        createdAt={fix.created_at ?? ""}
        superficie={fix.superficie ?? 0}
        precioUF={fix.precio ?? 0}
        isSharedView={false}
        isLoggedIn
        medianaResolvedAt={fix.medianaSnapshot?.resolvedAt ?? new Date().toISOString()}
      />
    );
  }
  if (!fix || !isSTR) return <div style={{ padding: 40 }}>fixture ?row=staRosaStr|grajalesStr (STR, con &comp=pagina o &comp=&lt;pieza&gt;) · providenciaLtr (&comp=paginaLtr) no encontrado</div>;

  // `?comp=pagina` monta la página STR completa (T1) con el fixture.
  if (comp === "pagina") {
    return (
      <STRResultsClient
        analysisId={fix.id}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results={results as any}
        inputData={fix.input_data ?? null}
        accessLevel="premium"
        ufValue={valorUF}
        nombre={fix.nombre ?? ""}
        comuna={fix.comuna}
        ciudad={fix.ciudad ?? "Santiago"}
        superficie={fix.superficie ?? 0}
        createdAt={fix.created_at}
        userId={null}
        isSharedView={false}
        userCredits={0}
        aiAnalysisInitial={fix.ai_analysis ?? null}
        puedeRegenerarProsa={false}
        simulacionStr={fix.simulacion ?? null}
        zonaStr={fix.zonaStr ?? null}
      />
    );
  }

  // T1 (04-sep-2026) · `?comp=<pieza>` monta las piezas compartidas sobre el recompute
  // volcado. Sin registro por pieza cada QA era un `if` a mano.
  return (
    <div className="doc-dictamen doc-tokens" style={{ background: "var(--doc-paper, #FAF8F3)", minHeight: "100vh" }}>
      <DocTokens />
      <TokensHallazgos />
      <TokensShared />
      <p className="font-mono" style={{ fontSize: 12, padding: "12px 20px 0" }}>DEV · {rowKey} · piezas compartidas · comp={comp ?? "all"}</p>
      <PiezasShared fix={fix} comp={comp ?? "all"} />
    </div>
  );
}

export default function DrawersPixelDevPage() {
  // GUARD DE PRODUCCIÓN: ruta solo-dev. En build de prod NODE_ENV==="production" se inlinea
  // y la ruta responde 404 (notFound()). Nunca queda accesible en producción.
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>…</div>}>
      <Inner />
    </Suspense>
  );
}
