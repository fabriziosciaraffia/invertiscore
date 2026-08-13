// ============================================================================
// ENSAMBLADOR AMBAS — el informe comparativo como pieza de lectura
// ============================================================================
// Espejo de ensamblar.ts para el producto comparativo. La diferencia
// arquitectónica: el comparativo no es una fila, es un PAR (LTR + STR), y su
// fidelidad de render exige la BASE HOMOLOGADA de la página (comparativa/
// page.tsx): la UF real se reconstruye del lado LTR (`resolveUfForAnalysis`) y
// el recompute del STR re-escala a esa UF. Leer `input_data` crudo calificaría
// un informe que el usuario nunca vio — 19/66 pares del parque tienen el
// precioCompra STR convertido con la UF fallback 38.800 del wizard v3, y la
// página los enmascara al renderizar. Acá se reproduce ese enmascaramiento a
// propósito (el objeto evaluado es lo que se lee, no lo que se persiste).
//
// Orden de lectura (comparativa-client.tsx + HeroComparativa.tsx):
//   hero (veredicto + sub + banner frágil + mini-scores) → prosa "Cuál te
//   conviene" (apertura + mov 1-2) → TOP-3 "Lo que define este veredicto" →
//   "La posición de Franco" + cierre → pirámide diferencial (4-6 cards con su
//   drawer-puente) → evidencia (tabla side-by-side).
//
// Desvío deliberado respecto de la doctrina LTR/STR ("drawers motor-templated
// no se incluyen"): los drawers-puente de la pirámide comparativa SÍ se
// ensamblan. Son strings puros del builder (no TSX que haya que renderizar) y
// las dimensiones AMBAS de la rúbrica (D10 cifra-sin-ancla, D11 tensión sin
// resolver) miden exactamente si el puente aritmético existe — sin el puente
// en la pieza, el juez reportaría como falla lo que la página sí entrega a un
// tap de distancia.
//
// Pares SIN prosa (`results.comparativaAI` ausente): se ensamblan igual con el
// placeholder real de la web ("Los datos y la tabla comparativa están
// disponibles arriba."). El hero, las cards y la evidencia son motor y se
// evalúan igual; meta.sinProsa lo marca para el reporte.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIAnalysisComparativa, AnalisisInput, FullAnalysisResult } from "../../../src/lib/types";
import { normalizeLegacyVerdict } from "../../../src/lib/types";
import type { ShortTermResult } from "../../../src/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "../../../src/lib/engines/short-term-score";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { recomputeShortTermForLegacy } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "../../../src/lib/api-helpers/analisis-pipeline";
import { resolveUfForAnalysis } from "../../../src/lib/uf";
import { readVeredicto } from "../../../src/lib/results-helpers";
import { buildHeroAmbas, FRAGIL_CHIP, type Verdict } from "../../../src/lib/comparativa-hero-copy";
import { lineaDistanciaMini } from "../../../src/lib/distancia-copy";
import type { Hallazgo, HallazgoDistanciaVeredicto } from "../../../src/lib/types";
import { buildFindingsComparativa, ctxFromResults, type FindingComparativa } from "../../../src/lib/comparativa-findings";
import { buildNotaFlujoChart, buildNotaPatrimonioChart, notaTexto } from "../../../src/lib/comparativa-chart-notas";
import { buildAperturaComparativa } from "../../../src/lib/comparativa-apertura";
import type { BandaComparativa } from "../../../src/lib/engines/str-universo-santiago";
import { PROMPT_VERSION_AMBAS } from "../../../src/lib/ai-generation-ambas";
import { generateComparativaAI } from "../../../src/lib/ai-generation-ambas-generate";

const UF_FALLBACK = 38800; // mismo fallback que ai-generation-ambas-generate.ts

type LTRResultsWithCache = FullAnalysisResult & { comparativaAI?: AIAnalysisComparativa; tipoAnalisis?: string };
type STRResultsWithScore = ShortTermResult & { tipoAnalisis?: string; francoScore?: FrancoScoreSTR };

/** Fila mínima de `analisis` que el ensamblador comparativo necesita por lado. */
export interface FilaParAmbas {
  id: string;
  user_id: string | null;
  comuna: string | null;
  direccion: string | null;
  created_at: string | null;
  tipo_analisis: string | null;
  input_data: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
  score: number | null;
}

