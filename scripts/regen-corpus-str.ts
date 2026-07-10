// regen-corpus-str.ts — regen-corpus-str · F2/F3.
// Regeneración unificada del corpus STR: normaliza motor (factorADR=1), re-ensambla la
// pirámide (results.hallazgos N≤12) y — solo para las filas que YA tenían ai_analysis —
// regenera prosa fresca (REGLA ESPEJO: prompt derivado del motor RECOMPUTADO).
//
// FUENTE: input_data + results.airbnbRaw PERSISTIDOS. NUNCA re-fetch AirROI (Decisión 2).
// PATH ANTI-HOOKS: service-role sb.update directo → no cobra crédito, no dispara email/Resend
//   (auditado F1). No usa la ruta HTTP (que llama consumeCredit + corta por caché).
//
// Modos:
//   --dry      : recompute de las 46, verifica invariante en memoria (factorADR=1, veredicto
//                canónico, hallazgos N). NO llama Claude. NO persiste. Imprime tabla.
//   --muestra  : recompute + prosa FRESCA de las filas con ai_analysis (source-determinism) →
//                regen-corpus-str-muestra.md. Llama Claude. NO persiste en DB.
//   --go       : regen real. Persiste results+score+desglose+resumen en las 46; ai_analysis
//                fresco solo en las 20 con prosa previa. Throttle + reintentos + log por fila.
//
// Uso: node --env-file=.env.local --import tsx scripts/regen-corpus-str.ts --dry
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import path from "path";
import fs from "fs";
import { calcShortTerm } from "../src/lib/engines/short-term-engine";
import type { ShortTermResult, STRVerdict } from "../src/lib/engines/short-term-engine";
import { calcFrancoScoreSTR } from "../src/lib/engines/short-term-score";
import type { FrancoScoreSTR } from "../src/lib/engines/short-term-score";
import { buildStrHallazgos } from "../src/lib/str-hallazgos";
import { buildAirbnbData } from "../src/lib/api-helpers/analisis-pipeline";
import { getComunaMedianaVentaUF } from "../src/lib/comuna-stats";
import { CLAUDE_MODEL } from "../src/lib/ai-config";
import { SYSTEM_PROMPT_STR } from "../src/lib/ai-generation-str";
import { findNearestStation } from "../src/lib/metro-stations";
import { CLINICAS, ZONAS_NEGOCIOS, ZONAS_TURISTICAS, ACCESO_SKI, distanciaMinima } from "../src/lib/data/str-attractors";
import type { AIAnalysisSTRv2 } from "../src/lib/types";
config({ path: path.resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CANONICOS = new Set<STRVerdict>(["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmtCLP = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
const fmtUF = (n: number) => "UF " + (Math.round(n * 10) / 10).toLocaleString("es-CL");
const fmtCLPSigned = (n: number) => { if (n === 0) return "$0"; const abs = Math.abs(Math.round(n)); const f = "$" + abs.toLocaleString("es-CL"); return n < 0 ? "-" + f : f; };

// ── buildInputs: idéntico al pipeline (analisis-pipeline.ts:496-526) y golden str-recompute ──
function buildInputs(d: any, airbnbData: any, uf: number) {
  return {
    precioCompra: d.precioCompra, superficie: d.superficieUtil, dormitorios: d.dormitorios, banos: d.banos,
    tipoPropiedad: typeof d.tipoPropiedad === "string" ? d.tipoPropiedad : undefined,
    antiguedad: d.antiguedad ?? (d.tipoPropiedad === "nuevo" ? 0 : 5), antiguedadEsFallback: d.antiguedad == null,
    comuna: typeof d.comuna === "string" ? d.comuna : undefined, piePercent: d.piePct / 100, tasaCredito: d.tasaInteres / 100,
    plazoCredito: d.plazoCredito, airbnbData, modoGestion: d.modoGestion, comisionAdministrador: d.comisionAdministrador,
    tipoEdificio: d.tipoEdificio, habilitacion: d.habilitacion, adminPro: d.adminPro === true,
    adrOverride: typeof d.adrOverride === "number" ? d.adrOverride : null, occOverride: typeof d.occOverride === "number" ? d.occOverride : null,
    costoElectricidad: d.costoElectricidad, costoAgua: d.costoAgua, costoWifi: d.costoWifi, costoInsumos: d.costoInsumos,
    gastosComunes: d.gastosComunes, mantencion: d.mantencion, contribuciones: d.contribuciones || 0,
    costoAmoblamiento: d.estaAmoblado ? 0 : (d.costoAmoblamiento || 0), arriendoLargoMensual: d.arriendoLargoMensual, valorUF: uf,
  };
}

interface RecomputeOut { rec: ShortTermResult; score: FrancoScoreSTR; hallazgos: any[]; newResults: any; uf: number; }

// Recompute forward-only + ensamble de pirámide. Espeja buildShortTermAnalysisRow SIN re-fetch.
async function recompute(d: any, oldResults: any, comuna: string): Promise<RecomputeOut> {
  const uf = d.precioCompra / d.precioCompraUF;
  const airbnbData = buildAirbnbData(oldResults.airbnbRaw, uf); // EXPORTADO, misma transformación que prod
  const rec = calcShortTerm(buildInputs(d, airbnbData, uf) as any);
  const lat = typeof d.lat === "number" ? d.lat : -33.4378;
  const lng = typeof d.lng === "number" ? d.lng : -70.6504;
  const score = calcFrancoScoreSTR({
    results: rec, precioCompra: d.precioCompra, dormitorios: d.dormitorios, superficie: d.superficieUtil,
    regulacionEdificio: d.edificioPermiteAirbnb || "no_seguro", lat, lng,
    revenueP50: airbnbData.percentiles.revenue.p50, monthlyRevenue: airbnbData.monthly_revenue,
  } as any);
  // mediana comunal real (sobreprecio) — mismo helper que el prefetch del pipeline.
  let mediana: { mediana: number | null; n: number } = { mediana: null, n: 0 };
  try { mediana = await getComunaMedianaVentaUF(sb, comuna, d.superficieUtil, d.dormitorios ?? null, uf); } catch { /* cae a null → sobreprecio omitido, patrón LTR */ }
  const strHallazgos = buildStrHallazgos({
    result: rec, francoScore: score, comuna: comuna || "", precioUF: d.precioCompraUF, superficieM2: d.superficieUtil,
    piePct: d.piePct, tasaPct: d.tasaInteres, plazoAnios: d.plazoCredito, mediana, valorUF: uf, incluyeCorretaje: false,
  });
  const hallazgos = [...(rec.hallazgos ?? []), ...strHallazgos];
  const newResults = {
    ...rec,
    hallazgos,
    tipoAnalisis: "short-term",
    veredicto: score.veredicto,
    francoScore: score,
    airbnbRaw: oldResults.airbnbRaw, // preservar el raw persistido (NO re-fetch)
    ...(oldResults.ocupacionRealizadaComparables ? { ocupacionRealizadaComparables: oldResults.ocupacionRealizadaComparables } : {}),
  };
  return { rec, score, hallazgos, newResults, uf };
}

// ── buildUserPrompt: VERBATIM de of-regen-revenue-str.ts / route.ts, pero sobre el motor RECOMPUTADO ──
function buildUserPrompt(inp: any, r: any, comuna: string): { userPrompt: string; veredictoMotor: STRVerdict } {
  const base = r.escenarios.base, cons = r.escenarios.conservador, agr = r.escenarios.agresivo, comp = r.comparativa;
  const precioCompraCLP = (inp.precioCompra as number) ?? 0;
  const precioCompraUF = (inp.precioCompraUF as number) ?? 0;
  const superficie = (inp.superficie as number) ?? (inp.superficieUtil as number) ?? 0;
  const dormitorios = (inp.dormitorios as number) ?? 0;
  const banos = (inp.banos as number) ?? 0;
  const direccion = (inp.direccion as string) ?? "";
  const piePct = Math.round(((inp.piePct as number) ?? 20));
  const tasa = ((inp.tasaInteres as number) ?? 4.5);
  const plazo = (inp.plazoCredito as number) ?? 25;
  const modoGestion = (inp.modoGestion as string) ?? "auto";
  const comisionPct = modoGestion === "auto" ? 3 : Math.round(((inp.comisionAdministrador as number) ?? 0.2) * 100);
  const regulacion = (inp.edificioPermiteAirbnb as string) ?? (inp.regulacionEdificio as string) ?? "no_seguro";
  const costoAmoblamiento = inp.estaAmoblado ? 0 : ((inp.costoAmoblamiento as number) ?? 0);
  const amoblado = costoAmoblamiento > 0 ? "Sí" : "No";
  const elec = (inp.costoElectricidad as number) ?? 0, agua = (inp.costoAgua as number) ?? 0, wifi = (inp.costoWifi as number) ?? 0;
  const insumos = (inp.costoInsumos as number) ?? 0, mant = (inp.mantencion as number) ?? 0, gc = (inp.gastosComunes as number) ?? 0;
  const contribTrim = (inp.contribuciones as number) ?? 0, contribMensual = Math.round(contribTrim / 3);
  const lat = (inp.lat as number) ?? 0, lng = (inp.lng as number) ?? 0;
  let distMetro = 0, metroName = "—";
  if (lat && lng) { const n = findNearestStation(lat, lng, "active"); if (n) { distMetro = Math.round(n.distance); metroName = n.station.name; } }
  const clinica = lat && lng ? distanciaMinima(lat, lng, CLINICAS) : { distancia: Infinity, nombre: "—" };
  const zonaNT = lat && lng ? distanciaMinima(lat, lng, [...ZONAS_NEGOCIOS, ...ZONAS_TURISTICAS]) : { distancia: Infinity, nombre: "—" };
  const ski = lat && lng ? distanciaMinima(lat, lng, ACCESO_SKI) : { distancia: Infinity, nombre: "—" };
  const distClinicaTxt = isFinite(clinica.distancia) ? `${Math.round(clinica.distancia)}m` : "—";
  const distZonaTxt = isFinite(zonaNT.distancia) ? `${Math.round(zonaNT.distancia)}m` : "—";
  const distSkiTxt = isFinite(ski.distancia) ? `${(ski.distancia / 1000).toFixed(1)}km` : "—";
  const tipoPropiedad = (inp.tipoPropiedad as string) ?? "";
  const strAuto = comp.str_auto, strAdmin = comp.str_admin, difAutoAdmin = strAuto.flujoCajaMensual - strAdmin.flujoCajaMensual;
  const anomalias: string[] = [];
  if (r.breakEvenPctDelMercado > 1) anomalias.push(`BREAK-EVEN SOBRE MERCADO: necesitas ${Math.round(r.breakEvenPctDelMercado * 100)}% del revenue P50 solo para cubrir costos.`);
  if (regulacion === "no") anomalias.push(`REGULACIÓN BLOQUEA AIRBNB: el edificio NO permite arriendo corto plazo. Operar es riesgo de multa o cancelación del reglamento.`);
  if (regulacion === "no_seguro" || regulacion === "no_estoy_seguro") anomalias.push(`REGULACIÓN NO CONFIRMADA: el usuario no sabe si el edificio permite Airbnb. DEBE verificar el reglamento antes de invertir en amoblamiento.`);
  const minM = r.flujoEstacional.length ? Math.min(...r.flujoEstacional.map((m: any) => m.ingresoBruto)) : 0;
  const maxM = r.flujoEstacional.length ? Math.max(...r.flujoEstacional.map((m: any) => m.ingresoBruto)) : 0;
  const estabRatio = maxM > 0 ? minM / maxM : 1;
  if (estabRatio < 0.5 && maxM > 0) anomalias.push(`ESTACIONALIDAD EXTREMA: el mes más bajo genera ${Math.round(estabRatio * 100)}% del peak. Caja fluctúa fuerte.`);
  if (comp.sobreRentaPct < 0) anomalias.push(`LTR GANA: arriendo tradicional genera ${Math.abs(Math.round(comp.sobreRentaPct * 100))}% más que STR. La estrategia STR no compensa.`);
  if (base.capRate < 0.03) anomalias.push(`CAP RATE BAJO: ${(base.capRate * 100).toFixed(1)}% — el NOI apenas justifica el precio de compra.`);
  if (base.flujoCajaMensual < -200000) anomalias.push(`FLUJO MUY NEGATIVO: ${fmtCLPSigned(base.flujoCajaMensual)}/mes incluso operando STR.`);
  const ingresoBrutoBase = base.ingresoBrutoMensual, costosOpTotal = base.costosOperativos + base.comisionMensual;
  if (ingresoBrutoBase > 0 && costosOpTotal / ingresoBrutoBase > 0.25) anomalias.push(`COSTOS OPERATIVOS ALTOS: ${Math.round((costosOpTotal / ingresoBrutoBase) * 100)}% del ingreso bruto se va en costos + comisión.`);
  const anomaliasTexto = anomalias.length > 0 ? `\n\n=== ANOMALÍAS DETECTADAS POR EL MOTOR ===\n${anomalias.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nMENCIÓN OBLIGATORIA en \`riesgos.contenido\` o sección que más aplique.` : "";
  const fs = r.francoScore, score = fs?.score ?? 50;
  const veredictoMotor: STRVerdict = (fs?.veredicto as STRVerdict) ?? r.veredicto;
  const mesPeak = r.flujoEstacional.length ? r.flujoEstacional.reduce((a: any, b: any) => (b.factor > a.factor ? b : a)) : null;
  const mesLow = r.flujoEstacional.length ? r.flujoEstacional.reduce((a: any, b: any) => (b.factor < a.factor ? b : a)) : null;
  const pieCLP = Math.round(precioCompraCLP * (piePct / 100));
  const dividendo = r.dividendoMensual, capitalInv = r.capitalInvertido;
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
veredicto del motor (úsalo como dado, no lo contradigas — §7): ${veredictoMotor}
${fs ? `Rentabilidad: ${fs.desglose.rentabilidad.score}/100 — ${fs.desglose.rentabilidad.detail}
Sostenibilidad: ${fs.desglose.sostenibilidad.score}/100 — ${fs.desglose.sostenibilidad.detail}
Ventaja vs LTR: ${fs.desglose.ventaja.score}/100 — ${fs.desglose.ventaja.detail}
Factibilidad: ${fs.desglose.factibilidad.score}/100 — ${fs.desglose.factibilidad.detail}` : "(desglose no disponible)"}

=== ESCENARIO BASE (ocupación en la mediana observada de la zona) ===
Revenue anual: ${fmtCLP(base.revenueAnual)}
ADR: ${fmtCLP(base.adrReferencia)}/noche, Ocupación: ${Math.round(base.ocupacionReferencia * 100)}% (mediana observada de la zona)
Ocupación upside (potencial con gestión profesional, estabilizado): ${Math.round(agr.ocupacionReferencia * 100)}%
Gap ocupación: +${Math.round((agr.ocupacionReferencia - base.ocupacionReferencia) * 100)} pts (observada -> potencial)
Fuente ocupación base: ${r.occFuente ?? "—"}
Ingreso bruto mensual: ${fmtCLP(base.ingresoBrutoMensual)}
Comisión (${comisionPct}%): -${fmtCLP(base.comisionMensual)}/mes
Costos operativos (electricidad ${fmtCLP(elec)} + agua ${fmtCLP(agua)} + wifi ${fmtCLP(wifi)} + insumos ${fmtCLP(insumos)} + mantención ${fmtCLP(mant)} + GC ${fmtCLP(gc)} + contrib ${fmtCLP(contribMensual)}): -${fmtCLP(base.costosOperativos)}/mes
NOI mensual: ${fmtCLPSigned(base.noiMensual)}
Dividendo: -${fmtCLP(dividendo)}/mes
FLUJO DE CAJA MENSUAL: ${fmtCLPSigned(base.flujoCajaMensual)}
CAP rate: ${(base.capRate * 100).toFixed(2)}%
Cash-on-Cash: ${(base.cashOnCash * 100).toFixed(1)}%

=== ESCENARIOS (conservador / base / upside) ===
Conservador (ocupación en el cuartil bajo observado): NOI ${fmtCLPSigned(cons.noiMensual)}/mes, Flujo ${fmtCLPSigned(cons.flujoCajaMensual)}/mes
Base (ocupación en la mediana observada): NOI ${fmtCLPSigned(base.noiMensual)}/mes, Flujo ${fmtCLPSigned(base.flujoCajaMensual)}/mes
Upside (gestión profesional): NOI ${fmtCLPSigned(agr.noiMensual)}/mes, Flujo ${fmtCLPSigned(agr.flujoCajaMensual)}/mes

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
Pérdida estimada primeros 5 meses parciales (ramp-up al 50%/60%/70%/80%/90% del target estabilizado): ${fmtCLP(r.perdidaRampUp)}

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

=== VIABILIDAD STR POR ZONA (Commit 4 · honestidad de modalidad) ===
${r.zonaSTR ? `Tier zona: ${r.zonaSTR.tierZona} (score ${r.zonaSTR.score}/100)
ADR percentil vs Santiago: p${r.zonaSTR.percentilADR}
Ocupación percentil vs Santiago: p${r.zonaSTR.percentilOcupacion}
Revenue percentil vs Santiago: p${r.zonaSTR.percentilRevenue}
${r.zonaSTR.comunaNoListada ? "(comuna no incluida en universo benchmark V1 — usar caveat al mencionar percentiles)" : ""}` : "(motor pre-Commit 4 · sin zonaSTR)"}

Recomendación modalidad motor: ${r.recomendacionModalidad ?? "(no disponible)"}
${r.recomendacionModalidad === "LTR_PREFERIDO" ? `→ OBLIGATORIO en \`vsLTR.contenido\` o \`vsLTR.estrategiaSugerida\`: decir explícitamente que en esta zona, LTR rinde mejor neto que STR. La complejidad operativa del STR no se justifica acá. NO endulces — la doctrina §1.1 exige asesor honesto.` : r.recomendacionModalidad === "STR_VENTAJA_CLARA" ? `→ En \`vsLTR.contenido\`: cuantifica la magnitud del upside STR sobre LTR (sobre-renta clara > +15%). El esfuerzo operativo se justifica.` : r.recomendacionModalidad === "INDIFERENTE" ? `→ En \`vsLTR.contenido\`: decir "está parejo". La decisión depende del esfuerzo operativo que el usuario quiera asumir y su perfil de riesgo.` : ""}

=== SUBSIDIO LEY 21.748 (palanca financiera ajena al motor) ===
${r.subsidioTasa ? `califica=${r.subsidioTasa.califica} | aplicado=${r.subsidioTasa.aplicado} | tasaConSubsidio=${r.subsidioTasa.tasaConSubsidio.toFixed(1)}%
${r.subsidioTasa.califica && !r.subsidioTasa.aplicado ? `→ DEBES mencionar (Ángulo 4): el user puede pedir tasa subsidiada al banco (~0,6 pp menos). Esto BAJA el dividendo y MEJORA el flujo. No está reflejado en este cálculo (la tasa actual no es la subsidiada).` : r.subsidioTasa.califica && r.subsidioTasa.aplicado ? `→ Ya está aplicado (la tasa ingresada coincide con la subsidiada). No menciones como mejora — solo si suma contexto.` : `→ No califica. NO mencionar el subsidio.`}` : "(motor pre-3a · subsidio no calculado)"}

=== SENSIBILIDAD DE PRECIO (Ángulo 4) ===
${r.sensibilidadPrecio ? r.sensibilidadPrecio.map((s: any) => `${s.label === "actual" ? "Precio actual" : `${s.label} → ${fmtCLP(s.precioCLP)}`}: CAP ${(s.capRate * 100).toFixed(2)}%, CoC ${(s.cashOnCash * 100).toFixed(1)}%, Flujo ${fmtCLPSigned(s.flujoCajaMensual)}/mes`).join("\n") : "(motor pre-3a · sin sensibilidad de precio)"}${anomaliasTexto}

═══════════════════════════════════════════════════════════════════
INSTRUCCIÓN FINAL
═══════════════════════════════════════════════════════════════════

1. Aplica la doctrina §1-§13 sin excepción. El test del §1 (¿se puede reemplazar por una tabla?) es real.
2. \`veredicto\` = "${veredictoMotor}" — cópialo EXACTO al JSON output. No lo modifiques.
3. Si crees que el motor está mal calibrado para este caso, NO lo contradigas en ningún campo visible. Usa \`francoCaveat\` opcional (audit-only, NO renderizado al usuario) con 1-2 frases. Si concuerdas con el motor, omite el campo.
4. Cada anomalía detectada por el motor debe aparecer en el output (§8).
5. Cierre obligatorio en \`riesgos.cajaAccionable\` con posición personal (§9), NO checklist.
6. Voz tuteo neutro chileno (§10). Auto-chequeo final: ningún verbo voseo (terminado en -ás/-és/-ís acentuado).
7. \`riesgos.contenido\`: 3 riesgos en prosa, separados por \\n\\n. Sin bullets, sin **bold**.
8. JSON válido y completo. Sin texto fuera del JSON, sin backticks.

Responde SOLO con el JSON.`;
  return { userPrompt, veredictoMotor };
}

const REVENUE_RE = /\brevenue\b/i;
function collectStrings(node: any, out: string[]) { if (typeof node === "string") { out.push(node); return; } if (Array.isArray(node)) { for (const n of node) collectStrings(n, out); return; } if (node && typeof node === "object") for (const v of Object.values(node)) collectStrings(v, out); }
function revenueLeaks(ai: any): string[] { const s: string[] = []; collectStrings(ai, s); return s.filter((x) => REVENUE_RE.test(x)); }

async function generarProsaOnce(inp: any, newResults: any, comuna: string): Promise<AIAnalysisSTRv2> {
  const { userPrompt, veredictoMotor } = buildUserPrompt(inp, newResults, comuna);
  const msg = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: 8000, messages: [{ role: "user", content: userPrompt }], system: SYSTEM_PROMPT_STR });
  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  let clean = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const f = clean.indexOf("{"), l = clean.lastIndexOf("}");
  if (f !== -1 && l !== -1) clean = clean.substring(f, l + 1);
  clean = clean.replace(/,(\s*[}\]])/g, "$1");
  const ai = JSON.parse(clean) as AIAnalysisSTRv2;
  if (!ai.veredicto) ai.veredicto = veredictoMotor;
  return ai;
}

