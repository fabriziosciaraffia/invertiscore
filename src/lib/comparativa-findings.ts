// ============================================================================
// PIRÁMIDE DIFERENCIAL AMBAS (D3) — builders motor-templated de los 6 findings
// ============================================================================
// Cada finding compara las DOS modalidades (no describe una sola). Determinístico: cada
// cifra deriva de los results LTR/STR recomputados + veredictoComparativo (Fase A). Cero IA.
// Anatomía canon LTR/STR (GenericFindingCard): kicker · titular humano · KPI · ksub ·
// cuerpo (consecuencia) · lado (a favor de quién) · procedencia. Cada finding trae su
// drawer-puente (D4): la aritmética del delta + links al hijo por sección.
//
// Orden DINÁMICO por banda (ratificado): STR_FRAGIL → lidera break-even (F4); el resto →
// lidera flujo (F1). Patrimonio-idéntico siempre cierra. Regulatorio y capital son
// condicionales. Composición 4-6 cards.
// ============================================================================

import type { BandaComparativa } from "./engines/str-universo-santiago";
import type { FullAnalysisResult } from "./types";
import type { ShortTermResult } from "./engines/short-term-engine";

export type FindingId = "flujo" | "gestion" | "patrimonio" | "breakeven" | "regulatorio" | "capital";
export type FindingLado = "ltr" | "str" | "neutro";
export type Currency = "CLP" | "UF";

export interface PuenteFila { label: string; ltr?: string; str?: string; delta?: string }
export interface PuenteLink { label: string; hijo: "ltr" | "str"; seccion: string }

// Criterio de botones-puente (R5): cada botón enlaza a la sección del hijo donde VIVE el
// detalle relevante del finding — nunca por azar. Regla:
//  · Finding de DOS lados (el detalle existe en ambos hijos) → 2 botones, uno por hijo.
//    Solo aplica a `flujo` (flujo mes a mes en ambos) y `patrimonio` (proyección en ambos).
//  · Finding de UN lado (el fenómeno es propio del corto) → 1 botón al hijo STR.
//    `gestion` (escenarios STR), `breakeven` (zona STR), `regulatorio` (supuestos STR),
//    `capital` (inversión inicial STR): el arriendo largo no tiene ese detalle que aportar.

export interface FindingComparativa {
  id: FindingId;
  kicker: string;
  titular: string;
  kpi: string;
  kpiRed: boolean;
  ksub: string;
  cuerpo: string;
  lado: FindingLado;
  decisividad: number;         // 0..1 (documental; el orden lo fija la banda)
  procedencia: string;
  // lead: planta QUÉ se compara antes de la aritmética (C2). filas: la resta.
  puente: { titulo: string; lead: string; filas: PuenteFila[]; nota?: string; links: PuenteLink[] };
  // Snapshot tipado para el golden (currency-independiente).
  valor: Record<string, number | string | boolean | null>;
}

// ── Formato (coma decimal chilena, UTF-8, − tipográfico) ─────────────────────
const fmtCLP = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");
const fmtUF = (n: number, uf: number) => "UF " + Math.round(Math.abs(n) / (uf || 1)).toLocaleString("es-CL");
function money(n: number, c: Currency, uf: number): string { return c === "UF" ? fmtUF(n, uf) : fmtCLP(n); }
function signed(n: number, c: Currency, uf: number): string { return (n < 0 ? "−" : "+") + money(n, c, uf); }
const pct0 = (n: number) => Math.round(n) + "%";

// ── Contexto: todo lo que los builders necesitan, ya derivado por el caller ──
export interface FindingsCtx {
  banda: BandaComparativa;
  // Flujo / NOI
  ltrFlujoMensual: number;
  strFlujoMensual: number;
  ltrNOIMensual: number;
  strNOIMensual: number;
  // Gestión / flip
  modoGestion: "auto" | "admin";
  comisionAdministrador: number;    // decimal (0.2)
  strAutoNOIMensual: number;
  strAdminNOIMensual: number;
  ingresoBrutoMensual: number;
  flipCambiaVeredicto: boolean;
  recomendacionAuto: string;
  recomendacionAdmin: string;
  // Patrimonio
  ltrPatY10: number | null;
  strPatY10: number | null;
  // Break-even / zona
  breakEvenPctDelMercado: number;
  breakEvenRevenueAnual: number;    // facturación anual necesaria para no perder (derivación F4)
  zonaTier?: string;
  zonaPercentilADR?: number;
  zonaPercentilOcupacion?: number;
  zonaComuna?: string;
  // Regulatorio
  edificioPermiteAirbnb: string;    // "si" | "no" | "no_seguro" | ""
  // Capital
  ltrCapitalInicial: number;        // simétrico (inversionInicial) si existe, si no pie
  ltrCapitalEsSimetrico: boolean;   // false ⇒ es pieCLP (asimétrico), el card se limita al amoblamiento
  strCapitalInvertido: number;
  costoAmoblamiento: number;
}

