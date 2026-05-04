/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SHIM — Replica del USER PROMPT builder de producción (`generateAiAnalysis`
 * en `src/lib/ai-generation.ts`).
 *
 * IMPORTANTE: si el prompt builder de producción cambia, sincronizar este
 * archivo. Validado contra dda02c2f en commit db6054c (v5).
 *
 * Uso para batch sintético sin tocar DB de producción:
 *   const { systemPrompt, userPrompt } = await buildLtrPrompts(input, results, options);
 *
 * El SYSTEM_PROMPT se importa directo del repo — NO se duplica.
 */

import { SYSTEM_PROMPT } from "../../src/lib/ai-generation";
import { findNearestStation } from "../../src/lib/metro-stations";
import { PLUSVALIA_HISTORICA, PLUSVALIA_DEFAULT } from "../../src/lib/plusvalia-historica";
import { estimarContribuciones } from "../../src/lib/contribuciones";
import {
  TASA_MERCADO_FALLBACK,
  calcTasaConSubsidio,
  calificaSubsidio,
  aplicaSubsidio,
} from "../../src/lib/constants/subsidio";
import type { AnalisisInput, FullAnalysisResult } from "../../src/lib/types";

function fmtCLP(n: number): string {
  return "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
}
function fmtUF(n: number): string {
  return "UF " + (Math.round(n * 10) / 10).toLocaleString("es-CL");
}

interface Options {
  zoneInsightStats?: { precioM2?: { medianaComuna?: number } };
  marketData?: { precio_m2_venta_promedio: number; arriendo_promedio: number } | null;
  etapa?: "evaluando" | "cerrado";
}

export interface BuiltPrompts {
  systemPrompt: string;
  userPrompt: string;
  // Diagnóstico para validación shim:
  diag: {
    tipoNegociacion: string;
    tieneDiferenciaValida: boolean;
    sobreprecioPorM2UF: number | null;
    flujoCruzaEnHorizonte: boolean;
    veredictoMotor: string;
    fhOverall: string | undefined;
  };
}

