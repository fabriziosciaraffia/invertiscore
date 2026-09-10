"use client";
// ============================================================================
// Página DEV — monta el informe y sus piezas sobre fixtures JSON congelados, sin sesión
// ni Supabase. La ruta real exige sesión de dueño/suscriptor, así que sin esto la página
// no se puede ver ni shotear sin login.
//   · ?row=staRosaStr|grajalesStr&comp=pagina  → página STR completa (STRResultsClient)
//   · ?row=providenciaLtr&comp=paginaLtr       → página LTR completa (PremiumResults)
//   · ?row=providenciaLtrV20&comp=paginaLtr    → la misma fila con prosa de cuatro campos
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

// Goal "material del informe" (06-sep-2026): tres casos más para los shots por veredicto sin
// abrir las filas en prod (laFloridaLtr = c4ffe9a6 BUSCAR, nunoaLtr = 17b4e10d COMPRAR,
// lasCondesStr = efe52b6a COMPRAR). Se vuelcan con scripts/of-dump-fixture.ts.
// v21 (08-sep-2026): los tres LTR se volcaron a prosa de DOS BLOQUES y
// `providenciaLtrV20` conserva la misma fila con los CUATRO campos viejos, que es
// la unica forma de shotear el camino congelado sin abrir una fila anonima en prod.
// v17 (09-sep-2026): los tres STR se volcaron a la prosa podada; `staRosaStrV11`
// conserva la misma fila con los siete bloques viejos (camino congelado), y
// `lasCondesStrNo` / `lasCondesStrNoSeguro` son la misma fila con los otros dos estados
// de regulacionEdificio — la unica forma de shotear el bloque determinista sin inventar
// filas de analisis.
// v22 (09-sep-2026): `nunoaLtrV22` / `providenciaLtrV22` / `laFloridaLtrV22` son las MISMAS
// tres filas con la forma v22 — un solo campo de prosa. Se derivan por SUSTRACCION de sus
// v21 (se les sacan los cuatro campos que v22 ya no emite), no por generacion: asi la prosa
// y el `results` siguen viniendo de la misma fila. ⚠️ EL TEXTO ES EL DE v21, o sea que
// `cajaAccionable` mide 48-65 palabras; en v22 el campo absorbe el trabajo de los cuatro
// muertos y su techo es 110, asi que en produccion el bloque va a ser MAS ALTO que en estos
// shots. Sirven para verificar la FORMA del render, no el largo definitivo.
// v22.1 (10-sep-2026) · los bordes del bloque determinista que ninguna fila real cubre:
// `gs4LtrMixCuerpo` y `gs7LtrUnicaSalida` son los 179 —ninguna palanca sola cruza y el mix
// es el cuerpo, con y sin descuento—, y `providenciaLtrViejo` es la misma fila con los
// campos nuevos BORRADOS del hallazgo: simula lo que llega por `rawResults` cuando no hay
// input_data (2 filas del parque) y prueba que la ausencia se lee como «no calculado».
// v22.2 (10-sep-2026) · el caso DOMINANTE de BUSCAR OTRA no necesita fixture nuevo: es
// `laFloridaLtrV22`. Tiene TRES palancas que llegan al escalón intermedio (pie +5,
// arriendo +5, precio −5,1%) y NINGUNA a COMPRAR, así que es la fila donde se ve la
// decisión del 10-sep — dice «ninguna llega a Comprar · haría falta en precio −36,6% ·
// fuera de rango», no «tres suben a Ajustar». Son 574 de las 592 filas con número hacia
// COMPRAR. Un fixture sin `ai_analysis` NO sirve para esto: el bloque solo existe en el
// camino de dos bloques (`esProsaDosBloques`), o sea con prosa v21+.
// v22.3 (10-sep-2026) · `lasCondesLtrSinSalida` es el CONTROL de las siete líneas: fila
// real donde ningún cambio alcanza NI combinando (`sinSalida` true, 258 del parque). Ahí
// la frase dura es cierta y tiene que sobrevivir intacta — apagarla en las 258 cambia una
// mentira por otra, que es la mitad que un arreglo apurado rompe.
type FixKey = "staRosaStr" | "staRosaStrV11" | "grajalesStr" | "providenciaLtr" | "providenciaLtrV20" | "providenciaLtrV22" | "laFloridaLtr" | "laFloridaLtrV22" | "nunoaLtr" | "nunoaLtrV22" | "lasCondesStr" | "lasCondesStrNo" | "lasCondesStrNoSeguro" | "gs4LtrMixCuerpo" | "gs7LtrUnicaSalida" | "providenciaLtrViejo" | "lasCondesLtrSinSalida";

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
