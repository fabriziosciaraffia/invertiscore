import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { consumeCredit } from "@/lib/access";
import { isAdminUser } from "@/lib/admin";
import { findNearestStation } from "@/lib/metro-stations";
import {
  CLINICAS,
  ZONAS_NEGOCIOS,
  ZONAS_TURISTICAS,
  ACCESO_SKI,
  distanciaMinima,
} from "@/lib/data/str-attractors";
import type { ShortTermResult, STRVerdict } from "@/lib/engines/short-term-engine";
import type { FrancoScoreSTR } from "@/lib/engines/short-term-score";
import type { AIAnalysisSTRv2 } from "@/lib/types";
import { SYSTEM_PROMPT_STR } from "@/lib/ai-generation-str";

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
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignored — server component sin acceso a cookies de respuesta
          }
        },
      },
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers de formato (CLP/UF/firma)
// ─────────────────────────────────────────────────────────────────────────

function fmtCLP(n: number): string {
  return "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
}

function fmtUF(n: number): string {
  return "UF " + (Math.round(n * 10) / 10).toLocaleString("es-CL");
}

function fmtCLPSigned(n: number): string {
  if (n === 0) return "$0";
  const abs = Math.abs(Math.round(n));
  const formatted = "$" + abs.toLocaleString("es-CL");
  return n < 0 ? "-" + formatted : formatted;
}

