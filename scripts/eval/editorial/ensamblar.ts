// ============================================================================
// ENSAMBLADOR — el informe completo como pieza de lectura (Fase 1)
// ============================================================================
// Reconstruye, desde la fila de `analisis`, el TEXTO que el usuario efectivamente
// lee en la página de resultados, en orden de lectura: hero (pregunta,
// respuestaDirecta, TOP-3, posición de Franco), cards de la pirámide, drawers
// con prosa IA, y zona/huésped si tiene.
//
// Fidelidad de render:
// - `results` NO se lee crudo: se recomputa como lo hace la página
//   (recomputeResultsForLegacy / recomputeShortTermForLegacy) con UF y fecha
//   CONGELADAS, para que los hallazgos (titular/fraseCanonica/KPI) sean los que
//   el usuario vio. Fallback al persistido si el recompute no es posible.
// - Orden y dedupe de la pirámide: MISMAS funciones que el render
//   (ordenarHallazgosPiramide / ordenarHallazgosPiramideSTR, findingDisplay).
// - Se evalúa la rama CLP (default del toggle).
// - Los drawers motor-templated (TSX determinístico: TIR, sensibilidad,
//   patrimonio, etc.) NO se incluyen: son plantillas del motor, no prosa, y
//   reconstruirlas exigiría renderizar componentes. Fase 1 evalúa la pieza
//   editorial: prosa IA + titulares/frases del motor que la página muestra como
//   texto corrido.
import type { AIAnalysisSTRv2, AIAnalysisV2, AISection, FullAnalysisResult, Hallazgo } from "../../../src/lib/types";
import { recomputeResultsForLegacy } from "../../../src/lib/analysis/recompute-results-for-legacy";
import { recomputeShortTermForLegacy } from "../../../src/lib/analysis/recompute-short-term-for-legacy";
import { resolveUfForAnalysis } from "../../../src/lib/uf";
import { ordenarHallazgosPiramide, piramideLayout } from "../../../src/lib/orden-hallazgos";
import { ordenarHallazgosPiramideSTR } from "../../../src/lib/piramide-orden-str";
import { findingDisplay } from "../../../src/components/analysis/GenericFindingCard";
import { describirMotivosSTR, describirMotivosLTR } from "../../../src/lib/no-cierra-copy";

const UF_FALLBACK = 38800; // solo si la fila no permite reconstruir la UF congelada

export interface FilaAnalisis {
  id: string;
  comuna: string | null;
  created_at: string | null;
  tipo_analisis: string | null;
  input_data: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
  ai_analysis: Record<string, unknown> | null;
  mediana_comuna_snapshot?: { mediana: number | null; n?: number } | null;
  zone_insight?: { insight?: Record<string, unknown> } | null;
  guest_insight?: { insight?: Record<string, unknown> } | null;
}

