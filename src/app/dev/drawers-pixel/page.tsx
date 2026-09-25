"use client";
// ============================================================================
// Página DEV — monta el informe y sus piezas sobre fixtures JSON congelados, sin sesión
// ni Supabase. La ruta real exige sesión de dueño/suscriptor, así que sin esto la página
// no se puede ver ni shotear sin login.
//   · ?row=staRosaStr|grajalesStr&comp=pagina  → página STR completa (STRResultsClient)
//   · ?row=providenciaLtr&comp=paginaLtr       → página LTR completa (PremiumResults)
//   · ?row=providenciaLtrV20&comp=paginaLtr    → la misma fila con prosa de cuatro campos
//   · ?comp=esqueleto                          → la carga de la página (loading.tsx), sin fila
//   · &muestra=1 (con paginaLtr)               → la zona como la de una fila NUEVA: la referencia
//     de arriendo y su muestra guardada (muestra-arriendo.json), para ver la lista del modal
//   · ?row=<str>&comp=<pieza>                  → piezas compartidas (matriz, planilla, fila
//     de dato, tramos, curva, cifras, día 1, patrimonio, all) sobre el recompute volcado
// T3 STR (05-sep-2026): murió la rama de los drawers STR viejos (DrawerSTR, DrawerContentSTR,
// HeroSTR) junto con esos componentes; los hallazgos viven en los capítulos.
// Los fixtures se regeneran desde la base con scripts/of-dump-fixture.ts (gitignored).
// ============================================================================
import { Suspense } from "react";
import { useSearchParams, notFound } from "next/navigation";
import type { FullAnalysisResult } from "@/lib/types";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { simularStrDesdePersistido } from "@/lib/analysis/simular-str";
import { TokensHallazgos } from "@/components/analysis/hallazgos/HallazgosAcordeon";
import { DocTokens } from "@/components/analysis/portada/PortadaInforme";
import { TokensShared } from "@/components/analysis/shared";
import { PiezasShared } from "./PiezasShared";
import { STRResultsClient } from "@/app/analisis/renta-corta/[id]/results-client";
import { PremiumResults } from "@/app/analisis/[id]/results-client";
import fixtures from "./fixtures.json";
import muestraFix from "./muestra-arriendo.json";
import { EsqueletoInforme } from "@/components/analysis/EsqueletoInforme";

// Goal "material del informe" (06-sep-2026): tres casos más para los shots por veredicto sin
// abrir las filas en prod (laFloridaLtr = c4ffe9a6 BUSCAR, nunoaLtr = 17b4e10d COMPRAR,
// lasCondesStr = efe52b6a COMPRAR). Se vuelcan con scripts/of-dump-fixture.ts.
// v21 (08-sep-2026): los tres LTR se volcaron a prosa de DOS BLOQUES y
// `providenciaLtrV20` conserva la misma fila con los CUATRO campos viejos, que es
// la unica forma de shotear el camino congelado sin abrir una fila anonima en prod.
// v17 (09-sep-2026): los tres STR se volcaron a la prosa podada; `staRosaStrV11`
// conserva la misma fila con los siete bloques viejos (camino congelado), y
// `lasCondesStrNo` / `lasCondesStrNoSeguro` eran la misma fila con los otros dos estados
// del reglamento; desde el retiro de la regulacion (11-sep-2026) renderizan igual que
// `lasCondesStr` y quedan solo como fixtures inertes.
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
// `providenciaStrSoloPalancas` (13-sep-2026) es el CUARTO estado del pop-up: sin grilla y
// con una palanca que cruza sola. Son 6 filas STR en el parque y ninguna estaba volcada.
// `santiagoStrUnaFila` (13-sep-2026): la grilla degenerada de UNA FILA (un solo pie), 63
// filas LTR y 2 STR. Con una fila no hay matriz que dibujar: hay una línea de plazos.
type FixKey = "santiagoStrUnaFila" | "providenciaStrSoloPalancas" | "staRosaStr" | "staRosaStrV11" | "grajalesStr" | "providenciaLtr" | "providenciaLtrV20" | "providenciaLtrV22" | "laFloridaLtr" | "laFloridaLtrV22" | "nunoaLtr" | "nunoaLtrV22" | "lasCondesStr" | "lasCondesStrNo" | "lasCondesStrNoSeguro" | "gs4LtrMixCuerpo" | "gs7LtrUnicaSalida" | "providenciaLtrViejo" | "lasCondesLtrSinSalida";