// ─────────────────────────────────────────────────────────────────────────
// Endpoint
// ─────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { analysisId } = await request.json();
    if (!analysisId) {
      return NextResponse.json({ error: "analysisId requerido" }, { status: 400 });
    }

    const { data: analysis } = await supabase
      .from("analisis")
      .select("*")
      .eq("id", analysisId)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
    }

    const isAdmin = isAdminUser(user.email);

    if (analysis.user_id && analysis.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "No autorizado para analizar este registro" }, { status: 403 });
    }

    if (!analysis.is_premium && !isAdmin) {
      const credited = await consumeCredit(user.id, analysisId);
      if (!credited) {
        return NextResponse.json({ error: "Análisis no desbloqueado. Debes pagar para acceder al análisis IA." }, { status: 403 });
      }
    }

    // Cache: si ya hay ai_analysis (cualquier shape), devolverlo. La compat v1
    // de render vive en el cliente (AIInsightSTR detecta v1 vs v2).
    if (analysis.ai_analysis && typeof analysis.ai_analysis === "object") {
      return NextResponse.json(analysis.ai_analysis);
    }

    const input = analysis.input_data as Record<string, unknown> | null;
    const results = analysis.results as
      | (ShortTermResult & { francoScore?: FrancoScoreSTR; airbnbRaw?: unknown; tipoAnalisis?: string })
      | null;

    if (!input || !results) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    const inp = input;
    const r = results;
    const base = r.escenarios.base;
    const cons = r.escenarios.conservador;
    const agr = r.escenarios.agresivo;
    const comp = r.comparativa;

    // --- UF derivation ---
    const precioCompraCLP = (inp.precioCompra as number) ?? 0;
    const precioCompraUF = (inp.precioCompraUF as number) ?? 0;

    const superficie = (inp.superficie as number) ?? 0;
    const dormitorios = (inp.dormitorios as number) ?? 0;
    const banos = (inp.banos as number) ?? 0;
    const direccion = (inp.direccion as string) ?? "";
    const comuna = (analysis.comuna as string) ?? (inp.comuna as string) ?? "";
    const piePct = Math.round(((inp.piePercent as number) ?? 0.2) * 100);
    const tasa = ((inp.tasaCredito as number) ?? 0.045) * 100;
    const plazo = (inp.plazoCredito as number) ?? 25;
    const modoGestion = (inp.modoGestion as string) ?? "auto";
    const comisionPct = modoGestion === "auto" ? 3 : Math.round(((inp.comisionAdministrador as number) ?? 0.2) * 100);
    const regulacion = (inp.regulacionEdificio as string) ?? (inp.edificioPermiteAirbnb as string) ?? "no_seguro";
    const costoAmoblamiento = (inp.costoAmoblamiento as number) ?? 0;
    const amoblado = costoAmoblamiento > 0 ? "Sí" : "No";

    const elec = (inp.costoElectricidad as number) ?? 0;
    const agua = (inp.costoAgua as number) ?? 0;
    const wifi = (inp.costoWifi as number) ?? 0;
    const insumos = (inp.costoInsumos as number) ?? 0;
    const mant = (inp.mantencion as number) ?? 0;
    const gc = (inp.gastosComunes as number) ?? 0;
    const contribTrim = (inp.contribuciones as number) ?? 0;
    const contribMensual = Math.round(contribTrim / 3);

    // --- Metro + atractores ---
    const lat = (inp.lat as number) ?? 0;
    const lng = (inp.lng as number) ?? 0;
    let distMetro = 0;
    let metroName = "—";
    if (lat && lng) {
      const nearest = findNearestStation(lat, lng, "active");
      if (nearest) {
        distMetro = Math.round(nearest.distance);
        metroName = nearest.station.name;
      }
    }
    const clinica = lat && lng ? distanciaMinima(lat, lng, CLINICAS) : { distancia: Infinity, nombre: "—" };
    const zonaNT = lat && lng ? distanciaMinima(lat, lng, [...ZONAS_NEGOCIOS, ...ZONAS_TURISTICAS]) : { distancia: Infinity, nombre: "—" };
    const ski = lat && lng ? distanciaMinima(lat, lng, ACCESO_SKI) : { distancia: Infinity, nombre: "—" };
    const distClinicaTxt = isFinite(clinica.distancia) ? `${Math.round(clinica.distancia)}m` : "—";
    const distZonaTxt = isFinite(zonaNT.distancia) ? `${Math.round(zonaNT.distancia)}m` : "—";
    const distSkiTxt = isFinite(ski.distancia) ? `${(ski.distancia / 1000).toFixed(1)}km` : "—";

    const tipoPropiedad = (inp.tipoPropiedad as string) ?? "";
    const strAuto = comp.str_auto;
    const strAdmin = comp.str_admin;
    const difAutoAdmin = strAuto.flujoCajaMensual - strAdmin.flujoCajaMensual;

    // --- Detección de anomalías STR ---
    const anomalias: string[] = [];
    if (r.breakEvenPctDelMercado > 1) {
      anomalias.push(
        `BREAK-EVEN SOBRE MERCADO: necesitas ${Math.round(r.breakEvenPctDelMercado * 100)}% del revenue P50 solo para cubrir costos.`,
      );
    }
    if (regulacion === "no") {
      anomalias.push(
        `REGULACIÓN BLOQUEA AIRBNB: el edificio NO permite arriendo corto plazo. Operar es riesgo de multa o cancelación del reglamento.`,
      );
    }
    if (regulacion === "no_seguro" || regulacion === "no_estoy_seguro") {
      anomalias.push(
        `REGULACIÓN NO CONFIRMADA: el usuario no sabe si el edificio permite Airbnb. DEBE verificar el reglamento antes de invertir en amoblamiento.`,
      );
    }
    const minM = r.flujoEstacional.length ? Math.min(...r.flujoEstacional.map((m) => m.ingresoBruto)) : 0;
    const maxM = r.flujoEstacional.length ? Math.max(...r.flujoEstacional.map((m) => m.ingresoBruto)) : 0;
    const estabRatio = maxM > 0 ? minM / maxM : 1;
    if (estabRatio < 0.5 && maxM > 0) {
      anomalias.push(
        `ESTACIONALIDAD EXTREMA: el mes más bajo genera ${Math.round(estabRatio * 100)}% del peak. Caja fluctúa fuerte.`,
      );
    }
    if (comp.sobreRentaPct < 0) {
      anomalias.push(
        `LTR GANA: arriendo tradicional genera ${Math.abs(Math.round(comp.sobreRentaPct * 100))}% más que STR. La estrategia STR no compensa.`,
      );
    }
    if (base.capRate < 0.03) {
      anomalias.push(`CAP RATE BAJO: ${(base.capRate * 100).toFixed(1)}% — el NOI apenas justifica el precio de compra.`);
    }
    if (base.flujoCajaMensual < -200000) {
      anomalias.push(`FLUJO MUY NEGATIVO: ${fmtCLPSigned(base.flujoCajaMensual)}/mes incluso operando STR.`);
    }
    const ingresoBrutoBase = base.ingresoBrutoMensual;
    const costosOpTotal = base.costosOperativos + base.comisionMensual;
    if (ingresoBrutoBase > 0 && costosOpTotal / ingresoBrutoBase > 0.25) {
      anomalias.push(
        `COSTOS OPERATIVOS ALTOS: ${Math.round((costosOpTotal / ingresoBrutoBase) * 100)}% del ingreso bruto se va en costos + comisión.`,
      );
    }
    const anomaliasTexto =
      anomalias.length > 0
        ? `\n\n=== ANOMALÍAS DETECTADAS POR EL MOTOR ===\n${anomalias.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nMENCIÓN OBLIGATORIA en \`riesgos.contenido\` o sección que más aplique.`
        : "";

    // --- Score + veredicto del motor ---
    const fs = results.francoScore;
    const score = fs?.score ?? 50;
    const engineSignal: STRVerdict = (fs?.veredicto as STRVerdict) ?? r.veredicto;

    // --- Estacionalidad para contexto operativo ---
    const mesPeak = r.flujoEstacional.length
      ? r.flujoEstacional.reduce((a, b) => (b.factor > a.factor ? b : a))
      : null;
    const mesLow = r.flujoEstacional.length
      ? r.flujoEstacional.reduce((a, b) => (b.factor < a.factor ? b : a))
      : null;

    // --- Variables financiamiento ---
    const pieCLP = Math.round(precioCompraCLP * ((inp.piePercent as number) ?? 0.2));
    const dividendo = r.dividendoMensual;
    const capitalInv = r.capitalInvertido;

    // --- Plusvalía / proyección long-term (si projections existe) ---
    const projY10 = r.projections && r.projections.length >= 10 ? r.projections[9] : null;
    const exit = r.exitScenario;

    const userPrompt = `Analiza esta inversión inmobiliaria en renta corta (Airbnb). Aplica doctrina §1-§13 del system prompt y devuelve el JSON v2.

=== DATOS DE LA PROPIEDAD ===
Dirección: ${direccion || "—"}
Comuna: ${comuna}
Superficie: ${superficie} m²
Dormitorios: ${dormitorios}, Baños: ${banos}
Tipo: ${tipoPropiedad || "—"}
Precio compra: ${fmtUF(precioCompraUF)} (${fmtCLP(precioCompraCLP)})
Pie: ${piePct}% = ${fmtCLP(pieCLP)}
Tasa crédito: ${tasa.toFixed(1)}%, Plazo: ${plazo} años
Dividendo: ${fmtCLP(dividendo)}/mes
Capital invertido inicial: ${fmtCLP(capitalInv)} (pie + amoblamiento + gastos cierre)
Modo gestión seleccionado: ${modoGestion} (comisión: ${comisionPct}%)
Edificio permite Airbnb: ${regulacion}
Amoblado: ${amoblado} (costo amoblamiento: ${fmtCLP(costoAmoblamiento)})

=== FRANCO SCORE STR: ${score}/100 ===
engineSignal del motor: ${engineSignal}
${fs ? `Rentabilidad: ${fs.desglose.rentabilidad.score}/100 — ${fs.desglose.rentabilidad.detail}
Sostenibilidad: ${fs.desglose.sostenibilidad.score}/100 — ${fs.desglose.sostenibilidad.detail}
Ventaja vs LTR: ${fs.desglose.ventaja.score}/100 — ${fs.desglose.ventaja.detail}
Factibilidad: ${fs.desglose.factibilidad.score}/100 — ${fs.desglose.factibilidad.detail}` : "(desglose no disponible)"}

=== ESCENARIO BASE (P50 del mercado) ===
Revenue anual: ${fmtCLP(base.revenueAnual)}
ADR: ${fmtCLP(base.adrReferencia)}/noche, Ocupación: ${Math.round(base.ocupacionReferencia * 100)}%
Ingreso bruto mensual: ${fmtCLP(base.ingresoBrutoMensual)}
Comisión (${comisionPct}%): -${fmtCLP(base.comisionMensual)}/mes
Costos operativos (electricidad ${fmtCLP(elec)} + agua ${fmtCLP(agua)} + wifi ${fmtCLP(wifi)} + insumos ${fmtCLP(insumos)} + mantención ${fmtCLP(mant)} + GC ${fmtCLP(gc)} + contrib ${fmtCLP(contribMensual)}): -${fmtCLP(base.costosOperativos)}/mes
NOI mensual: ${fmtCLPSigned(base.noiMensual)}
Dividendo: -${fmtCLP(dividendo)}/mes
FLUJO DE CAJA MENSUAL: ${fmtCLPSigned(base.flujoCajaMensual)}
CAP rate: ${(base.capRate * 100).toFixed(2)}%
Cash-on-Cash: ${(base.cashOnCash * 100).toFixed(1)}%

=== ESCENARIOS POR PERCENTIL ===
Conservador (P25): NOI ${fmtCLPSigned(cons.noiMensual)}/mes, Flujo ${fmtCLPSigned(cons.flujoCajaMensual)}/mes
Base (P50):        NOI ${fmtCLPSigned(base.noiMensual)}/mes, Flujo ${fmtCLPSigned(base.flujoCajaMensual)}/mes
Agresivo (P75):    NOI ${fmtCLPSigned(agr.noiMensual)}/mes, Flujo ${fmtCLPSigned(agr.flujoCajaMensual)}/mes

=== COMPARATIVA STR vs LTR ===
Arriendo largo (LTR):
  Ingreso bruto: ${fmtCLP(comp.ltr.ingresoBruto)}/mes
  NOI: ${fmtCLPSigned(comp.ltr.noiMensual)}/mes
  Flujo: ${fmtCLPSigned(comp.ltr.flujoCaja)}/mes

STR (modo seleccionado: ${modoGestion}, escenario base):
  NOI: ${fmtCLPSigned(base.noiMensual)}/mes
  Flujo: ${fmtCLPSigned(base.flujoCajaMensual)}/mes

DIFERENCIA STR vs LTR:
  Sobre-renta NOI: ${fmtCLPSigned(comp.sobreRenta)}/mes (${comp.sobreRentaPct >= 0 ? "+" : ""}${Math.round(comp.sobreRentaPct * 100)}%)
  STR ${base.flujoCajaMensual > comp.ltr.flujoCaja ? "GANA" : "PIERDE"} en flujo
  Payback amoblamiento: ${comp.paybackMeses > 0 ? comp.paybackMeses + " meses" : comp.paybackMeses === 0 ? "sin amoblamiento" : "no se recupera con sobre-renta"}

=== AUTO-GESTIÓN vs ADMINISTRADOR ===
Auto (comisión 3% Airbnb): NOI ${fmtCLPSigned(strAuto.noiMensual)}/mes, Flujo ${fmtCLPSigned(strAuto.flujoCajaMensual)}/mes — requiere ~8-12 hrs/semana del usuario.
Admin (comisión ${Math.round(((inp.comisionAdministrador as number) ?? 0.2) * 100)}%): NOI ${fmtCLPSigned(strAdmin.noiMensual)}/mes, Flujo ${fmtCLPSigned(strAdmin.flujoCajaMensual)}/mes — inversión 100% pasiva.
Diferencia: auto-gestión genera ${fmtCLPSigned(difAutoAdmin)}/mes ${difAutoAdmin > 0 ? "más" : "menos"} que con administrador.

(NUNCA recomiendes administradores específicos por nombre. Cerrar con: "Franco pronto te conectará con operadores verificados.")

=== ESTACIONALIDAD ===
${mesPeak ? `Peak: ${mesPeak.mes} (factor ${(mesPeak.factor * 12).toFixed(2)}× vs promedio)` : ""}
${mesLow ? `Low: ${mesLow.mes} (factor ${(mesLow.factor * 12).toFixed(2)}× vs promedio)` : ""}
Estacionalidad Santiago general: julio peak (vacaciones invierno + ski), febrero low (todos en la costa).

=== BREAK-EVEN + RAMP-UP ===
Revenue anual necesario para cubrir costos: ${fmtCLP(r.breakEvenRevenueAnual)} (${Math.round(r.breakEvenPctDelMercado * 100)}% del P50)
Pérdida estimada primeros 3 meses (ramp-up al 70%/80%/90%): ${fmtCLP(r.perdidaRampUp)}

=== PROYECCIÓN LARGO PLAZO ===
${projY10 && exit ? `Patrimonio neto al año ${exit.yearVenta}: ${fmtCLP(projY10.patrimonioNeto)} (valor depto ${fmtCLP(projY10.valorDepto)} - saldo crédito ${fmtCLP(projY10.saldoCredito)} + flujos acumulados ${fmtCLPSigned(projY10.flujoAcumulado)})
Ganancia neta al vender año ${exit.yearVenta}: ${fmtCLPSigned(exit.gananciaNeta)} (valor venta - saldo - cierre + flujos - capital inicial)
TIR @ ${exit.yearVenta} años: ${exit.tirAnual.toFixed(1)}%
Multiplicador capital: ${exit.multiplicadorCapital.toFixed(2)}x` : "(proyecciones long-term no disponibles)"}

=== ATRACTORES DE DEMANDA EN LA ZONA ===
Metro más cercano: ${metroName} a ${distMetro}m
Clínica/hospital más cercano: ${clinica.nombre} a ${distClinicaTxt} (demanda médica internacional captura estadías 3-15 días)
Zona negocios/turismo: ${zonaNT.nombre} a ${distZonaTxt} (demanda corporativa)
Acceso ski (junio-septiembre): ${distSkiTxt} (peak julio coincide con peak STR Santiago, +34% vs promedio)
${anomaliasTexto}

═══════════════════════════════════════════════════════════════════
INSTRUCCIÓN FINAL
═══════════════════════════════════════════════════════════════════

1. Aplica la doctrina §1-§13 sin excepción. El test del §1 (¿se puede reemplazar por una tabla?) es real.
2. \`engineSignal\` = "${engineSignal}" — cópialo EXACTO al JSON output.
3. \`francoVerdict\` por default = "${engineSignal}". Diverge solo si §7 lo justifica (ej. regulación bloqueada). Si diverge, completa \`francoVerdictRationale\` con 1-2 frases.
4. Cada anomalía detectada por el motor debe aparecer en el output (§8).
5. Cierre obligatorio en \`riesgos.cajaAccionable\` con posición personal (§9), NO checklist.
6. Voz tuteo neutro chileno (§10). Auto-chequeo final: ningún verbo voseo (terminado en -ás/-és/-ís acentuado).
7. \`riesgos.contenido\`: 3 riesgos en prosa, separados por \\n\\n. Sin bullets, sin **bold**.
8. JSON válido y completo. Sin texto fuera del JSON, sin backticks.

Responde SOLO con el JSON.`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: userPrompt }],
      system: SYSTEM_PROMPT_STR,
    });

    const rawText = msg.content[0].type === "text" ? msg.content[0].text : "";
    console.log("[STR AI v2] Raw response length:", rawText.length);

    let aiResult: AIAnalysisSTRv2;
    try {
      let cleanText = rawText;
      cleanText = cleanText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const firstBrace = cleanText.indexOf("{");
      const lastBrace = cleanText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
      }
      cleanText = cleanText.replace(/,(\s*[}\]])/g, "$1");
      aiResult = JSON.parse(cleanText) as AIAnalysisSTRv2;
    } catch (parseError) {
      console.error("[STR AI v2] Parse error:", parseError);
      return NextResponse.json({ error: "Error parsing AI response", raw: rawText }, { status: 500 });
    }

    // Garantía mínima de schema: si la IA olvidó engineSignal/francoVerdict, los completamos
    if (!aiResult.engineSignal) aiResult.engineSignal = engineSignal;
    if (!aiResult.francoVerdict) aiResult.francoVerdict = aiResult.engineSignal;

    await supabase.from("analisis").update({ ai_analysis: aiResult }).eq("id", analysisId);

    return NextResponse.json(aiResult);
  } catch (error) {
    console.error("STR AI v2 error:", error);
    return NextResponse.json({ error: "Error generando análisis IA" }, { status: 500 });
  }
}