export async function buildLtrPrompts(
  input: AnalisisInput,
  results: FullAnalysisResult,
  options: Options = {}
): Promise<BuiltPrompts> {
  const mRaw = (results as any).metrics;
  const m = {
    ...mRaw,
    rentabilidadBruta: mRaw.rentabilidadBruta ?? mRaw.yieldBruto ?? 0,
    rentabilidadNeta: mRaw.rentabilidadNeta ?? mRaw.yieldNeto ?? 0,
    capRate: mRaw.capRate ?? 0,
  };
  const d = (results as any).desglose;
  const exit = (results as any).exitScenario;
  const UF_CLP = m.precioCLP / input.precio;

  // Zone market data — el shim acepta market data inyectada (mock) o usa fallback
  let precioM2Zona = m.precioM2;
  let arriendoZona = input.arriendo;
  let yieldZona = m.rentabilidadBruta;
  let precioM2ZonaConfiable = false;
  if (options.marketData) {
    precioM2Zona = options.marketData.precio_m2_venta_promedio;
    arriendoZona = options.marketData.arriendo_promedio;
    yieldZona = Math.round((arriendoZona * 12 / (precioM2Zona * input.superficie * UF_CLP)) * 1000) / 10;
    precioM2ZonaConfiable = true;
  }
  if (!precioM2ZonaConfiable && options.zoneInsightStats?.precioM2?.medianaComuna) {
    precioM2Zona = options.zoneInsightStats.precioM2.medianaComuna;
    precioM2ZonaConfiable = true;
  }

  const creditoCLP = m.precioCLP * (1 - input.piePct / 100);
  const inversionTotal = m.pieCLP + Math.round(m.precioCLP * 0.02);

  const fechaEntregaFmt = input.fechaEntrega
    ? (() => { const [a, me] = input.fechaEntrega!.split("-").map(Number); const mesesEs = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]; return `${mesesEs[(me || 1) - 1]} ${a}`; })()
    : "";

  const precioConDescuento10 = Math.round(input.precio * 0.9);
  const projections = (results as any).projections as { flujoAcumulado: number; flujoAnual: number }[] | undefined;
  const flujoNegAcum10 = projections && projections.length >= 10 && projections[9].flujoAcumulado < 0
    ? Math.round(Math.abs(projections[9].flujoAcumulado))
    : m.flujoNetoMensual < 0 ? Math.round(Math.abs(m.flujoNetoMensual) * 12 * 10) : 0;
  const datoDP = Math.round(inversionTotal * Math.pow(1.05, 10));
  const datoFM = Math.round(inversionTotal * Math.pow(1.07, 10));
  const valorProp5 = Math.round(m.precioCLP * Math.pow(1.04, 5));
  const valorProp10 = Math.round(m.precioCLP * Math.pow(1.04, 10));
  const dividendoSiTasaSube1 = creditoCLP > 0
    ? Math.round((creditoCLP * ((input.tasaInteres + 1) / 100 / 12)) / (1 - Math.pow(1 + (input.tasaInteres + 1) / 100 / 12, -(input.plazoCredito * 12))))
    : 0;
  const dividendoSiTasaSube2 = creditoCLP > 0
    ? Math.round((creditoCLP * ((input.tasaInteres + 2) / 100 / 12)) / (1 - Math.pow(1 + (input.tasaInteres + 2) / 100 / 12, -(input.plazoCredito * 12))))
    : 0;
  const flujoNegAcum5 = projections && projections.length >= 5 && projections[4].flujoAcumulado < 0
    ? Math.round(Math.abs(projections[4].flujoAcumulado))
    : Math.round(Math.abs(m.flujoNetoMensual) * 60);

  // Anomalías
  const anomalias: string[] = [];
  const arriendoRef = arriendoZona;
  if (arriendoRef > 0 && input.arriendo > 0) {
    const diffArriendo = ((input.arriendo - arriendoRef) / arriendoRef) * 100;
    if (diffArriendo > 30) {
      const flujoConArriendoReal = m.flujoNetoMensual - (input.arriendo - arriendoRef);
      anomalias.push(`ARRIENDO ALTO: El usuario ingresó ${fmtCLP(input.arriendo)} pero el mercado paga ${fmtCLP(arriendoRef)} (${Math.round(diffArriendo)}% sobre mercado). Si no logras ese precio, tu flujo real sería ${fmtCLP(flujoConArriendoReal)}, no ${fmtCLP(m.flujoNetoMensual)}.`);
    } else if (diffArriendo < -30) {
      anomalias.push(`ARRIENDO BAJO: El usuario ingresó ${fmtCLP(input.arriendo)} pero el mercado indica ${fmtCLP(arriendoRef)} (${Math.round(Math.abs(diffArriendo))}% bajo).`);
    }
  }
  const precioM2Usuario = input.precio / input.superficie;
  if (precioM2Zona > 0 && precioM2Usuario > 0 && precioM2ZonaConfiable) {
    const diffPrecio = ((precioM2Usuario - precioM2Zona) / precioM2Zona) * 100;
    if (diffPrecio > 30) {
      anomalias.push(`PRECIO ALTO: Precio/m² de ${fmtUF(precioM2Usuario)} está ${Math.round(diffPrecio)}% sobre el promedio de la zona (${fmtUF(precioM2Zona)}/m²).`);
    } else if (diffPrecio < -30) {
      anomalias.push(`PRECIO BAJO: Precio/m² de ${fmtUF(precioM2Usuario)} está ${Math.round(Math.abs(diffPrecio))}% bajo (${fmtUF(precioM2Zona)}/m²).`);
    }
  }
  const ggccEstimado = input.superficie * 2000;
  if (input.gastos > 0 && input.gastos > ggccEstimado * 1.5) {
    anomalias.push(`GGCC ALTOS: ${fmtCLP(input.gastos)} para ${input.superficie}m² (ref ~${fmtCLP(ggccEstimado)}).`);
  }
  const precioCLPFull = m.precioCLP || input.precio * UF_CLP;
  const esNuevo = input.tipo === "nuevo";
  const contribEstimada = estimarContribuciones(precioCLPFull, esNuevo);
  const contribUsuario = input.contribuciones || 0;
  if (contribEstimada > 0 && contribUsuario > contribEstimada * 2) {
    anomalias.push(`CONTRIBUCIONES MUY ALTAS: estim ~${fmtCLP(contribEstimada)}/trim vs ${fmtCLP(contribUsuario)}.`);
  }

  const anomaliasTexto = anomalias.length > 0
    ? `\n\nANOMALÍAS DETECTADAS EN LOS INPUTS:\n${anomalias.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nDEBES mencionar cada anomalía relevante en tu análisis.`
    : "";

  const anomaliasFin: string[] = [];
  if (input.piePct < 15) anomaliasFin.push(`PIE BAJO: ${input.piePct}% (estándar 20-25%).`);
  if (input.tasaInteres > 5.5) anomaliasFin.push(`TASA ALTA: ${input.tasaInteres}% (mercado ~4.1%).`);
  if (input.plazoCredito < 20) anomaliasFin.push(`PLAZO CORTO: ${input.plazoCredito} años.`);
  const anomaliasFinTexto = anomaliasFin.length > 0
    ? `\n\nANOMALÍAS DE FINANCIAMIENTO:\n${anomaliasFin.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
    : "";

  // Contexto negociación
  const precioFlujoNeutroUF = m.precioFlujoNeutroUF || 0;
  const descuentoParaNeutro = m.descuentoParaNeutro || 0;
  const plusvaliaFranco = m.plusvaliaInmediataFranco || 0;
  const plusvaliaFrancoPct = m.plusvaliaInmediataFrancoPct || 0;

  const vmFrancoUF = input.valorMercadoFranco || input.precio;
  const vmFrancoCLP = vmFrancoUF * UF_CLP;
  const precioCompraCLP = m.precioCLP;
  const diferenciaCLP = vmFrancoCLP - precioCompraCLP;
  const pctDiferencia = vmFrancoCLP > 0 ? (Math.abs(diferenciaCLP) / vmFrancoCLP) * 100 : 0;
  const tipoNegociacion: "PASADA" | "SOBREPRECIO" | "PRECIO_ALINEADO" =
    pctDiferencia <= 2 ? "PRECIO_ALINEADO" : diferenciaCLP > 0 ? "PASADA" : "SOBREPRECIO";
  const tieneDiferenciaValida = Math.abs(diferenciaCLP) > 1_000_000;
  const sobreprecioPorM2UF = precioM2ZonaConfiable && precioM2Zona > 0 && m.precioM2 > 0
    ? Math.round((m.precioM2 - precioM2Zona) * 10) / 10
    : null;

  const neg = (results as any).negociacion;
  const precioSugeridoCLPNeg = neg?.precioSugeridoCLP ?? Math.round(Math.min(input.precio, vmFrancoUF) * 0.97 * UF_CLP);
  const tirActual = exit?.tir ?? 0;
  const tirAlSugeridoNeg = neg?.tirAlSugerido ?? null;
  const deltaTirSugerido = typeof tirAlSugeridoNeg === "number" ? tirAlSugeridoNeg - tirActual : null;
  const precioLimiteCLPNeg = neg?.precioLimiteCLP ?? null;

  const projYears = (projections as any[]) || [];
  let anioCruce = -1;
  for (let i = 0; i < projYears.length; i++) {
    if ((projYears[i]?.flujoAnual ?? 0) >= 0) { anioCruce = i + 1; break; }
  }
  let mesesDeFlujoNegativo = 0;
  let flujoCruzaEnHorizonte = true;
  if (m.flujoNetoMensual >= 0) mesesDeFlujoNegativo = 0;
  else if (anioCruce === -1) { mesesDeFlujoNegativo = projYears.length * 12; flujoCruzaEnHorizonte = false; }
  else mesesDeFlujoNegativo = Math.max(0, (anioCruce - 1) * 12);

  const inputAny = input as any;
  const lat = inputAny.lat || inputAny.zonaRadio?.lat || null;
  const lng = inputAny.lng || inputAny.zonaRadio?.lng || null;
  let metroInfo = "";
  if (lat && lng) {
    const nearestActive = findNearestStation(lat, lng, "active");
    if (nearestActive) {
      const distKm = (nearestActive.distance / 1000).toFixed(1);
      metroInfo += `Estación de metro más cercana: ${nearestActive.station.name} (${nearestActive.station.line}) a ${distKm} km. `;
      if (nearestActive.distance < 500) metroInfo += "Excelente ubicación respecto a metro. ";
      else if (nearestActive.distance < 1000) metroInfo += "Buena cercanía a metro. ";
      else if (nearestActive.distance > 2500) metroInfo += "Lejos de metro, puede afectar demanda.";
    }
  } else metroInfo = "Sin datos de ubicación exacta.";

  const comunaNorm = (input.comuna || "").trim();
  const historica = PLUSVALIA_HISTORICA[comunaNorm];
  let plusvaliaHistoricaInfo = "";
  if (historica) {
    plusvaliaHistoricaInfo = `Plusvalía histórica de ${comunaNorm} (2014-2024): ${historica.plusvalia10a}% en 10 años (${historica.anualizada}% anual).`;
    if (historica.anualizada >= 4.5) plusvaliaHistoricaInfo += " Comuna con plusvalía ALTA.";
    else if (historica.anualizada >= 3.0) plusvaliaHistoricaInfo += " Comuna con plusvalía MODERADA.";
    else if (historica.anualizada >= 1.5) plusvaliaHistoricaInfo += " Comuna con plusvalía BAJA.";
    else plusvaliaHistoricaInfo += " Comuna con plusvalía MUY BAJA o NEGATIVA — cuidado.";
  } else {
    plusvaliaHistoricaInfo = `Sin datos históricos para ${comunaNorm}. Promedio Gran Santiago (${PLUSVALIA_DEFAULT.anualizada}% anual).`;
  }
  const COMUNAS_GRAN_SANTIAGO = ["Santiago","Providencia","Las Condes","Ñuñoa","La Florida","Vitacura","Lo Barnechea","San Miguel","Macul","Maipú","La Reina","Puente Alto","Estación Central","Independencia","Recoleta","Quinta Normal","San Joaquín"];
  const esFueraGranSantiago = comunaNorm ? !COMUNAS_GRAN_SANTIAGO.includes(comunaNorm) : false;

  const precioSugeridoUF = plusvaliaFrancoPct > 15 ? Math.round(input.precio)
    : precioFlujoNeutroUF > 0 && descuentoParaNeutro <= 10 ? Math.round(precioFlujoNeutroUF)
    : Math.round(input.precio * 0.9);

  const veredictoMotor = (results as any).engineSignal || (results.score >= 70 ? "COMPRAR" : results.score >= 40 ? "AJUSTA EL PRECIO" : "BUSCAR OTRA");

  // ─── Fase 3.6 v9 — anclas discretas (paralelo a ai-generation.ts) ──────
  const techoUF = neg?.precioSugeridoUF
    ? Math.round(neg.precioSugeridoUF)
    : precioSugeridoUF;
  const techoCLP = Math.round(techoUF * UF_CLP);
  const primeraOfertaUF = Math.round(techoUF * 0.95);
  const primeraOfertaCLP = Math.round(primeraOfertaUF * UF_CLP);
  let walkAwayAncla: { precio_uf: number | null; precio_clp: number | null; razon: string } | null;
  if (veredictoMotor === "BUSCAR OTRA") {
    walkAwayAncla = { precio_uf: null, precio_clp: null, razon: "veredicto motor: buscar otra propiedad" };
  } else if (veredictoMotor === "AJUSTA EL PRECIO") {
    walkAwayAncla = { precio_uf: techoUF, precio_clp: techoCLP, razon: "no comprar sobre el techo" };
  } else {
    walkAwayAncla = null;
  }
  const anclasBloque = `
