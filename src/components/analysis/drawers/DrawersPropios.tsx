"use client";

import { introModalVias } from "@/lib/palancas-en-palabras";
import { DIST_PIE_TOPE_PCT } from "@/lib/distancia-veredicto-hallazgo";

// Drawers propios (rama drawers-propios · F2) — plantillas DETERMINÍSTICAS motor-templated.
// Cero prosa IA, cero prompt, cero regen: cada cifra deriva de results/exit/projections/
// metrics + hallazgo.valor persistidos. El contrato visual es mockup-drawers-propios.html
// (⛔#1, los 3 reescritos aprobados). Sirve LTR (FullAnalysisResult) y STR (ShortTermResult):
// las plantillas de presentación son puras (reciben cifras ya derivadas); la derivación
// campo→fuente vive en el caller por modalidad (of-drawers-propios-f1.md).
//
// Primitivas de presentación (espejo del mockup): Lead · Chips/Cell · Decomp · Box · Chain · Note.

import type { ReactNode } from "react";
import type { NivelPie } from "@/lib/analysis";
import { EscaleraPie, nivelActualValidado } from "@/components/analysis/hallazgos/escalera-pie";
import { EstructuraComparada } from "@/components/analysis/hallazgos/estructura-comparada";
import type {
  FullAnalysisResult,
  HallazgoTIR,
  HallazgoSensibilidad,
  HallazgoDistanciaVeredicto,
  HallazgoPatrimonio,
  HallazgoPlusvalia,
  HallazgoSobreprecio,
  HallazgoEstructuraFinanciamiento,
  HallazgoEstructuraCostosStr,
  PalancaDistancia,
  ViaDistancia,
} from "@/lib/types";
import type { ShortTermResult } from "@/lib/engines/short-term-engine";
import { fuenteHistoricaPlusvalia } from "@/lib/plusvalia-procedencia";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  VProsa,
  VViz,
  VCierre,
  VFuente,
  Thermo,
  Fall,
  type FallRow,
  CmpPares,
  Palancas,
  type FilaPalanca,
  Dial,
  type ZonaDial,
  type BordeDial,
  Bars,
  Cien,
  ParBarras,
} from "@/components/analysis/hallazgos/vocabulario";


// ── Formato (coma decimal chilena, UTF-8 directo) ──────────────────────────────
type Currency = "CLP" | "UF";
// dec1 normaliza el guion ASCII de toFixed al − tipográfico (HUECO-3b): mismo trato
// de signo que el resto de los helpers.
const dec1 = (n: number) => n.toFixed(1).replace(".", ",").replace("-", "−");
const pctStr = (n: number) => dec1(n) + "%";
// Multiplicador a 2 decimales RECORTADOS — misma precisión que card (findingDisplay),
// hero y la prosa (exit.multiplicadorCapital a 2 dec). Familia 7 del censo: antes el
// drawer decía ×1,5 mientras la card decía ×1,45. El gate anti-no-op de los stress
// sigue comparando a 1 decimal (round1) — solo cambia el display.
const multStr = (n: number) =>
  "×" + n.toFixed(2).replace(/0$/, "").replace(/\.$/, "").replace(".", ",").replace("-", "−");
const round1 = (n: number) => Math.round(n * 10) / 10;

// ── GRUPO A · clasificar SOBRE LO MOSTRADO (una regla, un lugar) ────────────────
// pts: redondea a 1 decimal PRIMERO; el signo y el tono salen de ese redondeado, nunca
// del crudo. Lo consumen los dos márgenes de TIR (STR y LTR) — muere el tono hardcoded.
function ptsClass(n: number): { display: string; tone: "pos" | "red" | "plain" } {
  const r = round1(n);
  if (r > 0) return { display: "+" + dec1(r) + " pts", tone: "pos" };
  if (r < 0) return { display: dec1(r) + " pts", tone: "red" }; // dec1(r) ya trae el − tipográfico
  return { display: "0,0 pts", tone: "plain" };
}
// Comparación inline entre dos cifras QUE SE MUESTRAN: la palabra sale de la aritmética
// sobre lo mostrado (ambas a 1 decimal). mayor→"sobre" · igual→"en" · menor→"bajo".
// (hallazgo.direccion manda en clasificaciones de fondo, no en estas comparaciones visibles.)
function cmpMostrado(a: number, b: number): "sobre" | "en" | "bajo" {
  const ra = round1(a);
  const rb = round1(b);
  return ra > rb ? "sobre" : ra < rb ? "bajo" : "en";
}
// (consecuenciaMultEquity murió con la conversión de plusvalía: era el único consumidor
// y traducía un MULTIPLICADOR a palabras. Los dos cierres ahora hablan en pesos contra
// lo aportado — la misma vara que dibujan las barras —, así que la traducción sobra.)

// Monto completo respetando toggle CLP/UF.
function fmtMoney(n: number, currency: Currency, valorUF: number): string {
  const abs = Math.abs(n);
  if (currency === "UF") {
    const uf = abs / (valorUF || 1);
    if (uf >= 100) return "UF " + Math.round(uf).toLocaleString("es-CL");
    return "UF " + dec1(Math.round(uf * 10) / 10);
  }
  return "$" + Math.round(abs).toLocaleString("es-CL");
}

// Monto abreviado para barras/decomp ($48,4M · UF 1,2K).
function fmtCompact(n: number, currency: Currency, valorUF: number): string {
  const abs = Math.abs(n);
  if (currency === "UF") {
    const uf = abs / (valorUF || 1);
    if (uf >= 1000) return "UF " + dec1(uf / 1000) + "K";
    return "UF " + Math.round(uf).toLocaleString("es-CL");
  }
  const M = abs / 1_000_000;
  if (M >= 100) return "$" + Math.round(M) + "M";
  if (M >= 1) return "$" + dec1(M) + "M";
  if (abs >= 1000) return "$" + Math.round(abs / 1000) + "K";
  return "$" + Math.round(abs).toLocaleString("es-CL");
}
const signCompact = (n: number, currency: Currency, valorUF: number) =>
  (n < 0 ? "−" : "+") + fmtCompact(n, currency, valorUF);
// Monto completo con SIGNO explícito (− tipográfico / + ) — para valores de flujo en prosa
// que pueden ser negativos (FIX-2). Cuando la frase NO declara dirección, la cifra la lleva.
const fmtMoneySigned = (n: number, currency: Currency, valorUF: number) =>
  (n < 0 ? "−" : "+") + fmtMoney(n, currency, valorUF);

// ── Primitivas de presentación ─────────────────────────────────────────────────
// FASE 4: estas primitivas YA NO dibujan lo suyo — rinden el VOCABULARIO ÚNICO
// (vocabulario.tsx). Mantienen su firma a propósito: así los 12 cuerpos de
// drawer que las usan migran al vocabulario sin tocar una línea de su lógica,
// y los dos vocabularios que convivían (Chips/DataRow · Box/CajaFranco ·
// Lead/NarrativeIA) colapsan en uno solo. Ver mockup v12 CONGELADO.

export function Lead({ children }: { children: ReactNode }) {
  return <VProsa>{children}</VProsa>;
}

// Término con traducción pegada (jerga → paréntesis con glosa + tooltip).
export function Jerga({ term, gloss, tip }: { term: string; gloss: string; tip: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>
        {term} <span style={{ color: "var(--doc-tx3)" }}>({gloss})</span>
      </span>
      <InfoTooltip content={tip} />
    </span>
  );
}

type Cell = { k: string; v: string; tone?: "pos" | "red" | "plain"; small?: string };

/** Grid de KPIs — pasa a ser un BLOQUE VISUAL del vocabulario (VViz). */
export function Chips({ label, cells, foot }: { label: string; cells: Cell[]; foot?: ReactNode }) {
  const cols = cells.length === 2 ? "repeat(2,1fr)" : "repeat(3,1fr)";
  const toneColor = (t?: Cell["tone"]) =>
    t === "red" ? "var(--signal-red)" : t === "pos" ? "var(--doc-good)" : "var(--doc-tx)";
  return (
    <VViz t={label}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
        {cells.map((c) => (
          <div key={c.k}>
            <p
              className="font-mono uppercase m-0"
              style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--doc-tx4)", marginBottom: 4 }}
            >
              {c.k}
            </p>
            <p className="font-mono font-bold m-0" style={{ fontSize: 20, lineHeight: 1.05, color: toneColor(c.tone) }}>
              {c.v}
              {c.small && <span style={{ fontSize: 13, fontWeight: 500 }}> {c.small}</span>}
            </p>
          </div>
        ))}
      </div>
      {foot && (
        <p className="font-body m-0" style={{ fontSize: 11.5, color: "var(--doc-tx3)", marginTop: 12, lineHeight: 1.5 }}>
          {foot}
        </p>
      )}
    </VViz>
  );
}

type DecompRow = { label: string; value: string; widthPct: number; tone: "strong" | "mid" | "weak" | "red" };

/** Descomposición — pasa a la primitiva WATERFALL (Fall) dentro de un VViz. */
export function Decomp({ rows, net }: { rows: DecompRow[]; net?: { label: string; value: string } }) {
  const tono = (t: DecompRow["tone"]): FallRow["tone"] =>
    t === "red" ? "red" : t === "strong" ? "neutral" : t === "mid" ? "warn" : "muted";
  return (
    <VViz t="De dónde sale cada parte">
      <Fall
        rows={rows.map((r) => ({ k: r.label, v: r.value, pct: Math.max(0, r.widthPct), tone: tono(r.tone) }))}
        total={net ? { k: net.label, v: net.value } : undefined}
      />
    </VViz>
  );
}

/** Pie de diagrama (FASE 4.1) — el texto que DESCRIBE el gráfico de arriba deja de ser
 *  una caja de cierre y pasa a colgar del diagrama, que es lo que explica. Nace de los
 *  dos Box de 80/78 palabras de tir/retorno, que narraban en prosa el mismo waterfall
 *  dibujado cinco líneas antes. */
export function VizPie({ children }: { children: ReactNode }) {
  return <div className="viz-pie">{children}</div>;
}

/**
 * Caja de cierre — CIERRE ÚNICO del vocabulario. Cuando un cuerpo heredado apila
 * varios cierres, el CSS del acordeón degrada los previos y deja el último como
 * la caja: el cierre es uno.
 *
 * CORRECCIÓN 7 (FASE 4.1) — antes esto mapeaba por LABEL: un `Box` cuyo título
 * empezara con "De dónde sale" se renderizaba como `VFuente`. El criterio era
 * adivinatorio y se equivocaba en los tres únicos casos que lo activaban
 * (plusvalía LTR ~106 palabras, plusvalía STR ~93, precio STR ~46): ninguno es
 * una línea de procedencia, así que quedaban párrafos largos pintados de nota al
 * pie. Con el regex muerto, `Box` es SIEMPRE cierre y `VFuente` se usa donde se
 * declara de verdad — `Note` y las dos `procedenciaExtendida()` de capex y
 * capRate, que sí son líneas.
 */
