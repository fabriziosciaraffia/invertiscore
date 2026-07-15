import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isAdminUser } from "@/lib/admin";
import { CLAUDE_MODEL } from "@/lib/ai-config";
import type { FullAnalysisResult, AIAnalysisComparativa, RecomendacionModalidadAmbas, AnalisisInput } from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import {
  SYSTEM_PROMPT_AMBAS,
  fmtCLPAmbas,
  fmtUFAmbas,
  fmtPctAmbas,
  sanitizeComparativaAI,
} from "@/lib/ai-generation-ambas";
import { deriveRecomendacionModalidad } from "@/lib/engines/str-universo-santiago";
import { resolveUfForAnalysis } from "@/lib/uf";
import { recomputeResultsForLegacy } from "@/lib/analysis/recompute-results-for-legacy";
import { recomputeShortTermForLegacy } from "@/lib/analysis/recompute-short-term-for-legacy";
import { prefetchMedianaComunaVenta } from "@/lib/api-helpers/analisis-pipeline";

const anthropic = new Anthropic();

function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ignored
          }
        },
      },
    },
  );
}

type LTRResultsWithCache = FullAnalysisResult & {
  comparativaAI?: AIAnalysisComparativa;
  tipoAnalisis?: string;
};

type STRResultsExtended = ShortTermResult & {
  tipoAnalisis?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as { ltrId?: string; strId?: string };
    const ltrId = body.ltrId;
    const strId = body.strId;
    if (!ltrId || !strId) {
      return NextResponse.json({ error: "ltrId y strId requeridos" }, { status: 400 });
    }

    const [{ data: ltrRow }, { data: strRow }] = await Promise.all([
      supabase.from("analisis").select("*").eq("id", ltrId).single(),
      supabase.from("analisis").select("*").eq("id", strId).single(),
    ]);

    if (!ltrRow || !strRow) {
      return NextResponse.json({ error: "Análisis no encontrados" }, { status: 404 });
    }

    const isAdmin = isAdminUser(user.email);
    if (ltrRow.user_id && ltrRow.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (strRow.user_id && strRow.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const ltrResultsPersisted = (ltrRow.results ?? null) as LTRResultsWithCache | null;
    const strResultsPersisted = (strRow.results ?? null) as STRResultsExtended | null;

    if (!ltrResultsPersisted || !strResultsPersisted) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    // ─── Cache (persistente en ltr.results.comparativaAI) ───────────────
    if (ltrResultsPersisted.comparativaAI && typeof ltrResultsPersisted.comparativaAI === "object") {
      return NextResponse.json(ltrResultsPersisted.comparativaAI);
    }

    // ─── Contexto para el prompt ────────────────────────────────────────
    const strInput = strRow.input_data as Record<string, unknown> | null;

    // P1-C + P2 (Rama 0b): recompute ambos lados con el motor nuevo antes de generar la prosa,
    // para que las cifras que narra la IA (patrimonio Y10, delta, sobre-renta) sean las MISMAS
    // que muestra el hero. LTR base precioCLP; STR con la UF real de LTR (base homologada).
    // Espejo de comparativa/page.tsx. Solo corre en generación fresca (el cache ya cortó arriba).
    const ltrUf = resolveUfForAnalysis(
      ltrResultsPersisted as { metrics?: { precioCLP?: number | null } | null },
      ltrRow.input_data as { precio?: number | null } | null,
      38800,
      ltrRow.id as string,
    );
    const ltrInputRc = (ltrRow.input_data ?? null) as AnalisisInput | null;
    const ltrAsOfRc = new Date((ltrRow.created_at as string) ?? new Date().toISOString());
    const ltrMedianaRc = ltrInputRc
      ? await prefetchMedianaComunaVenta(supabase, ltrInputRc, ltrUf)
      : { mediana: null, n: 0 };
    const ltrResults = (
      ltrInputRc
        ? { ...recomputeResultsForLegacy(ltrInputRc, ltrUf, ltrMedianaRc, ltrAsOfRc), comparativaAI: ltrResultsPersisted.comparativaAI }
        : ltrResultsPersisted
    ) as LTRResultsWithCache;

    const strAsOfRc = new Date((strRow.created_at as string) ?? new Date().toISOString());
    const strMedianaRc = strInput
      ? await prefetchMedianaComunaVenta(
          supabase,
          {
            comuna: (strInput.comuna as string) ?? (strRow.comuna as string) ?? "",
            superficie: Number(strInput.superficieUtil) || 0,
            dormitorios: Number(strInput.dormitorios) || 0,
          },
          ltrUf,
        )
      : { mediana: null, n: 0 };
    const strResults = (
      recomputeShortTermForLegacy(strInput, strResultsPersisted, ltrUf, strAsOfRc, strMedianaRc) ?? strResultsPersisted
    ) as STRResultsExtended;

    const comuna = (ltrRow.comuna as string) ?? (strRow.comuna as string) ?? "—";
    const superficie = (ltrRow.superficie as number) ?? (strRow.superficie as number) ?? 0;
    const dormitorios = (ltrRow.dormitorios as number) ?? 0;
    const banos = (ltrRow.banos as number) ?? 0;
    const precioUF = (ltrRow.precio as number) ?? (strRow.precio as number) ?? 0;

    const ltrMetrics = ltrResults.metrics;
    const strBase = strResults.escenarios?.base;

    const ltrNOIMensual = (ltrMetrics?.noi ?? 0) / 12;
    const strNOIMensual = strBase?.noiMensual ?? 0;
    const deltaNOIMensual = strNOIMensual - ltrNOIMensual;

    const ltrFlujoMensual = ltrMetrics?.flujoNetoMensual ?? 0;
    const strFlujoMensual = strBase?.flujoCajaMensual ?? 0;
    const deltaFlujoMensual = strFlujoMensual - ltrFlujoMensual;

    const ltrCapital = ltrMetrics?.pieCLP ?? 0;
    const costoAmoblamiento = (strInput?.costoAmoblamiento as number) ?? 0;
    const strCapital = (strResults.capitalInvertido ?? 0);

    // Patrimonio Y10
    const ltrY10 = ltrResults.projections?.[9];
    const strY10 = strResults.projections?.[9];
    const ltrPatY10 = ltrY10?.patrimonioNeto ?? 0;
    const strPatY10 = strY10?.patrimonioNeto ?? 0;
    const deltaPatY10 = strPatY10 - ltrPatY10;

    // Zona STR + recomendación (con fallback para análisis pre-Commit 4)
    const zona = strResults.zonaSTR;
    const sobreRentaPct = strResults.comparativa?.sobreRentaPct ?? 0;
    // P3 (Rama 0b): el % de sobre-renta no es confiable cuando el NOI-LTR es ≤0 o ínfimo (ratio
    // explotado). En ese caso la prosa narra la sobre-renta ABSOLUTA (CLP), nunca un % absurdo.
    const sobreRentaPctConfiable = strResults.comparativa?.sobreRentaPctConfiable ?? true;
    const sobreRentaCLP = strResults.comparativa?.sobreRenta ?? 0;
    const reco = deriveRecomendacionModalidad({
      recomendacionModalidad: strResults.recomendacionModalidad,
      zonaSTR: zona,
      sobreRentaPct,
      ltrNoiMensual: strResults.comparativa?.ltr?.noiMensual,
      sobreRenta: sobreRentaCLP,
      strNoiMensual: strResults.comparativa?.str_auto?.noiMensual,
    });

    // Modo gestión + comisión administrador
    const modoGestion = (strInput?.modoGestion as string) ?? "auto";
    const comisionAdmin = Math.round(((strInput?.comisionAdministrador as number) ?? 0.2) * 100);

    const userPrompt = `Analiza la decisión de modalidad para esta inversión. El usuario ya tiene análisis LTR y STR completos por separado — tu trabajo es asesorar cuál conviene más, con doctrina §1-§3.

=== PROPIEDAD ===
${dormitorios}D${banos}B en ${comuna} · ${superficie} m² · ${fmtUFAmbas(precioUF)}

=== RECOMENDACIÓN MOTOR ===
recomendacionModalidad: ${reco}
sobreRentaPct STR vs LTR: ${sobreRentaPctConfiable ? `${(sobreRentaPct * 100).toFixed(1).replace(".", ",")}%` : `N/D — el arriendo largo rinde ≈0 o negativo, el porcentaje no informa; usá la sobre-renta ABSOLUTA (${fmtCLPAmbas(sobreRentaCLP)}/mes) y nunca cites un %`}
${zona ? `Zona tier: ${zona.tierZona} (score ${zona.score}/100)
ADR percentil vs Santiago: p${zona.percentilADR}
Ocupación percentil vs Santiago: p${zona.percentilOcupacion}
${zona.comunaNoListada ? "(comuna no listada en universo benchmark V1 — atenuá el caveat)" : ""}` : "(zona STR no calculada — análisis pre-Commit 4)"}

=== LTR (renta larga) ===
NOI mensual: ${fmtCLPAmbas(ltrNOIMensual)}
NOI anual año 1: ${fmtCLPAmbas(ltrNOIMensual * 12)}
Flujo de caja mensual: ${fmtCLPAmbas(ltrFlujoMensual)}
Capital requerido inicial (pie + cierre): ${fmtCLPAmbas(ltrCapital)}
Patrimonio neto año 10: ${fmtCLPAmbas(ltrPatY10)}
Esfuerzo operativo: bajo (~0,5 hrs/semana — buscar inquilino + cobrar arriendo).
Riesgo principal: vacancia entre arriendos (~1-2 meses cada 2-3 años).

=== STR (renta corta · escenario base P50) ===
NOI mensual (estabilizado): ${fmtCLPAmbas(strNOIMensual)}
NOI anual año 1 (con estabilización inicial ~6 meses): ${fmtCLPAmbas(strNOIMensual * 12 - strResults.perdidaRampUp)}
NOI anual año 2+ (estabilizado): ${fmtCLPAmbas(strNOIMensual * 12)}
Flujo de caja mensual (estabilizado): ${fmtCLPAmbas(strFlujoMensual)}
Capital requerido inicial (pie + cierre + amoblamiento ${fmtCLPAmbas(costoAmoblamiento)}): ${fmtCLPAmbas(strCapital)}
Patrimonio neto año 10: ${fmtCLPAmbas(strPatY10)}
Modo gestión asumido: ${modoGestion} (${modoGestion === "auto" ? "8-12 hrs/semana del usuario" : `administrador ${comisionAdmin}% comisión`}).
Riesgo principal: estacionalidad (Santiago: julio peak ski, febrero low), ocupación variable, regulación edificio.

=== DELTAS STR vs LTR ===
Delta NOI mensual: ${fmtCLPAmbas(deltaNOIMensual)} (${deltaNOIMensual >= 0 ? "STR gana" : "LTR gana"})
Delta Flujo caja mensual: ${fmtCLPAmbas(deltaFlujoMensual)} (${deltaFlujoMensual >= 0 ? "STR gana" : "LTR gana"})
Delta Patrimonio Y10: ${fmtCLPAmbas(deltaPatY10)} (${deltaPatY10 >= 0 ? "STR gana" : "LTR gana"})
Pérdida primeros meses STR (estabilización inicial): ${fmtCLPAmbas(strResults.perdidaRampUp)}
Capital extra requerido para STR: ${fmtCLPAmbas(strCapital - ltrCapital)}
Sobre-renta STR vs LTR neto: ${sobreRentaPctConfiable ? fmtPctAmbas(sobreRentaPct, 1) : `${fmtCLPAmbas(sobreRentaCLP)}/mes (porcentaje N/D — NOI-LTR ≈0/negativo)`}

=== ANCLAS DE COSTO/ESFUERZO ===
LTR: ~0,5 hrs/semana. Operación pasiva una vez firmado contrato anual.
STR auto-gestión: 8-12 hrs/semana (precios dinámicos, check-ins, mensajes, limpieza, reposición). Reviews 1-3★ se pegan al listing meses.
STR con administrador: 0,5-1 hrs/semana del usuario, pero ${comisionAdmin}% del bruto al admin (≈ ${fmtCLPAmbas((strBase?.ingresoBrutoMensual ?? 0) * (comisionAdmin / 100))}/mes).

═══════════════════════════════════════════════════════════════════
INSTRUCCIÓN FINAL
═══════════════════════════════════════════════════════════════════

1. Aplica doctrina §1-§3 sin excepción. Test §1.1 real: cada párrafo debe interpretar, no recitar.
2. \`recomendacion\` = "${reco}" — cópialo EXACTO al JSON. No lo modifiques.
3. Si crees que la recomendación del motor está mal calibrada, NO la contradigas en ningún campo visible. Usa \`francoCaveat\` opcional (audit-only, NO renderizado al usuario) con 1-2 frases. Si concuerdas, omite el campo.
4. \`headline\` refleja la \`recomendacion\` del motor, 1 frase, máx 25 palabras.
5. Los 4 ángulos del \`conviene\` siguen la disciplina §1.3 + §2.6 (largos).
6. Voz §2.1: tuteo neutro chileno. Auto-check: ningún voseo (-ás/-és/-ís acentuado). Ningún chilenismo coloquial. Ningún cliché de apertura.
7. \`cierre\` con posición personal §1.10. NO checklist.
8. JSON válido y completo. Sin texto fuera del JSON, sin backticks, sin markdown.

Responde SOLO con el JSON.`;

    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: userPrompt }],
      system: SYSTEM_PROMPT_AMBAS,
    });

    const rawText = msg.content[0].type === "text" ? msg.content[0].text : "";
    console.log("[Comparativa AI] Raw response length:", rawText.length);

    let aiResult: AIAnalysisComparativa;
    try {
      let cleanText = rawText;
      cleanText = cleanText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const firstBrace = cleanText.indexOf("{");
      const lastBrace = cleanText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
      }
      cleanText = cleanText.replace(/,(\s*[}\]])/g, "$1");
      aiResult = JSON.parse(cleanText) as AIAnalysisComparativa;
    } catch (parseError) {
      console.error("[Comparativa AI] Parse error:", parseError);
      return NextResponse.json(
        { error: "Error parsing AI response", raw: rawText },
        { status: 500 },
      );
    }

    // Garantía mínima de schema (Commit E.2 · 2026-05-13): si la IA olvidó
    // copiar la recomendación del motor, la completamos con el valor autoritativo.
    if (!aiResult.recomendacion) {
      aiResult.recomendacion = reco as RecomendacionModalidadAmbas;
    }

    // Sanitizer voseo→tuteo (safety net; el prompt ya prohíbe voseo pero el
    // LLM puede deslizar formas argentinas en tonos confrontacionales).
    aiResult = sanitizeComparativaAI(aiResult);

    // ─── Persistencia (cache permanente en ltr.results.comparativaAI) ────
    const updatedResults = {
      ...(ltrResults as object),
      comparativaAI: aiResult,
    };
    await supabase
      .from("analisis")
      .update({ results: updatedResults })
      .eq("id", ltrId);

    return NextResponse.json(aiResult);
  } catch (error) {
    console.error("Comparativa AI error:", error);
    return NextResponse.json({ error: "Error generando narrativa IA" }, { status: 500 });
  }
}