export interface InformeEnsambladoAmbas {
  meta: {
    /** `<ltr8>+<str8>` — el informe es del par, no de una fila. */
    id8: string;
    tipo: "AMBAS";
    /** Badge que el usuario ve (hero 3 ejes: LARGA/PAREJAS/CORTA o NO SE SOSTIENE). */
    veredicto: string;
    banda: string;
    comuna: string;
    promptVersion: number | null;
    /** Sin `results.comparativaAI` — el informe queda motor-templated completo. */
    sinProsa: boolean;
    /** Columna informativa del censo: el precioCompra STR nació con la UF 38.800
     *  del wizard v3 (la página lo enmascara re-escalando; el ensamblado también). */
    parRoto38800: boolean;
  };
  texto: string;
  piezas: number;
}

// ── helpers (espejo de ensamblar.ts, privados allá) ──────────────────────────
const seccion = (etiqueta: string, cuerpo: Array<string | null | undefined>): string | null => {
  const partes = cuerpo.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  if (partes.length === 0) return null;
  return `[PIEZA: ${etiqueta}]\n${partes.join("\n")}`;
};

const fmtCLP = (n: number) => (n < 0 ? "−$" : "$") + Math.round(Math.abs(n)).toLocaleString("es-CL");

const ladoLabel = (l: FindingComparativa["lado"]) =>
  l === "ltr" ? "a favor renta larga" : l === "str" ? "a favor renta corta" : "educativo";

// Fila del drawer-puente como línea de texto (mismas celdas que el render).
const filaPuente = (f: { label: string; ltr?: string; str?: string; delta?: string }): string => {
  const celdas = [
    f.ltr != null ? `larga ${f.ltr}` : null,
    f.str != null ? `corta ${f.str}` : null,
    f.delta != null ? `Δ ${f.delta}` : null,
  ].filter(Boolean);
  return `· ${f.label}: ${celdas.join(" · ")}`;
};

/** Detección informativa del par con base UF 38.800 (bug wizard v3, dato de entrada). */
export function esParRoto38800(strInput: Record<string, unknown> | null): boolean {
  const clp = Number(strInput?.precioCompra) || 0;
  const uf = Number(strInput?.precioCompraUF) || 0;
  if (clp <= 0 || uf <= 0) return false;
  return Math.abs(clp / uf - 38800) < 1;
}

export interface EnsamblarAmbasOpts {
  /**
   * Genera la prosa con el prompt VIGENTE en vez de leer la persistida
   * (`persist: false` — cero writes). Sirve para medir el informe que el usuario
   * verá cuando abra el suyo, en un parque donde la prosa guardada quedó de
   * versiones anteriores. Sin esto solo se puede medir lo motor-templated.
   */
  prosaFresca?: boolean;
}