ANCLAS DE NEGOCIACIÓN (REGLA 5 v9 — usar EXACTOS, no recalcular):
- primeraOferta_uf: ${primeraOfertaUF} (${fmtCLP(primeraOfertaCLP)})
- techo_uf: ${techoUF} (${fmtCLP(techoCLP)})
- walkAway: ${walkAwayAncla === null
      ? "null (no hay condición de salida — veredicto COMPRAR sin condiciones)"
      : walkAwayAncla.precio_uf === null
        ? `{ precio_uf: null, razon: "${walkAwayAncla.razon}" } — la salida es buscar otra propiedad`
        : `{ precio_uf: ${walkAwayAncla.precio_uf} (${fmtCLP(walkAwayAncla.precio_clp!)}), razon: "${walkAwayAncla.razon}" }`}`;

  const subsidioBloque = (() => {
    if (!calificaSubsidio(input.tipo, input.precio)) return "";
    const tasaConSubsidio = calcTasaConSubsidio(TASA_MERCADO_FALLBACK);
    const usoTasaSubsidio = aplicaSubsidio(input.tasaInteres, tasaConSubsidio);
    const creditoCLPSub = m.precioCLP * (1 - input.piePct / 100);
    const tasaMesSub = tasaConSubsidio / 100 / 12;
    const nMeses = input.plazoCredito * 12;
    const dividendoConSubsidio = Math.round((creditoCLPSub * tasaMesSub) / (1 - Math.pow(1 + tasaMesSub, -nMeses)));
    return `\n\nSUBSIDIO LEY 21.748:\n- usoTasaSubsidio: ${usoTasaSubsidio}\n- tasaConSubsidio: ~${tasaConSubsidio}%\n- dividendoConSubsidio: ${fmtCLP(dividendoConSubsidio)} (vs actual ${fmtCLP(m.dividendo)})\n- compliance: lenguaje NO imperativo.`;
  })();

  const fh = (results as any).financingHealth;
  const fhBloque = fh ? `