const nombreLado = (l: FindingLado) => l === "ltr" ? "renta larga" : l === "str" ? "renta corta" : "ninguna";
// Texto del lado a partir de la recomendación de un modo (para el flip de gestión D2).
const ladoTxt = (reco: string) => { const l = recoToLado(reco); return l === "ltr" ? "renta larga" : l === "str" ? "renta corta" : "parejas"; };
const convieneFrase = (reco: string) => { const l = recoToLado(reco); return l === "neutro" ? "quedan parejas" : `conviene ${nombreLado(l)}`; };

// Glosa de jerga a lenguaje llano (C4). Percentil SIEMPRE traducido: p94 ADR → "el 6% más
// caro"; p39 ocupación → "bajo el 61%". Tier → nivel de demanda. Voz: tuteo neutro chileno.
const glosaADR = (p?: number) => p == null ? "" : `la tarifa por noche está entre el ${100 - p}% más caro de Santiago`;
const glosaOcc = (p?: number) => p == null ? "" : `la ocupación queda por debajo del ${100 - p}% de la zona`;
const glosaTier = (t?: string) =>
  t === "alta" ? "zona de demanda alta para arriendo corto"
    : t === "baja" ? "zona de demanda baja para arriendo corto"
      : "zona de demanda media para arriendo corto";

// ── Builder del contexto desde los results recomputados (owner + share) ──────
export function ctxFromResults(
  ltr: FullAnalysisResult | null,
  str: ShortTermResult | null,
  inputs: { modoGestion: "auto" | "admin"; comisionAdministrador: number; costoAmoblamiento: number; edificioPermiteAirbnb: string },
): FindingsCtx | null {
  if (!ltr || !str) return null;
  const vc = str.veredictoComparativo;
  const base = str.escenarios?.base;
  // Capital LTR simétrico (inversionInicial = pie+cierre+CapEx+corretaje) vive en el objeto
  // retorno/exit; si no llega, se cae a pieCLP (asimétrico) y el finding de capital se limita
  // al amoblamiento. Gap declarado en F-B1.
  const ltrRet = (ltr as unknown as { retorno?: { inversionInicial?: number }; exitScenario?: { inversionInicial?: number } });
  const ltrInvInicial = ltrRet.retorno?.inversionInicial ?? ltrRet.exitScenario?.inversionInicial;
  const ltrCapitalEsSimetrico = typeof ltrInvInicial === "number" && ltrInvInicial > 0;
  return {
    banda: vc?.banda ?? "INDIFERENTE",
    ltrFlujoMensual: ltr.metrics?.flujoNetoMensual ?? 0,
    strFlujoMensual: base?.flujoCajaMensual ?? 0,
    ltrNOIMensual: (ltr.metrics?.noi ?? 0) / 12,
    strNOIMensual: base?.noiMensual ?? 0,
    modoGestion: (vc?.flipGestion?.modoActual ?? inputs.modoGestion) as "auto" | "admin",
    comisionAdministrador: inputs.comisionAdministrador,
    strAutoNOIMensual: str.comparativa?.str_auto?.noiMensual ?? 0,
    strAdminNOIMensual: str.comparativa?.str_admin?.noiMensual ?? 0,
    ingresoBrutoMensual: base?.ingresoBrutoMensual ?? 0,
    flipCambiaVeredicto: vc?.flipGestion?.cambiaVeredicto ?? false,
    recomendacionAuto: vc?.flipGestion?.recomendacionAuto ?? "",
    recomendacionAdmin: vc?.flipGestion?.recomendacionAdmin ?? "",
    ltrPatY10: ltr.projections?.[9]?.patrimonioNeto ?? null,
    strPatY10: str.projections?.[9]?.patrimonioNeto ?? null,
    breakEvenPctDelMercado: str.breakEvenPctDelMercado ?? 0,
    breakEvenRevenueAnual: str.breakEvenRevenueAnual ?? 0,
    zonaTier: str.zonaSTR?.tierZona,
    zonaPercentilADR: str.zonaSTR?.percentilADR,
    zonaPercentilOcupacion: str.zonaSTR?.percentilOcupacion,
    zonaComuna: str.zonaSTR?.comuna,
    edificioPermiteAirbnb: inputs.edificioPermiteAirbnb,
    ltrCapitalInicial: ltrCapitalEsSimetrico ? (ltrInvInicial as number) : (ltr.metrics?.pieCLP ?? 0),
    ltrCapitalEsSimetrico,
    strCapitalInvertido: str.capitalInvertido ?? 0,
    costoAmoblamiento: inputs.costoAmoblamiento,
  };
}