export function Box({
  label,
  tone = "neutral",
  big,
  children,
}: {
  label: string;
  tone?: "neutral" | "red";
  big?: string;
  children: ReactNode;
}) {
  return (
    <VCierre titulo={label}>
      {big && (
        <span
          className="font-mono font-bold"
          style={{ fontSize: 20, color: tone === "red" ? "var(--signal-red)" : "var(--doc-tx)", fontStyle: "normal", marginRight: 8 }}
        >
          {big}
        </span>
      )}
      {children}
    </VCierre>
  );
}

/** Cadena causal (Financiamiento STR) — bloque visual del vocabulario.
 *  `foot`: el dato que NO está en los pasos cuelga del diagrama (propuesta-13-11);
 *  narrar la cadena en un párrafo aparte era la duplicación que la conversión mató. */
export function Chain({ steps, foot }: { steps: Array<{ v: string; k: ReactNode; pos?: boolean }>; foot?: ReactNode }) {
  return (
    <VViz t="La palanca, paso a paso">
      <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div
              style={{
                flex: 1,
                minWidth: 96,
                background: "var(--doc-paper2)",
                border: "1px solid var(--doc-line)",
                borderRadius: 3,
                padding: "10px 12px",
              }}
            >
              <p
                className="font-mono font-bold m-0"
                style={{ fontSize: 17, lineHeight: 1.1, color: s.pos ? "var(--doc-good)" : "var(--doc-tx)" }}
              >
                {s.v}
              </p>
              <p className="font-body m-0" style={{ fontSize: 11, color: "var(--doc-tx3)", marginTop: 3 }}>
                {s.k}
              </p>
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="font-mono"
                style={{ alignSelf: "center", color: "var(--doc-tx4)", fontSize: 13 }}
              >
                →
              </span>
            )}
          </div>
        ))}
      </div>
      {foot && (
        <p
          className="font-mono m-0"
          style={{ fontSize: 10.5, letterSpacing: "0.03em", color: "var(--doc-tx2)", marginTop: 11, lineHeight: 1.5 }}
        >
          {foot}
        </p>
      )}
    </VViz>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <VFuente>{children}</VFuente>;
}

