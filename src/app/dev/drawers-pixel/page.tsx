"use client";
// ============================================================================
// Página DEV — pixel de los DRAWERS PROPIOS STR (⛔#3). Monta DrawerSTR con
// DrawerContentSTR sobre un fixture JSON congelado, sin sesión ni Supabase.
// T5 (03-sep-2026): la rama LTR de esta página murió con los drawers LTR (los
// hallazgos viven en los capítulos y la página solo abre "La zona"); queda STR.
// Controlado por query: ?row=santiagoStr|qaStr|selfLiqStr|elBosqueStr &key=<drawerKey> &cur=CLP|UF
//   · elBosqueStr: histórico NEGATIVO (−0,7%), única comuna con serie histórica bajo cero.
//   · ?comp=hero monta el HeroSTR de producción con el mismo fixture.
// Los fixtures LTR del JSON quedan (los usa el shot QA del acordeón), pero esta ruta no
// los monta.
// ============================================================================
import { Suspense, useMemo, useState } from "react";
import { useSearchParams, notFound } from "next/navigation";
import type { FullAnalysisResult, Hallazgo } from "@/lib/types";
import { DrawerSTR, type DrawerKeySTR } from "@/components/analysis/str/DrawerSTR";
import { HeroSTR } from "@/components/analysis/str/HeroSTR";
import { DrawerContentSTR, DRAWER_TITULOS_STR } from "@/components/analysis/str/DrawerContentSTR";
import { ordenarHallazgosPiramideSTR, HALLAZGO_DRAWER_STR } from "@/components/analysis/str/PiramideHallazgosSTR";
import { TokensHallazgos } from "@/components/analysis/hallazgos/HallazgosAcordeon";
import { DocTokens } from "@/components/analysis/portada/PortadaInforme";
import fixtures from "./fixtures.json";

type FixKey = "santiagoStr" | "qaStr" | "selfLiqStr" | "elBosqueStr";

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
  const rowKey = (sp.get("row") ?? "santiagoStr") as FixKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fix = (fixtures as Record<string, any>)[rowKey];
  const isSTR = fix?.tipo === "renta_corta" || fix?.tipo === "short-term";
  const [currency, setCurrency] = useState<"CLP" | "UF">((sp.get("cur") as "CLP" | "UF") ?? "CLP");

  const results = fix?.results as FullAnalysisResult;
  const valorUF: number = fix?.uf ?? 38800;

  const strSeq = useMemo(() => (isSTR && results ? seqStr(results.hallazgos) : []), [isSTR, results]);
  const initialKey = sp.get("key") ?? "retorno";
  const [strKey, setStrKey] = useState<DrawerKeySTR>((initialKey as DrawerKeySTR) ?? "retorno");
  const [heroDrawer, setHeroDrawer] = useState<DrawerKeySTR | null>(null);

  if (!fix || !isSTR) return <div style={{ padding: 40 }}>fixture STR ?row=santiagoStr|qaStr|selfLiqStr|elBosqueStr no encontrado (T5: esta ruta ya no monta LTR)</div>;

  // `?comp=hero` monta el HeroSTR de producción con el mismo fixture. Existe para poder
  // verificar el clickeable de "La posición de Franco" sin sesión: la página de resultados
  // real exige auth, así que sin esto el botón solo se podía revisar leyendo el código.
  if (sp.get("comp") === "hero") {
    return (
      <div style={{ background: "var(--franco-bg, #FAFAF8)", minHeight: "100vh", padding: 16 }}>
        <p className="font-mono" style={{ fontSize: 12, marginBottom: 12 }}>
          DEV · {rowKey} · HeroSTR · drawer abierto: {heroDrawer ?? "—"}
        </p>
        <HeroSTR
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ai={{ conviene: { cajaAccionable: "Stub de QA: la caja de posición existe solo cuando hay prosa IA." } } as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          results={results as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          veredicto={(results as any)?.francoScore?.veredicto ?? "BUSCAR OTRA"}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          score={(results as any)?.francoScore?.score ?? null}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputData={(fix.input_data ?? {}) as any}
          comuna={fix.comuna}
          onOpenDrawer={(k) => setHeroDrawer(k)}
        />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--franco-bg, #FAFAF8)", minHeight: "100vh" }}>
      {/* Los dos bloques que el informe real aporta y esta ruta no montaba: los tokens
          --doc-* (portada) y el CSS del vocabulario (acordeón). Sin ellos los cuerpos
          se ven sin diseño y el shot QA no sirve de evidencia visual. */}
      <DocTokens />
      <TokensHallazgos />
      <div style={{ padding: "16px 24px", display: "flex", gap: 12, alignItems: "center" }}>
        <span className="font-mono" style={{ fontSize: 12 }}>
          DEV · {rowKey} · {fix.comuna} · STR · key={strKey}
        </span>
        <button className="font-mono" style={{ fontSize: 12, border: "1px solid #ccc", padding: "3px 10px", borderRadius: 6 }} onClick={() => setCurrency((c) => (c === "CLP" ? "UF" : "CLP"))}>
          {currency}
        </button>
      </div>
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          results={results as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputData={(fix.input_data ?? {}) as any}
          comuna={fix.comuna}
          currency={currency}
          valorUF={valorUF}
          ai={null}
        />
      </DrawerSTR>
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