// ── F1 · Flujo mensual comparado (FIJO) ──────────────────────────────────────
function buildFlujo(x: FindingsCtx, c: Currency, uf: number): FindingComparativa {
  const delta = x.strFlujoMensual - x.ltrFlujoMensual;   // STR − LTR
  const lado: FindingLado = delta > 0 ? "str" : "ltr";
  const gana = nombreLado(lado);              // el que pone menos / deja más
  const pierde = nombreLado(lado === "str" ? "ltr" : "str");
  const abs = Math.abs(delta);
  const anual = abs * 12;
  const ambasNegativas = x.ltrFlujoMensual < 0 && x.strFlujoMensual < 0;
  const ambasPositivas = x.ltrFlujoMensual >= 0 && x.strFlujoMensual >= 0;
  const cortoGana = lado === "str";
  // C5: titular AFIRMA la conclusión decisional en positivo, legible sin leer el cuerpo.
  const titular = ambasNegativas
    ? `Este depto pide plata de tu bolsillo en las dos — con ${gana} pones menos`
    : ambasPositivas
      ? `Te deja plata cada mes en las dos, y con ${gana} un poco más`
      : `Con ${gana} te queda plata cada mes; con ${pierde} la pones de tu bolsillo`;
  return {
    id: "flujo",
    kicker: "FLUJO MENSUAL",
    titular,
    kpi: money(abs, c, uf),
    kpiRed: ambasNegativas,
    ksub: `${money(anual, c, uf)} AL AÑO A FAVOR DE ${gana.toUpperCase()}`,
    // C5: concepto → evidencia → consecuencia. Signo explicado en palabras, sin recitar.
    cuerpo: `El flujo mensual es la plata que te queda —o que pones— cada mes después de pagar el dividendo del crédito y los gastos. ${ambasNegativas ? `Acá ninguna de las dos se paga sola: con renta larga pones ${money(Math.abs(x.ltrFlujoMensual), c, uf)} de tu bolsillo al mes y con renta corta ${money(Math.abs(x.strFlujoMensual), c, uf)}.` : `Con renta larga ${x.ltrFlujoMensual >= 0 ? `te quedan ${money(x.ltrFlujoMensual, c, uf)}` : `pones ${money(Math.abs(x.ltrFlujoMensual), c, uf)}`} al mes y con renta corta ${x.strFlujoMensual >= 0 ? `te quedan ${money(x.strFlujoMensual, c, uf)}` : `pones ${money(Math.abs(x.strFlujoMensual), c, uf)}`}.`} La diferencia es ${money(abs, c, uf)} al mes a favor de ${gana}: ${money(anual, c, uf)} al año que ${cortoGana ? "el arriendo largo no te da" : "el corto te cuesta de más solo en caja"}.`,
    lado,
    decisividad: 0.95,
    procedencia: "Flujo de caja mensual de cada modalidad, ya descontado el dividendo y los gastos",
    puente: {
      titulo: `De dónde sale la diferencia de ${money(abs, c, uf)} al mes`,
      lead: `El flujo mensual es lo que queda en tu bolsillo después de pagar el dividendo del crédito y los gastos. El NOI es lo que renta la operación antes de ese dividendo; el flujo es lo mismo ya con el dividendo restado. Comparadas fila a fila:`,
      filas: [
        { label: "Lo que renta antes del dividendo", ltr: money(x.ltrNOIMensual, c, uf), str: money(x.strNOIMensual, c, uf), delta: signed(x.strNOIMensual - x.ltrNOIMensual, c, uf) },
        { label: "Lo que queda ya con el dividendo", ltr: signed(x.ltrFlujoMensual, c, uf), str: signed(x.strFlujoMensual, c, uf), delta: signed(delta, c, uf) },
      ],
      nota: `Renta corta parte con menos renta operativa y encima carga un dividendo mayor —el amoblamiento y los meses de estabilización suman capital a financiar—, así que la diferencia de caja termina en ${money(abs, c, uf)} al mes a favor de ${gana}.`,
      links: [
        { label: "Ver el flujo mes a mes del corto", hijo: "str", seccion: "estacionalidad" },
        { label: "Ver el flujo de renta larga", hijo: "ltr", seccion: "flujo" },
      ],
    },
    valor: { deltaFlujo: Math.round(delta), ltrFlujo: Math.round(x.ltrFlujoMensual), strFlujo: Math.round(x.strFlujoMensual), lado },
  };
}