// Fallback breve cuando falta el dato crítico de un cuerpo (GRUPO B) — patrón STR-TIR
// extendido a todos: mejor una constatación honesta que ceros o cifras falsas.
function SinDatos({ children }: { children: ReactNode }) {
  return (
    <p className="font-body" style={{ fontSize: 14, lineHeight: 1.65, color: "var(--franco-text-secondary)" }}>
      {children}
    </p>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LTR — 4 drawers propios (tir · sensibilidad · patrimonio · plusvalía)
// ════════════════════════════════════════════════════════════════════════════


// 2 · SENSIBILIDAD LTR — "cuánto aguanta tu veredicto" (KPI en positivo, capas separadas)
// ═══════════ MATRIZ DE PALANCAS (FASE 4.1) ═══════════
// Compartida por distanciaVeredicto LTR y STR.
//
// LO QUE EL MOTOR PERSISTE — y lo que por lo tanto se puede dibujar: `palancas` trae
// SOLO las que cruzan dentro del tope de honestidad. Las que se probaron y NO alcanzan
// no guardan su delta, así que se nombran sin magnitud en el pie de la matriz. En la
// rama estructural `palancas` viene vacío y el único número real es
// `deltaMinimoFueraDeTope`: una fila, marcada como que no alcanza.
// (Persistir el delta de las que no cruzan es cambio de motor y tiene su propio goal.)

/** Escala de un par comparado: el mayor ocupa el 100% y el otro queda proporcional, así
 *  la diferencia se lee en el escalón entre los dos bordes derechos. Con valores no
 *  positivos devuelve 0 (no se dibuja una barra sobre una base inválida). */
function escalaPar(valor: number, contra: number): number {
  const max = Math.max(valor, contra);
  return max > 0 ? (valor / max) * 100 : 0;
}

/** Techo de plausibilidad del cost-stack STR (% del bruto). Sobre esto el dato es de
 *  escala corrupta —el parque tiene un caso de 16.176%— y la barra de $100 no se dibuja:
 *  darle forma de medición a un número roto es peor que no mostrarlo. Entre 100 y este
 *  techo sí se dibuja, cortada en 100 y con marca de desborde. */
const TECHO_COSTSTACK = 150;

const NOMBRE_PALANCA: Record<string, string> = {
  arriendo: "Arriendo mensual",
  adr: "Tarifa por noche",
  precio: "Precio de compra",
  plazo: "Plazo del crédito",
  pie: "Pie",
  gestion: "Modo de gestión",
};

// Catálogo DETERMINISTA de razones — mismo criterio que los captions de cifraClave:
// lo escribe el motor, nunca la IA.
const RAZON_NO_ALCANZA: Record<string, string> = {
  precio: "ese descuento no existe en el mercado",
  arriendo: "ningún arriendo de la zona llega a ese nivel",
  adr: "esa tarifa está sobre lo que paga el mercado",
  plazo: "es el máximo del mercado y no basta",
  pie: "aun poniendo más pie no cierra la brecha",
  gestion: "ahorra, pero no cierra la brecha",
};

function textoPalanca(p: PalancaDistancia, currency: Currency, valorUF: number) {
  const money = (n: number) => fmtMoney(n, currency, valorUF);
  switch (p.palanca) {
    case "plazo":
      return { origen: `${Math.round(p.actual)} años`, destino: `${Math.round(p.objetivo)} años`, delta: `+${Math.round(p.deltaAbs)} años` };
    case "pie":
      // `deltaPct` en PUNTOS porcentuales (documentado en el tipo), no cambio relativo.
      return { origen: `${pctStr(p.actual)}`, destino: `${pctStr(p.objetivo)}`, delta: `+${pctStr(Math.abs(p.deltaPct))} pts` };
    case "gestion":
      return {
        origen: p.modoGestionObjetivo === "auto" ? "Administrador" : "Autogestión",
        destino: p.modoGestionObjetivo === "auto" ? "autogestión" : "administrador",
        delta: `−${pctStr(Math.abs(p.deltaPct))} comisión`,
      };
    case "precio":
      // El precio viaja en UF; se muestra en la moneda activa.
      return {
        origen: money(p.actual * valorUF),
        destino: money(p.objetivo * valorUF),
        delta: `−${pctStr(Math.abs(p.deltaPct))}`,
      };
    default:
      return { origen: money(p.actual), destino: money(p.objetivo), delta: `+${pctStr(Math.abs(p.deltaPct))}` };
  }
}

/** Tope explorado de una vía que no cruza, en la unidad de la palanca. */
function textoTope(via: Extract<ViaDistancia, { estado: "noCruza" }>): string {
  switch (via.palanca) {
    case "plazo":
      return `hasta ${via.topeExplorado} años`;
    case "pie":
      return `hasta ${via.topeExplorado}%`;
    case "precio":
      return `hasta −${via.topeExplorado}%`;
    case "gestion":
      // La vía probó el OTRO modo: el chip nombra el modo, no un porcentaje.
      return /autogesti/i.test(via.razon) ? "autogestión" : "con administrador";
    default:
      return `hasta +${via.topeExplorado}%`;
  }
}

function construirPalancas(
  v: HallazgoDistanciaVeredicto["valor"],
  currency: Currency,
  valorUF: number,
  esStr: boolean,
): { filas: FilaPalanca[]; noProbadas: string[] } {
  const filas: FilaPalanca[] = [];
  // ── GOAL "cuatro palancas siempre" (02-sep-2026): con `vias` la matriz trae las
  // cuatro filas en el mismo orden siempre — las que cruzan arriba (orden de
  // `palancas`: pie primero, luego por |delta|), después las que no cruzan con el
  // tope explorado y su razón de catálogo, y al final las que no aplican. Sin cifra
  // de "cuánto faltaría" salvo la que el motor emite (`deltaMinimoPct`, estructural).
  if (v.vias && v.vias.length > 0) {
    const razonAlcanza = v.palancas.length === 1 ? "la única que alcanza" : "alcanza por sí sola";
    const RAZON_ALCANZA_PIE = "no depende del vendedor, depende de tu liquidez";
    for (const p of v.palancas) {
      const t = textoPalanca(p, currency, valorUF);
      filas.push({
        nombre: NOMBRE_PALANCA[p.palanca] ?? p.palanca,
        delta: t.delta,
        alcanza: true,
        origen: t.origen,
        destino: t.destino,
        razon: p.palanca === "pie" ? RAZON_ALCANZA_PIE : razonAlcanza,
        wash: "warn",
      });
    }
    for (const via of v.vias.filter((x): x is Extract<ViaDistancia, { estado: "noCruza" }> => x.estado === "noCruza")) {
      const dm = via.deltaMinimoPct;
      // Las palancas de NIVEL (pie, plazo) muestran el tramo explorado en la misma
      // posición donde el precio muestra "$… → $…" (editorial de Fabrizio, 02-sep).
      const tramo =
        via.palanca === "pie"
          ? { origen: `${Number.isInteger(via.actual) ? via.actual : pctStr(via.actual).replace("%", "")}%`, destino: `${via.topeExplorado}%` }
          : via.palanca === "plazo"
            ? { origen: `${Math.round(via.actual)} años`, destino: `${via.topeExplorado} años` }
            : {};
      filas.push({
        nombre: NOMBRE_PALANCA[via.palanca] ?? via.palanca,
        delta: dm != null ? `${dm < 0 ? "−" : "+"}${pctStr(Math.abs(dm))}` : textoTope(via),
        alcanza: false,
        ...tramo,
        razon: dm != null ? `lo mínimo que cruza, y queda fuera de lo razonable (probado ${textoTope(via)})` : via.razon,
        atenuada: true,
      });
    }
    for (const via of v.vias.filter((x): x is Extract<ViaDistancia, { estado: "noAplica" }> => x.estado === "noAplica")) {
      filas.push({
        nombre: NOMBRE_PALANCA[via.palanca] ?? via.palanca,
        delta: "no aplica",
        alcanza: false,
        razon: via.razon,
        atenuada: true,
        noAplica: true,
      });
    }
    return { filas, noProbadas: [] };
  }
  if (v.esEstructural) {
    const d = v.deltaMinimoFueraDeTope;
    // Sin delta mínimo (5 filas del parque) NO hay matriz: el caller cae a prosa.
    if (d) {
      filas.push({
        nombre: NOMBRE_PALANCA[d.palanca] ?? d.palanca,
        delta: `${d.deltaPct < 0 ? "−" : "+"}${pctStr(Math.abs(d.deltaPct))}`,
        alcanza: false,
        razon: RAZON_NO_ALCANZA[d.palanca] ?? "queda fuera de lo razonable",
      });
    }
    return { filas, noProbadas: [] };
  }
  // D-01(a) — razón corta de CATÁLOGO también para las que alcanzan (el mockup la
  // trae: "· la única que alcanza"). Con varias, el porqué es que cada una basta sola.
  const razonAlcanza = v.palancas.length === 1 ? "la única que alcanza" : "alcanza por sí sola";
  // GOAL 2 · el PIE que cruza lleva razón PROPIA, no la genérica. Las otras
  // palancas dependen de un tercero —que el vendedor baje, que el arrendatario
  // pague más, que el banco estire— y el pie no: depende de cuánta plata puede
  // poner el comprador. Esa diferencia es la que decide si la vía es accionable
  // hoy o es una espera, y la genérica ("alcanza por sí sola") no la dice.
  const RAZON_ALCANZA_PIE = "no depende del vendedor, depende de tu liquidez";
  for (const p of v.palancas) {
    const t = textoPalanca(p, currency, valorUF);
    // Degradado aprobado (propuesta-01-v2): la fila que alcanza lleva lavado ámbar.
    filas.push({
      nombre: NOMBRE_PALANCA[p.palanca] ?? p.palanca,
      delta: t.delta,
      alcanza: true,
      origen: t.origen,
      destino: t.destino,
      razon: p.palanca === "pie" ? RAZON_ALCANZA_PIE : razonAlcanza,
      wash: "warn",
    });
  }
  const universo = esStr ? ["adr", "precio", "plazo", "gestion"] : ["arriendo", "precio", "plazo"];
  if (v.pieEsPalanca) universo.push("pie");
  const cruzaron = new Set(v.palancas.map((p) => p.palanca));
  // GOAL 2 · el pie que NO cruza dice HASTA DÓNDE se probó. Sin el tope, la línea
  // decía "probamos también el pie" y el lector no sabía con qué límite: nada en
  // pantalla contradecía a una prosa que pidiera un pie mayor. Fue el hueco por el
  // que se coló "mientras no subas el pie a 30%" en un caso donde el motor había
  // escrito, en el mismo objeto, "subir el pie hasta 30% tampoco lo cruza".
  const noProbadas = universo
    .filter((p) => !cruzaron.has(p as PalancaDistancia["palanca"]))
    .map((p) => {
      const nombre = (NOMBRE_PALANCA[p] ?? p).toLowerCase();
      // OJO: el tope del PIE **no** es `v.topePct`. Ese es el de las palancas
      // genéricas (precio/arriendo/plazo) y vale 15 o 30 según el salto de banda;
      // el pie tiene el suyo, ABSOLUTO y siempre 30, porque el pie es un NIVEL y no
      // un cambio porcentual. Usar `topePct` imprimía "pie hasta 15%" en filas donde
      // el motor había probado hasta 30 — se cazó midiendo la métrica del goal:
      // una prosa citó bien el 30 y el instrumento la marcó como inventada, los dos
      // comparando contra el campo equivocado.
      return p === "pie" ? `${nombre} hasta ${DIST_PIE_TOPE_PCT}%` : nombre;
    });
  return { filas, noProbadas };
}

/** Derivación del dial de sensibilidad — compartida por el drawer y el capítulo I
 *  (T3): eje, zonas, bordes y colchón salen de acá, una sola vez. */
function derivarSensibilidad(hallazgo: HallazgoSensibilidad, results: FullAnalysisResult, currency: Currency, valorUF: number) {
  const v = hallazgo.valor;
  const arriendo = results.metrics?.ingresoMensual ?? 0;
  const margenFrac = v.marginPct / 100;
  const colchon = arriendo * margenFrac;
  const piso = arriendo * (1 - margenFrac);
  const base = v.veredictoBase;
  // CORRECCIÓN 7 (FASE 4.1) — sin veredicto de destino (firme) no hay corte ni se inventa.
  const nuevo = v.veredictoNuevo;
  const arriendoStr = fmtMoney(arriendo, currency, valorUF);
  const pisoStr = fmtMoney(piso, currency, valorUF);
  const colchonStr = fmtMoney(colchon, currency, valorUF);
  // GRUPO A — clasifica sobre marginPct redondeado a 1 decimal contra el corte del motor.
  const amplio = round1(v.marginPct) >= v.corteFavorable;

  // ── BORDE DE ARRIBA ── solo es un punto DEL MISMO EJE cuando la palanca más barata
  // es el arriendo. Si lo más barato es bajar el precio o estirar el plazo, ese borde
  // existe pero vive en otro eje: se nombra en prosa y NO se dibuja en el dial.
  const dist = results.hallazgos?.find(
    (h): h is HallazgoDistanciaVeredicto => h.id === "distancia_veredicto",
  );
  const palancaArriba = dist && !dist.valor.esEstructural ? dist.valor.palancaMasBarata : null;
  const objetivoArriba =
    palancaArriba && dist ? (dist.valor.veredictoObjetivo === "COMPRAR" ? "COMPRAR" : "AJUSTA SUPUESTOS") : null;
  const arribaEsArriendo = palancaArriba?.palanca === "arriendo" && (palancaArriba.objetivo ?? 0) > 0;
  const arribaX = arribaEsArriendo ? (palancaArriba!.objetivo as number) : null;

  // ── EJE DEL DIAL ── arriendo mensual, extremos con 8% de aire.
  const puntos = [arriendo, piso, ...(arribaX ? [arribaX] : [])];
  const ejeMin = Math.min(...puntos) * 0.92;
  const ejeMax = Math.max(...puntos) * 1.08;
  const pos = (x: number) => ((x - ejeMin) / (ejeMax - ejeMin)) * 100;

  const tonoDe = (ver: string): "buscar" | "ajusta" | "comprar" =>
    ver === "BUSCAR OTRA" ? "buscar" : ver === "COMPRAR" ? "comprar" : "ajusta";
  const zonas: ZonaDial[] = [];
  const bordes: BordeDial[] = [];
  if (v.firme || !nuevo) {
    zonas.push({ k: base, pct: 100, tono: tonoDe(base) });
  } else {
    zonas.push({ k: nuevo, pct: pos(piso), tono: tonoDe(nuevo) });
    const finBase = arribaX ? pos(arribaX) : 100;
    zonas.push({ k: base, pct: finBase - pos(piso), tono: tonoDe(base) });
    if (arribaX && objetivoArriba) zonas.push({ k: objetivoArriba, pct: 100 - finBase, tono: tonoDe(objetivoArriba) });
    // Formato único tira↔cuerpo (editorial T3): entero sin decimal, coma si no.
    const margenStr = Number.isInteger(round1(v.marginPct)) ? `${Math.round(v.marginPct)}%` : pctStr(v.marginPct);
    bordes.push({ pos: pos(piso), delta: `−${margenStr}`, v: pisoStr, k: `y cae a ${nuevo}`, dir: "abajo" });
    if (arribaX && objetivoArriba) {
      bordes.push({
        pos: pos(arribaX),
        delta: `+${pctStr(Math.abs(palancaArriba!.deltaPct))}`,
        v: fmtMoney(arribaX, currency, valorUF),
        k: `y sube a ${objetivoArriba}`,
        dir: "arriba",
      });
    }
  }
  return { v, arriendo, base, nuevo, arriendoStr, colchonStr, amplio, palancaArriba, objetivoArriba, arribaEsArriendo, arribaX, zonas, bordes, marcaPct: pos(arriendo) };
}

/** El Dial de sensibilidad con su colchón — la viz del drawer y del capítulo I. */
export function SensibilidadDial({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoSensibilidad;
  results: FullAnalysisResult;
  currency: Currency;
  valorUF: number;
}) {
  const d = derivarSensibilidad(hallazgo, results, currency, valorUF);
  if (!(d.arriendo > 0)) return null;
  return (
    <>
      <Dial zonas={d.zonas} marcaPct={d.marcaPct} marcaK="Declaraste" marcaV={d.arriendoStr} bordes={d.bordes} />
      {!d.v.firme && d.nuevo ? (
        <div className="compo-total">
          <span className="k">Colchón hasta el borde de abajo</span>
          <span className="v">
            {d.colchonStr}
            <small>/mes</small>
          </span>
        </div>
      ) : (
        <div className="compo-total">
          <span className="k">No hay borde dentro del rango probado</span>
          <span className="v">{d.base}</span>
        </div>
      )}
    </>
  );
}

export function DrawerSensibilidadLtr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoSensibilidad;
  results: FullAnalysisResult;
  currency: Currency;
  valorUF: number;
}) {
  const d = derivarSensibilidad(hallazgo, results, currency, valorUF);
  // GRUPO B — guard por dato crítico: sin arriendo declarado no hay piso/colchón que mostrar.
  if (!(d.arriendo > 0)) {
    return <SinDatos>Datos insuficientes para el margen del veredicto (falta el arriendo declarado).</SinDatos>;
  }
  const { v, base, nuevo, amplio, palancaArriba, objetivoArriba, arribaEsArriendo, arribaX } = d;

  return (
    <div>
      <VProsa>
        Bajamos el arriendo hasta que el veredicto se mueve: esto es lo que aguanta antes de cambiar
        {arribaX ? " — y lo que le falta para subir" : ""}.
      </VProsa>

      <VViz t="Tu veredicto según el arriendo mensual">
        <SensibilidadDial hallazgo={hallazgo} results={results} currency={currency} valorUF={valorUF} />
      </VViz>

      {/* El borde de arriba existe pero NO es un punto de este eje (la palanca más
          barata es el precio o el plazo, no el arriendo): se nombra, no se dibuja. */}
      {palancaArriba && objetivoArriba && !arribaEsArriendo && (
        <VProsa>
          Hacia arriba la vía no es el arriendo:{" "}
          {palancaArriba.palanca === "plazo"
            ? `estirar el crédito a ${palancaArriba.objetivo} años`
            : `un precio ${pctStr(Math.abs(palancaArriba.deltaPct))} menor`}{" "}
          bastaría para llegar a {objetivoArriba}. Esa palanca se mide en su propio hallazgo.
        </VProsa>
      )}

      {/* CIERRE ÚNICO — absorbe "Qué significa", "Qué haces con esto" y la lectura
          bidireccional que antes eran tres cajas: el dial ya muestra las posiciones,
          acá queda solo lo que el diagrama no puede decir. */}
      <VCierre titulo="Qué significa">
        {v.firme || !nuevo
          ? `El veredicto aguanta todo el rango que probamos: ni con el arriendo a la mitad cambia la conclusión. `
          : amplio
            ? `Es un colchón amplio: el arriendo tendría que caer ${pctStr(v.marginPct)} para que ${base} deje de tenerse en pie, así que no necesitas afinar ese número antes de decidir. `
            : `El colchón es acotado: basta que el arriendo caiga ${pctStr(v.marginPct)} para que ${base} deje de tenerse en pie, así que la decisión cuelga bastante de que el arriendo declarado sea exacto. `}
        {palancaArriba && objetivoArriba && Math.abs(palancaArriba.deltaPct) < round1(v.marginPct)
          ? "Estás más cerca del borde de arriba que del de abajo: la conclusión de hoy es la más pesimista de las dos que tienes a mano. "
          : ""}
        Igual conviene validarlo con 2–3 publicaciones comparables de la zona — no para salvar el veredicto,
        sino para saber con qué flujo real vas a vivir mes a mes.
      </VCierre>

      <Note>Motor Franco · reevaluación del veredicto sobre el arriendo</Note>
    </div>
  );
}