financingHealth:
- overall: ${fh.overall}
- pie: ${fh.pie.level} (actual ${fh.pie.actual_pct}%, recomendado ${fh.pie.recommended_pct}%)${fh.pie.impact_message ? ` — ${fh.pie.impact_message}` : ""}
- tasa: ${fh.tasa.level} (actual ${fh.tasa.actual_pct}%, mercado ${fh.tasa.market_avg_pct}%, spread ${fh.tasa.spread_bps >= 0 ? "+" : ""}${fh.tasa.spread_bps} bps)${fh.tasa.impact_message ? ` — ${fh.tasa.impact_message}` : ""}` : "";

  const etapa = options.etapa || "evaluando";

  const userPrompt = `Caso a analizar. Aplica la doctrina del system prompt. Devuelve SOLO el JSON con el schema definido en §13.

PERFIL Y ETAPA
- userTier: estandar
- etapa: ${etapa}
- monedaUF: 1 UF = ${fmtCLP(UF_CLP)}

DATOS DEL DEPTO
- tipo: ${input.tipo}
- ubicacion: ${input.comuna}, ${input.ciudad}
- superficie: ${input.superficie} m²
- antiguedad: ${input.estadoVenta !== "inmediata" && fechaEntregaFmt ? "en construcción, entrega " + fechaEntregaFmt : input.antiguedad + " años"}