// ── F2 · Esfuerzo / costo de gestión (FIJO, + variante flip D2) ──────────────
function buildGestion(x: FindingsCtx, c: Currency, uf: number): FindingComparativa {
  const costoDelegar = x.strAutoNOIMensual - x.strAdminNOIMensual;   // cuánto baja el NOI al delegar
  const comisionMensual = x.ingresoBrutoMensual * x.comisionAdministrador;
  const flip = x.flipCambiaVeredicto;
  return {
    id: "gestion",
    kicker: flip ? "GESTIÓN · CAMBIA EL VEREDICTO" : "ESFUERZO DE GESTIÓN",
    // C5: titular AFIRMA la conclusión decisional; el KPI se explica en la ksub (puente titular↔número).
    titular: flip
      ? "Quién administre el corto cambia cuál te conviene"
      : "El corto solo rinde si lo administras tú; delegarlo se come la ventaja",
    kpi: flip ? money(comisionMensual, c, uf) : money(costoDelegar, c, uf),
    kpiRed: false,
    ksub: flip
      ? `AL MES AL ADMINISTRADOR · Y AHÍ SE DA VUELTA EL VEREDICTO`
      : `LO QUE PIERDES AL MES SI LO DELEGAS · ${pct0(x.comisionAdministrador * 100)} DEL BRUTO`,
    // C5: concepto → evidencia (los dos modos) → consecuencia decisional. Tuteo chileno.
    cuerpo: flip
      ? `Operar un arriendo corto son 8-12 horas a la semana tuyas, o un administrador que cobra ${pct0(x.comisionAdministrador * 100)} del bruto (${money(comisionMensual, c, uf)} al mes). Acá esa decisión pesa tanto que da vuelta el veredicto: si lo administras tú ${convieneFrase(x.recomendacionAuto)}, y si lo delegas ${convieneFrase(x.recomendacionAdmin)}. Antes de elegir modalidad, decide si vas a poner las horas o la plata.`
      : `Renta larga es casi pasiva: media hora a la semana y listo. El corto te exige 8-12 horas semanales, o entregar ${pct0(x.comisionAdministrador * 100)} del bruto (${money(comisionMensual, c, uf)} al mes) a un administrador. Si lo delegas, lo que renta la operación cae ${money(costoDelegar, c, uf)} al mes: esa es la parte de la ventaja del corto que estás pagando por no gestionarlo tú.`,
    lado: "ltr",
    decisividad: 0.85,
    procedencia: "Lo que renta el corto administrándolo tú vs pagando un administrador, sobre el mismo bruto",
    puente: {
      titulo: flip ? "Cómo el administrador da vuelta el veredicto" : "Cuánto te cuesta no administrarlo tú",
      lead: `El corto se opera de dos formas: lo administras tú (8-12 horas a la semana, sin comisión) o lo delegas a un administrador que cobra ${pct0(x.comisionAdministrador * 100)} del bruto. El ingreso bruto es el mismo (${money(x.ingresoBrutoMensual, c, uf)} al mes); lo que cambia es cuánto sobra después de la gestión:`,
      filas: [
        { label: "Lo que factura el corto (bruto)", str: money(x.ingresoBrutoMensual, c, uf) },
        { label: "Lo que renta si lo administras tú", str: money(x.strAutoNOIMensual, c, uf) },
        { label: `Lo que renta con administrador (−${pct0(x.comisionAdministrador * 100)})`, str: money(x.strAdminNOIMensual, c, uf), delta: signed(-costoDelegar, c, uf) },
      ],
      nota: flip
        ? `Por eso la gestión no es un detalle operativo: administrándolo tú conviene ${ladoTxt(x.recomendacionAuto)}, con administrador conviene ${ladoTxt(x.recomendacionAdmin)}. La decisión de modalidad no se puede separar de quién opera.`
        : `Delegar cuesta ${money(costoDelegar, c, uf)} al mes de rentabilidad. Aun así el veredicto no cambia: la mejor opción sigue siendo ${nombreLado(recoToLado(x.recomendacionAuto))} de las dos formas.`,
      links: [{ label: "Ver el modelo de gestión completo del corto", hijo: "str", seccion: "escenarios" }],
    },
    valor: { costoDelegarMensual: Math.round(costoDelegar), comisionMensual: Math.round(comisionMensual), flipCambia: flip, recomendacionAuto: x.recomendacionAuto, recomendacionAdmin: x.recomendacionAdmin },
  };
}