// 2b · DISTANCIA AL VEREDICTO LTR — "lo que te separa" (las vías, una por una)
// Espejo del drawer de sensibilidad: aquella responde "cuánto aguanta antes de bajar",
// esta "cuánto falta para subir". Las vías NO se suman — cada una cruza por su cuenta.
export function DrawerDistanciaLtr({
  hallazgo,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoDistanciaVeredicto;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const base = v.veredictoBase;
  const objetivo = v.veredictoObjetivo;
  const { filas, noProbadas } = construirPalancas(v, currency, valorUF, false);

  // ── ESTRUCTURAL SIN DELTA MÍNIMO (filas sin `vias`) ── no hay una sola magnitud
  // real que dibujar. La matriz no se inventa: queda la prosa.
  if (v.esEstructural && filas.length === 0) {
    return (
      <div>
        <VProsa>
          Tu veredicto es {base}. Probamos las vías una por una y ninguna llega a {objetivo}, ni
          llevándolas a extremos que ya no son negociación: arriendo al doble, precio a un tercio,
          crédito a 30 años.
        </VProsa>
        <VCierre titulo="Qué significa">
          <mark>La brecha no está en cómo estás mirando este depto — está en el depto.</mark> Ajustar
          supuestos sirve cuando el número está cerca; acá el esfuerzo que pide es de otro orden.
        </VCierre>
      </div>
    );
  }

  return (
    <div>
      <VProsa>
        {v.vias
          ? introModalVias(v.palancas.length, v.vias.length, objetivo)
          : v.esEstructural
            ? `Tu veredicto es ${base}. La pregunta honesta no es qué falta, sino si hay algo que alcance: probamos las palancas una por una, hasta donde dejan de ser un ajuste y pasan a ser otro departamento.`
            : `Tu veredicto es ${base} y está cerca del borde de arriba. Estas son las vías que lo cruzan a ${objetivo}, cada una por su cuenta: no se suman, cualquiera alcanza.`}
      </VProsa>

      {v.pieExcluidoPorBono && !v.vias && (
        <VProsa>
          El pie no aparece entre las vías porque lo cubre la inmobiliaria: subirlo no es una palanca, es
          deshacer el trato que estás evaluando. Con el pie cubierto, el precio se mira con más dureza,
          porque alguien está pagando ese bono.
        </VProsa>
      )}

      <VViz t={`Qué pediría cada palanca para llegar a ${objetivo}`}>
        <Palancas
          filas={filas}
          pie={
            v.vias
              ? undefined
              : v.esEstructural
                ? "Es la vía menos exigente de todas las que probamos, y aun así queda fuera de rango. Las demás piden más."
                : noProbadas.length > 0
                  ? `Probamos también ${noProbadas.join(", ")}: ninguna cruza dentro de lo razonable.`
                  : undefined
          }
        />
      </VViz>

      {/* CIERRE ÚNICO — el "qué haces con esto" por palanca dominante, que es la
          pregunta que queda cuando la matriz ya mostró los números. */}
      <VCierre titulo={v.esEstructural ? "Qué significa" : "Qué haces con esto"}>
        {v.esEstructural ? (
          <>
            <mark>La brecha no está en cómo estás mirando este depto — está en el depto.</mark> Ajustar
            supuestos sirve cuando el número está cerca; acá el esfuerzo que pide es de otro orden.{" "}
            {v.piePctActual === 0
              ? "Sigue buscando: con financiamiento 100% no tienes colchón para absorberlo."
              : "Guarda el pie para el siguiente."}{" "}
            Si igual quieres avanzar por razones que no son financieras, está bien saberlo — pero no te
            cuentes que los números dan.
          </>
        ) : v.palancas[0]?.palanca === "pie" ? (
          <><mark>Esta no se negocia con nadie: es plata tuya contra menos crédito.</mark> Antes de
          descartar el depto, confirma con el banco cuánto baja la cuota con ese pie y si tienes la
          liquidez sin quedarte sin colchón.</>
        ) : v.palancas[0]?.palanca === "precio" ? (
          <>Llévalo a la mesa: <mark>la diferencia está en rango de negociación, no en otro
          departamento</mark>. Si el vendedor no baja, ya sabes exactamente cuánto te separa.</>
        ) : (
          <>Antes de descartarlo, <mark>confirma ese techo de arriendo contra 2–3 publicaciones
          comparables de la zona</mark>. Si el mercado lo da, la decisión se toma sola.</>
        )}
      </VCierre>


      <Note>Motor Franco · palancas del veredicto, una a la vez</Note>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// PLUSVALÍA · las dos viz compartidas (LTR y STR son gemelos: misma forma, mismo
// dato, distinta derivación del aporte). Viven acá arriba para que no puedan
// divergir — misma razón que EscaleraPie y EstructuraComparada.
// ════════════════════════════════════════════════════════════════════════════

/**
 * VIZ 1 · el histórico de la comuna contra el benchmark real, en un EJE.
 *
 * Por qué eje y no dos barras (verificado contra el parque, 684 hallazgos):
 *  · El umbral es 3,0% en el 100% de los casos y la proyección Franco es
 *    también 3% (PLUSVALIA_REF_REAL vs PLUSVALIA_PROYECCION_ANUAL: conceptos
 *    distintos que HOY coinciden). Dibujar "proyección" y "umbral" como dos
 *    cosas sería dibujar dos veces la misma línea.
 *  · 163/684 (24%) tienen histórico NEGATIVO: una barra desde cero no puede
 *    representarlo.
 *  · 343/684 (50%) caen a ±0,35 pts del 3%: desde cero, 2,9 y 3,0 son la misma
 *    barra — es la regla de uso de `Bars` escrita en FASE 4.2.
 * El eje resuelve los tres: posición legible con diferencias de un dígito,
 * dominio que baja bajo cero, y UNA sola referencia.
 */
function PlusvaliaEje({
  anual,
  umbral,
  gapPts,
  tieneData,
  comunaLabel,
  cobertura,
  nivelUfM2,
  nivelPeriodo,
}: {
  anual: number;
  umbral: number;
  gapPts: number;
  tieneData: boolean;
  comunaLabel: string;
  cobertura?: string;
  nivelUfM2?: number;
  nivelPeriodo?: string;
}) {
  // Dominio: siempre incluye el cero y la referencia, con aire a los dos lados.
  const lo = Math.min(anual, 0) - 0.7;
  const hi = Math.max(anual, umbral) + 0.9;
  const pos = (x: number) => ((x - lo) / (hi - lo)) * 100;
  const negativo = round1(anual) < 0;
  const g = round1(gapPts);
  // GRUPO A — la palabra sale de la aritmética sobre lo MOSTRADO (ambas a 1 decimal),
  // no del crudo: con 2,96% vs 3,0% el eje dibuja "3,0 vs 3,0" y el texto debe
  // concordar con lo que el lector ve.
  const rel = cmpMostrado(anual, umbral);

  return (
    <VViz t="Lo que hizo tu comuna contra el benchmark de largo plazo">
      <Thermo
        invertido
        pct={pos(anual)}
        refPct={pos(umbral)}
        ceroPct={pos(0)}
        legend={[
          { k: tieneData ? comunaLabel : "referencia GS", v: pctStr(anual) },
          { k: "apreciación real (Chile)", v: pctStr(umbral) },
          { k: "brecha", v: `${g > 0 ? "+" : ""}${dec1(g)} pts` },
        ]}
      />
      <VizPie>
        Cifras en UF: ambas ya son reales, con la inflación descontada. El {pctStr(umbral)} es el
        benchmark histórico de largo plazo
        {negativo
          ? " — y tu comuna quedó bajo cero: no es que ganara menos que el mercado, es que perdió valor real."
          : rel === "bajo"
            ? " — bajo él, tu comuna igual ganó valor real, solo menos que el mercado."
            : rel === "en"
              ? " — y tu comuna se movió justo en esa línea."
              : " — y tu comuna lo superó: ganó valor real por sobre el promedio del mercado."}{" "}
        Franco proyecta ese mismo {pctStr(umbral)} hacia adelante: ni premia ni castiga a tu comuna
        por su historia.
        {!tieneData && (
          <>
            {" "}No hay histórico propio de {comunaLabel}: la marca es el promedio del Gran Santiago,
            un supuesto conservador sin dato comunal.
            {cobertura === "solo_nivel" && nivelUfM2 != null && (
              <>
                {" "}Sí sabemos a qué precio se vende hoy: UF {dec1(nivelUfM2)}/m² en departamentos
                nuevos ({nivelPeriodo}) — precio de hoy, no trayectoria.
              </>
            )}
          </>
        )}
      </VizPie>
    </VViz>
  );
}

/**
 * VIZ 2 · el retorno con y sin plusvalía, contra lo que pusiste — EN PESOS.
 *
 * Reemplaza el multiplicador abstracto (×1,5) por magnitudes comparables con algo
 * que el lector reconoce: su propio aporte. Acá las barras desde cero SÍ
 * corresponden — medido sobre el parque, patrimonio/aportado va de 0,75 a 29,3
 * con mediana 1,51 (órdenes visibles). En el 8% de los casos el ratio cae entre
 * 0,88 y 1,12 y las barras quedan casi iguales: ahí la lectura la carga el valor
 * impreso al costado, no el largo.
 */
function PlusvaliaRetorno({
  aportadoCLP,
  patrimonioCLP,
  plusvaliaProj,
  currency,
  valorUF,
}: {
  aportadoCLP: number;
  patrimonioCLP: number;
  plusvaliaProj: number;
  currency: Currency;
  valorUF: number;
}) {
  if (!(aportadoCLP > 0)) return null;
  const sinPlus = patrimonioCLP - plusvaliaProj;
  // Sin plusvalía proyectada (o con proyección nula), la tercera barra sería un
  // clon de la segunda: no se dibuja en vez de fingir un contrafáctico.
  const hayContrafactual = plusvaliaProj > 0;
  const techo = Math.max(aportadoCLP, patrimonioCLP, hayContrafactual ? sinPlus : 0);
  if (!(techo > 0)) return null;
  // Un contrafáctico NEGATIVO (sin la valorización proyectada terminas en rojo) es un
  // caso real del parque: la barra no puede bajar de cero, pero el VALOR sí dice la
  // verdad — clamparlo a "$0" lo disfrazaría de break-even.
  const money = (n: number) => (n < 0 ? "−" : "") + fmtCompact(Math.abs(n), currency, valorUF);
  const barra = (n: number) => (Math.max(n, 0) / techo) * 100;

  return (
    <VViz t="Tu parte a 10 años, contra lo que pusiste">
      <Bars
        rows={[
          { k: "Lo que pusiste", v: money(aportadoCLP), pct: barra(aportadoCLP), neg: aportadoCLP < 0 },
          // Sin `destacada`: el fill rojo era destaque de SERIE, y sobre una cifra de
          // patrimonio POSITIVA el Signal Red contradice la Capa 1 (rojo = negativo
          // crítico). El peso de la fila lo lleva el dato, no el color.
          {
            k: "Con la plusvalía proyectada",
            v: money(patrimonioCLP),
            pct: barra(patrimonioCLP),
            neg: patrimonioCLP < 0,
          },
          ...(hayContrafactual
            ? [{ k: "Si la comuna no se aprecia", v: money(sinPlus), pct: barra(sinPlus), neg: sinPlus < 0 }]
            : []),
        ]}
      />
    </VViz>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// STR — 6 drawers propios (financiamiento · precio · retorno · patrimonio ·
// plusvalía · estructura de costos). Reusan las primitivas; la derivación es
// STR-específica (ShortTermResult). Guard de exit (opcional en filas legacy).
// ════════════════════════════════════════════════════════════════════════════

// 5 · FINANCIAMIENTO STR — una sola cadena causal (pie → cuota → flujo)
export function DrawerFinanciamientoStr({
  hallazgo,
  results,
  currency,
  valorUF,
  nivelesPie = [],
}: {
  hallazgo: HallazgoEstructuraFinanciamiento;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
  // Escalera del pie STR: los niveles llegan YA CALCULADOS desde el servidor.
  // No se calculan acá porque el reconstructor del input (`buildStrRecomputeCtx`)
  // arrastra `analisis-pipeline`, que usa `next/headers` — importarlo desde un
  // componente cliente tira 500 y el tsc no lo ve. Además el recompute (4 ×
  // calcShortTerm) no tiene por qué correr en el teléfono del lector.
  nivelesPie?: NivelPie[];
}) {
  const v = hallazgo.valor;
  // GRUPO B — guard por dato crítico: sin crédito no hay cuota ni palanca del pie.
  if (!(results.montoCredito > 0)) {
    return <SinDatos>Datos insuficientes para el detalle de financiamiento (falta el monto del crédito).</SinDatos>;
  }
  const cuota = results.dividendoMensual;
  const flujo = results.escenarios?.base?.flujoCajaMensual ?? 0;

  // AUDITORÍA fase42 (punto 1) — acá moría la última constante 25 del componente:
  // la cadena calculaba a mano el salto "pie → 25%". Ahora el salto se DERIVA de los
  // niveles de la escalera (simularPieStr, calculados server-side y validados por la
  // guarda compartida del invariante): destino = primer nivel sobre el actual (+5).
  // Entre niveles lo único que cambia es la cuota, así que el ahorro de cuota ES la
  // diferencia de flujo — y la cadena y la fila +5 de la escalera muestran el mismo
  // delta POR CONSTRUCCIÓN, no por casualidad de dos aritméticas paralelas.
  const palanca = (() => {
    const actual = nivelActualValidado(nivelesPie, flujo);
    const destino = actual ? nivelesPie?.find((n) => n.piePct > actual.piePct) : undefined;
    if (!actual || !destino) return null;
    const ahorroCuota = Math.max(destino.flujoMensual - actual.flujoMensual, 0);
    return {
      actual,
      destino,
      extraPie: destino.pieCLP - actual.pieCLP,
      ahorroCuota,
      // FIX-5 — adjetivo → número: qué % de la sangría recorta el ahorro de cuota.
      recorte: actual.flujoMensual < 0 ? Math.round((ahorroCuota / Math.abs(actual.flujoMensual)) * 100) : 0,
    };
  })();
  const hayPalanca = palanca != null;

  return (
    <div>
      <Lead>
        Cómo armas el crédito define cuánta cuota cargas cada mes — y en una renta corta con flujo apretado, eso
        mueve la aguja. Tu pie y tu tasa hoy dejan {hayPalanca ? "un margen menor" : "poco espacio de mejora"}.
      </Lead>

      {/* AUDITORÍA fase42 D-13 — los KPIs pelados + la prosa que narraba el juicio
          de la tasa se reemplazan por la comparación DIBUJADA (propuesta-13-11):
          tasa contra el promedio de mercado con su chip; pie como barra propia,
          cuyo contexto lo da la escalera de abajo. */}
      <VViz t="Tu estructura contra la referencia">
        <EstructuraComparada
          piePct={v.piePct}
          tasaPct={v.tasaPct}
          tasaMarketPct={v.tasaMarketPct}
          cuotaFmt={fmtMoney(cuota, currency, valorUF)}
        />
      </VViz>

      {palanca ? (
        <>
          <div
            style={{
              borderLeft: "3px solid var(--franco-text-secondary)",
              background: "color-mix(in srgb, var(--franco-text) 4%, transparent)",
              borderRadius: "0 8px 8px 0",
              padding: "14px 16px",
              marginBottom: 14,
            }}
          >
            <p
              className="font-mono uppercase m-0"
              style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--franco-text-secondary)", marginBottom: 8 }}
            >
              La palanca real: el pie
            </p>
            {/* AUDITORÍA fase42 (7a) — murió el párrafo que narraba paso a paso la
                cadena dibujada cinco líneas más arriba (duplicación literal). Su único
                dato nuevo — el % de recorte a la sangría — cuelga del diagrama. */}
            <Chain
              steps={[
                { v: "+" + fmtCompact(palanca.extraPie, currency, valorUF), k: <>de pie hoy<br />({palanca.actual.piePct}% → {palanca.destino.piePct}%)</> },
                { v: "−" + fmtMoney(palanca.ahorroCuota, currency, valorUF), k: <>de cuota<br />al mes</> },
                { v: `${signCompact(palanca.actual.flujoMensual, currency, valorUF)} → ${signCompact(palanca.destino.flujoMensual, currency, valorUF)}`, k: <>tu flujo<br />mensual</>, pos: true },
              ]}
              foot={
                <>
                  {/* Misma guarda que la escalera (FASE 4.2): "se da vuelta" solo si
                      el mes VENÍA negativo — con flujo ya positivo esa frase miente. */}
                  <b style={{ color: "var(--doc-good)" }}>
                    {palanca.destino.flujoMensual < 0
                      ? `Le recorta ~${palanca.recorte}% a la sangría`
                      : palanca.actual.flujoMensual < 0
                        ? "Con esto el flujo se da vuelta"
                        : "El mes ya cierra a favor — con más pie queda aún más holgado"}
                  </b>{" "}
                  — y es lo único que no depende del mercado ni de la ocupación.
                </>
              }
            />
          </div>
      {/* ═══ CONVERSIÓN 13 (FASE 4.2) · ESCALERA DEL PIE ═══
          Espejo exacto del LTR: mismos niveles relativos, mismas dos columnas y el
          mismo invariante. La paridad no es cosmética — LTR con escalera y STR sin
          ella es justo la divergencia que el vocabulario único vino a eliminar. El
          recompute usa `calcShortTerm` sobre el input reconstruido por
          `buildStrRecomputeCtx`, que ya alimenta la bisección de distancia STR. */}
      <EscaleraPie
        niveles={nivelesPie}
        valorUF={valorUF}
        flujoPersistido={results.escenarios?.base?.flujoCajaMensual}
        currency={currency}
      />

          {/* AUDITORÍA fase42 D-pie10 — el cierre RAMIFICA por signo del flujo (la
              misma lección del copy de la escalera): con mes en verde, "el flujo
              negativo es un dato a asumir" contradecía el dato, y "mayor impacto y
              menor riesgo" tampoco aplica — ahí el trade-off se invierte: holgura a
              cambio de TIR. */}
          {palanca.actual.flujoMensual < 0 ? (
            <Box label="Qué haces con esto">
              Si tienes la liquidez para subir el pie, <mark>es el ajuste de mayor impacto y menor riesgo</mark>.
              Si no la tienes, el flujo negativo es un dato a asumir, no un error a esconder.
            </Box>
          ) : (
            <Box label="Qué haces con esto">
              El mes ya cierra a favor, así que subir el pie no rescata nada: <mark>compra holgura mensual a
              cambio de retorno</mark>
              {palanca.actual.tirPct != null && palanca.destino.tirPct != null
                ? ` — la TIR baja de ${pctStr(palanca.actual.tirPct)} a ${pctStr(palanca.destino.tirPct)}, la escalera lo muestra`
                : " — la escalera muestra el intercambio"}
              . Si valoras el colchón, es una opción; si buscas rendimiento por peso puesto, no la necesitas.
            </Box>
          )}
        </>
      ) : (
        <Box label="Qué haces con esto">
          El efecto de mover el pie no se pudo calcular nivel por nivel para este análisis, así que no lo
          mostramos a ciegas. Como regla: <mark>más pie baja la cuota y alivia el mes, pero rinde menos
          sobre tu plata</mark>; menos pie hace lo contrario. El resto del flujo se juega en la ocupación y
          la gestión.
        </Box>
      )}

      {/* T1 — línea de fuente al pie del cuerpo, posición única del v12. */}
      <Note>Tasa de referencia: promedio de mercado en UF · Motor Franco, actualización manual</Note>
    </div>
  );
}

// 6 · PRECIO / SOBREPRECIO STR — dos lentes (fusión)
export function DrawerPrecioStr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoSobreprecio;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const precioCLP = results.pie + results.montoCredito;
  // GRUPO B — guard: las dos lentes necesitan precio válido y UF/m² del sujeto (>0)
  // para derivar superficie y valor estimado; sin eso, todo cae a 0.
  if (!(v.sujetoUfM2 > 0) || !(precioCLP > 0)) {
    return <SinDatos>Datos insuficientes para el detalle de precio (falta el precio o el UF/m² del sujeto).</SinDatos>;
  }
  const precioUF = valorUF > 0 ? precioCLP / valorUF : 0;
  const superficie = v.sujetoUfM2 > 0 ? precioUF / v.sujetoUfM2 : 0;
  const valorEstimadoUF = v.medianaComunaUfM2 * superficie;
  const margenUF = valorEstimadoUF - precioUF;
  const margenCLP = margenUF * valorUF;
  const bajoMercado = v.desviacionPct < 0;
  const comuna = v.comuna || "la comuna";

  const fmtUF = (uf: number) => "UF " + Math.round(uf).toLocaleString("es-CL");

  return (
    <div>
      <VProsa>
        Dos maneras de mirar lo mismo: el metro cuadrado y el depto entero. Ambas apuntan al mismo lado.
      </VProsa>

      {/* CONVERSIÓN 12 — las dos lentes eran dos grupos de Chips que obligaban a
          reconstruir la comparación de cabeza. Apareadas contra su referencia, la
          diferencia se lee en el borde de la barra aunque sea de un dígito (ver la
          regla de uso de `Bars`: acá una barra desde cero no serviría). */}
      <VViz t="Tu precio contra la referencia de mercado">
        <CmpPares
          filas={[
            {
              k: "Por metro cuadrado",
              sub: `contra la mediana de ${comuna}`,
              tag:
                Math.abs(v.desviacionPct) <= 2
                  ? { texto: "a la par", tono: "par" }
                  : bajoMercado
                    ? { texto: `${pctStr(Math.abs(v.desviacionPct))} bajo`, tono: "ok" }
                    : { texto: `${pctStr(Math.abs(v.desviacionPct))} sobre`, tono: "flojo" },
              tuyo: { lbl: "tuyo", v: fmtUF(v.sujetoUfM2), pct: escalaPar(v.sujetoUfM2, v.medianaComunaUfM2) },
              ref: { lbl: "mediana", v: fmtUF(v.medianaComunaUfM2), pct: escalaPar(v.medianaComunaUfM2, v.sujetoUfM2) },
            },
            {
              k: "El depto entero",
              sub: "contra su valor estimado",
              tag:
                margenCLP >= 0
                  ? { texto: `${fmtCompact(margenCLP, currency, valorUF)} a favor`, tono: "ok" }
                  : { texto: `${fmtCompact(Math.abs(margenCLP), currency, valorUF)} de más`, tono: "flojo" },
              tuyo: { lbl: "tu precio", v: fmtUF(precioUF), pct: escalaPar(precioUF, valorEstimadoUF) },
              ref: { lbl: "estimado", v: fmtUF(valorEstimadoUF), pct: escalaPar(valorEstimadoUF, precioUF) },
            },
          ]}
          pie={`Sobre tus ${Math.round(superficie)} m² a mediana comunal, el mercado estimaría ~${fmtUF(valorEstimadoUF)}.`}
        />
      </VViz>

      <VCierre titulo="Tu palanca de negociación">
        {bajoMercado
          ? `Entrar bajo mercado ya te da una ventaja de compra de ~${fmtCompact(margenCLP, currency, valorUF)} el día uno — es parte de por qué tu patrimonio a 10 años cierra a favor pese al flujo negativo. No hay urgencia de bajar más el precio: la palanca de este deal está en el flujo (pie y gestión), no en el precio de entrada.`
          : `Pagas sobre la referencia de mercado, así que acá sí hay espacio para negociar: cada peso que bajes del precio entra directo a tu patrimonio y mejora el flujo — menos crédito, menos cuota.`}
      </VCierre>

      <Note>{v.n > 0 ? `Mediana de ${v.n} avisos de venta en ${comuna}` : `Mediana de publicaciones de venta en ${comuna}`} · avisos, no transacciones</Note>
    </div>
  );
}

// 7 · TIR / RETORNO STR — suma reconstruible + 10,3% ya descuenta la caja
export function DrawerTIRStr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoTIR;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const exit = results.exitScenario;
  // Multiplicador de ESTADO desde el hallazgo patrimonio (única fuente); sin él, el guard
  // decide. Desde F2: STR patrimonioCLP = EQUITY (equity/aportado → ×1 break-even), como LTR.
  const pat = results.hallazgos?.find((h): h is HallazgoPatrimonio => h.id === "patrimonio");
  if (!exit || !pat) return <SinDatos>Datos insuficientes para el detalle de retorno (aún no calculamos la venta a futuro de este análisis).</SinDatos>;

  const tirPct = v.tirPct;
  const umbral = v.umbralPct;
  const margenPts = tirPct - umbral;
  const margen = ptsClass(margenPts);
  const precioCLP = results.pie + results.montoCredito;
  const amort = Math.max(results.montoCredito - exit.saldoCreditoAlVender, 0);
  const flujo = exit.flujoAcumuladoAlVender; // puede ser negativo (drag)
  const plusvalia = Math.max(exit.valorVenta - precioCLP, 0);
  const brutoSinFlujo = plusvalia + amort;
  const bruto = brutoSinFlujo + flujo;

  // Estado desde el hallazgo; contrafáctico "sin la resta" derivado de la MISMA base cruda.
  const net = pat.valor.patrimonioCLP; // equity (STR, desde F2): lo que te queda al vender
  const aportado = pat.valor.aportadoCLP;
  const multActual = pat.valor.multiplicador;
  const netSinResta = net - flujo; // flujo<0 ⇒ suma |flujo|
  const multSinResta = aportado > 0 ? netSinResta / aportado : 0;
  const flujoResta = flujo < 0;

  const maxBar = Math.max(plusvalia, amort, Math.abs(flujo), 1);
  const rows: DecompRow[] = [
    { label: "Plusvalía", value: "+" + fmtCompact(plusvalia, currency, valorUF), widthPct: Math.max((plusvalia / maxBar) * 100, 2), tone: "strong" },
    { label: "Amortización", value: "+" + fmtCompact(amort, currency, valorUF), widthPct: Math.max((amort / maxBar) * 100, 2), tone: "mid" },
    { label: "Flujo 10 años", value: signCompact(flujo, currency, valorUF), widthPct: Math.max((Math.abs(flujo) / maxBar) * 100, 2), tone: flujoResta ? "red" : "weak" },
  ];

  return (
    <div>
      <Lead>
        La{" "}
        <Jerga
          term="TIR"
          gloss="la rentabilidad anual de toda tu inversión"
          tip="TIR = rentabilidad anual de toda tu inversión, juntando caja, amortización y venta."
        />{" "}
        es {pctStr(tirPct)}
        {margen.tone === "red" ? ` — bajo el piso de ${pctStr(umbral)}. ` : `, sobre el piso de ${pctStr(umbral)}. `}
        {flujoResta
          ? "Pero acá hay una vuelta importante: uno de los tres motores del retorno —la caja, la plusvalía y la amortización— no suma, resta, y ese porcentaje ya lo trae descontado."
          : "Se arma de tres motores —la caja, la plusvalía y la amortización—; vale ver cuál lo carga."}
      </Lead>

      <Chips
        label="Tu retorno vs el piso"
        cells={[
          // El semáforo lo lleva el margen: una TIR bajo el piso no se destaca como positiva.
          { k: "Tu TIR", v: pctStr(tirPct), tone: margen.tone === "red" ? "plain" : "pos" },
          { k: "Piso exigible", v: pctStr(umbral) },
          { k: "Margen", v: margen.display, tone: margen.tone },
        ]}
        foot={
          flujoResta
            ? margen.tone === "red"
              ? `Quedas ${dec1(Math.abs(round1(margenPts)))} pts bajo el piso de ${pctStr(umbral)} — y eso ya con la caja negativa descontada, no antes.`
              : `Ese ${margen.display} es sobre el piso de ${pctStr(umbral)} — y está medido después de descontar la caja negativa, no antes. El ${pctStr(tirPct)} no es un retorno bruto que luego baja.`
            : `${pctStr(umbral)} es el mínimo que un crédito apalancado debe rendir para pagar el esfuerzo y la iliquidez de tener un depto.`
        }
      />

      <Decomp rows={rows} net={{ label: "Suma de los tres, en bruto", value: fmtCompact(bruto, currency, valorUF) }} />

      <VizPie>
        {flujoResta ? (
          <>
            Tu {pctStr(tirPct)} no viene de la caja — la caja <b>resta</b> {fmtCompact(Math.abs(flujo), currency, valorUF)} en
            el camino, porque el corto te saca plata cada mes. Lo levantan la plusvalía ({fmtCompact(plusvalia, currency, valorUF)})
            y la amortización ({fmtCompact(amort, currency, valorUF)}): juntas suman {fmtCompact(brutoSinFlujo, currency, valorUF)},
            y recién después baja a {fmtCompact(bruto, currency, valorUF)} cuando le restas la caja. El {pctStr(tirPct)} es la
            tasa sobre lo que queda al final —tras esa resta y los costos de vender—, no antes. Sin la resta de la
            caja, lo que terminas teniendo pasaría de <b>~{fmtCompact(net, currency, valorUF)} a ~{fmtCompact(netSinResta, currency, valorUF)}</b> — de{" "}
            {multStr(multActual)} a {multStr(multSinResta)} sobre lo que pusiste.
          </>
        ) : (
          <>
            El grueso de tu {pctStr(tirPct)} lo levantan la plusvalía ({fmtCompact(plusvalia, currency, valorUF)}) y la
            amortización ({fmtCompact(amort, currency, valorUF)}); la caja aporta {fmtCompact(flujo, currency, valorUF)}. Es un
            retorno con base operativa, no solo de valorización.
          </>
        )}
      </VizPie>
      <Box label="Qué pasa si falla" tone="red">
        Si la comuna no se aprecia, el {pctStr(tirPct)} se desploma: te quedas apoyado {flujoResta ? "solo en la amortización, con una caja que ya es negativa" : "en la amortización y una caja ajustada"}. A
        diferencia de una renta larga sana, este retorno depende fuerte de un supuesto a futuro — vale entrarle
        con los ojos abiertos.
      </Box>
      <Note>Motor Franco · escenario de venta a 10 años</Note>
    </div>
  );
}

// 8 · PATRIMONIO STR — self-liquidating con vuelta honesta por signo del flujo
export function DrawerPatrimonioStr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoPatrimonio;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const exit = results.exitScenario;
  // GRUPO B — guard: sin escenario de salida no hay amortización ni bolsillo que mostrar.
  if (!exit) {
    return <SinDatos>Datos insuficientes para el patrimonio a 10 años (aún no calculamos la venta a futuro de este análisis).</SinDatos>;
  }
  const anios = exit.yearVenta ?? 10; // GRUPO D — horizonte del exit STR, no un 10 hardcoded
  // EQUITY (rama motor-supuestos F2): `patrimonioCLP` (= exit.equityCLP) ya es EQUITY final —
  // lo que te queda en la mano al vender (neto de deuda y comisión, más flujo acumulado), NO la
  // ganancia encima del capital. El multiplicador es equity/aportado → ×1 = break-even, misma vara
  // que LTR. Copy y umbrales alineados a la card (patrimonio-hallazgo): <1 adverso · [1,2) borde ·
  // ≥2 favorable → la fraseCanonica de la card y este drawer dicen lo mismo.
  const patrimonio = v.patrimonioCLP;
  const aportado = v.aportadoCLP;
  const mult = v.multiplicador;
  const amort = Math.max(results.montoCredito - exit.saldoCreditoAlVender, 0);
  const flujoAcum = exit.flujoAcumuladoAlVender;
  const selfLiquidating = flujoAcum >= 0;
  // GRUPO D — el bolsillo STR sale de flujoAcumuladoAlVender, una acumulación NETA (mezcla
  // años + y −); un "$/mes" no sale limpio de lo persistido → se muestra SOLO el total (exacto).
  const bolsillo = Math.abs(Math.min(flujoAcum, 0));

  return (
    <div>
      <VProsa>
        El depto vale una cosa; lo tuyo es esa cifra menos la deuda que aún le debes al banco. A {anios}{" "}
        años, tras vender y saldar el crédito, esto es lo que te queda en la mano frente a lo que fuiste
        poniendo.
      </VProsa>

      {/* HERENCIA PARCIAL del diagrama de patrimonio LTR — medido, no supuesto. La barra de
          COMPOSICIÓN no se puede portar a STR por tres razones del shape persistido:
           · `metrics.pieCLP` no existe en STR (210/210 filas) ⇒ falta el primer segmento;
           · el equity STR incorpora `flujoAcumuladoAlVender`, negativo en 173 de 210 ⇒ el
             segmento sería negativo y la barra no cerraría;
           · la identidad no es estable entre filas: 168 cierran SIN el flujo acumulado y 39
             CON él, o sea hay dos convenciones conviviendo en lo ya persistido.
          Queda la comparación de dos totales, que sí es afirmable con estos datos y es la
          misma forma aprobada para el caso multiplicador < 1 en LTR. */}
      <VViz t="Lo que pusiste contra lo que te queda">
        <Bars
          rows={[
            {
              k: "Pusiste",
              v: fmtMoney(aportado, currency, valorUF),
              pct: aportado >= patrimonio ? 100 : (aportado / Math.max(patrimonio, 1)) * 100,
            },
            {
              k: `Te queda a ${anios} años`,
              v: fmtMoney(patrimonio, currency, valorUF),
              pct: patrimonio >= aportado ? 100 : (patrimonio / Math.max(aportado, 1)) * 100,
              destacada: mult < 1,
            },
          ]}
        />
        <div className="compo-total" style={{ marginTop: 10 }}>
          <span className="k">Multiplicas lo que pusiste por</span>
          <span className="v">{multStr(mult)}</span>
        </div>
      </VViz>

      {selfLiquidating ? (
        <Box label="La deuda que se paga sola">
          El arriendo amortiza <b>{fmtCompact(amort, currency, valorUF)}</b> del crédito en {anios} años, y el
          flujo te queda a favor: no pusiste plata extra para bajar la deuda. El inquilino te construye patrimonio.
        </Box>
      ) : (
        <Box label="Acá la deuda NO se paga sola" tone="red">
          El arriendo sí amortiza <b>{fmtCompact(amort, currency, valorUF)}</b> del crédito en {anios} años — esa
          parte trabaja a tu favor. Pero como el flujo es negativo, no alcanza a cubrir toda la cuota: pusiste{" "}
          <b>{fmtCompact(bolsillo, currency, valorUF)}</b> de tu bolsillo en el camino. La deuda baja, sí, pero en
          parte la pagas tú, no solo el inquilino.
        </Box>
      )}
      <Box label="Qué significa">
        {mult >= 2
          ? `Multiplicas por ${dec1(mult).replace(",0", "")} lo que pusiste, apalancado por dos motores: la deuda que el arriendo amortiza y la plusvalía proyectada. `
          : mult >= 1
            ? `Terminas con más de lo que pusiste (${multStr(mult)}), pero el margen es acotado y buena parte se apoya en la plusvalía proyectada (la ves en el drawer de plusvalía). `
            : `Terminas con menos de lo que pusiste (${multStr(mult)}): ni lo que amortizas ni la plusvalía proyectada alcanzan a devolverte lo que fuiste aportando. `}
        {selfLiquidating
          ? "Tu parte se construye con caja a favor, que es lo más firme."
          : "Además el flujo es negativo: tu parte se construye a pesar de la caja, no gracias a ella."}
      </Box>
    </div>
  );
}

// 9 · PLUSVALÍA STR — misma plantilla, nervio del deal cuando la caja es negativa
export function DrawerPlusvaliaStr({
  hallazgo,
  results,
  currency,
  valorUF,
  comuna,
}: {
  hallazgo: HallazgoPlusvalia;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
  comuna: string;
}) {
  const v = hallazgo.valor;
  const exit = results.exitScenario;
  // Multiplicador de ESTADO desde el hallazgo patrimonio (única fuente de verdad). Si falta
  // el hallazgo, el guard decide (SinDatos), sin fallback a recompute. Desde F2: STR es
  // EQUITY (equity/aportado → ×1 break-even), misma vara que LTR.
  const pat = results.hallazgos?.find((h): h is HallazgoPatrimonio => h.id === "patrimonio");
  // GRUPO B — guard: el stress y la lectura de la caja necesitan exit; el estado, el hallazgo.
  if (!exit || !pat) {
    return <SinDatos>Datos insuficientes para el detalle de plusvalía (aún no calculamos la venta a futuro de este análisis).</SinDatos>;
  }
  const anual = v.anualizadaPct;
  const umbral = v.refPct;
  const comunaLabel = comuna || "la comuna";
  const cajaNegativa = exit.flujoAcumuladoAlVender < 0;
  const historicoNegativo = round1(anual) < 0; // GRUPO C

  const precioCLP = results.pie + results.montoCredito;
  const plusvaliaProj = Math.max(exit.valorVenta - precioCLP, 0);
  const multActual = pat.valor.multiplicador; // estado (hallazgo)
  const multSinPlus = pat.valor.aportadoCLP > 0 ? (pat.valor.patrimonioCLP - plusvaliaProj) / pat.valor.aportadoCLP : 0; // escenario derivado (misma base cruda)
  // El cierre habla en PESOS (misma vara que las barras); los multiplicadores siguen
  // vivos solo como gate anti-no-op del contrafáctico.
  const sinPlusCLP = pat.valor.patrimonioCLP - plusvaliaProj;
  // GRUPO C anti-no-op: round1(hallazgo) vs round1(derivado).
  const contrafactualVisible = round1(multActual) !== round1(multSinPlus);
  const tieneData = v.tieneData;
  // v.fuente = procedencia histórica real (F4), fuente única de verdad; fallback defensivo al
  // literal para filas pre-regen (v.fuente con texto del umbral). Idéntico al drawer LTR.
  const fuenteHist = (v.fuente && !/umbral/i.test(v.fuente))
    ? v.fuente
    : fuenteHistoricaPlusvalia(comuna, tieneData);
  // FIX-7 — cierre de caja negativa ramificado por caso: "la historia no respalda" solo es cierto
  // con histórico negativo. Con histórico que sí respalda (positivo) o sin dato comunal, cambia.
  const cierreCaja = !cajaNegativa
    ? ""
    : historicoNegativo
      ? " Con la caja también negativa, el deal descansa completo en un supuesto que la historia de la comuna no respalda."
      : tieneData
        ? " Con la caja también negativa, el deal descansa completo en que esa valorización se sostenga los próximos diez años."
        : " Con la caja también negativa, el deal descansa completo en ese supuesto de referencia — sin dato comunal que lo respalde.";

  return (
    <div>
      <VProsa>
        {historicoNegativo ? (
          <>
            La{" "}
            <Jerga term="plusvalía" gloss="cuánto sube de precio el depto con los años" tip="Plusvalía = cuánto sube de precio el depto con los años." />{" "}
            suele sostener el retorno a largo plazo, pero acá el histórico juega en contra: {comunaLabel} viene
            retrocediendo un {pctStr(Math.abs(anual))} real anual
            {cajaNegativa ? " — y con la caja también negativa, el deal se apoya en un supuesto que la historia no respalda." : "."}
          </>
        ) : (
          <>
            {cajaNegativa ? "En este deal la " : "La "}
            <Jerga term="plusvalía" gloss="cuánto sube de precio el depto con los años" tip="Plusvalía = cuánto sube de precio el depto con los años." />{" "}
            {cajaNegativa
              ? "no es un extra: es el motor que sostiene todo el retorno, porque la caja es negativa. Por eso importa doble de dónde sale."
              : "aporta al retorno a largo plazo. Conviene mirar de dónde sale el número y qué tan garantizado está."}
          </>
        )}
      </VProsa>

      <PlusvaliaEje
        anual={anual}
        umbral={umbral}
        gapPts={v.gapPts}
        tieneData={tieneData}
        comunaLabel={comunaLabel}
        cobertura={v.cobertura}
        nivelUfM2={v.nivelUfM2}
        nivelPeriodo={v.nivelPeriodo}
      />

      <PlusvaliaRetorno
        aportadoCLP={pat.valor.aportadoCLP}
        patrimonioCLP={pat.valor.patrimonioCLP}
        plusvaliaProj={plusvaliaProj}
        currency={currency}
        valorUF={valorUF}
      />

      {/* CIERRE ÚNICO — espejo exacto del LTR: la procedencia al VFuente, la
          advertencia al pie del eje, el stress en PESOS como cierre. */}
      {/* Título ROTATIVO del vocabulario: "Ojo con el supuesto" / "Qué pasa si se
          detiene" eran los rótulos de las cajas viejas. Las dos ramas INTERPRETAN
          (no accionan), así que ambas son "Qué significa". */}
      <VCierre titulo="Qué significa">
        {contrafactualVisible ? (
          <>
            {historicoNegativo
              ? `Pese al retroceso histórico, la proyección a 10 años igual valoriza el depto — es un supuesto del modelo, no el histórico de ${comunaLabel}. `
              : cajaNegativa
                ? "Acá está el nervio del deal: "
                : ""}
            {sinPlusCLP <= 0 ? (
              <>
                <mark>
                  Si {comunaLabel} deja de apreciarse, no recuperas ni lo aportado
                </mark>
                : de los {fmtCompact(pat.valor.aportadoCLP, currency, valorUF)} que pusiste, el
                resultado neto queda en rojo.
              </>
            ) : (
              <>
                <mark>
                  Si {comunaLabel} deja de apreciarse, tu parte cae a{" "}
                  {fmtCompact(sinPlusCLP, currency, valorUF)} sobre los{" "}
                  {fmtCompact(pat.valor.aportadoCLP, currency, valorUF)} que pusiste
                </mark>
                {sinPlusCLP < pat.valor.aportadoCLP
                  ? " — terminarías con menos de lo que aportaste."
                  : ", y buena parte de lo que ganas se apoya en ese supuesto."}
              </>
            )}
            {cierreCaja}
          </>
        ) : (
          <>
            <mark>La proyección no le carga retorno relevante a la valorización</mark>: lo que ves en
            TIR y patrimonio se sostiene del arriendo y la amortización.
          </>
        )}
      </VCierre>

      <VFuente>
        {fuenteHist}
        {tieneData ? ` · ${comunaLabel}` : ""}
      </VFuente>
    </div>
  );
}

// 10 · ESTRUCTURA COSTOS STR — drawer propio (deja de compartir rentabilidad)
export function DrawerEstructuraCostosStr({
  hallazgo,
  results,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoEstructuraCostosStr;
  results: ShortTermResult;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const base = results.escenarios?.base;
  const bruto = base?.ingresoBrutoMensual ?? 0;
  // GRUPO B — guard por dato crítico: sin ingreso bruto, el "de cada $100" no tiene base.
  if (!(bruto > 0)) {
    return <SinDatos>Datos insuficientes para el desglose de costos (falta el ingreso bruto del escenario base).</SinDatos>;
  }
  const costosOp = base?.costosOperativos ?? 0;
  const comision = base?.comisionMensual ?? 0;
  // GRUPO E — el "flujo de hoy" sale de la MISMA fuente que Financiamiento y Sostenibilidad
  // (escenario base), no de str_auto. str_auto/str_admin quedan SOLO para el contraste de gestión.
  const flujoHoy = base?.flujoCajaMensual ?? 0;
  const seVa = Math.round(v.costStackPct);
  const queda = 100 - seVa;
  // GRUPO A — clasifica sobre el ENTERO mostrado ($seVa), no sobre el crudo.
  const dentroDeVara = seVa <= v.bandaAdvPct;

  // GRUPO E — el contraste gestionas-tú vs administrador necesita ambos escenarios;
  // sin uno de los dos NO se mezclan fuentes: se omite el box completo.
  const strAuto = results.comparativa?.str_auto;
  const strAdmin = results.comparativa?.str_admin;
  const gestionComparable = !!strAuto && !!strAdmin;
  // Reparto real sobre el bruto (no el redondeo de `seVa`, que es el total mostrado).
  const pctOper = (costosOp / bruto) * 100;
  const pctCom = (comision / bruto) * 100;
  const comisionMax = Math.max(strAuto?.comisionMensual ?? 0, strAdmin?.comisionMensual ?? 0);

  return (
    <div>
      <VProsa>
        De cada $100 que entran por noches arrendadas, una parte se va en operar el depto antes de que veas un
        peso de utilidad. Cuánto se va decide si el corto respira o no.
      </VProsa>

      {/* TECHO DE PLAUSIBILIDAD — con un costStack sobre 150 el dato es de escala corrupta
          (el parque tiene un caso de 16.176%): dibujar una barra de $100 le daría apariencia
          de medición a un número roto. El techo es paliativo de RENDER, no arregla el dato:
          la calidad de ese input se mira aparte. */}
      {seVa > TECHO_COSTSTACK ? (
        <VProsa>
          El desglose de costos de este análisis da {seVa}% del ingreso bruto, una cifra que no es plausible
          para una renta corta: hay un problema en los datos de entrada, no en el negocio. No mostramos el
          reparto hasta poder verificarlo.
        </VProsa>
      ) : (
        <VViz t="De cada $100 brutos que factura al mes">
          <Cien
            segmentos={[
              {
                k: "Operación",
                sub: "aseo, servicios, insumos",
                v: `$${Math.round(pctOper)}`,
                pct: pctOper,
                tono: "oper",
              },
              {
                k: "Comisión de gestión",
                sub: gestionComparable && strAuto ? "administrándolo tú" : undefined,
                v: `$${Math.round(pctCom)}`,
                pct: pctCom,
                tono: "com",
              },
              ...(queda > 0
                ? [
                    {
                      k: "Queda operativo",
                      sub: "antes del dividendo",
                      v: `$${queda}`,
                      pct: queda,
                      tono: "util" as const,
                    },
                  ]
                : []),
            ]}
            banda={{ desde: v.bandaFavPct, hasta: v.bandaAdvPct, label: `vara típica $${v.bandaFavPct}–$${v.bandaAdvPct}` }}
            cortePct={Math.min(seVa, 100)}
            corteLabel={`$${seVa}`}
            desborde={seVa >= 100}
          />
        </VViz>
      )}

      {/* Segundo diagrama: la palanca de gestión. Sin los dos escenarios NO se dibuja
          (el guard ya existía) — no se mezclan fuentes para completar una comparación. */}
      {gestionComparable && strAuto && strAdmin && (
        <VViz t="La única palanca real: quién administra">
          <ParBarras
            cap="Comisión mensual · y el flujo que resulta"
            filas={[
              {
                k: "Lo administras tú",
                consecuencia: `${fmtMoneySigned(strAuto.flujoCajaMensual, currency, valorUF)}/mes`,
                v: fmtMoney(strAuto.comisionMensual, currency, valorUF),
                pct: comisionMax > 0 ? (strAuto.comisionMensual / comisionMax) * 100 : 0,
              },
              {
                k: "Administrador profesional",
                consecuencia: `${fmtMoneySigned(strAdmin.flujoCajaMensual, currency, valorUF)}/mes`,
                v: fmtMoney(strAdmin.comisionMensual, currency, valorUF),
                pct: comisionMax > 0 ? (strAdmin.comisionMensual / comisionMax) * 100 : 0,
                destacada: true,
              },
            ]}
          />
        </VViz>
      )}

      <VCierre titulo="Qué significa">
        {seVa <= TECHO_COSTSTACK
          ? `${seVa}% está ${dentroDeVara ? "dentro de lo típico" : "sobre la vara típica"} para una renta corta — ${dentroDeVara ? "no es acá donde se rompe el deal" : "acá sí hay grasa que recortar"}.`
          : "Con el desglose en duda, lo único afirmable es el flujo del escenario base."}
        {flujoHoy < 0
          ? dentroDeVara
            ? " El problema del flujo negativo viene de la ocupación y la cuota, no de costos inflados. Cada punto que bajes de comisión o servicios va directo a tu bolsillo, pero no esperes que un recorte de costos dé vuelta el mes."
            : " Acá los costos inflados son parte del problema: recortarlos ayuda de verdad. Pero con esta cuota y esta ocupación, no esperes que solo ese recorte dé vuelta el mes."
          : dentroDeVara
            ? " Cada punto que bajes de comisión o servicios va directo a tu bolsillo."
            : " Los costos están sobre la vara: recortarlos mejora directo tu bolsillo — es la palanca más limpia acá."}
        {gestionComparable && strAuto && strAdmin
          ? ` Y la gestión sí mueve la aguja: tercerizarla se come ${fmtMoney(Math.abs(strAdmin.comisionMensual - strAuto.comisionMensual), currency, valorUF)} al mes.`
          : ""}
      </VCierre>

      <Note>Motor Franco · escenario base</Note>
    </div>
  );
}

// ── DISTANCIA AL VEREDICTO STR — "lo que te separa" ──────────────────────────
// Port del `DrawerDistanciaLtr`. Cambian tres cosas, y ninguna es cosmética:
//   · dos vías que LTR no tiene (la tarifa por noche y el modo de gestión);
//   · la tarifa se marca como APUESTA, no como ajuste — el número de referencia sale de
//     lo que se cobra realmente en la zona, así que pedir superarlo es asumir un riesgo,
//     no corregir un supuesto optimista del usuario;
//   · el caso PURO-GATE, que en LTR no existe: cuando el puntaje ya alcanza la banda de
//     arriba, abrir con "estás cerca del borde" sería falso. Se nombra primero lo que
//     retiene el veredicto y recién después la vía que lo suelta.
export function DrawerDistanciaStr({
  hallazgo,
  currency,
  valorUF,
}: {
  hallazgo: HallazgoDistanciaVeredicto;
  currency: Currency;
  valorUF: number;
}) {
  const v = hallazgo.valor;
  const base = v.veredictoBase;
  const objetivo = v.veredictoObjetivo;

  const { filas, noProbadas } = construirPalancas(v, currency, valorUF, true);
  const tieneAdr = v.palancas.some((l) => l.palanca === "adr");
  const tieneGestion = v.palancas.some((l) => l.palanca === "gestion");
  const primera = v.palancas[0]?.palanca;

  // ── ESTRUCTURAL SIN DELTA MÍNIMO ── ni una magnitud real que dibujar (2 filas STR
  // en el parque). No se inventa matriz: queda la prosa.
  if (v.esEstructural && filas.length === 0) {
    return (
      <div>
        <VProsa>
          Tu veredicto es {base}. Probamos las vías una por una y ninguna llega a {objetivo}, ni
          llevándolas a extremos que ya no son negociación: tarifa al doble, precio a un tercio, crédito a
          30 años.
        </VProsa>
        <VCierre titulo="Qué significa">
          <mark>La brecha no está en cómo estás mirando este departamento — está en el departamento.</mark>{" "}
          Ajustar supuestos sirve cuando el número está cerca; acá el esfuerzo que pide es de otro orden.
        </VCierre>
      </div>
    );
  }

  return (
    <div>
      <VProsa>
        {v.esEstructural
          ? `Tu veredicto es ${base}. La pregunta honesta no es qué falta, sino si hay algo que alcance: probamos las palancas una por una, hasta donde dejan de ser un ajuste y pasan a ser otro departamento.`
          : v.vias && v.vias.length > 0 && !v.esPuroGate
            // T1: con `vias` la intro cuenta las vías reales (cinco en STR), la misma frase que LTR.
            ? introModalVias(v.palancas.length, v.vias.length, objetivo)
          : v.esPuroGate
            ? `Tu puntaje ya da para ${objetivo}: lo que retiene el veredicto en ${base} no son puntos, es que la operación todavía no cierra. Estas son las vías que la dan vuelta, cada una por su cuenta: no se suman, cualquiera alcanza.`
            : `Tu veredicto es ${base} y está cerca del borde de arriba. Estas son las vías que lo cruzan a ${objetivo}, cada una por su cuenta: no se suman, cualquiera alcanza.`}
      </VProsa>

      {/* D-01(c) — el v12 congelado NO admite prosa entre VViz y VCierre (las
          secuencias del mockup son [prosa] → viz → cierre → fuente): este caveat de
          la tarifa sube ANTES de la matriz. Sigue siendo prosa legítima — ningún
          diagrama dice esto. */}
      {tieneAdr && !v.esEstructural && !v.vias && (
        <VProsa>
          Ojo con la tarifa: la de referencia no es un supuesto nuestro, sale de lo que se cobra realmente
          alrededor. Pedirte que la superes no es ajustar un número optimista, es apostar a que vas a rendir
          sobre la mediana de tu zona. Se puede —mejores fotos, calendario bien manejado, respuesta rápida—,
          pero es trabajo tuyo sostenido, no un dato que cambia.
        </VProsa>
      )}

      {v.pieExcluidoPorBono && (
        <VProsa>
          El pie no aparece entre las vías porque lo cubre la inmobiliaria: subirlo no es una palanca, es
          deshacer el trato que estás evaluando. Con el pie cubierto, el precio se mira con más dureza,
          porque alguien está pagando ese bono.
        </VProsa>
      )}

      <VViz t={`Qué pediría cada palanca para llegar a ${objetivo}`}>
        <Palancas
          filas={filas}
          pie={
            v.esEstructural
              ? "Es la vía menos exigente de todas las que probamos, y aun así queda fuera de rango. Las demás piden más."
              : noProbadas.length > 0
                ? `Probamos también ${noProbadas.join(", ")}: ninguna cruza dentro de lo razonable.`
                : tieneGestion
                  ? "Cambiar el modo de gestión es la única que no te cuesta plata ni depende de nadie más: es la misma propiedad con otra estructura de comisión."
                  : undefined
          }
        />
      </VViz>

      <VCierre titulo={v.esEstructural ? "Qué significa" : "Qué haces con esto"}>
        {v.esEstructural ? (
          <>
            <mark>La brecha no está en cómo estás mirando este departamento — está en el departamento.</mark>{" "}
            Ajustar supuestos sirve cuando el número está cerca; acá el esfuerzo que pide es de otro orden.{" "}
            {v.piePctActual === 0
              ? "Sigue buscando: con financiamiento 100% no tienes colchón para absorberlo."
              : "Guarda el pie para el siguiente."}{" "}
            Si igual quieres avanzar por razones que no son financieras, está bien saberlo — pero no te
            cuentes que los números dan.
          </>
        ) : primera === "pie" ? (
          <><mark>Esta no se negocia con nadie: es plata tuya contra menos crédito.</mark> Antes de
          descartar el departamento, confirma con el banco cuánto baja la cuota con ese pie y si tienes
          la liquidez sin quedarte sin colchón.</>
        ) : primera === "gestion" ? (
          <><mark>Esta la decides tú y no cuesta capital.</mark> Antes de moverla, mira qué estás
          entregando a cambio: gestionar tú significa responder huéspedes, coordinar aseo y sostener el
          calendario todas las semanas.</>
        ) : primera === "precio" ? (
          <>Llévalo a la mesa: <mark>la diferencia está en rango de negociación, no en otro
          departamento</mark>. Si el vendedor no baja, ya sabes exactamente cuánto te separa.</>
        ) : (
          <>Antes de decidir, mira qué se cobra hoy por noche en propiedades comparables de tu zona.
          Si tu departamento no tiene con qué diferenciarse, <mark>esa tarifa es una apuesta y no un
          plan</mark>.</>
        )}
      </VCierre>

      <Note>Motor Franco · palancas del veredicto, una a la vez</Note>
    </div>
  );
}