/**
 * `&muestra=1` (24-sep-2026): ninguna fila del parque guarda todavía la muestra de su mediana de
 * arriendo (se guarda desde este cambio), así que la lista de «Ver los comparables» no se puede
 * ver con una fila real sin crear un análisis. Esto le pone a la fila la referencia de radio y la
 * muestra de 00f9c0eb recalculada el 24-sep-2026 —41 avisos a 500 m—, con la mediana y el n que
 * salen de esa misma muestra, que es lo que el wizard guarda. La cifra de la fila no calza con la
 * tipología de la muestra: es un fixture de render, no un análisis.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function conMuestraArriendo(input: any): any {
  const precios = muestraFix.avisos.map((a) => a.precio).sort((a, b) => a - b);
  const m = Math.floor(precios.length / 2);
  const mediana = precios.length % 2 ? precios[m] : (precios[m - 1] + precios[m]) / 2;
  return {
    ...input,
    zonaRadio: {
      ...(input?.zonaRadio ?? {}),
      arriendoFuente: "radio",
      arriendoPromedio: Math.round(mediana / 1000) * 1000,
      sampleSizeArriendo: muestraFix.avisos.length,
      radioMetros: muestraFix.radioMetros,
      muestraArriendo: { modo: muestraFix.modo, avisos: muestraFix.avisos },
    },
  };
}

function Inner() {
  const sp = useSearchParams();
  const rowKey = (sp.get("row") ?? "staRosaStr") as FixKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fix = (fixtures as Record<string, any>)[rowKey];
  const isSTR = fix?.tipo === "renta_corta" || fix?.tipo === "short-term";
  // RECOMPUTE, COMO LA RUTA REAL (13-sep-2026). `analisis/[id]/page.tsx` recomputa antes de
  // montar; esta página servía los `results` congelados del fixture, así que todo lo que el
  // motor agregó DESPUÉS del volcado —la grilla del pop-up, por ejemplo— salía vacío acá y
  // lleno en producción. Un entorno de prueba que muestra otro estado que prod no sirve para
  // aprobar un render. Mismas congeladas que allá: UF de la fila y fecha de creación.
  const results = ((): FullAnalysisResult => {
    const persisted = fix?.results as FullAnalysisResult;
    const input = fix?.input_data;
    if (!input) return persisted;
    if (isSTR) {
      // STR recomputa por su propia ruta (`recomputeShortTermForLegacy`), igual que
      // `analisis/renta-corta/[id]/page.tsx`.
      const uf = Number(input.precioCompra) && Number(input.precioCompraUF) ? Number(input.precioCompra) / Number(input.precioCompraUF) : 0;
      if (!(uf > 0)) return persisted;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (recomputeShortTermForLegacy(input as any, persisted as any, uf, new Date(fix.created_at ?? Date.now()), { mediana: null, n: 0 }) ?? persisted) as unknown as FullAnalysisResult;
      } catch {
        return persisted;
      }
    }
    const uf = persisted?.metrics?.precioCLP && input.precio ? persisted.metrics.precioCLP / input.precio : 38800;
    const snap = fix?.medianaSnapshot;
    const mediana = snap ? { mediana: snap.mediana, n: snap.n ?? 0 } : undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (recomputeResultsForLegacy(input as any, uf, mediana as any, new Date(fix.created_at ?? Date.now())) ?? persisted) as FullAnalysisResult;
    } catch {
      return persisted;
    }
  })();
  const valorUF: number = fix?.uf ?? 38800;
  const comp = sp.get("comp");
  if (comp === "esqueleto") return <EsqueletoInforme />;

  // Goal "LTR hereda piezas compartidas" (05-sep-2026) · `?row=providenciaLtr&comp=paginaLtr`
  // monta la página LTR completa con el recompute volcado de 7710a017.
  if (fix && !isSTR && comp === "paginaLtr") {
    // `doc-lienzo`: en la ruta real lo pone `analisis/[id]/page.tsx` (server), que esta
    // página no monta, y sin él el shot de LTR salía sobre el gris de la app. Hasta el
    // 12-sep-2026 (retiro del andamio) `?rediseno=1` envolvía además con el provider del
    // interruptor; el rediseño es el único camino y ya no hay nada que encender.
    return (
      <div className="doc-lienzo">
      <PremiumResults
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results={results as any}
        accessLevel="subscriber"
        analysisId={fix.id}
        inputData={sp.get("muestra") === "1" ? conMuestraArriendo(fix.input_data) : fix.input_data}
        comuna={fix.comuna}
        score={fix.score ?? results?.score ?? 0}
        freeYieldBruto={results?.metrics?.rentabilidadBruta ?? 0}
        freeFlujo={results?.metrics?.flujoNetoMensual ?? 0}
        freePrecioM2={results?.metrics?.precioM2 ?? 0}
        resumenEjecutivo=""
        ufValue={valorUF}
        aiAnalysisInitial={fix.ai_analysis ?? undefined}
        nombre={fix.nombre ?? ""}
        ciudad={fix.ciudad ?? "Santiago"}
        createdAt={fix.created_at ?? ""}
        superficie={fix.superficie ?? 0}
        precioUF={fix.precio ?? 0}
        isSharedView={false}
        isLoggedIn
        medianaResolvedAt={fix.medianaSnapshot?.resolvedAt ?? new Date().toISOString()}
      />
      </div>
    );
  }
  if (!fix || !isSTR) return <div style={{ padding: 40 }}>fixture ?row=staRosaStr|grajalesStr (STR, con &comp=pagina o &comp=&lt;pieza&gt;) · providenciaLtr (&comp=paginaLtr) no encontrado</div>;

  // `?comp=pagina` monta la página STR completa (T1) con el fixture, tal como la sirve la
  // ruta real (el rediseño es el único camino desde el 12-sep-2026).
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
        simulacionStr={(() => {
          // La simulación se recalcula sobre el recompute, como en la ruta real: el fixture
          // la trae congelada y sus fronteras quedaron en el volcado.
          const input = fix.input_data;
          const uf = Number(input?.precioCompra) && Number(input?.precioCompraUF) ? Number(input.precioCompra) / Number(input.precioCompraUF) : 0;
          if (!(uf > 0)) return fix.simulacion ?? null;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return simularStrDesdePersistido(input as any, results as any, uf, new Date(fix.created_at ?? Date.now())) ?? fix.simulacion ?? null;
          } catch {
            return fix.simulacion ?? null;
          }
        })()}
        zonaStr={fix.zonaStr ?? null}
      />
    );
  }

  // T1 (04-sep-2026) · `?comp=<pieza>` monta las piezas compartidas sobre el recompute
  // volcado. Sin registro por pieza cada QA era un `if` a mano.
  return (
    <div
      className="doc-dictamen doc-tokens"
      style={{ background: "var(--doc-paper, #FAF8F3)", minHeight: "100vh" }}
    >
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