// ── F3 · Patrimonio-idéntico educativo (FIJO, cierre) ────────────────────────
function buildPatrimonio(x: FindingsCtx, c: Currency, uf: number): FindingComparativa {
  const lPat = x.ltrPatY10 ?? 0, sPat = x.strPatY10 ?? 0;
  const iguales = Math.abs(lPat - sPat) < 1000;   // homologados en Fase 0b → idénticos
  return {
    id: "patrimonio",
    kicker: "PATRIMONIO A 10 AÑOS",
    // C5: titular = el remate decisional (traído del drawer). Sin triple repetición aguas abajo.
    titular: iguales
      ? "El patrimonio no decide: es el mismo con las dos, la decisión está en el flujo y el esfuerzo"
      : "El patrimonio casi no separa a las dos: la decisión está en el flujo y el esfuerzo",
    kpi: money(lPat, c, uf),
    kpiRed: false,
    ksub: iguales ? "IGUAL EN LAS DOS · A 10 AÑOS" : `LARGA ${money(lPat, c, uf)} · CORTA ${money(sPat, c, uf)}`,
    // C5: concepto → evidencia (mismo número) → por qué. El "entonces qué" ya está en el titular; no repetir.
    cuerpo: iguales
      ? `El patrimonio a 10 años es lo que te queda si vendes y saldas el crédito: acá, ${money(lPat, c, uf)} en las dos modalidades. Es idéntico porque la propiedad se valoriza y la deuda se amortiza igual, la arriendes corto o largo — arrendar es lo que hacés con el activo, no lo que lo construye.`
      : `El patrimonio a 10 años es lo que te queda si vendes y saldas el crédito: ${money(lPat, c, uf)} en renta larga y ${money(sPat, c, uf)} en renta corta. La propiedad se valoriza y la deuda se amortiza casi igual en las dos, así que la modalidad apenas mueve esta cifra.`,
    lado: "neutro",
    decisividad: 0.3,
    procedencia: "Patrimonio neto al año 10 de cada modalidad (valor de la propiedad menos la deuda)",
    puente: {
      titulo: "Por qué el patrimonio no distingue modalidad",
      lead: `El patrimonio neto al año 10 es el valor de la propiedad menos la deuda que te quede: lo que embolsas si vendes. Puesto lado a lado:`,
      filas: [
        { label: "Patrimonio neto al año 10 (valor − deuda)", ltr: money(lPat, c, uf), str: money(sPat, c, uf), delta: signed(sPat - lPat, c, uf) },
      ],
      nota: `Los dos lados dependen del precio de compra y del crédito —no del tipo de arriendo—, por eso el resultado es ${iguales ? "el mismo" : "casi el mismo"}. La consecuencia para tu decisión es directa: al elegir entre las dos, esta cifra no aporta nada. Compáralas por el flujo mensual y por las horas que te pide cada una — ahí, y no acá, se juega cuál conviene.`,
      links: [
        { label: "Ver la proyección de renta larga", hijo: "ltr", seccion: "patrimonio" },
        { label: "Ver la proyección de renta corta", hijo: "str", seccion: "patrimonio" },
      ],
    },
    valor: { ltrPatY10: Math.round(lPat), strPatY10: Math.round(sPat), iguales },
  };
}