ESTRUCTURA FINANCIERA DEL USUARIO
- precio: ${fmtUF(input.precio)} (${fmtCLP(m.precioCLP)})
- pie: ${input.piePct}% = ${fmtCLP(m.pieCLP)} (${fmtUF(m.pieCLP / UF_CLP)})
- credito: ${fmtCLP(creditoCLP)} a ${input.tasaInteres}% en ${input.plazoCredito} años
- dividendoMensual: ${fmtCLP(m.dividendo)} (${fmtUF(m.dividendo / UF_CLP)})
${fhBloque}

OPERACIÓN MENSUAL
- arriendo: ${fmtCLP(input.arriendo)}/mes (${fmtUF(input.arriendo / UF_CLP)}/mes)
- gastosComunes: ${fmtCLP(input.gastos)}/mes
- contribuciones: ${fmtCLP(input.contribuciones)}/trimestre
- provisionMantencion: ${fmtCLP(input.provisionMantencion)}/mes
- flujoMensualNeto: ${fmtCLP(m.flujoNetoMensual)} (${fmtUF(m.flujoNetoMensual / UF_CLP)})${m.flujoNetoMensual < 0 ? " — negativo" : ""}

MÉTRICAS DEL MOTOR
- francoScore: ${results.score}/100 (clasificación: ${results.clasificacion})
- engineSignal: ${veredictoMotor}
- subscores: rentabilidad ${Math.round(d.rentabilidad)}/100 · flujo caja ${Math.round(d.flujoCaja)}/100 · plusvalia ${Math.round(d.plusvalia)}/100 · eficiencia ${Math.round(d.eficiencia)}/100
- rentabilidadBruta: ${m.rentabilidadBruta.toFixed(1)}%
- capRate: ${m.capRate.toFixed(1)}%
- rentabilidadNeta: ${m.rentabilidadNeta.toFixed(1)}%
- cashOnCash: ${m.cashOnCash.toFixed(1)}%
- TIR a 10 años: ${exit.tir.toFixed(1)}%
- multiplicadorCapital 10 años: ${exit.multiplicadorCapital.toFixed(2)}x
- inversionInicialTotal: ${fmtCLP(inversionTotal)} (${fmtUF(inversionTotal / UF_CLP)})

