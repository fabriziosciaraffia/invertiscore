"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Herramienta DEV — pixel de los DRAWERS PROPIOS (rama motor-supuestos). Casts `as any` a
// propósito: monta componentes de producción con fixtures capturados (shape laxo).

// Página DEV — pixel de los DRAWERS PROPIOS (⛔#3). Monta AnalysisDrawer (LTR) o
// DrawerSTR+DrawerContentSTR (STR) con fixtures REALES (fixtures.json, sin DB/auth).
// Controlado por query: ?row=santiagoLtr|santiagoStr|qaStr|selfLiqStr &key=<drawerKey> &cur=CLP|UF
// prev/next funcionan (onNavigate actualiza estado). Ruta temporal, untracked.

import { Suspense, useMemo, useState } from "react";
import { useSearchParams, notFound } from "next/navigation";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult, Hallazgo } from "@/lib/types";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { HALLAZGO_DRAWER } from "@/components/analysis/GenericFindingCard";
import { ordenarHallazgosPiramide } from "@/components/analysis/PiramideHallazgos";
import { DrawerSTR, type DrawerKeySTR } from "@/components/analysis/str/DrawerSTR";
import { DrawerContentSTR, DRAWER_TITULOS_STR } from "@/components/analysis/str/DrawerContentSTR";
import { ordenarHallazgosPiramideSTR, HALLAZGO_DRAWER_STR } from "@/components/analysis/str/PiramideHallazgosSTR";
import fixtures from "./fixtures.json";

// `bajoStr`: fixture SINTÉTICO (equity < capital, mult ≈ 0,70) — el tramo <1 "terminas con
// menos de lo que pusiste" no tiene fila REAL en el corpus post-flip (F2: 0 STR pierde plata),
// así que se valida sintético, como los razor-edges del golden. El resto son filas reales.
type FixKey =
  | "santiagoLtr" | "qaLtr" | "fallbackLtr"
  | "santiagoStr" | "qaStr" | "selfLiqStr" | "fallbackStr" | "costosAltosStr" | "bajoStr";

function seqLtr(results: FullAnalysisResult, ai: AIAnalysisV2): DrawerKey[] {
  const seq: DrawerKey[] = [];
  for (const h of ordenarHallazgosPiramide(results, ai)) {
    const k = HALLAZGO_DRAWER[h.id];
    if (k && !seq.includes(k)) seq.push(k);
  }
  return seq;
}
function seqStr(hallazgos: Hallazgo[] | undefined): DrawerKeySTR[] {
  const seq: DrawerKeySTR[] = [];
  for (const h of ordenarHallazgosPiramideSTR(hallazgos)) {
    const k = HALLAZGO_DRAWER_STR[h.id];
    if (k && !seq.includes(k)) seq.push(k);
  }
  return seq;
}

function Inner() {
  const sp = useSearchParams();
  const rowKey = (sp.get("row") ?? "santiagoLtr") as FixKey;
  const fix = (fixtures as Record<string, any>)[rowKey];
  const isSTR = fix?.tipo === "renta_corta" || fix?.tipo === "short-term";
  const [currency, setCurrency] = useState<"CLP" | "UF">((sp.get("cur") as "CLP" | "UF") ?? "CLP");

  const results = fix?.results as FullAnalysisResult;
  const valorUF: number = fix?.uf ?? 38800;
  // Stub: secciones IA vacías para que los drawers heredados (negociacion/costoMensual/
  // largoPlazo) no crasheen al traversar con prev/next. Los 4 nuevos no las usan.
  const ai = useMemo(
    () => ({ negociacion: {}, costoMensual: {}, largoPlazo: {}, reestructuracion: {}, conviene: {} }) as unknown as AIAnalysisV2,
    [],
  );

  const ltrSeq = useMemo(() => (!isSTR && results ? seqLtr(results, ai) : []), [isSTR, results, ai]);
  const strSeq = useMemo(() => (isSTR && results ? seqStr(results.hallazgos) : []), [isSTR, results]);

  const initialKey = sp.get("key") ?? (isSTR ? "retorno" : "tir");
  const [ltrKey, setLtrKey] = useState<DrawerKey>((initialKey as DrawerKey) ?? "tir");
  const [strKey, setStrKey] = useState<DrawerKeySTR>((initialKey as DrawerKeySTR) ?? "retorno");

  if (!fix) return <div style={{ padding: 40 }}>fixture ?row=santiagoLtr|santiagoStr|qaStr|selfLiqStr no encontrado</div>;

  return (
    <div style={{ background: "var(--franco-bg, #FAFAF8)", minHeight: "100vh" }}>
      <div style={{ padding: "16px 24px", display: "flex", gap: 12, alignItems: "center" }}>
        <span className="font-mono" style={{ fontSize: 12 }}>
          DEV · {rowKey} · {fix.comuna} · {isSTR ? "STR" : "LTR"} · key={isSTR ? strKey : ltrKey}
        </span>
        <button className="font-mono" style={{ fontSize: 12, border: "1px solid #ccc", padding: "3px 10px", borderRadius: 6 }} onClick={() => setCurrency((c) => (c === "CLP" ? "UF" : "CLP"))}>
          {currency}
        </button>
      </div>
      {isSTR ? (
        <DrawerSTR
          activeKey={strKey}
          titulo={DRAWER_TITULOS_STR[strKey]}
          sequence={strSeq}
          onClose={() => {}}
          onNavigate={(k) => setStrKey(k)}
        >
          <DrawerContentSTR
            activeKey={strKey}
            analysisId={fix.id}
            results={results as any}
            inputData={(fix.input_data ?? {}) as any}
            comuna={fix.comuna}
            currency={currency}
            valorUF={valorUF}
            ai={null}
          />
        </DrawerSTR>
      ) : (
        <AnalysisDrawer
          activeKey={ltrKey}
          aiAnalysis={ai}
          currency={currency}
          results={results}
          inputData={(fix.input_data ?? { comuna: fix.comuna }) as AnalisisInput}
          valorUF={valorUF}
          onClose={() => {}}
          onNavigate={(k) => setLtrKey(k)}
          sequence={ltrSeq}
          comuna={fix.comuna}
        />
      )}
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