// ── F4 · Break-even vs banda de zona (FIJO) ──────────────────────────────────
function buildBreakEven(x: FindingsCtx, c: Currency, uf: number): FindingComparativa {
  const bePct = Math.round(x.breakEvenPctDelMercado * 100);
  const holgado = x.breakEvenPctDelMercado <= 0.90;
  const fragil = x.breakEvenPctDelMercado > 0.90 && x.breakEvenPctDelMercado <= 1.10;
  const conflictiva = x.breakEvenPctDelMercado > 1.10;
  const lado: FindingLado = holgado ? "str" : "ltr";
  // Tensión tarifa-buena / ocupación-mala: EL insight cuando el ADR es alto pero la occ baja.
  const tarifaAlta = x.zonaPercentilADR != null && x.zonaPercentilADR >= 60;
  const occBaja = x.zonaPercentilOcupacion != null && x.zonaPercentilOcupacion < 50;
  const tension = tarifaAlta && occBaja;
  const revenueMercado = x.breakEvenPctDelMercado > 0 ? Math.round(x.breakEvenRevenueAnual / x.breakEvenPctDelMercado) : 0;
  // C5: conclusión primero; la tensión es el insight, no la cola.
  const titular = holgado
    ? "El corto convendría: cubre sus costos facturando bastante menos que el promedio de la zona"
    : tension
      ? "Para que el corto convenga tiene que llenarse más que el promedio de la zona — y la ocupación no acompaña"
      : conflictiva
        ? "El corto tendría que facturar más de lo que da la zona solo para no perder"
        : "Para que el corto convenga tiene que rendir casi como el promedio de la zona, sin margen de error";
  return {
    id: "breakeven",
    kicker: "PUNTO DE EQUILIBRIO",
    titular,
    kpi: `${bePct}%`,
    kpiRed: conflictiva || fragil,
    ksub: `DE LO QUE RINDE LA ZONA, SOLO PARA NO PERDER · ${holgado ? "COLCHÓN AMPLIO" : fragil ? "MARGEN FRÁGIL" : "NO ALCANZA"}`,
    // C5: conclusión (tensión) → mecanismo glosado → consecuencia. Percentiles traducidos (C4).
    cuerpo: holgado
      ? `Para no perder plata, el corto necesita facturar el ${bePct}% de lo que rinde una operación típica de la zona: bastante menos de lo que da, así que hay colchón de sobra para una temporada floja o una vacancia. ${x.zonaTier ? `Es ${glosaTier(x.zonaTier)}` : "La zona acompaña"}, y los números lo sostienen.`
      : tension
        ? `Para no perder plata, el corto necesita llenarse por encima del promedio de la zona (el ${bePct}% de lo que rinde una operación típica). Y ahí está la trampa de esta zona: ${glosaADR(x.zonaPercentilADR)}, pero ${glosaOcc(x.zonaPercentilOcupacion)}. El precio por noche da, pero las noches no se llenan — y sin esa ocupación el margen no aparece.`
        : `Para no perder plata, el corto necesita facturar el ${bePct}% de lo que rinde una operación típica de la zona: ${conflictiva ? "más de lo que la zona da, o sea que ni al precio de mercado cubre costos" : "casi todo lo que da, sin margen para una temporada floja"}. ${x.zonaTier ? `Es ${glosaTier(x.zonaTier)}.` : ""}`,
    lado,
    decisividad: 0.9,
    procedencia: "Facturación que el corto necesita para no perder, contra lo que rinde una operación típica de la zona",
    puente: {
      titulo: `De dónde sale el ${bePct}%`,
      lead: `El punto de equilibrio compara dos facturaciones anuales del corto: la que necesita solo para cubrir costos, contra la que rinde una operación típica de la zona. El ratio entre las dos es el ${bePct}%:`,
      filas: [
        { label: "Facturación que necesita para no perder", str: money(x.breakEvenRevenueAnual, c, uf) + "/año" },
        { label: "Lo que rinde una operación típica de la zona", str: money(revenueMercado, c, uf) + "/año" },
        { label: "El corto necesita, de eso", str: `${bePct}%` },
      ],
      nota: holgado
        ? `Bajo el 90% hay colchón; entre 90 y 110% el margen es frágil; sobre 110% la operación no cubre ni al precio de la zona. Acá el ${bePct}% deja espacio para que una temporada floja no te tire a pérdida.`
        : `${tension ? `${glosaADR(x.zonaPercentilADR).charAt(0).toUpperCase() + glosaADR(x.zonaPercentilADR).slice(1)}, pero ${glosaOcc(x.zonaPercentilOcupacion)}: la tarifa ayuda, la ocupación no. ` : ""}Entre 90 y 110% el margen es frágil (una temporada floja lo cruza a pérdida); sobre 110% no cubre ni al precio de la zona.`,
      links: [{ label: "Ver el análisis de zona del corto", hijo: "str", seccion: "zona" }],
    },
    valor: { breakEvenPct: bePct, banda: x.banda, tier: x.zonaTier ?? null, pADR: x.zonaPercentilADR ?? null, pOcc: x.zonaPercentilOcupacion ?? null, lado },
  };
}