VARIABLES DE NEGOCIACIÓN
- tipoNegociacion: ${tieneDiferenciaValida ? tipoNegociacion : "INDETERMINADO_FALLBACK_VMFRANCO (NO usar — aplica REGLA 0 §12 con SOLO el indicador por m²)"}
- precioCompra: ${fmtUF(input.precio)} (${fmtCLP(precioCompraCLP)})
- vmFranco: ${fmtUF(vmFrancoUF)} (${fmtCLP(vmFrancoCLP)})${tieneDiferenciaValida ? "" : " ← FALLBACK del motor"}
- diferencia: ${diferenciaCLP >= 0 ? "+" : "-"}${fmtCLP(Math.abs(diferenciaCLP))} (${pctDiferencia.toFixed(1)}%)${tieneDiferenciaValida ? "" : " ← INVÁLIDO por fallback"}
- tieneDiferenciaValida: ${tieneDiferenciaValida}
- sobreprecioPorM2: ${sobreprecioPorM2UF !== null ? `${sobreprecioPorM2UF > 0 ? "+" : ""}${sobreprecioPorM2UF.toFixed(1)} UF/m² (tu ${m.precioM2.toFixed(1)} vs zona ${precioM2Zona.toFixed(1)})` : "sin dato"}
- precioSugerido: ${fmtUF(precioSugeridoUF)} (${fmtCLP(precioSugeridoCLPNeg)})
- precioCon10pctDescuento: ${fmtUF(precioConDescuento10)}
- tirActual: ${tirActual.toFixed(1)}%
- tirAlSugerido: ${tirAlSugeridoNeg !== null ? tirAlSugeridoNeg.toFixed(1) + "%" : "sin dato"}
- deltaTirSugerido: ${deltaTirSugerido !== null ? (deltaTirSugerido >= 0 ? "+" : "") + deltaTirSugerido.toFixed(1) + " pp" : "sin dato"}
- precioLimite: ${precioLimiteCLPNeg !== null ? fmtCLP(precioLimiteCLPNeg) : "sin dato"}
- precioFlujoNeutro: ${precioFlujoNeutroUF > 0 ? fmtUF(precioFlujoNeutroUF) + ` (descuento ${descuentoParaNeutro.toFixed(1)}%)` : "no existe"}
- plusvaliaInmediataFranco: ${plusvaliaFrancoPct.toFixed(1)}% (${plusvaliaFranco >= 0 ? "+" : ""}${fmtCLP(plusvaliaFranco)})
- mesesDeFlujoNegativo: ${m.flujoNetoMensual >= 0 ? "0" : flujoCruzaEnHorizonte ? `${mesesDeFlujoNegativo} (≈${Math.round(mesesDeFlujoNegativo / 12)} años)` : `>${projYears.length * 12} — NO cruza`}
- flujoCruzaEnHorizonte: ${flujoCruzaEnHorizonte}
- plazoCredito: ${input.plazoCredito} años

PROYECCIÓN Y ALTERNATIVAS
- flujoNegativoAcumulado5anios: ${fmtCLP(flujoNegAcum5)}
- flujoNegativoAcumulado10anios: ${fmtCLP(flujoNegAcum10)}
- valorPropiedadProyectado10anios (4%): ${fmtCLP(valorProp10)}
- gananciaNetaAlVender10anios: ${fmtCLP(exit.gananciaNeta)}
- depositoUFAl5pct10anios: ${fmtCLP(datoDP)}
- fondoMutuoAl7pct10anios: ${fmtCLP(datoFM)}
- dividendoSiTasaSube1pp: ${fmtCLP(dividendoSiTasaSube1)} (vs actual ${fmtCLP(m.dividendo)})
- dividendoSiTasaSube2pp: ${fmtCLP(dividendoSiTasaSube2)}

DATOS DE MERCADO DE LA ZONA
- precioM2Zona: ${fmtUF(precioM2Zona)}${precioM2ZonaConfiable ? "" : " (fallback al m² del depto, no es dato real)"}
- arriendoZona: ${fmtCLP(arriendoZona)}
- yieldZona: ${yieldZona.toFixed(1)}%

UBICACIÓN Y PLUSVALÍA
${metroInfo}
${plusvaliaHistoricaInfo}
${esFueraGranSantiago ? "ADVERTENCIA: fuera del Gran Santiago. Datos pueden ser imprecisos." : ""}
${anomaliasTexto}${anomaliasFinTexto}${subsidioBloque}
${anclasBloque}

negociacion.precioSugerido (este caso): "${fmtUF(techoUF)}" ← EXACTO techo_uf de las anclas (REGLA 6 v9)

Devuelve SOLO el JSON. Aplica las reglas del system prompt al caso descrito arriba.`;

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    diag: {
      tipoNegociacion: tieneDiferenciaValida ? tipoNegociacion : "INDETERMINADO_FALLBACK_VMFRANCO",
      tieneDiferenciaValida,
      sobreprecioPorM2UF,
      flujoCruzaEnHorizonte,
      veredictoMotor,
      fhOverall: fh?.overall,
    },
  };
}