export interface InformeEnsamblado {
  meta: { id8: string; tipo: "LTR" | "STR"; veredicto: string; comuna: string; promptVersion: number | null };
  texto: string;
  piezas: number;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const seccion = (etiqueta: string, cuerpo: Array<string | null | undefined>): string | null => {
  const partes = cuerpo.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  if (partes.length === 0) return null;
  return `[PIEZA: ${etiqueta}]\n${partes.join("\n")}`;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function cardsPiramide(ordenadas: Hallazgo[], respuestaDirecta: string, valorUF: number): Array<string | null> {
  const { nivel1, nivel2, nivel3 } = piramideLayout(ordenadas);
  const niveles: Array<[Hallazgo | undefined, number]> = [
    [nivel1, 1],
    ...nivel2.map((h): [Hallazgo, number] => [h, 2]),
    ...nivel3.map((h): [Hallazgo, number] => [h, 3]),
  ];
  return niveles.map(([h, nivel]) => {
    if (!h) return null;
    let d: { kick: string; title: string; kpi: string; ksub: string };
    try {
      d = findingDisplay(h, "CLP", valorUF);
    } catch {
      d = { kick: h.tipo, title: h.titular ?? "", kpi: "", ksub: "" };
    }
    // Regla corona (PiramideHallazgos:208-221): si la respuestaDirecta abre con la
    // misma fraseCanonica, la card nivel 1 suprime su body (el usuario lo lee UNA vez).
    const bodySuprimido = nivel === 1 && !!h.fraseCanonica && norm(respuestaDirecta).startsWith(norm(h.fraseCanonica).slice(0, 60));
    const dir = h.direccion === "favorable" ? "A favor" : h.direccion === "neutral" ? "Leve" : "En contra";
    return seccion(`card:${h.id} (nivel ${nivel} · ${dir})`, [
      `${d.kick} — ${d.title}`,
      d.kpi ? `KPI: ${d.kpi}${d.ksub ? ` (${d.ksub})` : ""}` : null,
      bodySuprimido ? "(la frase de esta card ya abre la respuesta directa del hero — no se repite)" : h.fraseCanonica,
    ]);
  });
}

const drawerAISection = (etiqueta: string, s: AISection | undefined): string | null =>
  s ? seccion(`drawer:${etiqueta}`, [s.contenido_clp, s.cajaAccionable_clp ? `${s.cajaLabel || "Hazte esta pregunta:"} ${s.cajaAccionable_clp}` : null]) : null;

// ── LTR ─────────────────────────────────────────────────────────────────────
function ensamblarLTR(fila: FilaAnalisis): InformeEnsamblado {
  const ai = fila.ai_analysis as unknown as AIAnalysisV2 | null;
  if (!ai?.conviene) throw new Error("sin ai_analysis.conviene (LTR)");

  // Recompute espejo del render (UF y fecha congeladas, mediana del snapshot).
  const raw = fila.results as unknown as FullAnalysisResult | null;
  const ufFrozen = resolveUfForAnalysis(raw, fila.input_data as { precio?: number | null } | null, UF_FALLBACK, fila.id);
  const snap = fila.mediana_comuna_snapshot;
  const mediana = snap != null ? { mediana: snap.mediana, n: snap.n ?? 0 } : undefined;
  const asOf = fila.created_at ? new Date(fila.created_at) : undefined;
  let results: FullAnalysisResult | null = raw;
  if (fila.input_data && typeof (fila.input_data as { precio?: unknown }).precio === "number") {
    try {
      results = recomputeResultsForLegacy(fila.input_data as never, ufFrozen, mediana, asOf);
    } catch { /* fallback al persistido */ }
  }

  const respuesta = ai.conviene.respuestaDirecta_clp ?? "";
  const ordenadas = ordenarHallazgosPiramide(results, ai);
  // Índice del hero: los PRIMEROS 3 del orden único, igual que HeroLTR (ordenados.slice).
  // El sort por decisividad que había acá medía OTRO índice que el que el usuario ve —
  // mismo desvío que se corrigió en STR (censo 2026-08-07); este es el espejo LTR.
  const top3 = ordenadas.slice(0, 3);

  // LO QUE TE SEPARA — la distancia no es card (la pirámide LTR la filtra): vive en el
  // drawer que abre "La posición de Franco" y su frase baja al PDF. Espejo del fix STR.
  const distanciaLtr = ((results?.hallazgos ?? []) as Hallazgo[]).find((h) => h.id === "distancia_veredicto");

  // POR QUÉ NO CIERRA (LTR, pv4) — puerto del patrón STR al HeroLTR: la glosa de
  // los motivos cuando el veredicto lo decidió un gate. MISMA derivación que el
  // componente (brazos del hallazgo de distancia + capa Gate 2 derivada:
  // score >= 70 con AJUSTA). Sin motivos → sin pieza, igual que la página.
  const gate2CapoLtr = ((results?.score as number | undefined) ?? 0) >= 70 &&
    (results as { veredicto?: string } | null)?.veredicto === "AJUSTA SUPUESTOS";
  const motivosLtr = describirMotivosLTR(
    (distanciaLtr?.valor as { brazosGate1Activos?: string[] } | undefined)?.brazosGate1Activos ?? [],
    gate2CapoLtr,
  );

  const piezas: Array<string | null> = [
    motivosLtr ? seccion("hero:motivos (Por qué no cierra)", [motivosLtr.frase]) : null,
    seccion("hero:pregunta", [ai.conviene.pregunta ?? "¿Conviene o no conviene?"]),
    seccion("respuestaDirecta", [respuesta]),
    seccion("hero:indice (Léelo en este orden)", top3.map((h) => `· ${h.titular || h.fraseCanonica}`)),
    seccion("posicion (La posición de Franco)", [ai.conviene.cajaAccionable_clp]),
    distanciaLtr
      ? seccion('drawer:distancia (Lo que te separa — se abre desde "La posición de Franco")', [
          distanciaLtr.titular,
          distanciaLtr.fraseCanonica,
        ])
      : null,
    ...cardsPiramide(ordenadas, respuesta, ufFrozen),
    drawerAISection("costoMensual (¿Cuánto te cuesta al mes?)", ai.costoMensual),
    ai.negociacion
      ? seccion("drawer:negociacion", [
          ai.negociacion.contenido_clp,
          ai.negociacion.estrategiaSugerida_clp,
          ai.negociacion.precios?.glosaPrimeraOferta_clp ? `Primera oferta: ${ai.negociacion.precios.glosaPrimeraOferta_clp}` : null,
          ai.negociacion.precios?.glosaTecho_clp ? `Techo: ${ai.negociacion.precios.glosaTecho_clp}` : null,
          ai.negociacion.precios?.glosaWalkAway_clp
            ? `Walk-away: ${ai.negociacion.precios.glosaWalkAway_clp}`
            : ai.negociacion.precios?.walkAway?.razon
              ? `Walk-away: ${ai.negociacion.precios.walkAway.razon}`
              : null,
          ai.negociacion.cajaAccionable_clp ? `${ai.negociacion.cajaLabel || "Hazte esta pregunta:"} ${ai.negociacion.cajaAccionable_clp}` : null,
        ])
      : null,
    ai.reestructuracion ? seccion("drawer:reestructuracion", [ai.reestructuracion.contenido_clp]) : null,
    drawerAISection("largoPlazo (análisis a 10 años)", ai.largoPlazo),
  ];

  const zi = fila.zone_insight?.insight as { headline_clp?: string; narrative_clp?: string; accion?: string } | undefined;
  if (zi) piezas.push(seccion("zona", [zi.headline_clp, zi.narrative_clp, zi.accion ? `Acción: ${zi.accion}` : null]));

  const vivas = piezas.filter((p): p is string => !!p);
  return {
    meta: {
      id8: fila.id.slice(0, 8),
      tipo: "LTR",
      veredicto: (results as { veredicto?: string } | null)?.veredicto ?? "?",
      comuna: fila.comuna ?? "?",
      promptVersion: ai.promptVersion ?? null,
    },
    texto: vivas.join("\n\n"),
    piezas: vivas.length,
  };
}

// ── STR ─────────────────────────────────────────────────────────────────────
function ensamblarSTR(fila: FilaAnalisis): InformeEnsamblado {
  const ai = fila.ai_analysis as unknown as AIAnalysisSTRv2 | null;
  if (!ai?.conviene) throw new Error("sin ai_analysis.conviene (STR)");

  const persisted = fila.results as Record<string, unknown> | null;
  const inp = fila.input_data as Record<string, unknown> | null;
  const precioUF = Number((inp as { precioCompraUF?: unknown } | null)?.precioCompraUF) || 0;
  const precioCLP = Number((inp as { precioCompra?: unknown } | null)?.precioCompra) || 0;
  const ufFrozen = precioUF > 0 && precioCLP > 0 ? precioCLP / precioUF : UF_FALLBACK;
  const snap = fila.mediana_comuna_snapshot;
  const mediana = snap != null ? { mediana: snap.mediana, n: snap.n ?? 0 } : { mediana: null, n: 0 };
  const asOf = new Date(fila.created_at ?? new Date().toISOString());
  let results = persisted;
  try {
    const rec = recomputeShortTermForLegacy(inp, persisted as never, ufFrozen, asOf, mediana);
    if (rec) results = rec as unknown as Record<string, unknown>;
  } catch { /* fallback al persistido */ }

  const hallazgos = (Array.isArray(results?.hallazgos) ? results?.hallazgos : []) as Hallazgo[];
  const ordenadas = ordenarHallazgosPiramideSTR(hallazgos);
  // Índice del hero: los PRIMEROS 3 del orden único, igual que HeroSTR (ordenados.slice).
  // El sort por decisividad que había acá medía OTRO índice que el que el usuario ve.
  const top3 = ordenadas.slice(0, 3);
  const respuesta = ai.conviene.respuestaDirecta ?? "";

  // POR QUÉ NO CIERRA — la frase determinística de los motivos de gate que el hero
  // muestra entre el veredicto y la pregunta (HeroSTR:280). Sin ella el juez no puede
  // medir su coherencia con la distancia ni con las cards.
  const fsGates = (results as { francoScore?: { gates?: { motivos?: unknown[] } } } | null)?.francoScore?.gates;
  const motivos = describirMotivosSTR((fsGates?.motivos ?? []) as never);

  // LO QUE TE SEPARA — el hallazgo de distancia NO es card (la pirámide lo filtra):
  // vive en el drawer que abre "La posición de Franco" y su frase baja al PDF. Se
  // ensambla como pieza propia inmediatamente después de la posición, que es donde
  // está el botón que lo abre.
  const distancia = hallazgos.find((h) => h.id === "distancia_veredicto");

  // El rótulo de la caja es POR DRAWER en la web (DrawerContentSTR): rentabilidad
  // "Hazte esta pregunta:", vsLTR "Guión para decidir:", factibilidad "Si decides
  // avanzar...", largoPlazo "La apuesta que estás haciendo:". El hardcode único que
  // había acá le hizo leer al juez una promesa de pregunta que la página no hace —
  // 2 fallas dim2 del censo 2026-08-07 son artefacto de esto (b826223b largoPlazo,
  // 8d02902b factibilidad); las de rentabilidad sí son reales.
  const drawerStr = (etiqueta: string, s: { contenido?: string; cajaAccionable?: string } | undefined, extra?: Array<string | null>, cajaLabel = "Hazte esta pregunta:"): string | null =>
    s ? seccion(`drawer:${etiqueta}`, [s.contenido, ...(extra ?? []), s.cajaAccionable ? `${cajaLabel} ${s.cajaAccionable}` : null]) : null;

  const piezas: Array<string | null> = [
    motivos ? seccion("hero:motivos (Por qué no cierra)", [motivos.frase]) : null,
    seccion("hero:pregunta", [ai.conviene.pregunta ?? "¿Conviene en renta corta?"]),
    seccion("respuestaDirecta", [respuesta]),
    seccion("hero:reencuadre", [ai.conviene.reencuadre]),
    seccion("hero:indice (Léelo en este orden)", top3.map((h) => `· ${h.titular || h.fraseCanonica}`)),
    seccion("posicion (La posición de Franco)", [ai.conviene.cajaAccionable]),
    distancia
      ? seccion('drawer:distancia (Lo que te separa — se abre desde "La posición de Franco")', [
          distancia.titular,
          distancia.fraseCanonica,
        ])
      : null,
    ...cardsPiramide(ordenadas, respuesta, ufFrozen),
    drawerStr("rentabilidad", ai.rentabilidad),
    drawerStr("vsLTR (corto vs largo)", ai.vsLTR, [ai.vsLTR?.estrategiaSugerida], "Guión para decidir:"),
    ai.riesgos || ai.operacion
      ? seccion("drawer:factibilidad (riesgos + operación)", [
          ai.riesgos?.contenido,
          ai.operacion?.contenido,
          ai.riesgos?.cajaAccionable || ai.operacion?.cajaAccionable
            ? `Si decides avanzar, protege estos flancos: ${ai.riesgos?.cajaAccionable || ai.operacion?.cajaAccionable}`
            : null,
        ])
      : null,
    drawerStr("largoPlazo (análisis a 10 años)", ai.largoPlazo, undefined, "La apuesta que estás haciendo:"),
  ];

  const gi = fila.guest_insight?.insight as { perfilDominante?: { descripcionExtendida?: string; implicaciones?: string } } | undefined;
  if (gi?.perfilDominante) {
    piezas.push(seccion("zona (tipo de huésped)", [gi.perfilDominante.descripcionExtendida, gi.perfilDominante.implicaciones]));
  }

  const vivas = piezas.filter((p): p is string => !!p);
  return {
    meta: {
      id8: fila.id.slice(0, 8),
      tipo: "STR",
      veredicto: String(ai.veredicto ?? (results as { veredicto?: string } | null)?.veredicto ?? "?"),
      comuna: fila.comuna ?? "?",
      promptVersion: ai.promptVersion ?? null,
    },
    texto: vivas.join("\n\n"),
    piezas: vivas.length,
  };
}

// ── entrada ─────────────────────────────────────────────────────────────────
export function ensamblarInforme(fila: FilaAnalisis): InformeEnsamblado {
  // Columna autoritativa; fallback a results.tipoAnalisis para filas pre-migración.
  const tipo = fila.tipo_analisis ?? (fila.results as { tipoAnalisis?: string } | null)?.tipoAnalisis ?? "long-term";
  return tipo === "short-term" ? ensamblarSTR(fila) : ensamblarLTR(fila);
}
