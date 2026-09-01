"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Herramienta DEV — pixel de los DRAWERS PROPIOS (rama motor-supuestos). Casts `as any` a
// propósito: monta componentes de producción con fixtures capturados (shape laxo).

// Página DEV — pixel de los DRAWERS PROPIOS (⛔#3). Monta AnalysisDrawer (LTR) o
// DrawerSTR+DrawerContentSTR (STR) con fixtures REALES (fixtures.json, sin DB/auth).
// Controlado por query: ?row=santiagoLtr|penalolenLtr|santiagoStr|qaStr|selfLiqStr|elBosqueLtr|elBosqueStr &key=<drawerKey> &cur=CLP|UF
// penalolenLtr (F2): cobertura solo_nivel — precio actual sin trayectoria propia.
// santiagoLtr / recoletaLtr / maipuLtr (F3-F4): las tres variantes de rango —
// GfK hasta 2025, A&C 2014-2024, y GfK sin cierre (2015-2024).
// prev/next funcionan (onNavigate actualiza estado). Ruta temporal, untracked.

import { Suspense, useMemo, useState } from "react";
import { useSearchParams, notFound } from "next/navigation";
import type { AIAnalysisV2, AnalisisInput, FullAnalysisResult, Hallazgo } from "@/lib/types";
import { AnalysisDrawer, type DrawerKey } from "@/components/ui/AnalysisDrawer";
import { HALLAZGO_DRAWER } from "@/components/analysis/GenericFindingCard";
import { ordenarHallazgosPiramide } from "@/components/analysis/PiramideHallazgos";
import { DrawerSTR, type DrawerKeySTR } from "@/components/analysis/str/DrawerSTR";
import { HeroSTR } from "@/components/analysis/str/HeroSTR";
import { DrawerContentSTR, DRAWER_TITULOS_STR } from "@/components/analysis/str/DrawerContentSTR";
import { ordenarHallazgosPiramideSTR, HALLAZGO_DRAWER_STR } from "@/components/analysis/str/PiramideHallazgosSTR";
import { TokensHallazgos } from "@/components/analysis/hallazgos/HallazgosAcordeon";
import { DocTokens } from "@/components/analysis/portada/PortadaInforme";
import fixtures from "./fixtures.json";

// `bajoStr`: fixture SINTÉTICO (equity < capital, mult ≈ 0,70) — el tramo <1 "terminas con
// menos de lo que pusiste" no tiene fila REAL en el corpus post-flip (F2: 0 STR pierde plata),
// así que se valida sintético, como los razor-edges del golden. El resto son filas reales.
type FixKey =
  | "santiagoLtr" | "qaLtr" | "fallbackLtr" | "penalolenLtr" | "recoletaLtr" | "maipuLtr"
  | "santiagoStr" | "qaStr" | "selfLiqStr" | "fallbackStr" | "costosAltosStr" | "bajoStr"
  // elBosqueLtr/elBosqueStr: histórico NEGATIVO (−0,7%). El Bosque es la única comuna
  // con trayectoria negativa en el módulo vigente y NO tiene ni un análisis real en el
  // parque, así que la rama roja del cuerpo de plusvalía —escala bajo cero y cierre
  // "no recuperas ni lo aportado"— solo se puede validar por fixture. Derivados de los
  // santiago* reales: se parchea la comuna y el bloque plusvalia con los valores
  // exactos de PLUSVALIA_ESTIMADO["El Bosque"].
  | "elBosqueLtr" | "elBosqueStr"
  // pieCruzaLtr/pieNoCruzaLtr: las DOS ramas de la palanca del pie en el cuerpo de
  // distancia, que ningún fixture cubría (los cuatro con hallazgo de distancia eran
  // STR y ninguno tenía `pieEsPalanca`). Análisis REALES copiados tal cual:
  //   · pieCruzaLtr   — pie 10%, la palanca cruza en 17% ⇒ fila con razón propia
  //     ("no depende del vendedor, depende de tu liquidez").
  //   · pieNoCruzaLtr — pie 15%, califica pero NO cruza ⇒ línea del tope
  //     ("Probamos también … pie hasta 30%"), que es el remedio del caso donde una
  //     prosa pidió subir el pie a 30% mientras el motor ya había probado y fallado.
  //   TRAMO 3 — estos dos fijan además LAS DOS RAMAS DE LA ESCALERA DEL PLAZO, que
  //   se leen al revés una de otra: `pieCruzaLtr` tiene plazo 15 (puede estirar) y
  //   `pieNoCruzaLtr` tiene plazo 30 (ya en el tope, lectura hacia arriba: qué
  //   ahorras acortando). Es la única rama del informe sin precedente, así que NO
  //   les cambies el `plazoCredito` sin reponer la cobertura en otro fixture.
  | "pieCruzaLtr" | "pieNoCruzaLtr";

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
  const [heroDrawer, setHeroDrawer] = useState<DrawerKeySTR | null>(null);

  if (!fix) return <div style={{ padding: 40 }}>fixture ?row=santiagoLtr|santiagoStr|qaStr|selfLiqStr no encontrado</div>;

  // `?comp=hero` monta el HeroSTR de producción con el mismo fixture. Existe para poder
  // verificar el clickeable de "La posición de Franco" sin sesión: la página de resultados
  // real exige auth, así que sin esto el botón solo se podía revisar leyendo el código.
  if (isSTR && sp.get("comp") === "hero") {
    return (
      <div style={{ background: "var(--franco-bg, #FAFAF8)", minHeight: "100vh", padding: 16 }}>
        <p className="font-mono" style={{ fontSize: 12, marginBottom: 12 }}>
          DEV · {rowKey} · HeroSTR · drawer abierto: {heroDrawer ?? "—"}
        </p>
        <HeroSTR
          ai={{ conviene: { cajaAccionable: "Stub de QA: la caja de posición existe solo cuando hay prosa IA." } } as any}
          results={results as any}
          veredicto={(results as any)?.francoScore?.veredicto ?? "BUSCAR OTRA"}
          score={(results as any)?.francoScore?.score ?? null}
          inputData={(fix.input_data ?? {}) as any}
          comuna={fix.comuna}
          onOpenDrawer={(k) => setHeroDrawer(k)}
        />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--franco-bg, #FAFAF8)", minHeight: "100vh" }}>
      {/* El CSS del vocabulario (.thermo, .bars, .v-cierre, .viz-pie…) lo inyecta el
          acordeón, que acá no se monta: sin esto los cuerpos salen SIN estilo y el
          shot QA no muestra el diseño real — el hueco que hacía inservible esta ruta
          para capturas. Los tokens --doc-* los aporta el shell del drawer. */}
      {/* Los dos bloques que el informe real aporta y esta ruta no montaba: los tokens
          --doc-* (portada) y el CSS del vocabulario (acordeón). Sin ellos los cuerpos
          se ven sin diseño y el shot QA no sirve de evidencia visual. */}
      <DocTokens />
      <TokensHallazgos />
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