// Guard REGLA ESPEJO: regenera si la prosa filtra "revenue" en CUALQUIER campo (incl. francoCaveat
// audit-only). Hasta `tries` intentos; devuelve la más limpia y el nº de leaks residual.
async function generarProsa(inp: any, newResults: any, comuna: string, tries = 3): Promise<{ ai: AIAnalysisSTRv2; leaks: number }> {
  let best: AIAnalysisSTRv2 | null = null; let bestLeaks = Infinity;
  for (let t = 0; t < tries; t++) {
    const ai = await generarProsaOnce(inp, newResults, comuna);
    const leaks = revenueLeaks(ai).length;
    if (leaks < bestLeaks) { best = ai; bestLeaks = leaks; }
    if (leaks === 0) break;
    if (t < tries - 1) await sleep(800);
  }
  return { ai: best!, leaks: bestLeaks };
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry"), muestra = args.includes("--muestra"), go = args.includes("--go");
  if (!dry && !muestra && !go) { console.error("Especificá --dry | --muestra | --go"); process.exit(1); }

  const { data: rows, error } = await sb.from("analisis")
    .select("id, nombre, user_id, comuna, input_data, results, ai_analysis, created_at")
    .eq("tipo_analisis", "short-term").order("created_at", { ascending: true }).range(0, 999);
  if (error) { console.error(error); process.exit(1); }
  // Exclusiones explícitas (⛔#2, decisión Fabrizio) — NO se persisten (ni results ni prosa):
  //  · 4ea0b582 — LTR ingreso bruto $0 → LTR_PREFERIDO diferencial 3483% ininterpretable;
  //    ventaja_vs_ltr (dim DECISIVA) cargaría un decisivo basura. A investigación aparte (LTR $0).
  //  · c53331bf — base occ 74% + ADR 93993 vienen de occOverride/adrOverride, pero occFuente="observada"
  //    → la prosa presentaría un override manual como "mediana observada de la zona" (no fiel). Bug de
  //    etiquetado del motor a ticket aparte.
  const EXCLUDE_PREFIXES = ["4ea0b582", "c53331bf"];
  const isExcluded = (id: string) => EXCLUDE_PREFIXES.some((p) => id.startsWith(p));
  // Solo las recomputables: con input_data + airbnbRaw persistido (excluye 8e006a8 sin insumos, Decisión F1)
  // y las exclusiones semánticas de ⛔#2.
  const recomputables = (rows ?? []).filter((r) => {
    const d = r.input_data as any, res = r.results as any;
    return d?.precioCompra && d?.precioCompraUF && res?.airbnbRaw && !isExcluded(r.id);
  });
  const excluidas = (rows ?? []).filter((r) => !recomputables.includes(r));
  console.log(`\nCorpus: ${rows?.length} · recomputables: ${recomputables.length} · excluidas: ${excluidas.length} [${excluidas.map((e) => e.id.slice(0, 8)).join(", ")}]`);

  // ── DRY: invariante en memoria ──────────────────────────────────────────
  if (dry) {
    const tabla: any[] = [];
    let violaciones = 0;
    for (const r of recomputables) {
      const { rec, score, hallazgos } = await recompute(r.input_data, r.results, r.comuna as string);
      const factor = rec.ejesAplicados?.factorADRTotal;
      const factorOK = Number.isFinite(factor) && Math.abs(factor! - 1) < 1e-6;
      const verOK = CANONICOS.has(score.veredicto);
      const N = hallazgos.length;
      const nOK = N >= 7 && N <= 12;
      if (!factorOK || !verOK || !nOK) violaciones++;
      tabla.push({ id: r.id.slice(0, 8), comuna: r.comuna, factorADR: Number.isFinite(factor) ? +factor!.toFixed(3) : factor, veredicto: score.veredicto, N, ok: factorOK && verOK && nOK ? "✓" : "✗" });
    }
    console.table(tabla);
    const nDist: Record<number, number> = {};
    for (const t of tabla) nDist[t.N] = (nDist[t.N] || 0) + 1;
    console.log(`\n=== INVARIANTE DRY (${recomputables.length} filas) ===`);
    console.log(`  factorADR=1 · veredicto canónico · N∈[7,12]: ${violaciones === 0 ? "TODAS ✓" : `${violaciones} violaciones ✗`}`);
    console.log(`  distribución N (hallazgos):`, nDist);
    return;
  }

  // Filas con prosa previa (Decisión F1: prosa fresca SOLO donde ya existía).
  const conProsa = recomputables.filter((r) => r.ai_analysis && typeof r.ai_analysis === "object");
  console.log(`Con ai_analysis previo (reciben prosa fresca): ${conProsa.length}`);

  // ── MUESTRA: prosa fresca de las filas con prosa → md (NO persiste) ──────
  if (muestra) {
    const outPath = path.resolve(process.cwd(), "regen-corpus-str-muestra.md");
    const jsonPath = path.resolve(process.cwd(), "scripts/output/regen-str-muestra-full-20260710.json");
    const parts: string[] = [`# Muestra semántica — regen STR (prosa fresca, source-determinism)\n`, `> Generada con motor RECOMPUTADO desde airbnbRaw persistido. ${conProsa.length} filas con prosa previa. NO persistido. Guard anti-"revenue" activo (3 intentos).\n`];
    const fullDump: any[] = [];
    let i = 0;
    for (const r of conProsa) {
      i++;
      process.stdout.write(`[${i}/${conProsa.length}] ${r.id.slice(0, 8)} prosa... `);
      try {
        const { newResults, score } = await recompute(r.input_data, r.results, r.comuna as string);
        const oldVer = (r.results as any)?.francoScore?.veredicto ?? (r.results as any)?.veredicto ?? "(null)";
        const { ai, leaks } = await generarProsa(r.input_data, newResults, r.comuna as string);
        const a = ai as any;
        fullDump.push({ id: r.id, comuna: r.comuna, oldVer, newVer: score.veredicto, leaks, ai });
        parts.push(`\n---\n\n## ${r.id.slice(0, 8)} · ${r.comuna} · veredicto ${oldVer} → **${score.veredicto}**${leaks ? ` · ⚠️ REVENUE(${leaks})` : ""}\n`);
        parts.push(`**headline (UF):** ${a.siendoFrancoHeadline_uf ?? "—"}\n`);
        if (a.conviene) { parts.push(`**conviene · respuestaDirecta:** ${a.conviene.respuestaDirecta ?? "—"}\n`); parts.push(`**conviene · veredictoFrase:** ${a.conviene.veredictoFrase ?? "—"}\n`); parts.push(`**conviene · reencuadre:** ${a.conviene.reencuadre ?? "—"}\n`); }
        if (a.rentabilidad?.contenido) parts.push(`**rentabilidad:** ${a.rentabilidad.contenido}\n`);
        if (a.vsLTR?.contenido) parts.push(`**vsLTR:** ${a.vsLTR.contenido}${a.vsLTR.estrategiaSugerida ? `\n_estrategia:_ ${a.vsLTR.estrategiaSugerida}` : ""}\n`);
        if (a.operacion?.contenido) parts.push(`**operacion:** ${a.operacion.contenido}\n`);
        if (a.largoPlazo?.contenido) parts.push(`**largoPlazo:** ${a.largoPlazo.contenido}\n`);
        if (a.riesgos?.contenido) parts.push(`**riesgos:** ${a.riesgos.contenido}\n`);
        if (a.riesgos?.cajaAccionable) parts.push(`**cajaAccionable (§9):** ${a.riesgos.cajaAccionable}\n`);
        if (a.francoCaveat) parts.push(`_francoCaveat (audit-only, no render):_ ${a.francoCaveat}\n`);
        console.log(`ok${leaks ? ` ⚠️revenue(${leaks})` : ""}`);
      } catch (e: any) { console.log("FAIL", e.message); parts.push(`\n---\n\n## ${r.id.slice(0, 8)} — FALLO: ${e.message}\n`); }
      await sleep(1000);
    }
    fs.writeFileSync(outPath, parts.join("\n"));
    fs.writeFileSync(jsonPath, JSON.stringify(fullDump, null, 2));
    const totalLeaks = fullDump.reduce((s, d) => s + (d.leaks || 0), 0);
    console.log(`\n[muestra] → ${outPath}  ·  full JSON → ${jsonPath}`);
    console.log(`[muestra] filas=${fullDump.length} · leaks residuales de "revenue": ${totalLeaks}`);
    return;
  }

  // ── GO: regen real (results 46 + prosa 20), throttle + reintentos + log ──
  if (go) {
    const CONC = 4;
    const log: any[] = [];
    let idx = 0;
    async function worker() {
      while (idx < recomputables.length) {
        const r = recomputables[idx++];
        const oldVer = (r.results as any)?.francoScore?.veredicto ?? (r.results as any)?.veredicto ?? "(null)";
        try {
          const { newResults, score } = await recompute(r.input_data, r.results, r.comuna as string);
          const update: any = { results: newResults, score: score.score, desglose: score.desglose, resumen: score.veredicto };
          const debeProsa = conProsa.includes(r);
          let prosaStatus = "sin-prosa";
          if (debeProsa) {
            let lastErr: any = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                // generarProsa ya reintenta hasta 3× por fuga de "revenue" y devuelve la más limpia.
                const { ai, leaks } = await generarProsa(r.input_data, newResults, r.comuna as string);
                if (leaks === 0) { update.ai_analysis = ai; prosaStatus = "prosa-ok"; }
                // Guard invariante: prosa con "revenue" residual NO se persiste (results/hallazgos sí).
                else { prosaStatus = `prosa-FAIL-REVENUE(${leaks})`; }
                lastErr = null; break;
              } catch (e: any) { lastErr = e; await sleep(1000 * attempt * attempt); }
            }
            if (lastErr) prosaStatus = `prosa-FAIL:${lastErr.message}`;
          }
          const { error: upErr } = await sb.from("analisis").update(update).eq("id", r.id);
          if (upErr) throw upErr;
          log.push({ id: r.id.slice(0, 8), comuna: r.comuna, antes: oldVer, despues: score.veredicto, flip: oldVer !== score.veredicto ? "⚡" : "=", N: newResults.hallazgos.length, prosa: prosaStatus, ok: prosaStatus.startsWith("prosa-FAIL") ? "⚠" : "✓" });
        } catch (e: any) {
          log.push({ id: r.id.slice(0, 8), comuna: r.comuna, antes: oldVer, despues: "FAIL", flip: "?", N: 0, prosa: "-", ok: `✗ ${e.message}` });
        }
        await sleep(300);
      }
    }
    await Promise.all(Array.from({ length: CONC }, () => worker()));
    console.table(log);
    const fails = log.filter((l) => l.ok.startsWith("✗"));
    const prosaFails = log.filter((l) => l.prosa.startsWith("prosa-FAIL"));
    const prosaLeaks = log.filter((l) => l.prosa.startsWith("prosa-FAIL-REVENUE"));
    console.log(`\n=== GO RESUMEN ===`);
    console.log(`  filas persistidas (results): ${log.length - fails.length}/${recomputables.length} · fails: ${fails.length}`);
    console.log(`  prosa fresca ok: ${log.filter((l) => l.prosa === "prosa-ok").length}/${conProsa.length} · prosa API-fail: ${prosaFails.length} · prosa NO persistida por "revenue": ${prosaLeaks.length}`);
    if (fails.length) console.log(`  FAILS:`, fails.map((f) => `${f.id}:${f.ok}`).join(" · "));
    if (prosaFails.length) console.log(`  PROSA API-FAILS:`, prosaFails.map((f) => f.id).join(" · "));
    if (prosaLeaks.length) console.log(`  ⚠️ PROSA NO PERSISTIDA (revenue residual tras 3×3 intentos):`, prosaLeaks.map((f) => f.id).join(" · "));
    fs.writeFileSync(path.resolve(process.cwd(), "scripts/output/regen-str-go-log-20260710.json"), JSON.stringify(log, null, 2));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