// ── ensamblado ────────────────────────────────────────────────────────────────
export async function ensamblarAMBAS(
  ltr: FilaParAmbas,
  str: FilaParAmbas,
  sb: SupabaseClient,
  opts?: EnsamblarAmbasOpts,
): Promise<InformeEnsambladoAmbas> {
  const ltrResultsPersisted = (ltr.results ?? null) as LTRResultsWithCache | null;
  const strResultsPersisted = (str.results ?? null) as STRResultsWithScore | null;
  if (!ltrResultsPersisted || !strResultsPersisted) throw new Error("par sin results en algún lado");

  // ── Recompute homologado — espejo byte-a-byte de comparativa/page.tsx ──────
  const ltrUf = resolveUfForAnalysis(
    ltrResultsPersisted as { metrics?: { precioCLP?: number | null } | null },
    ltr.input_data as { precio?: number | null } | null,
    UF_FALLBACK,
    ltr.id,
  );
  const ltrInput = (ltr.input_data ?? null) as AnalisisInput | null;
  const ltrAsOf = new Date(ltr.created_at ?? new Date().toISOString());
  const ltrMediana = ltrInput ? await prefetchMedianaComunaVenta(sb, ltrInput, ltrUf) : { mediana: null, n: 0 };
  const ltrResults = (
    ltrInput
      ? { ...recomputeResultsForLegacy(ltrInput, ltrUf, ltrMediana, ltrAsOf), comparativaAI: ltrResultsPersisted.comparativaAI }
      : ltrResultsPersisted
  ) as LTRResultsWithCache;

  const strInput = str.input_data;
  const strAsOf = new Date(str.created_at ?? new Date().toISOString());
  const strMediana = strInput
    ? await prefetchMedianaComunaVenta(
        sb,
        {
          comuna: (strInput.comuna as string) ?? str.comuna ?? "",
          superficie: Number(strInput.superficieUtil) || 0,
          dormitorios: Number(strInput.dormitorios) || 0,
          esNuevo: strInput.tipoPropiedad === "nuevo",
          antiguedad: typeof strInput.antiguedad === "number" ? strInput.antiguedad : undefined,
        },
        ltrUf,
      )
    : { mediana: null, n: 0 };
  const strResults = (recomputeShortTermForLegacy(strInput, strResultsPersisted, ltrUf, strAsOf, strMediana) ??
    strResultsPersisted) as STRResultsWithScore;

  // ── Derivaciones del hero 3 ejes (MISMO builder que web/share/documento) ──
  // La banda de 4 estados manda: la reco colapsada ya no se usa acá (ver
  // `ganadorDeBanda` — STR_FRAGIL no es un empate).
  const fragil = strResults.veredictoComparativo?.fragil ?? false;
  const banda = strResults.veredictoComparativo?.banda ?? "INDIFERENTE";

  const ltrVerdict = (readVeredicto(ltrResults) as Verdict | null) ?? null;
  const strVerdict = (normalizeLegacyVerdict(strResults.veredicto) as Verdict | null) ?? null;
  const ltrScore = ltr.score ?? 0;
  const strScore = strResults.francoScore?.score ?? 0;

  const hero = buildHeroAmbas({
    banda: banda as BandaComparativa,
    fragil,
    ltrVerdict,
    strVerdict,
    ltrFlujoMensual: ltrResults.metrics?.flujoNetoMensual ?? 0,
    strFlujoMensual: strResults.escenarios?.base?.flujoCajaMensual ?? 0,
    sobreRentaPct: strResults.comparativa?.sobreRentaPct ?? 0,
    sobreRentaPctConfiable: strResults.comparativa?.sobreRentaPctConfiable ?? true,
    sobreRentaCLP: strResults.comparativa?.sobreRenta ?? 0,
  });
  const buscarDistancia = (hs: unknown): HallazgoDistanciaVeredicto | null => {
    const arr = Array.isArray(hs) ? (hs as Hallazgo[]) : [];
    return (arr.find((h) => h.id === "distancia_veredicto") as HallazgoDistanciaVeredicto | undefined) ?? null;
  };
  const ltrDistancia = lineaDistanciaMini(buscarDistancia(ltrResults.hallazgos), ltrVerdict);
  const strDistancia = lineaDistanciaMini(
    buscarDistancia((strResults as unknown as { hallazgos?: Hallazgo[] }).hallazgos),
    strVerdict,
  );

  const modoGestion = ((strInput?.modoGestion as string) ?? "auto") as "auto" | "admin";
  const comisionAdministrador = (strInput?.comisionAdministrador as number) ?? 0.2;
  const costoAmoblamiento = (strInput?.costoAmoblamiento as number) ?? 0;
  const edificioPermiteAirbnb = (strInput?.edificioPermiteAirbnb as string) ?? "no_seguro";

  const ctx = ctxFromResults(ltrResults, strResults, {
    modoGestion,
    comisionAdministrador,
    costoAmoblamiento,
    edificioPermiteAirbnb,
  });
  const findings = ctx ? buildFindingsComparativa(ctx, "CLP", ltrUf) : [];
  const top3 = findings.slice(0, 3);

  // ── Prosa: lo que el usuario VE, no lo que está guardado ──────────────────
  // Las tres superficies de producción (web logueada, share y documento) ocultan
  // la prosa cuyo `promptVersion` no es el vigente: la logueada regenera y las
  // públicas degradan a motor-only. Sin este mismo chequeo el censo mediría
  // prosa v1/v2 que hoy no ve nadie — exactamente el error que el instrumento
  // existe para no cometer. `opts.prosaFresca` es la otra mitad: genera la prosa
  // del prompt vigente SIN persistir, para medir el informe que el usuario verá
  // cuando abra el suyo.
  let ai: AIAnalysisComparativa | null = null;
  if (opts?.prosaFresca) {
    try {
      ai = await generateComparativaAI({ ltrId: ltr.id, strId: str.id, supabase: sb, persist: false, log: () => {} });
    } catch {
      ai = null; // el par se censa motor-only y queda declarado en el reporte
    }
  } else {
    const persistida = ltrResultsPersisted.comparativaAI ?? null;
    ai = persistida?.promptVersion === PROMPT_VERSION_AMBAS ? persistida : null;
  }
  const sinProsa = !ai?.conviene;

  // ── Piezas en orden de lectura (hero 3 ejes, contrato d25096d) ──────────────
  const miniLtr = [
    `RENTA LARGA — Franco Score ${ltrScore} · ${ltrVerdict ?? "?"}`,
    ltrDistancia ? `Lo que te separa: ${ltrDistancia}` : null,
  ];
  const miniStr = [
    `RENTA CORTA — Franco Score ${strScore} · ${strVerdict ?? "?"}`,
    strDistancia ? `Lo que te separa: ${strDistancia}` : null,
  ];
  const piezas: Array<string | null> = [
    seccion(`hero:veredicto (${hero.badgeCritico ? "Veredicto" : "Veredicto de modalidad"})`, [
      hero.badge,
      hero.sub,
      hero.margen ? `Margen del ganador: ${hero.margen.texto}${hero.margen.mostrarRotulo ? ` · ${hero.margen.escala}` : ""}` : null,
    ]),
    hero.subordinada
      ? seccion(`hero:subordinada (${hero.subordinada.kicker})`, [hero.subordinada.texto])
      : null,
    hero.fragilChip ? seccion("hero:banner (Margen frágil)", [`${FRAGIL_CHIP.kicker}: ${FRAGIL_CHIP.texto}.`]) : null,
    seccion(
      "hero:mini-scores (los dos análisis hijos)",
      // Ganador primero — mismo orden que el render.
      hero.ganador === "corta" ? [...miniStr, ...miniLtr] : [...miniLtr, ...miniStr],
    ),
    sinProsa
      // Sin prosa IA el bloque ya NO muestra un placeholder que promete y no
      // entrega: lo carga la apertura del motor (misma función que la web y el
      // documento). El censo lo midió como D1/D2 ALTA en 7 pares.
      ? seccion("prosa (Cuál te conviene)", [
          buildAperturaComparativa({
            topId: findings[0]?.id ?? "flujo",
            topLado: findings[0]?.lado ?? "neutro",
            banda: banda as BandaComparativa,
            estadoHero: hero.estado,
            sobreRentaPct: strResults.comparativa?.sobreRentaPct ?? 0,
            sobreRentaPctConfiable: strResults.comparativa?.sobreRentaPctConfiable ?? true,
          }),
        ])
      : seccion("prosa (Cuál te conviene)", [
          ai?.apertura ?? ai?.headline ?? null,
          ai?.conviene?.quienDeberiasSer ? `Quién tienes que ser: ${ai.conviene.quienDeberiasSer}` : null,
          ai?.conviene?.switchPath ? `¿Y si migro después?: ${ai.conviene.switchPath}` : null,
        ]),
    seccion("hero:indice (Lo que define este veredicto)", [
      `Las ${top3.length} diferencias que más pesan en la decisión.`,
      ...top3.map((f, i) => `${String(i + 1).padStart(2, "0")} ${f.titular} · KPI ${f.kpi} (${f.kicker} · ${ladoLabel(f.lado)})`),
    ]),
    seccion("posicion (La posición de Franco)", [
      hero.posicion,
      ai?.conviene?.cierre?.trim() || null,
    ]),
    ...findings.flatMap((f, i) => [
      seccion(`card:${f.id} (#${i + 1} · ${ladoLabel(f.lado)})`, [
        `${f.kicker} — ${f.titular}`,
        `KPI: ${f.kpi} (${f.ksub})`,
        f.cuerpo,
      ]),
      seccion(`drawer:puente:${f.id} (${f.puente.titulo})`, [
        f.puente.lead,
        ...f.puente.filas.map(filaPuente),
        f.puente.nota ?? null,
      ]),
    ]),
    seccion("evidencia (Lo que cambia entre renta larga y renta corta — tabla)", buildEvidencia(ltrResults, strResults, modoGestion, comisionAdministrador)),
    // Anotaciones de los dos charts de "LA EVIDENCIA": prosa con cifras que el
    // usuario lee bajo cada gráfico. Mismo builder que los componentes
    // (comparativa-chart-notas) — regla espejo, cero copia. La nota de
    // patrimonio ES el puente D11 (patrimonio descontando bolsillo + comisión).
    ...(() => {
      const notaPat = buildNotaPatrimonioChart(ltrResults, strResults, "CLP", ltrUf);
      const notaFlu = buildNotaFlujoChart(ltrResults, strResults, "CLP", ltrUf);
      return [
        notaPat
          ? seccion(`chart:patrimonio:nota (${notaPat.kicker})`, [notaPat.cuerpo, notaTexto(notaPat.glosa)])
          : null,
        notaFlu
          ? seccion("chart:flujo:nota (Volatilidad vs estabilidad del flujo de caja)", [notaTexto(notaFlu)])
          : null,
      ];
    })(),
  ];

  const vivas = piezas.filter((p): p is string => !!p);
  return {
    meta: {
      id8: `${ltr.id.slice(0, 8)}+${str.id.slice(0, 8)}`,
      tipo: "AMBAS",
      veredicto: hero.badge,
      banda,
      comuna: ltr.comuna ?? str.comuna ?? "?",
      promptVersion: ai?.promptVersion ?? null,
      sinProsa,
      parRoto38800: esParRoto38800(strInput),
    },
    texto: vivas.join("\n\n"),
    piezas: vivas.length,
  };
}