// ── F5 · Riesgo regulatorio condicional (CONDICIONAL: aparece salvo "si") ─────
function buildRegulatorio(x: FindingsCtx): FindingComparativa {
  const confirmadoNo = x.edificioPermiteAirbnb === "no";
  return {
    id: "regulatorio",
    kicker: "RIESGO REGULATORIO",
    titular: confirmadoNo
      ? "El edificio no permite Airbnb — la opción corto no está sobre la mesa"
      : "El edificio no confirma que permita Airbnb, y eso puede voltear todo el plan",
    kpi: confirmadoNo ? "NO PERMITE" : "SIN CONFIRMAR",
    kpiRed: true,
    ksub: confirmadoNo ? "REGLAMENTO DE COPROPIEDAD · PROHÍBE EL CORTO" : "REGLAMENTO DE COPROPIEDAD · SIN VERIFICAR",
    cuerpo: confirmadoNo
      ? "El reglamento de copropiedad prohíbe el arriendo corto, así que toda la comparación con Airbnb es teórica: no puedes operarlo acá. La decisión real es entre renta larga en este depto o buscar otra propiedad que sí permita corto."
      : "Nadie confirmó que el reglamento de copropiedad permita arriendo corto, y ese es un riesgo que anula la opción, no que la encarece: si el edificio lo prohíbe, todo el caso del corto se cae y te quedas con la renta larga igual. Confírmalo con el administrador del edificio antes de gastar un peso en amoblar.",
    lado: "ltr",
    decisividad: 0.8,
    procedencia: "Estado declarado del reglamento de copropiedad para arriendo corto",
    puente: {
      titulo: confirmadoNo ? "Por qué el corto no está sobre la mesa" : "Por qué esto puede anular la opción corto",
      lead: `El reglamento de copropiedad es el que decide si un edificio admite arriendo corto — no lo decides tú ni el rendimiento. Acá su estado es:`,
      filas: [
        { label: "Reglamento para arriendo corto", str: confirmadoNo ? "Lo prohíbe" : "Sin confirmar" },
      ],
      nota: confirmadoNo
        ? "Es un riesgo binario ya realizado: no reduce el rendimiento del corto, lo anula. Toda la comparativa de arriba solo tiene sentido si consigues cambiar de propiedad."
        : "Es un riesgo binario: no reduce el rendimiento del corto, lo anula por completo. Una llamada al administrador del edificio lo despeja — hazla antes de amoblar, no después.",
      links: [{ label: "Revisar los supuestos del corto", hijo: "str", seccion: "supuestos" }],
    },
    valor: { edificioPermiteAirbnb: x.edificioPermiteAirbnb, confirmadoNo },
  };
}