// Tabla side-by-side textualizada — mismas derivaciones que comparativa-client.tsx
// (KPIs del Acto 3) y mismas etiquetas/tooltips de valor que TablaSideBySide.tsx.
function buildEvidencia(
  ltrResults: FullAnalysisResult,
  strResults: STRResultsWithScore,
  modoGestion: "auto" | "admin",
  comisionAdministrador: number,
): string[] {
  const ltrNOIMensual = (ltrResults.metrics?.noi ?? 0) / 12;
  const ltrNOIAnualY1 = ltrNOIMensual * 12;
  const ltrY5 = ltrResults.projections?.[4];
  const ltrNOIAnualY5 = ltrY5
    ? ltrY5.flujoAnual + (ltrResults.metrics?.dividendo ?? 0) * 12
    : ltrNOIAnualY1 * Math.pow(1.03, 4);
  const ltrRetorno = ltrResults as unknown as { retorno?: { inversionInicial?: number }; exitScenario?: { inversionInicial?: number } };
  const ltrCapital = ltrRetorno.retorno?.inversionInicial ?? ltrRetorno.exitScenario?.inversionInicial ?? ltrResults.metrics?.pieCLP ?? 0;

  const strBase = strResults.escenarios?.base;
  const strNOIMensual = strBase?.noiMensual ?? 0;
  const strNOIAnualY1 = strNOIMensual * 12 - (strResults.perdidaRampUp ?? 0);
  const strY5 = strResults.projections?.[4];
  const strNOIAnualY5 = strY5
    ? strY5.flujoOperacionalAnual + (strResults.dividendoMensual ?? 0) * 12
    : strNOIMensual * 12 * Math.pow(1.03, 4);
  const strCapital = strResults.capitalInvertido ?? 0;

  return [
    `· Lo que renta al mes (neto de gastos): larga ${fmtCLP(ltrNOIMensual)} · corta ${fmtCLP(strNOIMensual)}`,
    `· Lo que renta el año 1: larga ${fmtCLP(ltrNOIAnualY1)} · corta ${fmtCLP(strNOIAnualY1)}`,
    `· Lo que renta el año 5: larga ${fmtCLP(ltrNOIAnualY5)} · corta ${fmtCLP(strNOIAnualY5)}`,
    `· Capital de entrada: larga ${fmtCLP(ltrCapital)} · corta ${fmtCLP(strCapital)}`,
    `· Esfuerzo operativo: larga Bajo · ~0,5 hrs/sem — corta ${modoGestion === "auto" ? "Alto · 8-12 hrs/sem" : `Medio · ${Math.round(comisionAdministrador * 100)}% al admin`}`,
    `· Riesgo principal: larga Vacancia entre arriendos — corta Estacionalidad + ocupación`,
  ];
}