// ── F6 · Capital inicial diferencial (CONDICIONAL: amoblamiento > 0) ──────────
function buildCapital(x: FindingsCtx, c: Currency, uf: number): FindingComparativa {
  const deltaSimetrico = x.strCapitalInvertido - x.ltrCapitalInicial;
  // Sin capital LTR simétrico, el diferencial honesto es el amoblamiento (lo que SOLO exige el corto).
  const usaAmoblamiento = !x.ltrCapitalEsSimetrico;
  // Con capital simétrico: el largo TAMBIÉN pone plata de entrada (puesta a punto), así que el
  // amoblamiento no llega entero al delta. Si el delta es << amoblamiento, el capital NO es el
  // diferenciador que parece — hay que decirlo, no forzar "casi todo amoblamiento".
  const amoblamientoLoAbsorbe = !usaAmoblamiento && deltaSimetrico < x.costoAmoblamiento * 0.6;
  const kpiVal = usaAmoblamiento ? x.costoAmoblamiento : deltaSimetrico;
  return {
    id: "capital",
    kicker: "CAPITAL DE ENTRADA",
    // C5: titular AFIRMA la conclusión decisional (el capital decide o no decide, con el número).
    titular: usaAmoblamiento
      ? `Con Airbnb inmovilizas ${money(x.costoAmoblamiento, c, uf)} más de entrada, en amoblar`
      : amoblamientoLoAbsorbe
        ? `El capital no es lo que decide acá: ${money(Math.abs(deltaSimetrico), c, uf)} de diferencia sobre ${money(x.strCapitalInvertido, c, uf)}`
        : `Empezar con Airbnb te pide ${money(Math.abs(deltaSimetrico), c, uf)} más de capital de entrada`,
    kpi: `+${money(kpiVal, c, uf)}`,
    kpiRed: false,
    ksub: usaAmoblamiento
      ? "MÁS DE ENTRADA · AMOBLAMIENTO QUE SOLO EL CORTO PIDE"
      : amoblamientoLoAbsorbe ? "DE DIFERENCIA · MENOS DEL 1% DEL CAPITAL" : "MÁS DE ENTRADA CON EL CORTO",
    cuerpo: usaAmoblamiento
      ? `Lo único que el corto pide de entrada y el largo no es el amoblamiento: ${money(x.costoAmoblamiento, c, uf)} que salen el día uno y recuperas recién si la operación estabiliza. Es una barrera de entrada, no de rentabilidad — con esa plata disponible, no cambia cuál conviene.`
      : amoblamientoLoAbsorbe
        ? `El corto pide ${money(x.strCapitalInvertido, c, uf)} de entrada y el largo ${money(x.ltrCapitalInicial, c, uf)}: solo ${money(Math.abs(deltaSimetrico), c, uf)} de diferencia. Parece que el amoblamiento (${money(x.costoAmoblamiento, c, uf)}) debería separarlos más, pero se compensa casi entero con la puesta a punto que el largo también necesita. El capital de entrada no es lo que decide entre las dos.`
        : `El corto pide ${money(x.strCapitalInvertido, c, uf)} de entrada y el largo ${money(x.ltrCapitalInicial, c, uf)}: ${money(Math.abs(deltaSimetrico), c, uf)} más, casi todo amoblamiento (${money(x.costoAmoblamiento, c, uf)}). Es capital inmovilizado antes del primer peso de renta — una barrera de entrada que decides si puedes cruzar, no algo que cambie la rentabilidad.`,
    lado: amoblamientoLoAbsorbe ? "neutro" : "ltr",
    decisividad: amoblamientoLoAbsorbe ? 0.3 : 0.5,
    procedencia: usaAmoblamiento
      ? "Amoblamiento declarado del corto (diferencial limpio; el capital total de renta larga no es comparable aún)"
      : "Capital inicial total de cada modalidad (pie + gastos de cierre + puesta a punto / amoblamiento)",
    puente: {
      titulo: "De dónde sale el capital de entrada de cada una",
      lead: usaAmoblamiento
        ? `El capital de entrada es la plata que inmovilizas el día uno, antes del primer peso de renta. El corto suma un ítem que el largo no tiene —el amoblamiento—, y ese es el diferencial limpio:`
        : `El capital de entrada es la plata que inmovilizas el día uno: pie + gastos de cierre + puesta a punto. Las dos modalidades lo piden; comparadas lado a lado:`,
      filas: usaAmoblamiento
        ? [{ label: "Amoblamiento (solo lo pide el corto)", str: money(x.costoAmoblamiento, c, uf) }]
        : [
            { label: "Capital inicial total (pie + cierre + habilitación)", ltr: money(x.ltrCapitalInicial, c, uf), str: money(x.strCapitalInvertido, c, uf), delta: signed(deltaSimetrico, c, uf) },
            { label: "Del cual amoblamiento (corto)", str: money(x.costoAmoblamiento, c, uf) },
          ],
      nota: usaAmoblamiento
        ? "Mostramos solo el amoblamiento porque el capital total de renta larga (pie + cierre) todavía no se calcula de forma comparable con el del corto."
        : `Las dos incluyen pie + cierre + puesta a punto. El corto suma amoblamiento (${money(x.costoAmoblamiento, c, uf)}); el largo suma su propia habilitación — por eso el neto entre ambas queda en ${money(Math.abs(deltaSimetrico), c, uf)}, mucho menos que el amoblamiento solo.`,
      links: [{ label: "Ver la inversión inicial del corto", hijo: "str", seccion: "capital" }],
    },
    valor: { amoblamiento: Math.round(x.costoAmoblamiento), deltaSimetrico: Math.round(deltaSimetrico), usaAmoblamiento, amoblamientoLoAbsorbe },
  };
}

function recoToLado(reco: string): FindingLado {
  if (reco === "LTR_PREFERIDO") return "ltr";
  if (reco === "STR_VENTAJA_CLARA") return "str";
  return "neutro";
}

// ── Composición con orden dinámico por banda ─────────────────────────────────
export function buildFindingsComparativa(x: FindingsCtx, c: Currency, uf: number): FindingComparativa[] {
  const flujo = buildFlujo(x, c, uf);
  const gestion = buildGestion(x, c, uf);
  const patrimonio = buildPatrimonio(x, c, uf);
  const breakeven = buildBreakEven(x, c, uf);
  const capital = x.costoAmoblamiento > 0 ? buildCapital(x, c, uf) : null;         // condicional
  const regulatorio = x.edificioPermiteAirbnb !== "si" ? buildRegulatorio(x) : null; // default APARECE (no confirmado incluye no preguntado)

  // Orden base (por decisividad); patrimonio SIEMPRE cierra; condicionales al medio.
  const medio = [regulatorio, capital].filter(Boolean) as FindingComparativa[];
  const cabeza: FindingComparativa[] = x.banda === "STR_FRAGIL"
    ? [breakeven, flujo, gestion]   // frágil → break-even lidera
    : [flujo, breakeven, gestion];  // resto → flujo lidera
  return [...cabeza, ...medio, patrimonio];
}
